import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Deck, Card, GlobalSettings } from '../types'
import { loadGlobalSettings, saveGlobalSettings, getCardSRS } from '../utils/storage'
import { exportToMarkdown, exportToMarkdownForTerm } from '../utils/markdown'

type MarkdownFilter = 'all' | 'mastered' | 'unmastered'

interface Props {
  decks: Deck[]
  cards: Card[]
  onAddDeck: (deck: Deck) => void
  onAddCards: (cards: Card[]) => void
  onUpdateDeck: (id: string, updates: Partial<Deck>) => void
}

export default function GlobalSettingsPage({ decks, cards, onAddDeck, onAddCards }: Props) {
  const navigate = useNavigate()
  const [settings, setSettings] = useState<GlobalSettings>(loadGlobalSettings())

  // デッキ結合
  const [showMerge, setShowMerge] = useState(false)
  const [mergeSelected, setMergeSelected] = useState<Set<string>>(new Set())
  const [mergeMode, setMergeMode] = useState<'new' | 'into'>('new')
  const [mergeTargetId, setMergeTargetId] = useState<string>('')
  const [mergeName, setMergeName] = useState('')
  const [mergeDone, setMergeDone] = useState(false)

  // 総合Markdown
  const [showMarkdown, setShowMarkdown] = useState(false)
  const [mdSelected, setMdSelected] = useState<Set<string>>(new Set())
  const [mdFilter, setMdFilter] = useState<MarkdownFilter>('all')
  const [copied, setCopied] = useState(false)

  const updateSetting = <K extends keyof GlobalSettings>(key: K, value: GlobalSettings[K]) => {
    const next = { ...settings, [key]: value }
    setSettings(next)
    saveGlobalSettings(next)
  }

  // ===== デッキ結合 =====
  const handleMerge = () => {
    const selectedDecks = decks.filter(d => mergeSelected.has(d.id))
    if (selectedDecks.length < 2) return

    const selectedCards = cards.filter(c => mergeSelected.has(c.deckId))
    const now = Date.now()

    if (mergeMode === 'new') {
      const newDeckId = crypto.randomUUID()
      const newDeck: Deck = {
        id: newDeckId,
        name: mergeName || `結合デッキ`,
        type: selectedDecks[0].type,
        wordConfig: selectedDecks[0].wordConfig ? { ...selectedDecks[0].wordConfig } : undefined,
        termConfig: selectedDecks[0].termConfig ? { ...selectedDecks[0].termConfig } : undefined,
        createdAt: now,
        updatedAt: now,
      }
      const newCards: Card[] = selectedCards.map(c => ({
        ...c,
        id: crypto.randomUUID(),
        deckId: newDeckId,
        columns: c.columns ? [...c.columns] : undefined,
        createdAt: now,
        updatedAt: now,
      }))
      onAddDeck(newDeck)
      onAddCards(newCards)
    } else if (mergeTargetId) {
      // 既存デッキに結合
      const otherCards = selectedCards.filter(c => c.deckId !== mergeTargetId)
      const newCards: Card[] = otherCards.map(c => ({
        ...c,
        id: crypto.randomUUID(),
        deckId: mergeTargetId,
        columns: c.columns ? [...c.columns] : undefined,
        createdAt: now,
        updatedAt: now,
      }))
      onAddCards(newCards)
    }

    setMergeDone(true)
    setTimeout(() => {
      setMergeDone(false)
      setShowMerge(false)
      setMergeSelected(new Set())
    }, 1500)
  }

  // ===== 総合Markdown =====
  const mdCards = useMemo(() => {
    const selected = cards.filter(c => mdSelected.has(c.deckId))
    if (mdFilter === 'mastered') {
      return selected.filter(c => {
        const srs = getCardSRS(c.id)
        return srs?.status === 'mastered'
      })
    }
    if (mdFilter === 'unmastered') {
      return selected.filter(c => {
        const srs = getCardSRS(c.id)
        return !srs || srs.status !== 'mastered'
      })
    }
    return selected
  }, [cards, mdSelected, mdFilter])

  const mdText = useMemo(() => {
    if (mdCards.length === 0) return ''
    // 最初の選択デッキの形式で出力
    const firstDeck = decks.find(d => mdSelected.has(d.id))
    if (firstDeck?.type === 'term' && firstDeck.termConfig) {
      return exportToMarkdownForTerm(mdCards, firstDeck.termConfig)
    }
    return exportToMarkdown(mdCards)
  }, [mdCards, decks, mdSelected])

  const handleCopyMarkdown = async () => {
    try {
      await navigator.clipboard.writeText(mdText)
    } catch {
      const ta = document.createElement('textarea')
      ta.value = mdText
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const toggleMergeSelect = (id: string) => {
    setMergeSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const toggleMdSelect = (id: string) => {
    setMdSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  return (
    <div className="page">
      <header className="page-header">
        <button className="btn-back" onClick={() => navigate('/')}>← 戻る</button>
        <h1>基本設定</h1>
      </header>

      {/* ===== デフォルト設定 ===== */}
      <section className="settings-section">
        <h2 className="settings-section-title">🔧 デフォルト設定</h2>
        <p className="settings-description">新しいデッキ作成時の初期値を変更します。</p>

        <h3 className="settings-subsection-title">発音記号の表示面</h3>
        <select
          className="input"
          value={settings.defaultWordConfig.pronunciationSide}
          onChange={e => updateSetting('defaultWordConfig', {
            ...settings.defaultWordConfig,
            pronunciationSide: e.target.value as 'question' | 'answer'
          })}
        >
          <option value="question">問題面</option>
          <option value="answer">答え面</option>
        </select>

        <h3 className="settings-subsection-title">接頭辞・語源の表示面</h3>
        <select
          className="input"
          value={settings.defaultWordConfig.etymologySide}
          onChange={e => updateSetting('defaultWordConfig', {
            ...settings.defaultWordConfig,
            etymologySide: e.target.value as 'question' | 'answer'
          })}
        >
          <option value="question">問題面</option>
          <option value="answer">答え面</option>
        </select>

        <h3 className="settings-subsection-title">解説の表示タイミング</h3>
        {(['correct', 'partial', 'wrong'] as const).map(rating => {
          const labels = { correct: '⭕️ 正解', partial: '🔺 惜しい', wrong: '❌ 不正解' }
          return (
            <label key={rating} className="settings-toggle-row">
              <span>{labels[rating]}</span>
              <input
                type="checkbox"
                checked={settings.defaultExplanationDisplay[rating]}
                onChange={e => updateSetting('defaultExplanationDisplay', {
                  ...settings.defaultExplanationDisplay,
                  [rating]: e.target.checked,
                })}
              />
            </label>
          )
        })}

        <h3 className="settings-subsection-title">自動コマ送り</h3>
        <label className="settings-toggle-row">
          <span>有効</span>
          <input
            type="checkbox"
            checked={settings.defaultAutoAdvance.enabled}
            onChange={e => updateSetting('defaultAutoAdvance', {
              ...settings.defaultAutoAdvance,
              enabled: e.target.checked,
            })}
          />
        </label>
        {settings.defaultAutoAdvance.enabled && (
          <label className="settings-toggle-row">
            <span>秒数</span>
            <input
              type="number"
              className="settings-number-input"
              min={1}
              max={120}
              value={settings.defaultAutoAdvance.seconds}
              onChange={e => updateSetting('defaultAutoAdvance', {
                ...settings.defaultAutoAdvance,
                seconds: Math.max(1, parseInt(e.target.value) || 5),
              })}
            />
          </label>
        )}

        <h3 className="settings-subsection-title">復習間隔</h3>
        <label className="settings-toggle-row">
          <span>モード</span>
          <select
            className="settings-side-select"
            value={settings.defaultReviewInterval.mode}
            onChange={e => updateSetting('defaultReviewInterval', {
              ...settings.defaultReviewInterval,
              mode: e.target.value as 'fixed' | 'increasing',
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
            value={settings.defaultReviewInterval.baseDays}
            onChange={e => updateSetting('defaultReviewInterval', {
              ...settings.defaultReviewInterval,
              baseDays: Math.max(1, parseInt(e.target.value) || 1),
            })}
          />
        </label>
        {settings.defaultReviewInterval.mode === 'increasing' && (
          <label className="settings-toggle-row">
            <span>上限（日）</span>
            <input
              type="number"
              className="settings-number-input"
              min={settings.defaultReviewInterval.baseDays}
              max={365}
              value={settings.defaultReviewInterval.maxDays}
              onChange={e => updateSetting('defaultReviewInterval', {
                ...settings.defaultReviewInterval,
                maxDays: Math.max(settings.defaultReviewInterval.baseDays, parseInt(e.target.value) || 7),
              })}
            />
          </label>
        )}
        <label className="settings-toggle-row">
          <span>ミス時にリセット</span>
          <input
            type="checkbox"
            checked={settings.defaultReviewInterval.resetOnMistake}
            onChange={e => updateSetting('defaultReviewInterval', {
              ...settings.defaultReviewInterval,
              resetOnMistake: e.target.checked,
            })}
          />
        </label>
      </section>

      {/* ===== デッキの結合 ===== */}
      <section className="settings-section">
        <h2 className="settings-section-title">🔗 デッキの結合</h2>
        <p className="settings-description">複数のデッキを1つにまとめます。</p>
        {!showMerge ? (
          <button className="btn" onClick={() => setShowMerge(true)}>結合するデッキを選択</button>
        ) : (
          <>
            <div className="deck-select-list">
              {decks.map(d => (
                <label key={d.id} className="settings-toggle-row">
                  <span>{d.name}（{cards.filter(c => c.deckId === d.id).length}枚）</span>
                  <input
                    type="checkbox"
                    checked={mergeSelected.has(d.id)}
                    onChange={() => toggleMergeSelect(d.id)}
                  />
                </label>
              ))}
            </div>
            {mergeSelected.size >= 2 && (
              <>
                <label className="settings-toggle-row">
                  <span>結合方法</span>
                  <select
                    className="settings-side-select"
                    value={mergeMode}
                    onChange={e => setMergeMode(e.target.value as 'new' | 'into')}
                  >
                    <option value="new">新しいデッキを作成</option>
                    <option value="into">既存のデッキに結合</option>
                  </select>
                </label>
                {mergeMode === 'new' ? (
                  <input
                    type="text"
                    className="input"
                    placeholder="新しいデッキ名"
                    value={mergeName}
                    onChange={e => setMergeName(e.target.value)}
                  />
                ) : (
                  <select
                    className="input"
                    value={mergeTargetId}
                    onChange={e => setMergeTargetId(e.target.value)}
                  >
                    <option value="">結合先を選択...</option>
                    {decks.filter(d => mergeSelected.has(d.id)).map(d => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                )}
                <button
                  className="btn btn-primary"
                  onClick={handleMerge}
                  disabled={mergeDone || (mergeMode === 'into' && !mergeTargetId)}
                >
                  {mergeDone ? '✅ 結合完了' : '結合する'}
                </button>
              </>
            )}
            <button className="btn" onClick={() => { setShowMerge(false); setMergeSelected(new Set()) }}>
              キャンセル
            </button>
          </>
        )}
      </section>

      {/* ===== 総合Markdown ===== */}
      <section className="settings-section">
        <h2 className="settings-section-title">📝 総合Markdown</h2>
        <p className="settings-description">複数デッキのカードをまとめてMarkdownに変換します。</p>
        {!showMarkdown ? (
          <button className="btn" onClick={() => setShowMarkdown(true)}>デッキを選択</button>
        ) : (
          <>
            <div className="deck-select-list">
              {decks.map(d => (
                <label key={d.id} className="settings-toggle-row">
                  <span>{d.name}（{cards.filter(c => c.deckId === d.id).length}枚）</span>
                  <input
                    type="checkbox"
                    checked={mdSelected.has(d.id)}
                    onChange={() => toggleMdSelect(d.id)}
                  />
                </label>
              ))}
            </div>
            {mdSelected.size > 0 && (
              <>
                <div className="settings-filter-buttons">
                  <button
                    className={`btn btn-small ${mdFilter === 'all' ? 'btn-primary' : ''}`}
                    onClick={() => setMdFilter('all')}
                  >全体</button>
                  <button
                    className={`btn btn-small ${mdFilter === 'mastered' ? 'btn-primary' : ''}`}
                    onClick={() => setMdFilter('mastered')}
                  >定着済み</button>
                  <button
                    className={`btn btn-small ${mdFilter === 'unmastered' ? 'btn-primary' : ''}`}
                    onClick={() => setMdFilter('unmastered')}
                  >未定着</button>
                </div>
                {mdCards.length > 0 ? (
                  <>
                    <textarea
                      className="settings-markdown-area"
                      readOnly
                      value={mdText}
                      rows={8}
                    />
                    <button className="btn" onClick={handleCopyMarkdown}>
                      {copied ? '✅ コピーしました' : `クリップボードにコピー（${mdCards.length}枚）`}
                    </button>
                  </>
                ) : (
                  <p className="settings-empty">該当するカードがありません</p>
                )}
              </>
            )}
            <button className="btn" onClick={() => { setShowMarkdown(false); setMdSelected(new Set()) }}>
              キャンセル
            </button>
          </>
        )}
      </section>
    </div>
  )
}
