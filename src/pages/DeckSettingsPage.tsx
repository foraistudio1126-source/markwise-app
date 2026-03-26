import { useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import type { Deck, Card } from '../types'
import { getLatestRecord, loadHistory, saveHistory } from '../utils/storage'
import { exportToMarkdown, exportToMarkdownForTerm } from '../utils/markdown'

type MarkdownFilter = 'all' | 'mastered' | 'unmastered'

interface Props {
  decks: Deck[]
  cards: Card[]
  onAddDeck: (deck: Deck) => void
  onAddCards: (cards: Card[]) => void
  onUpdateCard: (id: string, updates: Partial<Card>) => void
}

export default function DeckSettingsPage({ decks, cards, onAddDeck, onAddCards, onUpdateCard }: Props) {
  const { deckId } = useParams<{ deckId: string }>()
  const navigate = useNavigate()
  const deck = decks.find(d => d.id === deckId)
  const deckCards = cards.filter(c => c.deckId === deckId)

  const [mdFilter, setMdFilter] = useState<MarkdownFilter>('all')
  const [copied, setCopied] = useState(false)
  const [copyDeckDone, setCopyDeckDone] = useState(false)
  const [flipDone, setFlipDone] = useState(false)

  const masteredCards = useMemo(() =>
    deckCards.filter(c => {
      const r = getLatestRecord(c.id)
      return r?.answerRating === 'correct'
    }), [deckCards])

  const unmasteredCards = useMemo(() =>
    deckCards.filter(c => {
      const r = getLatestRecord(c.id)
      return !r || r.answerRating !== 'correct'
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
      // 用語タイプ: columns の問題面と答え面を入れ替え
      for (const card of deckCards) {
        if (card.columns) {
          const newWord = card.columns[deck.termConfig.answerColumns[0]] || ''
          const newMeaning = card.columns[deck.termConfig.questionColumns[0]] || ''
          onUpdateCard(card.id, { word: newWord, meaning: newMeaning })
        }
      }
    } else {
      // 単語タイプ
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
    for (const card of deckCards) {
      delete history[card.id]
    }
    saveHistory(history)
    setFlipDone(true)
    setTimeout(() => setFlipDone(false), 2000)
  }

  return (
    <div className="page">
      <header className="page-header">
        <button className="btn-back" onClick={() => navigate(`/deck/${deckId}`)}>← 戻る</button>
        <h1>設定</h1>
      </header>

      {/* ① コピー */}
      <section className="settings-section">
        <h2 className="settings-section-title">📋 デッキをコピー</h2>
        <p className="settings-description">
          デッキとカード（{deckCards.length}枚）のコピーを作成します。学習履歴はコピーされません。
        </p>
        <button
          className="btn"
          onClick={handleCopyDeck}
          disabled={copyDeckDone}
        >
          {copyDeckDone ? '✅ コピー完了' : 'コピーを作成'}
        </button>
      </section>

      {/* ② Markdown化 */}
      <section className="settings-section">
        <h2 className="settings-section-title">📝 Markdownにする</h2>
        <p className="settings-description">
          カードをMarkdown表に変換します。インポート形式と互換性があります。
        </p>
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

      {/* ③ 反転 */}
      <section className="settings-section">
        <h2 className="settings-section-title">🔄 カードを反転</h2>
        <p className="settings-description">
          全カードの「問題面」と「答え面」を入れ替えます。
          <br />
          <span className="settings-warning">⚠️ 学習履歴はリセットされます</span>
        </p>
        <button
          className="btn btn-danger"
          onClick={handleFlip}
          disabled={deckCards.length === 0 || flipDone}
        >
          {flipDone ? '✅ 反転完了' : '反転する'}
        </button>
      </section>
    </div>
  )
}
