import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import type { Deck, Card, ImportSettings } from '../types'
import { DEFAULT_IMPORT_SETTINGS } from '../types'
import { parseMarkdownTable, parseMarkdownTableForTerm } from '../utils/markdown'
import InfoModal from '../components/InfoModal'

interface Props {
  decks: Deck[]
  onAddCards: (cards: Card[]) => void
  onUpdateDeck: (id: string, updates: Partial<Deck>) => void
}

export default function ImportPage({ decks, onAddCards, onUpdateDeck }: Props) {
  const { deckId } = useParams<{ deckId: string }>()
  const navigate = useNavigate()
  const deck = decks.find(d => d.id === deckId)
  const [text, setText] = useState('')
  const [preview, setPreview] = useState<Card[]>([])
  const [showPreview, setShowPreview] = useState(false)

  const [importSettings, setImportSettings] = useState<ImportSettings>(
    deck?.importSettings ?? { ...DEFAULT_IMPORT_SETTINGS }
  )
  const [infoModal, setInfoModal] = useState<{ title: string; body: string } | null>(null)

  if (!deck) {
    return (
      <div className="page">
        <p>デッキが見つかりません</p>
        <button className="btn" onClick={() => navigate('/')}>戻る</button>
      </div>
    )
  }

  const handleSettingChange = (key: keyof ImportSettings, value: boolean) => {
    const next = { ...importSettings, [key]: value }
    setImportSettings(next)
    onUpdateDeck(deck.id, { importSettings: next })
    setShowPreview(false)
  }

  const handleParse = () => {
    let parsed: Card[]
    if (deck.type === 'term' && deck.termConfig) {
      parsed = parseMarkdownTableForTerm(text, deckId!, deck.termConfig)
    } else {
      parsed = parseMarkdownTable(text, deckId!, importSettings)
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

  // プレースホルダーを生成（単語タイプのみ設定に応じて動的に変わる）
  const buildWordPlaceholder = () => {
    const headers = ['単語と発音記号', '品詞と意味']
    const exampleRow = ['difficult [ˈdɪfɪkəlt]', '［形］ 難しい']
    if (importSettings.includeEtymology) {
      headers.push('接頭辞・語源')
      exampleRow.push('dis- + facilis')
    }
    if (importSettings.includeDefinition) {
      headers.push('語義説明')
      exampleRow.push('hard to do or understand')
    }
    if (importSettings.includeSynonymsAntonyms) {
      headers.push('類義語・対義語')
      exampleRow.push('類: hard 対: easy')
    }
    if (importSettings.includeExamples) {
      headers.push('例文（英語）', '例文（日本語訳）')
      exampleRow.push('This is **difficult**.', 'これは**難しい**。')
    }
    const headerStr = `| ${headers.join(' | ')} |`
    const sepStr = `|${headers.map(() => '---').join('|')}|`
    const rowStr = `| ${exampleRow.join(' | ')} |`
    return `${headerStr}\n${sepStr}\n${rowStr}`
  }

  const placeholder = isTerm
    ? (() => {
        const tc = deck.termConfig!
        const headerCells = tc.columnNames.map((n, i) => n || `${i + 1}列目`)
        const sepCells = tc.columnNames.map(() => '---')
        const dataCells = tc.columnNames.map(() => '...')
        return `| ${headerCells.join(' | ')} |\n|${sepCells.join('|')}|\n| ${dataCells.join(' | ')} |`
      })()
    : buildWordPlaceholder()

  return (
    <div className="page">
      <header className="page-header">
        <button className="btn-back" onClick={() => navigate(`/deck/${deckId}`)}>← 戻る</button>
        <h1>Markdownインポート</h1>
      </header>

      {/* 単語タイプのみインポート設定を表示 */}
      {!isTerm && (
        <div className="form-card">
          <div className="settings-section-header">
            <h3 className="import-settings-title">インポートする項目</h3>
            <button className="btn-info" onClick={() => setInfoModal({ title: 'インポートする項目', body: '単語・発音記号・品詞・意味は常にインポートされます。追加でインポートしたい列をオンにしてください。Markdownの列順と一致している必要があります。' })}>?</button>
          </div>
          <div className="import-settings-list">
            <label className="config-toggle-row">
              <span>接頭辞・接尾辞</span>
              <input
                type="checkbox"
                checked={importSettings.includeEtymology}
                onChange={e => handleSettingChange('includeEtymology', e.target.checked)}
              />
            </label>
            <label className="config-toggle-row">
              <span>語義説明</span>
              <input
                type="checkbox"
                checked={importSettings.includeDefinition}
                onChange={e => handleSettingChange('includeDefinition', e.target.checked)}
              />
            </label>
            <label className="config-toggle-row">
              <span>類義語・対義語</span>
              <input
                type="checkbox"
                checked={importSettings.includeSynonymsAntonyms}
                onChange={e => handleSettingChange('includeSynonymsAntonyms', e.target.checked)}
              />
            </label>
            <label className="config-toggle-row">
              <span>例文</span>
              <input
                type="checkbox"
                checked={importSettings.includeExamples}
                onChange={e => handleSettingChange('includeExamples', e.target.checked)}
              />
            </label>
          </div>
        </div>
      )}

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
                        {card.etymology && <div className="preview-detail">接頭辞: {card.etymology}</div>}
                        {card.definition && <div className="preview-detail">語義: {card.definition}</div>}
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

      {infoModal && <InfoModal title={infoModal.title} body={infoModal.body} onClose={() => setInfoModal(null)} />}
    </div>
  )
}
