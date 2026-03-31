import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import type { Deck, Card, Rating } from '../types'
import {
  getPriority,
  DEFAULT_EXPLANATION_DISPLAY,
  DEFAULT_AUTO_ADVANCE,
  DEFAULT_REVIEW_INTERVAL,
  determineCardStatus,
  calculateNextReview,
} from '../types'
import {
  getLatestRecord,
  addStudyRecord,
  getCardSRS,
  updateCardSRS,
  getReviewDueCards,
} from '../utils/storage'

interface Props {
  decks: Deck[]
  cards: Card[]
}

type Step = 'question' | 'answer' | 'explanation' | 'done' | 'retest_intro' | 'retest'
type StudyMode = 'all' | 'unmastered' | 'review'

export default function StudyPage({ decks, cards }: Props) {
  const { deckId } = useParams<{ deckId: string }>()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const mode = (searchParams.get('mode') || 'all') as StudyMode
  const deck = decks.find(d => d.id === deckId)

  const deckCards = useMemo(() => {
    const all = cards.filter(c => c.deckId === deckId)
    if (mode === 'unmastered') {
      return all.filter(c => {
        const srs = getCardSRS(c.id)
        return !srs || srs.status === 'unmastered' || srs.status === 'new'
      })
    }
    if (mode === 'review') {
      const reviewIds = new Set(getReviewDueCards(all.map(c => c.id)))
      return all.filter(c => reviewIds.has(c.id))
    }
    return all
  }, [cards, deckId, mode])

  const [step, setStep] = useState<Step>('question')
  const [selfRating, setSelfRating] = useState<Rating | null>(null)
  const [, setAnswerRating] = useState<Rating | null>(null)
  const [isFlipped, setIsFlipped] = useState(false)
  const [skipTransition, setSkipTransition] = useState(false)

  // 未定着カードの再テスト用
  const [unmasteredIds, setUnmasteredIds] = useState<Set<string>>(new Set())
  const [retestCards, setRetestCards] = useState<Card[]>([])
  const [retestIndex, setRetestIndex] = useState(0)
  const [isRetesting, setIsRetesting] = useState(false)

  // 自動コマ送り用
  const autoAdvanceConfig = deck?.autoAdvance ?? DEFAULT_AUTO_ADVANCE
  const autoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const sortedCards = useMemo(() => {
    const shuffled = [...deckCards].sort(() => Math.random() - 0.5)
    return shuffled.sort((a, b) => {
      const recA = getLatestRecord(a.id)
      const recB = getLatestRecord(b.id)
      const priA = recA ? getPriority(recA.selfRating, recA.answerRating) : 3
      const priB = recB ? getPriority(recB.selfRating, recB.answerRating) : 3
      return priA - priB
    })
  }, [deckCards])

  const [currentIndex, setCurrentIndex] = useState(0)
  const [studiedCount, setStudiedCount] = useState(0)
  const currentCard = isRetesting ? retestCards[retestIndex] : sortedCards[currentIndex]

  // 自動コマ送りタイマー
  useEffect(() => {
    if (autoTimerRef.current) {
      clearTimeout(autoTimerRef.current)
      autoTimerRef.current = null
    }

    if (autoAdvanceConfig.enabled && step === 'question' && !isRetesting) {
      autoTimerRef.current = setTimeout(() => {
        if (currentCard) {
          // 自動コマ送り: 未定着扱いで自動的に裏返す
          setSelfRating('wrong')
          setIsFlipped(true)
          setStep('answer')
        }
      }, autoAdvanceConfig.seconds * 1000)
    }

    return () => {
      if (autoTimerRef.current) {
        clearTimeout(autoTimerRef.current)
      }
    }
  }, [step, currentIndex, autoAdvanceConfig.enabled, autoAdvanceConfig.seconds, isRetesting, currentCard])

  const reviewConfig = deck?.reviewInterval ?? DEFAULT_REVIEW_INTERVAL

  const goNext = useCallback(() => {
    setSkipTransition(true)
    setIsFlipped(false)
    setSelfRating(null)
    setAnswerRating(null)

    requestAnimationFrame(() => {
      if (isRetesting) {
        // 再テストモード
        if (retestIndex + 1 < retestCards.length) {
          setRetestIndex(retestIndex + 1)
          setStep('retest')
        } else {
          setStep('done')
        }
      } else if (currentIndex + 1 < sortedCards.length) {
        setCurrentIndex(currentIndex + 1)
        setStep('question')
      } else {
        // メインセッション終了 → 未定着があれば再テスト
        if (unmasteredIds.size > 0) {
          const retestList = sortedCards.filter(c => unmasteredIds.has(c.id))
          setRetestCards(retestList.sort(() => Math.random() - 0.5))
          setRetestIndex(0)
          setStep('retest_intro')
        } else {
          setStep('done')
        }
      }
      requestAnimationFrame(() => {
        setSkipTransition(false)
      })
    })
  }, [currentIndex, sortedCards, isRetesting, retestIndex, retestCards, unmasteredIds])

  const handleSelfRate = (rating: Rating) => {
    setSelfRating(rating)
    setIsFlipped(true)
    setStep('answer')
  }

  const handleAnswerRate = (rating: Rating) => {
    setAnswerRating(rating)
    setStudiedCount(prev => prev + 1)

    // 学習記録を保存
    addStudyRecord(currentCard.id, {
      cardId: currentCard.id,
      selfRating: selfRating!,
      answerRating: rating,
      timestamp: Date.now(),
    })

    if (!isRetesting) {
      // SRS状態を更新
      const currentSRS = getCardSRS(currentCard.id)
      const currentStatus = currentSRS?.status ?? 'new'
      const newStatus = determineCardStatus(selfRating!, rating, currentStatus)

      const { nextReview, interval, consecutiveCorrect } = calculateNextReview(
        newStatus, currentSRS, reviewConfig
      )

      // 定着カードがミスした場合の間隔リセット
      const finalConsecutive = (
        currentStatus === 'mastered' && newStatus !== 'mastered' && reviewConfig.resetOnMistake
      ) ? 0 : consecutiveCorrect

      updateCardSRS(currentCard.id, {
        status: newStatus,
        interval,
        nextReview,
        consecutiveCorrect: finalConsecutive,
      })

      // 未定着カードを記録
      if (newStatus === 'unmastered') {
        setUnmasteredIds(prev => new Set(prev).add(currentCard.id))
      }
    }

    // 解説表示判定
    const display = deck?.explanationDisplay ?? DEFAULT_EXPLANATION_DISPLAY
    const shouldShow =
      (rating === 'correct' && display.correct) ||
      (rating === 'partial' && display.partial) ||
      (rating === 'wrong' && display.wrong)

    if (shouldShow) {
      setStep('explanation')
    } else {
      goNext()
    }
  }

  // 再テスト用: 簡易的な答え合わせ（状態は変わらない）
  const handleRetestRate = (rating: Rating) => {
    setAnswerRating(rating)
    setStudiedCount(prev => prev + 1)

    addStudyRecord(currentCard.id, {
      cardId: currentCard.id,
      selfRating: selfRating!,
      answerRating: rating,
      timestamp: Date.now(),
    })
    // 再テストではSRS状態を変更しない

    const display = deck?.explanationDisplay ?? DEFAULT_EXPLANATION_DISPLAY
    const shouldShow =
      (rating === 'correct' && display.correct) ||
      (rating === 'partial' && display.partial) ||
      (rating === 'wrong' && display.wrong)

    if (shouldShow) {
      setStep('explanation')
    } else {
      goNext()
    }
  }

  if (!deck) {
    return (
      <div className="page">
        <p>デッキが見つかりません</p>
        <button className="btn" onClick={() => navigate('/')}>戻る</button>
      </div>
    )
  }

  if (deckCards.length === 0) {
    return (
      <div className="page">
        <p>{mode === 'review' ? '復習するカードがありません' : 'カードがありません'}</p>
        <button className="btn" onClick={() => navigate(`/deck/${deckId}`)}>戻る</button>
      </div>
    )
  }

  // 再テスト導入画面
  if (step === 'retest_intro') {
    return (
      <div className="page study-done">
        <h1>未定着カードの確認</h1>
        <p>{unmasteredIds.size}枚の未定着カードをもう一度確認します</p>
        <p className="text-secondary">ここで正解しても定着にはなりません</p>
        <button
          className="btn btn-primary btn-large"
          onClick={() => {
            setIsRetesting(true)
            setStep('retest')
            setIsFlipped(false)
            setSelfRating(null)
            setAnswerRating(null)
          }}
        >
          確認を始める
        </button>
      </div>
    )
  }

  if (step === 'done') {
    return (
      <div className="page study-done">
        <h1>学習完了！</h1>
        <p>{studiedCount}枚のカードを学習しました</p>
        {isRetesting && <p className="text-secondary">未定着カードの確認も完了しました</p>}
        <button className="btn btn-primary btn-large" onClick={() => navigate(`/deck/${deckId}`)}>
          デッキに戻る
        </button>
        <button className="btn btn-large" onClick={() => {
          setCurrentIndex(0)
          setStudiedCount(0)
          setStep('question')
          setSelfRating(null)
          setAnswerRating(null)
          setIsFlipped(false)
          setUnmasteredIds(new Set())
          setRetestCards([])
          setRetestIndex(0)
          setIsRetesting(false)
        }}>
          もう一度
        </button>
      </div>
    )
  }

  // 用語タイプの表示
  const isTerm = deck.type === 'term' && deck.termConfig
  const termConfig = deck.termConfig
  const wordConfig = deck.wordConfig

  // 解説があるかどうか
  const hasExplanation = currentCard && (
    isTerm
      ? (termConfig?.explanationColumns?.length ?? 0) > 0 && currentCard.columns &&
        termConfig!.explanationColumns.some(ci => currentCard.columns![ci]?.trim())
      : currentCard.synonyms || currentCard.antonyms || currentCard.exampleEn || currentCard.exampleJa
  )

  const renderQuestionContent = () => {
    if (!currentCard) return null
    if (isTerm && termConfig && currentCard.columns) {
      return (
        <>
          {termConfig.questionColumns.map(colIdx => (
            <div key={colIdx} className="study-card-term-field">
              <span className="study-card-term-label">{termConfig.columnNames[colIdx] || `${colIdx + 1}列目`}</span>
              <span className="study-card-term-value">{currentCard.columns![colIdx] || ''}</span>
            </div>
          ))}
        </>
      )
    }
    return (
      <>
        <div className="study-card-word">{currentCard.word}</div>
        {currentCard.pronunciation && wordConfig?.pronunciationSide !== 'answer' && (
          <div className="study-card-pron">{currentCard.pronunciation}</div>
        )}
        {currentCard.etymology && wordConfig?.etymologySide !== 'answer' && (
          <div className="study-card-etymology">{currentCard.etymology}</div>
        )}
      </>
    )
  }

  const renderAnswerContent = () => {
    if (!currentCard) return null
    if (isTerm && termConfig && currentCard.columns) {
      return (
        <>
          <div className="study-card-word-small">
            {termConfig.questionColumns.map(ci => currentCard.columns![ci]).filter(Boolean).join(' / ')}
          </div>
          {termConfig.answerColumns.map(colIdx => (
            <div key={colIdx} className="study-card-term-field">
              <span className="study-card-term-label">{termConfig.columnNames[colIdx] || `${colIdx + 1}列目`}</span>
              <span className="study-card-term-value">{currentCard.columns![colIdx] || ''}</span>
            </div>
          ))}
        </>
      )
    }
    return (
      <>
        <div className="study-card-word-small">{currentCard.word}</div>
        {(() => {
          const parts = currentCard.meaning.split('\n')
          return (
            <>
              <div className="study-card-meaning">{parts[0]}</div>
              {parts[1] && <div className="study-card-pron">{parts[1]}</div>}
            </>
          )
        })()}
        {currentCard.pronunciation && wordConfig?.pronunciationSide === 'answer' && (
          <div className="study-card-pron">{currentCard.pronunciation}</div>
        )}
        {currentCard.etymology && wordConfig?.etymologySide === 'answer' && (
          <div className="study-card-etymology">{currentCard.etymology}</div>
        )}
      </>
    )
  }

  const totalCards = isRetesting ? retestCards.length : sortedCards.length
  const currentIdx = isRetesting ? retestIndex : currentIndex

  return (
    <div className="page study-page">
      <header className="study-header">
        <button className="btn-back" onClick={() => navigate(`/deck/${deckId}`)}>← 終了</button>
        <div className="study-progress">
          <span>
            {isRetesting && <span className="study-retest-badge">確認</span>}
            {currentIdx + 1} / {totalCards}
          </span>
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${((currentIdx) / totalCards) * 100}%` }} />
          </div>
        </div>
      </header>

      <div className="study-content">
        <div className="study-card-container">
          <div className={`study-card ${isFlipped ? 'flipped' : ''} ${skipTransition ? 'no-transition' : ''}`}>
            <div className="study-card-front">
              {renderQuestionContent()}
            </div>
            <div className="study-card-back">
              {renderAnswerContent()}
            </div>
          </div>
        </div>

        {/* 解説 */}
        {step === 'explanation' && hasExplanation && (
          <div className="explanation-section">
            {isTerm && termConfig && currentCard.columns ? (
              termConfig.explanationColumns.map(colIdx => {
                const val = currentCard.columns![colIdx]?.trim()
                if (!val) return null
                return (
                  <div key={colIdx} className="explanation-item">
                    <span className="explanation-label">
                      {termConfig.columnNames[colIdx] || `${colIdx + 1}列目`}:
                    </span> {val}
                  </div>
                )
              })
            ) : (
              <>
                {currentCard.definition && (
                  <div className="explanation-item explanation-definition">
                    <span className="explanation-label">語義:</span> {currentCard.definition}
                  </div>
                )}
                {currentCard.synonyms && (
                  <div className="explanation-item">
                    <span className="explanation-label">類義語:</span> {currentCard.synonyms}
                  </div>
                )}
                {currentCard.antonyms && (
                  <div className="explanation-item">
                    <span className="explanation-label">対義語:</span> {currentCard.antonyms}
                  </div>
                )}
                {currentCard.exampleEn && (
                  <div className="explanation-item">
                    <span className="explanation-label">例文:</span>
                    <span dangerouslySetInnerHTML={{ __html: formatBold(currentCard.exampleEn) }} />
                  </div>
                )}
                {currentCard.exampleJa && (
                  <div className="explanation-item">
                    <span className="explanation-label">訳:</span>
                    <span dangerouslySetInnerHTML={{ __html: formatBold(currentCard.exampleJa) }} />
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* ボタンエリア */}
      <div className="study-buttons">
        {(step === 'question' || step === 'retest') && (
          <>
            <p className="study-prompt">
              {isRetesting ? '覚えていますか？（確認のみ）' : '分かりますか？'}
            </p>
            <div className="rating-buttons">
              <button className="rating-btn rating-correct" onClick={() => handleSelfRate('correct')}>⭕️</button>
              <button className="rating-btn rating-partial" onClick={() => handleSelfRate('partial')}>🔺</button>
              <button className="rating-btn rating-wrong" onClick={() => handleSelfRate('wrong')}>❌</button>
            </div>
          </>
        )}
        {step === 'answer' && (
          <>
            <p className="study-prompt">合っていましたか？</p>
            <div className="rating-buttons">
              <button className="rating-btn rating-correct" onClick={() => (isRetesting ? handleRetestRate : handleAnswerRate)('correct')}>⭕️</button>
              <button className="rating-btn rating-partial" onClick={() => (isRetesting ? handleRetestRate : handleAnswerRate)('partial')}>🔺</button>
              <button className="rating-btn rating-wrong" onClick={() => (isRetesting ? handleRetestRate : handleAnswerRate)('wrong')}>❌</button>
            </div>
          </>
        )}
        {step === 'explanation' && (
          <button className="btn btn-primary btn-large btn-full" onClick={goNext}>
            次へ →
          </button>
        )}
      </div>
    </div>
  )
}

function formatBold(text: string): string {
  return text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
}
