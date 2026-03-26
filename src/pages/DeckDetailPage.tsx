import { useParams, useNavigate } from 'react-router-dom'
import type { Deck, Card } from '../types'
import { DECK_TYPE_LABELS } from '../types'
import { getLatestRecord } from '../utils/storage'

interface Props {
  decks: Deck[]
  cards: Card[]
  onDeleteCard: (id: string) => void
}

export default function DeckDetailPage({ decks, cards, onDeleteCard }: Props) {
  const { deckId } = useParams<{ deckId: string }>()
  const navigate = useNavigate()
  const deck = decks.find(d => d.id === deckId)
  const deckCards = cards.filter(c => c.deckId === deckId)

  if (!deck) {
    return (
      <div className="page">
        <p>デッキが見つかりません</p>
        <button className="btn" onClick={() => navigate('/')}>戻る</button>
      </div>
    )
  }

  const mastered = deckCards.filter(c => {
    const r = getLatestRecord(c.id)
    return r?.answerRating === 'correct'
  }).length
  const percent = deckCards.length > 0 ? Math.round((mastered / deckCards.length) * 100) : 0

  const handleDeleteCard = (e: React.MouseEvent, card: Card) => {
    e.stopPropagation()
    if (confirm(`「${card.word}」を削除しますか？`)) {
      onDeleteCard(card.id)
    }
  }

  const isTerm = deck.type === 'term' && deck.termConfig

  return (
    <div className="page">
      <header className="page-header">
        <button className="btn-back" onClick={() => navigate('/')}>← 戻る</button>
        <div>
          <h1>{deck.name}</h1>
          <span className="deck-type-badge">{DECK_TYPE_LABELS[deck.type]}</span>
        </div>
      </header>

      {deckCards.length > 0 && (
        <div className="progress-section">
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${percent}%` }} />
          </div>
          <p className="progress-label">{mastered} / {deckCards.length} 定着済み（{percent}%）</p>
        </div>
      )}

      <div className="action-buttons">
        {deckCards.length > 0 && (
          <>
            <button
              className="btn btn-primary btn-large"
              onClick={() => navigate(`/study/${deckId}`)}
            >
              暗記を始める
            </button>
            {deckCards.length - mastered > 0 && (
              <button
                className="btn btn-large"
                onClick={() => navigate(`/study/${deckId}?mode=unmastered`)}
              >
                未定着のみ（{deckCards.length - mastered}枚）
              </button>
            )}
          </>
        )}
        <button
          className="btn"
          onClick={() => navigate(`/deck/${deckId}/add`)}
        >
          ＋ カードを追加
        </button>
        <button
          className="btn"
          onClick={() => navigate(`/deck/${deckId}/import`)}
        >
          📋 Markdownインポート
        </button>
        <button
          className="btn"
          onClick={() => navigate(`/deck/${deckId}/analytics`)}
        >
          📊 アナリティクス
        </button>
        <button
          className="btn"
          onClick={() => navigate(`/deck/${deckId}/settings`)}
        >
          ⚙️ 設定
        </button>
      </div>

      <div className="card-list">
        <h2>カード一覧（{deckCards.length}枚）</h2>
        {deckCards.length === 0 && (
          <div className="empty-state">
            <p>カードがありません</p>
          </div>
        )}
        {deckCards.map(card => {
          const record = getLatestRecord(card.id)
          const statusIcon = record
            ? record.answerRating === 'correct' ? '⭕️'
              : record.answerRating === 'partial' ? '🔺'
              : '❌'
            : '—'

          // 用語タイプの場合、問題面の列を表示
          const displayWord = isTerm && card.columns && deck.termConfig
            ? deck.termConfig.questionColumns.map(ci => card.columns![ci]).filter(Boolean).join(' / ')
            : card.word
          const displayMeaning = isTerm && card.columns && deck.termConfig
            ? deck.termConfig.answerColumns.map(ci => card.columns![ci]).filter(Boolean).join(' / ')
            : card.meaning

          return (
            <div
              key={card.id}
              className="card-item"
              onClick={() => navigate(`/deck/${deckId}/edit/${card.id}`)}
            >
              <div className="card-item-main">
                <span className="card-word">{displayWord}</span>
                <span className="card-meaning">{displayMeaning}</span>
              </div>
              <div className="card-item-actions">
                <span className="card-status">{statusIcon}</span>
                <button className="btn-icon" onClick={e => handleDeleteCard(e, card)} title="削除">🗑️</button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
