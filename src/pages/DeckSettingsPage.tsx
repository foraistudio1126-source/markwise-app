import { useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import type { Deck, Card } from '../types'
import {
  DEFAULT_EXPLANATION_DISPLAY,
  DEFAULT_AUTO_ADVANCE,
  DEFAULT_REVIEW_INTERVAL,
} from '../types'
import { getCardSRS, loadHistory, saveHistory, loadSRS, saveSRS } from '../utils/storage'
import { exportToMarkdown, exportToMarkdownForTerm } from '../utils/markdown'
import InfoModal from '../components/InfoModal'

type MarkdownFilter = 'all' | 'mastered' | 'unmastered'

interface Props {
  decks: Deck[]
  cards: Card[]
  onAddDeck: (deck: Deck) => void
  onAddCards: (cards: Card[]) => void
  onUpdateCard: (id: string, updates: Partial<Card>) => void
  onUpdateDeck: (id: string, updates: Partial<Deck>) => void
}

export default function DeckSettingsPage({ decks, cards, onAddDeck, onAddCards, onUpdateCard, onUpdateDeck }: Props) {
  const { deckId } = useParams<{ deckId: string }>()
  const navigate = useNavigate()
  const deck = decks.find(d => d.id === deckId)
  const deckCards = cards.filter(c => c.deckId === deckId)

  const [mdFilter, setMdFilter] = useState<MarkdownFilter>('all')
  const [copied, setCopied] = useState(false)
  const [copyDeckDone, setCopyDeckDone] = useState(false)
  const [flipDone, setFlipDone] = useState(false)
  const [infoModal, setInfoModal] = useState<{ title: string; body: string } | null>(null)

  const masteredCards = useMemo(() =>
    deckCards.filter(c => {
      const srs = getCardSRS(c.id)
      return srs?.status === 'mastered'
    }), [deckCards])

  const unmasteredCards = useMemo(() =>
    deckCards.filter(c => {
      const srs = getCardSRS(c.id)
      return !srs || srs.status !== 'mastered'
    }), [deckCards])

  const filteredCards = useMemo(() => {
    if (mdFilter === 'mastered') return masteredCards
    if (mdFilter === 'unmastered') return unmasteredCards
    return deckCards
  }, [mdFilter, masteredCards, unmasteredCards, deckCards])

  const markdownText = useMemo(() => {
    if (deck?.type === 'term' && deck.termConfig) {
      return exportToMarkdownForTerm(filteredCards, deck.termConfig)
    }
    return exportToMarkdown(filteredCards)
  }, [filteredCards, deck])

  if (!deck) {
    return (
      <div className="page">
        <p>デッキが見つかりません</p>
        <button className="btn" onClick={() => navigate('/')}>戻る</button>
      </div>
    )
  }

  const handleCopyDeck = () => {
    const now = Date.now()
    const newDeckId = crypto.randomUUID()
    const newDeck: Deck = {
      id: newDeckId,
      name: `${deck.name}（コピー）`,
      type: deck.type,
      wordConfig: deck.wordConfig ? { ...deck.wordConfig } : undefined,
      termConfig: deck.termConfig ? { ...deck.termConfig, columnNames: [...deck.termConfig.columnNames], questionColumns: [...deck.termConfig.questionColumns], answerColumns: [...deck.termConfig.answerColumns], explanationColumns: [...(deck.termConfig.explanationColumns || [])] } : undefined,
      explanationDisplay: deck.explanationDisplay ? { ...deck.explanationDisplay } : undefined,
      autoAdvance: deck.autoAdvance ? { ...deck.autoAdvance } : undefined,
      reviewInterval: deck.reviewInterval ? { ...deck.reviewInterval } : undefined,
      createdAt: now,
      updatedAt: now,
    }
    const newCards: Card[] = deckCards.map(c => ({
      ...c,
      id: crypto.randomUUID(),
      deckId: newDeckId,
      columns: c.columns ? [...c.columns] : undefined,
      createdAt: now,
      updatedAt: now,
    }))
    onAddDeck(newDeck)
    onAddCards(newCards)
    setCopyDeckDone(true)
    setTimeout(() => navigate(`/deck/${newDeckId}`), 800)
  }

  const handleCopyMarkdown = async () => {
    try {
      await navigator.clipboard.writeText(markdownText)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      const ta = document.createElement('textarea')
      ta.value = markdownText
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleFlip = () => {
    if (!confirm('全カードの「問題面」と「答え面」を入れ替えます。学習履歴もリセットされます。よろしいですか？')) {
      return
    }

    if (deck.type === 'term' && deck.termConfig) {
      for (const card of deckCards) {
        if (card.columns) {
          const newWord = card.columns[deck.termConfig.answerColumns[0]] || ''
          const newMeaning = card.columns[deck.termConfig.questionColumns[0]] || ''
          onUpdateCard(card.id, { word: newWord, meaning: newMeaning })
        }
      }
    } else {
      for (const card of deckCards) {
        onUpdateCard(card.id, {
          word: card.meaning,
          meaning: card.pronunciation
            ? `${card.word}\n${card.pronunciation}`
            : card.word,
          pronunciation: '',
        })
      }
    }

    const history = loadHistory()
    const srsData = loadSRS()
    for (const card of deckCards) {
      delete history[card.id]
      delete srsData[card.id]
    }
    saveHistory(history)
    saveSRS(srsData)
    setFlipDone(true)
    setTimeout(() => setFlipDone(false), 2000)
  }

  const autoAdvance = deck.autoAdvance ?? DEFAULT_AUTO_ADVANCE
  const reviewInterval = deck.reviewInterval ?? DEFAULT_REVIEW_INTERVAL

  return (
    <div className="page">
      <header className="page-header">
        <button className="btn-back" onClick={() => navigate(`/deck/${deckId}`)}>← 戻る</button>
        <h1>設定</h1>
      </header>

      {/* ===== 編集セクション ===== */}
      <h2 className="settings-group-title">編集</h2>

      {/* 解説表示設定 */}
      <section className="settings-section">
        <div className="settings-section-header">
          <h2 className="settings-section-title"><span className="emoji-icon">💬</span> 解説の表示タイミング</h2>
          <button className="btn-info" onClick={() => setInfoModal({ title: '💬 解説の表示タイミング', body: '答え合わせ後、どの結果のときに解説を表示するか設定します。' })}>?</button>
        </div>
        {(['correct', 'partial', 'wrong'] as const).map(rating => {
          const display = deck.explanationDisplay ?? DEFAULT_EXPLANATION_DISPLAY
          const labels = { correct: '⭕️ 正解', partial: '🔺 惜しい', wrong: '❌ 不正解' }
          return (
            <label key={rating} className="settings-toggle-row">
              <span>{labels[rating]}</span>
              <input
                type="checkbox"
                checked={display[rating]}
                onChange={e => {
                  onUpdateDeck(deck.id, {
                    explanationDisplay: {
                      ...display,
                      [rating]: e.target.checked,
                    }
                  })
                }}
              />
            </label>
          )
        })}
      </section>

      {/* 表示面の設定（単語タイプのみ） */}
      {deck.type === 'word' && deck.wordConfig && (
        <section className="settings-section">
          <div className="settings-section-header">
            <h2 className="settings-section-title"><span className="emoji-icon">👀</span> 表示面の設定</h2>
            <button className="btn-info" onClick={() => setInfoModal({ title: '👀 表示面の設定', body: '発音記号・接頭辞・語源をどちらの面（問題面 or 答え面）に表示するか設定します。' })}>?</button>
          </div>
          <label className="settings-toggle-row">
            <span>発音記号</span>
            <select
              className="settings-side-select"
              value={deck.wordConfig.pronunciationSide}
              onChange={e => onUpdateDeck(deck.id, {
                wordConfig: { ...deck.wordConfig!, pronunciationSide: e.target.value as 'question' | 'answer' }
              })}
            >
              <option value="question">問題面</option>
              <option value="answer">答え面</option>
            </select>
          </label>
          <label className="settings-toggle-row">
            <span>接頭辞・語源</span>
            <select
              className="settings-side-select"
              value={deck.wordConfig.etymologySide}
              onChange={e => onUpdateDeck(deck.id, {
                wordConfig: { ...deck.wordConfig!, etymologySide: e.target.value as 'question' | 'answer' }
              })}
            >
              <option value="question">問題面</option>
              <option value="answer">答え面</option>
            </select>
          </label>
        </section>
      )}

      {/* 自動コマ送り */}
      <section className="settings-section">
        <div className="settings-section-header">
          <h2 className="settings-section-title"><span className="emoji-icon">⏱</span> 自動コマ送り</h2>
          <button className="btn-info" onClick={() => setInfoModal({ title: '⏱ 自動コマ送り', body: '設定した秒数後にカードを自動で裏返します。自動送りされたカードは未定着扱いになります。' })}>?</button>
        </div>
        <label className="settings-toggle-row">
          <span>自動コマ送り</span>
          <input
            type="checkbox"
            checked={autoAdvance.enabled}
            onChange={e => onUpdateDeck(deck.id, {
              autoAdvance: { ...autoAdvance, enabled: e.target.checked }
            })}
          />
        </label>
        {autoAdvance.enabled && (
          <label className="settings-toggle-row">
            <span>秒数</span>
            <input
              type="number"
              className="settings-number-input"
              min={1}
              max={120}
              value={autoAdvance.seconds}
              onChange={e => onUpdateDeck(deck.id, {
                autoAdvance: { ...autoAdvance, seconds: Math.max(1, parseInt(e.target.value) || 5) }
              })}
            />
          </label>
        )}
      </section>

      {/* 復習間隔設定 */}
      <section className="settings-section">
        <div className="settings-section-header">
          <h2 className="settings-section-title"><span className="emoji-icon">📅</span> 復習間隔</h2>
          <button className="btn-info" onClick={() => setInfoModal({ title: '📅 復習間隔', body: '定着したカードの復習間隔を設定します。「増加」モードでは正解するたびに間隔が延びていきます。' })}>?</button>
        </div>
        <label className="settings-toggle-row">
          <span>モード</span>
          <select
            className="settings-side-select"
            value={reviewInterval.mode}
            onChange={e => onUpdateDeck(deck.id, {
              reviewInterval: { ...reviewInterval, mode: e.target.value as 'fixed' | 'increasing' }
            })}
          >
            <option value="increasing">増加</option>
            <option value="fixed">固定</option>
          </select>
        </label>
        <label className="settings-toggle-row">
          <span>基本間隔（日）</span>
          <input
            type="number"
            className="settings-number-input"
            min={1}
            max={30}
            value={reviewInterval.baseDays}
            onChange={e => onUpdateDeck(deck.id, {
              reviewInterval: { ...reviewInterval, baseDays: Math.max(1, parseInt(e.target.value) || 1) }
            })}
          />
        </label>
        {reviewInterval.mode === 'increasing' && (
          <label className="settings-toggle-row">
            <span>上限（日）</span>
            <input
              type="number"
              className="settings-number-input"
              min={reviewInterval.baseDays}
              max={365}
              value={reviewInterval.maxDays}
              onChange={e => onUpdateDeck(deck.id, {
                reviewInterval: {
                  ...reviewInterval,
                  maxDays: Math.max(reviewInterval.baseDays, parseInt(e.target.value) || 7)
                }
              })}
            />
          </label>
        )}
        <label className="settings-toggle-row">
          <span>ミス時にリセット</span>
          <input
            type="checkbox"
            checked={reviewInterval.resetOnMistake}
            onChange={e => onUpdateDeck(deck.id, {
              reviewInterval: { ...reviewInterval, resetOnMistake: e.target.checked }
            })}
          />
        </label>
      </section>

      {/* ===== 外部セクション ===== */}
      <h2 className="settings-group-title">外部</h2>

      {/* デッキをコピー */}
      <section className="settings-section">
        <div className="settings-section-header">
          <h2 className="settings-section-title"><span className="emoji-icon">📋</span> デッキをコピー</h2>
          <button className="btn-info" onClick={() => setInfoModal({ title: '📋 デッキをコピー', body: `デッキとカード（${deckCards.length}枚）のコピーを作成します。学習履歴はコピーされません。` })}>?</button>
        </div>
        <button
          className="btn"
          onClick={handleCopyDeck}
          disabled={copyDeckDone}
        >
          {copyDeckDone ? '✅ コピー完了' : 'コピーを作成'}
        </button>
      </section>

      {/* カードを反転 */}
      <section className="settings-section">
        <div className="settings-section-header">
          <h2 className="settings-section-title"><span className="emoji-icon">🔄</span> カードを反転</h2>
          <button className="btn-info" onClick={() => setInfoModal({ title: '🔄 カードを反転', body: '全カードの「問題面」と「答え面」を入れ替えます。実行すると学習履歴がリセットされます。' })}>?</button>
        </div>
        <button
          className="btn btn-danger"
          onClick={handleFlip}
          disabled={deckCards.length === 0 || flipDone}
        >
          {flipDone ? '✅ 反転完了' : '反転する'}
        </button>
      </section>

      {/* Markdownにする */}
      <section className="settings-section">
        <div className="settings-section-header">
          <h2 className="settings-section-title"><span className="emoji-icon">📝</span> Markdownにする</h2>
          <button className="btn-info" onClick={() => setInfoModal({ title: '📝 Markdownにする', body: 'カードをMarkdown表に変換します。インポート形式と互換性があり、他のデッキへの移行やバックアップに使えます。' })}>?</button>
        </div>
        <div className="settings-filter-buttons">
          <button
            className={`btn btn-small ${mdFilter === 'all' ? 'btn-primary' : ''}`}
            onClick={() => setMdFilter('all')}
          >
            全体（{deckCards.length}）
          </button>
          <button
            className={`btn btn-small ${mdFilter === 'mastered' ? 'btn-primary' : ''}`}
            onClick={() => setMdFilter('mastered')}
          >
            定着済み（{masteredCards.length}）
          </button>
          <button
            className={`btn btn-small ${mdFilter === 'unmastered' ? 'btn-primary' : ''}`}
            onClick={() => setMdFilter('unmastered')}
          >
            未定着（{unmasteredCards.length}）
          </button>
        </div>
        {filteredCards.length > 0 ? (
          <>
            <textarea
              className="settings-markdown-area"
              readOnly
              value={markdownText}
              rows={8}
            />
            <button className="btn" onClick={handleCopyMarkdown}>
              {copied ? '✅ コピーしました' : 'クリップボードにコピー'}
            </button>
          </>
        ) : (
          <p className="settings-empty">該当するカードがありません</p>
        )}
      </section>

      {infoModal && <InfoModal title={infoModal.title} body={infoModal.body} onClose={() => setInfoModal(null)} />}
    </div>
  )
}
