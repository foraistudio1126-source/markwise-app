import { useState, useMemo, useCallback } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import type { Deck, Card, Rating } from '../types'
import { getPriority, DEFAULT_EXPLANATION_DISPLAY } from '../types'
import { getLatestRecord, addStudyRecord } from '../utils/storage'

interface Props {
  decks: Deck[]
  cards: Card[]
}

type Step = 'question' | 'answer' | 'explanation' | 'done'

export default function StudyPage({ decks, cards }: Props) {
  const { deckId } = useParams<{ deckId: string }>()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const mode = searchParams.get('mode')
  const deck = decks.find(d => d.id === deckId)
  const deckCards = useMemo(() => {
    const all = cards.filter(c => c.deckId === deckId)
    if (mode === 'unmastered') {
      return all.filter(c => {
        const r = getLatestRecord(c.id)
        return !r || r.answerRating !== 'correct'
      })
    }
    return all
  }, [cards, deckId, mode])

  const [step, setStep] = useState<Step>('question')
  const [selfRating, setSelfRating] = useState<Rating | null>(null)
  const [, setAnswerRating] = useState<Rating | null>(null)
  const [isFlipped, setIsFlipped] = useState(false)

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
  const currentCard = sortedCards[currentIndex]

  const [skipTransition, setSkipTransition] = useState(false)

  const goNext = useCallback(() => {
    setSkipTransition(true)
    setIsFlipped(false)
    setSelfRating(null)
    setAnswerRating(null)

    requestAnimationFrame(() => {
      if (currentIndex + 1 < sortedCards.length) {
        setCurrentIndex(currentIndex + 1)
        setStep('question')
      } else {
        setStep('done')
      }
      requestAnimationFrame(() => {
        setSkipTransition(false)
      })
    })
  }, [currentIndex, sortedCards.length])

  const handleSelfRate = (rating: Rating) => {
    setSelfRating(rating)
    setIsFlipped(true)
    setStep('answer')
  }

  const handleAnswerRate = (rating: Rating) => {
    setAnswerRating(rating)
    setStudiedCount(prev => prev + 1)

    addStudyRecord(currentCard.id, {
      cardId: currentCard.id,
      selfRating: selfRating!,
      answerRating: rating,
      timestamp: Date.now(),
    })

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
        <p>カードがありません</p>
        <button className="btn" onClick={() => navigate(`/deck/${deckId}`)}>戻る</button>
      </div>
    )
  }

  if (step === 'done') {
    return (
      <div className="page study-done">
        <h1>学習完了！</h1>
        <p>{studiedCount}枚のカードを学習しました</p>
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
        }}>
          もう一度
        </button>
      </div>
    )
  }

  // 用語タイプの表示
  const isTerm = deck.type === 'term' && deck.termConfig
  const termConfig = deck.termConfig

  // 単語タイプの設定
  const wordConfig = deck.wordConfig

  // 解説があるかどうか
  const hasExplanation = isTerm
    ? (termConfig?.explanationColumns?.length ?? 0) > 0 && currentCard.columns &&
      termConfig!.explanationColumns.some(ci => currentCard.columns![ci]?.trim())
    : currentCard.synonyms || currentCard.antonyms || currentCard.exampleEn || currentCard.exampleJa

  // 問題面・答え面のコンテンツ生成
  const renderQuestionContent = () => {
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

    // 単語タイプ
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

    // 単語タイプ
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

  return (
    <div className="page study-page">
      <header className="study-header">
        <button className="btn-back" onClick={() => navigate(`/deck/${deckId}`)}>← 終了</button>
        <div className="study-progress">
          <span>{currentIndex + 1} / {sortedCards.length}</span>
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${((currentIndex) / sortedCards.length) * 100}%` }} />
          </div>
        </div>
      </header>

      <div className="study-content">
        <div className="study-card-container">
          <div className={`study-card ${isFlipped ? 'flipped' : ''} ${skipTransition ? 'no-transition' : ''}`}>
            {/* 問題面 */}
            <div className="study-card-front">
              {renderQuestionContent()}
            </div>
            {/* 答え面 */}
            <div className="study-card-back">
              {renderAnswerContent()}
            </div>
          </div>
        </div>

        {/* 解説（Step 3） */}
        {step === 'explanation' && hasExplanation && (
          <div className="explanation-section">
            {isTerm && termConfig && currentCard.columns ? (
              // 用語タイプ: 解説面の列を表示
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
              // 単語タイプ
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
        {step === 'question' && (
          <>
            <p className="study-prompt">分かりますか？</p>
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
              <button className="rating-btn rating-correct" onClick={() => handleAnswerRate('correct')}>⭕️</button>
              <button className="rating-btn rating-partial" onClick={() => handleAnswerRate('partial')}>🔺</button>
              <button className="rating-btn rating-wrong" onClick={() => handleAnswerRate('wrong')}>❌</button>
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
