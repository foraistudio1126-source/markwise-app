import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import type { Deck, Card } from '../types'
import { parseMarkdownTable, parseMarkdownTableForTerm } from '../utils/markdown'

interface Props {
  decks: Deck[]
  onAddCards: (cards: Card[]) => void
}

export default function ImportPage({ decks, onAddCards }: Props) {
  const { deckId } = useParams<{ deckId: string }>()
  const navigate = useNavigate()
  const deck = decks.find(d => d.id === deckId)
  const [text, setText] = useState('')
  const [preview, setPreview] = useState<Card[]>([])
  const [showPreview, setShowPreview] = useState(false)

  if (!deck) {
    return (
      <div className="page">
        <p>デッキが見つかりません</p>
        <button className="btn" onClick={() => navigate('/')}>戻る</button>
      </div>
    )
  }

  const handleParse = () => {
    let parsed: Card[]
    if (deck.type === 'term' && deck.termConfig) {
      parsed = parseMarkdownTableForTerm(text, deckId!, deck.termConfig)
    } else {
      parsed = parseMarkdownTable(text, deckId!)
    }
    setPreview(parsed)
    setShowPreview(true)
  }

  const handleImport = () => {
    if (preview.length === 0) return
    onAddCards(preview)
    navigate(`/deck/${deckId}`)
  }

  const isTerm = deck.type === 'term' && deck.termConfig

  // プレースホルダーを生成
  const placeholder = isTerm
    ? (() => {
        const tc = deck.termConfig!
        const headerCells = tc.columnNames.map((n, i) => n || `${i + 1}列目`)
        const sepCells = tc.columnNames.map(() => '---')
        const dataCells = tc.columnNames.map(() => '...')
        return `| ${headerCells.join(' | ')} |\n|${sepCells.join('|')}|\n| ${dataCells.join(' | ')} |`
      })()
    : `| 単語と発音記号 | 品詞と意味 | 類義語・対義語 | 例文（英語） | 例文（日本語訳） |
|---|---|---|---|---|
| difficult [ˈdɪfɪkəlt] | ［形］ 難しい | 類: hard 対: easy | This is **difficult**. | これは**難しい**。 |`

  return (
    <div className="page">
      <header className="page-header">
        <button className="btn-back" onClick={() => navigate(`/deck/${deckId}`)}>← 戻る</button>
        <h1>Markdownインポート</h1>
      </header>

      <div className="form-card">
        <p className="text-secondary">Markdown表を貼り付けてください</p>
        {isTerm && (
          <p className="text-secondary">
            列構成: {deck.termConfig!.columnNames.map((n, i) => n || `${i + 1}列目`).join(' / ')}
          </p>
        )}
        <textarea
          value={text}
          onChange={e => { setText(e.target.value); setShowPreview(false) }}
          className="input textarea import-textarea"
          placeholder={placeholder}
          rows={8}
        />
        <button
          className="btn btn-primary btn-full"
          onClick={handleParse}
          disabled={!text.trim()}
        >
          プレビュー
        </button>
      </div>

      {showPreview && (
        <div className="form-card">
          <h3>プレビュー（{preview.length}件）</h3>
          {preview.length === 0 ? (
            <p className="text-secondary">パースできるデータがありません。形式を確認してください。</p>
          ) : (
            <>
              <div className="preview-list">
                {preview.map((card, i) => (
                  <div key={i} className="preview-item">
                    {isTerm && card.columns ? (
                      <>
                        <div className="preview-word">
                          {deck.termConfig!.questionColumns.map(ci =>
                            card.columns![ci]
                          ).filter(Boolean).join(' / ')}
                        </div>
                        <div className="preview-meaning">
                          {deck.termConfig!.answerColumns.map(ci =>
                            card.columns![ci]
                          ).filter(Boolean).join(' / ')}
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="preview-word">{card.word}</div>
                        {card.pronunciation && <div className="preview-pron">{card.pronunciation}</div>}
                        <div className="preview-meaning">{card.meaning}</div>
                        {card.synonyms && <div className="preview-detail">類: {card.synonyms}</div>}
                        {card.antonyms && <div className="preview-detail">対: {card.antonyms}</div>}
                      </>
                    )}
                  </div>
                ))}
              </div>
              <button
                className="btn btn-primary btn-full"
                onClick={handleImport}
              >
                {preview.length}件を一括登録
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
