import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import type { Card, Deck } from '../types'

interface Props {
  decks: Deck[]
  cards: Card[]
  onAddCard: (card: Card) => void
  onUpdateCard: (id: string, updates: Partial<Card>) => void
}

export default function CardEditPage({ decks, cards, onAddCard, onUpdateCard }: Props) {
  const { deckId, cardId } = useParams<{ deckId: string; cardId?: string }>()
  const navigate = useNavigate()
  const deck = decks.find(d => d.id === deckId)
  const existingCard = cardId ? cards.find(c => c.id === cardId) : null
  const isEdit = !!existingCard

  // 単語タイプ用
  const [word, setWord] = useState(existingCard?.word ?? '')
  const [pronunciation, setPronunciation] = useState(existingCard?.pronunciation ?? '')
  const [etymology, setEtymology] = useState(existingCard?.etymology ?? '')
  const [meaning, setMeaning] = useState(existingCard?.meaning ?? '')
  const [synonyms, setSynonyms] = useState(existingCard?.synonyms ?? '')
  const [antonyms, setAntonyms] = useState(existingCard?.antonyms ?? '')
  const [exampleEn, setExampleEn] = useState(existingCard?.exampleEn ?? '')
  const [exampleJa, setExampleJa] = useState(existingCard?.exampleJa ?? '')

  // 用語タイプ用
  const termConfig = deck?.termConfig
  const [columns, setColumns] = useState<string[]>(
    existingCard?.columns ?? (termConfig ? new Array(termConfig.totalColumns).fill('') : [])
  )

  if (!deck) {
    return (
      <div className="page">
        <p>デッキが見つかりません</p>
        <button className="btn" onClick={() => navigate('/')}>戻る</button>
      </div>
    )
  }

  const handleSave = () => {
    if (deck.type === 'word') {
      if (!word.trim() || !meaning.trim()) return
      if (isEdit && existingCard) {
        onUpdateCard(existingCard.id, {
          word: word.trim(),
          pronunciation: pronunciation.trim(),
          etymology: etymology.trim(),
          meaning: meaning.trim(),
          synonyms: synonyms.trim(),
          antonyms: antonyms.trim(),
          exampleEn: exampleEn.trim(),
          exampleJa: exampleJa.trim(),
        })
      } else {
        const now = Date.now()
        onAddCard({
          id: crypto.randomUUID(),
          deckId: deckId!,
          word: word.trim(),
          pronunciation: pronunciation.trim(),
          etymology: etymology.trim(),
          meaning: meaning.trim(),
          synonyms: synonyms.trim(),
          antonyms: antonyms.trim(),
          exampleEn: exampleEn.trim(),
          exampleJa: exampleJa.trim(),
          createdAt: now,
          updatedAt: now,
        })
      }
    } else if (deck.type === 'term' && termConfig) {
      // 用語タイプ: 少なくとも問題面と答え面に1つ以上のデータが必要
      const hasQuestion = termConfig.questionColumns.some(i => columns[i]?.trim())
      const hasAnswer = termConfig.answerColumns.some(i => columns[i]?.trim())
      if (!hasQuestion || !hasAnswer) return

      const trimmedColumns = columns.map(c => c.trim())
      // word = 問題面の最初の列, meaning = 答え面の最初の列 (互換性のため)
      const wordVal = trimmedColumns[termConfig.questionColumns[0]] || ''
      const meaningVal = trimmedColumns[termConfig.answerColumns[0]] || ''

      if (isEdit && existingCard) {
        onUpdateCard(existingCard.id, {
          word: wordVal,
          meaning: meaningVal,
          columns: trimmedColumns,
        })
      } else {
        const now = Date.now()
        onAddCard({
          id: crypto.randomUUID(),
          deckId: deckId!,
          word: wordVal,
          pronunciation: '',
          etymology: '',
          meaning: meaningVal,
          synonyms: '',
          antonyms: '',
          exampleEn: '',
          exampleJa: '',
          columns: trimmedColumns,
          createdAt: now,
          updatedAt: now,
        })
      }
    }
    navigate(`/deck/${deckId}`)
  }

  // 用語タイプのUI
  if (deck.type === 'term' && termConfig) {
    const hasQuestion = termConfig.questionColumns.some(i => columns[i]?.trim())
    const hasAnswer = termConfig.answerColumns.some(i => columns[i]?.trim())

    return (
      <div className="page">
        <header className="page-header">
          <button className="btn-back" onClick={() => navigate(`/deck/${deckId}`)}>← 戻る</button>
          <h1>{isEdit ? 'カード編集' : 'カード追加'}</h1>
        </header>

        <div className="form-card">
          <h3>問題面</h3>
          {termConfig.questionColumns.map(colIdx => (
            <div key={colIdx}>
              <label className="form-label">
                {termConfig.columnNames[colIdx] || `${colIdx + 1}列目`}
              </label>
              <input
                type="text"
                value={columns[colIdx] || ''}
                onChange={e => {
                  const next = [...columns]
                  next[colIdx] = e.target.value
                  setColumns(next)
                }}
                className="input"
              />
            </div>
          ))}
        </div>

        <div className="form-card">
          <h3>答え面</h3>
          {termConfig.answerColumns.map(colIdx => (
            <div key={colIdx}>
              <label className="form-label">
                {termConfig.columnNames[colIdx] || `${colIdx + 1}列目`}
              </label>
              <input
                type="text"
                value={columns[colIdx] || ''}
                onChange={e => {
                  const next = [...columns]
                  next[colIdx] = e.target.value
                  setColumns(next)
                }}
                className="input"
              />
            </div>
          ))}
        </div>

        {termConfig.explanationColumns && termConfig.explanationColumns.length > 0 && (
          <div className="form-card">
            <h3>解説（任意）</h3>
            {termConfig.explanationColumns.map(colIdx => (
              <div key={colIdx}>
                <label className="form-label">
                  {termConfig.columnNames[colIdx] || `${colIdx + 1}列目`}
                </label>
                <input
                  type="text"
                  value={columns[colIdx] || ''}
                  onChange={e => {
                    const next = [...columns]
                    next[colIdx] = e.target.value
                    setColumns(next)
                  }}
                  className="input"
                />
              </div>
            ))}
          </div>
        )}

        <div className="form-actions">
          <button
            className="btn btn-primary btn-full"
            onClick={handleSave}
            disabled={!hasQuestion || !hasAnswer}
          >
            {isEdit ? '保存' : '追加'}
          </button>
        </div>
      </div>
    )
  }

  // 単語タイプのUI
  return (
    <div className="page">
      <header className="page-header">
        <button className="btn-back" onClick={() => navigate(`/deck/${deckId}`)}>← 戻る</button>
        <h1>{isEdit ? 'カード編集' : 'カード追加'}</h1>
      </header>

      <div className="form-card">
        <h3>問題面</h3>
        <label className="form-label">
          単語
          <span className="required">必須</span>
        </label>
        <input
          type="text"
          value={word}
          onChange={e => setWord(e.target.value)}
          className="input"
          placeholder="comprehend"
        />
      </div>

      <div className="form-card">
        <h3>答え面</h3>
        <label className="form-label">
          意味
          <span className="required">必須</span>
        </label>
        <input
          type="text"
          value={meaning}
          onChange={e => setMeaning(e.target.value)}
          className="input"
          placeholder="［他］ 理解する、包含する"
        />
      </div>

      <div className="form-card">
        <h3>任意</h3>
        <label className="form-label">発音記号（IPA）</label>
        <input
          type="text"
          value={pronunciation}
          onChange={e => setPronunciation(e.target.value)}
          className="input"
          placeholder="/kɑːmprɪˈhend/"
        />

        <label className="form-label">接頭辞・語源</label>
        <input
          type="text"
          value={etymology}
          onChange={e => setEtymology(e.target.value)}
          className="input"
          placeholder="com-(共に) + prehend(つかむ)"
        />

        <label className="form-label">類義語</label>
        <input
          type="text"
          value={synonyms}
          onChange={e => setSynonyms(e.target.value)}
          className="input"
          placeholder="understand, grasp"
        />

        <label className="form-label">対義語</label>
        <input
          type="text"
          value={antonyms}
          onChange={e => setAntonyms(e.target.value)}
          className="input"
          placeholder="misunderstand"
        />

        <label className="form-label">英例文</label>
        <textarea
          value={exampleEn}
          onChange={e => setExampleEn(e.target.value)}
          className="input textarea"
          placeholder="I can't comprehend why he did that."
          rows={2}
        />

        <label className="form-label">日本語例文</label>
        <textarea
          value={exampleJa}
          onChange={e => setExampleJa(e.target.value)}
          className="input textarea"
          placeholder="なぜ彼がそうしたのか理解できない"
          rows={2}
        />
      </div>

      <div className="form-actions">
        <button
          className="btn btn-primary btn-full"
          onClick={handleSave}
          disabled={!word.trim() || !meaning.trim()}
        >
          {isEdit ? '保存' : '追加'}
        </button>
      </div>
    </div>
  )
}
