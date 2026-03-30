import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Deck, DeckType, WordConfig, ExplanationDisplay } from '../types'
import { DECK_TYPE_LABELS, DEFAULT_WORD_CONFIG, DEFAULT_EXPLANATION_DISPLAY } from '../types'
import { getLatestRecord } from '../utils/storage'
import type { Card } from '../types'

interface Props {
  decks: Deck[]
  cards: Card[]
  onAddDeck: (deck: Deck) => void
  onDeleteDeck: (id: string) => void
  onUpdateDeck: (id: string, updates: Partial<Deck>) => void
}

export default function HomePage({ decks, cards, onAddDeck, onDeleteDeck, onUpdateDeck }: Props) {
  const navigate = useNavigate()
  const [showForm, setShowForm] = useState(false)
  const [newName, setNewName] = useState('')
  const [newType, setNewType] = useState<DeckType>('word')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')

  // 単語タイプ設定
  const [wordConfig, setWordConfig] = useState<WordConfig>({ ...DEFAULT_WORD_CONFIG })

  // 用語タイプ設定
  const [termTotalColumns, setTermTotalColumns] = useState(4)
  const [termColumnNames, setTermColumnNames] = useState<string[]>(['', '', '', ''])
  const [termQuestionEnd, setTermQuestionEnd] = useState(1)  // 問題面: 1列目 〜 N列目
  const [termAnswerEnd, setTermAnswerEnd] = useState(2)      // 答え面: N+1列目 〜 M列目  (解説面: M+1列目 〜 最後)

  // 詳細設定
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [showTermConfig, setShowTermConfig] = useState(true)
  const [newExplanationDisplay, setNewExplanationDisplay] = useState<ExplanationDisplay>({ ...DEFAULT_EXPLANATION_DISPLAY })

  const handleAdd = () => {
    if (!newName.trim()) return
    const deck: Deck = {
      id: crypto.randomUUID(),
      name: newName.trim(),
      type: newType,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }

    if (newType === 'word') {
      deck.wordConfig = { ...wordConfig }
    } else {
      const questionColumns: number[] = []
      for (let i = 0; i < termQuestionEnd; i++) questionColumns.push(i)
      const answerColumns: number[] = []
      for (let i = termQuestionEnd; i < termAnswerEnd; i++) answerColumns.push(i)
      const explanationColumns: number[] = []
      for (let i = termAnswerEnd; i < termTotalColumns; i++) explanationColumns.push(i)

      deck.termConfig = {
        totalColumns: termTotalColumns,
        columnNames: termColumnNames.slice(0, termTotalColumns),
        questionColumns,
        answerColumns,
        explanationColumns,
      }
    }

    deck.explanationDisplay = { ...newExplanationDisplay }

    onAddDeck(deck)
    setNewName('')
    setNewType('word')
    setWordConfig({ ...DEFAULT_WORD_CONFIG })
    setTermTotalColumns(4)
    setTermColumnNames(['', '', '', ''])
    setTermQuestionEnd(1)
    setTermAnswerEnd(2)
    setShowAdvanced(false)
    setShowTermConfig(true)
    setNewExplanationDisplay({ ...DEFAULT_EXPLANATION_DISPLAY })
    setShowForm(false)
  }

  const handleDelete = (e: React.MouseEvent, id: string, name: string) => {
    e.stopPropagation()
    if (confirm(`「${name}」を削除しますか？`)) {
      onDeleteDeck(id)
    }
  }

  const handleEditStart = (e: React.MouseEvent, deck: Deck) => {
    e.stopPropagation()
    setEditingId(deck.id)
    setEditName(deck.name)
  }

  const handleEditSave = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (editingId && editName.trim()) {
      onUpdateDeck(editingId, { name: editName.trim() })
      setEditingId(null)
    }
  }

  const getProgress = (deckId: string) => {
    const deckCards = cards.filter(c => c.deckId === deckId)
    if (deckCards.length === 0) return { total: 0, mastered: 0, percent: 0 }
    const mastered = deckCards.filter(c => {
      const record = getLatestRecord(c.id)
      return record?.answerRating === 'correct'
    }).length
    return {
      total: deckCards.length,
      mastered,
      percent: Math.round((mastered / deckCards.length) * 100),
    }
  }

  const handleTermColumnsChange = (count: number) => {
    setTermTotalColumns(count)
    setTermColumnNames(prev => {
      const next = [...prev]
      while (next.length < count) next.push('')
      return next.slice(0, count)
    })
    // 制約を維持: questionEnd < answerEnd <= totalColumns
    if (termQuestionEnd >= count) setTermQuestionEnd(Math.max(1, count - 2))
    if (termAnswerEnd >= count) setTermAnswerEnd(Math.max(2, count - 1))
  }

  return (
    <div className="page">
      <header className="page-header">
        <h1><img src="/icon-192.png" alt="" className="app-logo" />Markwise</h1>
      </header>

      <div className="deck-list">
        {decks.length === 0 && (
          <div className="empty-state">
            <p>デッキがありません</p>
            <p className="text-secondary">「＋ 新しいデッキ」から作成してください</p>
          </div>
        )}

        {decks.map(deck => {
          const progress = getProgress(deck.id)
          return (
            <div
              key={deck.id}
              className="deck-card"
              onClick={() => navigate(`/deck/${deck.id}`)}
            >
              {editingId === deck.id ? (
                <div className="deck-edit-row" onClick={e => e.stopPropagation()}>
                  <input
                    type="text"
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    className="input"
                    autoFocus
                    onKeyDown={e => e.key === 'Enter' && handleEditSave(e as unknown as React.MouseEvent)}
                  />
                  <button className="btn btn-sm btn-primary" onClick={handleEditSave}>保存</button>
                  <button className="btn btn-sm" onClick={(e) => { e.stopPropagation(); setEditingId(null) }}>取消</button>
                </div>
              ) : (
                <>
                  <div className="deck-info">
                    <h3 className="deck-name">{deck.name}</h3>
                    <span className="deck-type-badge">{DECK_TYPE_LABELS[deck.type]}</span>
                  </div>
                  <div className="deck-stats">
                    <span>{progress.total}枚</span>
                    {progress.total > 0 && (
                      <div className="progress-bar-mini">
                        <div className="progress-fill" style={{ width: `${progress.percent}%` }} />
                        <span className="progress-text">{progress.percent}%</span>
                      </div>
                    )}
                  </div>
                  <div className="deck-actions">
                    <button className="btn-icon" onClick={e => handleEditStart(e, deck)} title="編集">✏️</button>
                    <button className="btn-icon" onClick={e => handleDelete(e, deck.id, deck.name)} title="削除">🗑️</button>
                  </div>
                </>
              )}
            </div>
          )
        })}
      </div>

      {showForm ? (
        <div className="form-card">
          <h3>新しいデッキ</h3>
          <input
            type="text"
            placeholder="デッキ名"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            className="input"
            autoFocus
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
          />
          <select
            value={newType}
            onChange={e => setNewType(e.target.value as DeckType)}
            className="input"
          >
            {Object.entries(DECK_TYPE_LABELS).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>

          {/* 単語タイプの詳細設定 */}
          {newType === 'word' && (
            <div className="config-section">
              <button
                type="button"
                className="config-toggle-btn"
                onClick={() => setShowAdvanced(v => !v)}
              >
                <span>詳細設定</span>
                <span className="toggle-arrow">{showAdvanced ? '▲' : '▼'}</span>
              </button>
              {showAdvanced && (
                <>
                  <label className="form-label">発音記号の表示面</label>
                  <select
                    value={wordConfig.pronunciationSide}
                    onChange={e => setWordConfig(prev => ({ ...prev, pronunciationSide: e.target.value as 'question' | 'answer' }))}
                    className="input"
                  >
                    <option value="question">問題面</option>
                    <option value="answer">答え面</option>
                  </select>
                  <label className="form-label">接頭辞・語源の表示面</label>
                  <select
                    value={wordConfig.etymologySide}
                    onChange={e => setWordConfig(prev => ({ ...prev, etymologySide: e.target.value as 'question' | 'answer' }))}
                    className="input"
                  >
                    <option value="question">問題面</option>
                    <option value="answer">答え面</option>
                  </select>
                  <label className="form-label">解説の表示タイミング</label>
                  {(['correct', 'partial', 'wrong'] as const).map(rating => {
                    const labels = { correct: '⭕️ 正解', partial: '🔺 惜しい', wrong: '❌ 不正解' }
                    return (
                      <label key={rating} className="config-toggle-row">
                        <span>{labels[rating]}</span>
                        <input
                          type="checkbox"
                          checked={newExplanationDisplay[rating]}
                          onChange={e => setNewExplanationDisplay(prev => ({ ...prev, [rating]: e.target.checked }))}
                        />
                      </label>
                    )
                  })}
                </>
              )}
            </div>
          )}

          {/* 用語タイプの設定 */}
          {newType === 'term' && (
            <>
              <div className="config-section">
                <button
                  type="button"
                  className="config-toggle-btn"
                  onClick={() => setShowTermConfig(v => !v)}
                >
                  <span>Markdown列の設定</span>
                  <span className="toggle-arrow">{showTermConfig ? '▲' : '▼'}</span>
                </button>
                {showTermConfig && (
                  <>
                    <label className="form-label">列数</label>
                    <input
                      type="number"
                      min={2}
                      max={10}
                      value={termTotalColumns}
                      onChange={e => handleTermColumnsChange(Math.max(2, Math.min(10, parseInt(e.target.value) || 2)))}
                      className="input"
                    />
                    <label className="form-label">各列の名前</label>
                    {termColumnNames.slice(0, termTotalColumns).map((name, i) => (
                      <input
                        key={i}
                        type="text"
                        placeholder={`${i + 1}列目の名前`}
                        value={name}
                        onChange={e => {
                          const next = [...termColumnNames]
                          next[i] = e.target.value
                          setTermColumnNames(next)
                        }}
                        className="input"
                      />
                    ))}
                    <label className="form-label">
                      問題面: {termQuestionEnd}列目まで
                    </label>
                    <select
                      value={termQuestionEnd}
                      onChange={e => {
                        const val = parseInt(e.target.value)
                        setTermQuestionEnd(val)
                        if (termAnswerEnd <= val) setTermAnswerEnd(val + 1)
                      }}
                      className="input"
                    >
                      {Array.from({ length: termTotalColumns - 2 }, (_, i) => i + 1).map(n => (
                        <option key={n} value={n}>{n}列目まで</option>
                      ))}
                    </select>
                    <label className="form-label">
                      答え面: {termAnswerEnd}列目まで
                    </label>
                    <select
                      value={termAnswerEnd}
                      onChange={e => setTermAnswerEnd(parseInt(e.target.value))}
                      className="input"
                    >
                      {Array.from({ length: termTotalColumns - termQuestionEnd - 1 }, (_, i) => termQuestionEnd + 1 + i).map(n => (
                        <option key={n} value={n}>{n}列目まで</option>
                      ))}
                    </select>
                    <label className="form-label">
                      解説面: {termAnswerEnd + 1}列目 〜 {termTotalColumns}列目（自動）
                    </label>
                    <div className="term-preview">
                      <div className="term-preview-row">
                        {termColumnNames.slice(0, termTotalColumns).map((name, i) => {
                          const isQuestion = i < termQuestionEnd
                          const isAnswer = i >= termQuestionEnd && i < termAnswerEnd
                          const isExplanation = i >= termAnswerEnd
                          return (
                            <span
                              key={i}
                              className={`term-preview-col ${isQuestion ? 'question-col' : ''} ${isAnswer ? 'answer-col' : ''} ${isExplanation ? 'explanation-col' : ''}`}
                            >
                              {name || `${i + 1}列目`}
                              <small>{isQuestion ? '問題' : isAnswer ? '答え' : '解説'}</small>
                            </span>
                          )
                        })}
                      </div>
                    </div>
                  </>
                )}
              </div>
              <div className="config-section">
                <button
                  type="button"
                  className="config-toggle-btn"
                  onClick={() => setShowAdvanced(v => !v)}
                >
                  <span>詳細設定</span>
                  <span className="toggle-arrow">{showAdvanced ? '▲' : '▼'}</span>
                </button>
                {showAdvanced && (
                  <>
                    <label className="form-label">解説の表示タイミング</label>
                    {(['correct', 'partial', 'wrong'] as const).map(rating => {
                      const labels = { correct: '⭕️ 正解', partial: '🔺 惜しい', wrong: '❌ 不正解' }
                      return (
                        <label key={rating} className="config-toggle-row">
                          <span>{labels[rating]}</span>
                          <input
                            type="checkbox"
                            checked={newExplanationDisplay[rating]}
                            onChange={e => setNewExplanationDisplay(prev => ({ ...prev, [rating]: e.target.checked }))}
                          />
                        </label>
                      )
                    })}
                  </>
                )}
              </div>
            </>
          )}

          <div className="form-actions">
            <button className="btn btn-primary" onClick={handleAdd}>作成</button>
            <button className="btn" onClick={() => setShowForm(false)}>キャンセル</button>
          </div>
        </div>
      ) : (
        <button className="btn btn-primary btn-full" onClick={() => setShowForm(true)}>
          ＋ 新しいデッキ
        </button>
      )}
    </div>
  )
}
