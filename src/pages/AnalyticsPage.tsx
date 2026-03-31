import { useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import type { Deck, Card } from '../types'
import { DECK_TYPE_LABELS } from '../types'
import { loadHistory, loadSRS } from '../utils/storage'
import type { StudyRecord } from '../types'

interface Props {
  decks: Deck[]
  cards: Card[]
}

interface Stats {
  total: number
  answerCorrect: number
  answerPartial: number
  answerWrong: number
  misremembered: number // self⭕️ × answer❌ のみ
}

function calcStats(records: StudyRecord[]): Stats {
  const stats: Stats = {
    total: records.length,
    answerCorrect: 0,
    answerPartial: 0,
    answerWrong: 0,
    misremembered: 0,
  }
  for (const r of records) {
    if (r.answerRating === 'correct') stats.answerCorrect++
    else if (r.answerRating === 'partial') stats.answerPartial++
    else if (r.answerRating === 'wrong') stats.answerWrong++

    if (r.selfRating === 'correct' && r.answerRating === 'wrong') {
      stats.misremembered++
    }
  }
  return stats
}

function pct(n: number, total: number): string {
  if (total === 0) return '0'
  return Math.round((n / total) * 100).toString()
}

function getMisrememberedCardIds(history: Record<string, StudyRecord[]>, deckCards: Card[]): string[] {
  const ids: string[] = []
  for (const card of deckCards) {
    const recs = history[card.id]
    if (!recs) continue
    const latest = recs[recs.length - 1]
    if (latest && latest.selfRating === 'correct' && latest.answerRating === 'wrong') {
      ids.push(card.id)
    }
  }
  return ids
}

export default function AnalyticsPage({ decks, cards }: Props) {
  const { deckId } = useParams<{ deckId: string }>()
  const navigate = useNavigate()
  const deck = decks.find(d => d.id === deckId)
  const deckCards = cards.filter(c => c.deckId === deckId)
  const [showMisremembered, setShowMisremembered] = useState(false)

  // SRSデータに基づく状態分布と復習予想
  const srsStats = useMemo(() => {
    const srsData = loadSRS()
    const now = Date.now()
    const DAY = 24 * 60 * 60 * 1000

    let newCount = 0
    let masteredCount = 0
    let reviewNeededCount = 0
    let unmasteredCount = 0

    const reviewForecast: number[] = [0, 0, 0, 0, 0, 0, 0] // 今日〜7日後

    for (const card of deckCards) {
      const srs = srsData[card.id]
      if (!srs) {
        newCount++
        continue
      }
      switch (srs.status) {
        case 'new': newCount++; break
        case 'mastered':
          masteredCount++
          // 復習予想に追加
          if (srs.nextReview > 0) {
            const daysUntil = Math.max(0, Math.floor((srs.nextReview - now) / DAY))
            if (daysUntil < 7) {
              reviewForecast[daysUntil]++
            }
          }
          break
        case 'review_needed':
          reviewNeededCount++
          reviewForecast[0]++ // 今日が復習日
          break
        case 'unmastered': unmasteredCount++; break
      }
    }

    return { newCount, masteredCount, reviewNeededCount, unmasteredCount, reviewForecast }
  }, [deckCards])

  if (!deck) {
    return (
      <div className="page">
        <p>デッキが見つかりません</p>
        <button className="btn" onClick={() => navigate('/')}>戻る</button>
      </div>
    )
  }

  const history = loadHistory()
  const allRecords: StudyRecord[] = []
  for (const card of deckCards) {
    const recs = history[card.id]
    if (recs) allRecords.push(...recs)
  }

  const stats = calcStats(allRecords)
  const misrememberedIds = getMisrememberedCardIds(history, deckCards)
  const misrememberedCards = deckCards.filter(c => misrememberedIds.includes(c.id))

  const isTerm = deck.type === 'term' && deck.termConfig

  const dayLabels = ['今日', '明日', '2日後', '3日後', '4日後', '5日後', '6日後']

  return (
    <div className="page">
      <header className="page-header">
        <button className="btn-back" onClick={() => navigate(`/deck/${deckId}`)}>← 戻る</button>
        <div>
          <h1>アナリティクス</h1>
          <span className="deck-type-badge">{DECK_TYPE_LABELS[deck.type]}</span>
        </div>
      </header>

      <div className="analytics-deck-name">{deck.name}</div>

      {/* カード状態の分布 */}
      <div className="analytics-section">
        <h2 className="analytics-section-title">カードの状態</h2>
        <div className="analytics-status-grid">
          <div className="analytics-status-item">
            <span className="analytics-status-num">{srsStats.masteredCount}</span>
            <span className="analytics-status-label">⭕️ 定着</span>
          </div>
          <div className="analytics-status-item">
            <span className="analytics-status-num">{srsStats.reviewNeededCount}</span>
            <span className="analytics-status-label">🔺 復習必要</span>
          </div>
          <div className="analytics-status-item">
            <span className="analytics-status-num">{srsStats.unmasteredCount}</span>
            <span className="analytics-status-label">❌ 未定着</span>
          </div>
          <div className="analytics-status-item">
            <span className="analytics-status-num">{srsStats.newCount}</span>
            <span className="analytics-status-label">🆕 新規</span>
          </div>
        </div>
        {deckCards.length > 0 && (
          <div className="analytics-bar-track" style={{ marginTop: 8, height: 12 }}>
            <div
              className="analytics-bar-fill analytics-bar-correct"
              style={{ width: `${pct(srsStats.masteredCount, deckCards.length)}%`, position: 'absolute', left: 0 }}
            />
          </div>
        )}
      </div>

      {/* 復習予想 */}
      <div className="analytics-section">
        <h2 className="analytics-section-title">復習予想（7日間）</h2>
        <p className="analytics-section-desc">各日に復習が必要になるカード数</p>
        <div className="analytics-forecast">
          {srsStats.reviewForecast.map((count, i) => (
            <div key={i} className="analytics-forecast-day">
              <div className="analytics-forecast-bar-wrapper">
                <div
                  className="analytics-forecast-bar"
                  style={{
                    height: `${Math.min(100, count > 0 ? Math.max(10, (count / Math.max(...srsStats.reviewForecast, 1)) * 100) : 0)}%`
                  }}
                />
              </div>
              <span className="analytics-forecast-count">{count}</span>
              <span className="analytics-forecast-label">{dayLabels[i]}</span>
            </div>
          ))}
        </div>
      </div>

      {stats.total === 0 ? (
        <div className="empty-state">
          <p>学習履歴がありません</p>
          <p className="text-secondary">暗記を始めるとここに統計が表示されます</p>
        </div>
      ) : (
        <>
          <div className="analytics-summary">
            <div className="analytics-total">
              <span className="analytics-total-num">{stats.total}</span>
              <span className="analytics-total-label">回答数</span>
            </div>
          </div>

          {/* 答え別統計 */}
          <div className="analytics-section">
            <h2 className="analytics-section-title">答え別</h2>
            <div className="analytics-bars">
              <div className="analytics-bar-row">
                <span className="analytics-bar-label">⭕️ 正解</span>
                <div className="analytics-bar-track">
                  <div
                    className="analytics-bar-fill analytics-bar-correct"
                    style={{ width: `${pct(stats.answerCorrect, stats.total)}%` }}
                  />
                </div>
                <span className="analytics-bar-value">{stats.answerCorrect}回 ({pct(stats.answerCorrect, stats.total)}%)</span>
              </div>
              <div className="analytics-bar-row">
                <span className="analytics-bar-label">🔺 惜しい</span>
                <div className="analytics-bar-track">
                  <div
                    className="analytics-bar-fill analytics-bar-partial"
                    style={{ width: `${pct(stats.answerPartial, stats.total)}%` }}
                  />
                </div>
                <span className="analytics-bar-value">{stats.answerPartial}回 ({pct(stats.answerPartial, stats.total)}%)</span>
              </div>
              <div className="analytics-bar-row">
                <span className="analytics-bar-label">❌ 不正解</span>
                <div className="analytics-bar-track">
                  <div
                    className="analytics-bar-fill analytics-bar-wrong"
                    style={{ width: `${pct(stats.answerWrong, stats.total)}%` }}
                  />
                </div>
                <span className="analytics-bar-value">{stats.answerWrong}回 ({pct(stats.answerWrong, stats.total)}%)</span>
              </div>
            </div>
          </div>

          {/* 覚え間違い統計 */}
          <div className="analytics-section">
            <h2 className="analytics-section-title">覚え間違い</h2>
            <p className="analytics-section-desc">自己評価⭕️なのに答え❌だった回数</p>
            <div className="analytics-highlight">
              <span className="analytics-highlight-num">{stats.misremembered}</span>
              <span className="analytics-highlight-label">回 / {stats.total}回中</span>
            </div>
            <div className="analytics-bar-track" style={{ marginTop: 8 }}>
              <div
                className="analytics-bar-fill analytics-bar-wrong"
                style={{ width: `${pct(stats.misremembered, stats.total)}%` }}
              />
            </div>
            <span className="analytics-bar-value" style={{ marginTop: 4, display: 'block' }}>
              {pct(stats.misremembered, stats.total)}%
            </span>

            {misrememberedCards.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <button
                  className="btn btn-small"
                  onClick={() => setShowMisremembered(!showMisremembered)}
                >
                  {showMisremembered ? '一覧を閉じる' : `覚え間違いの一覧（${misrememberedCards.length}件）`}
                </button>
                {showMisremembered && (
                  <div className="misremembered-list">
                    {misrememberedCards.map(card => {
                      const displayWord = isTerm && card.columns && deck.termConfig
                        ? deck.termConfig.questionColumns.map(ci => card.columns![ci]).filter(Boolean).join(' / ')
                        : card.word
                      const displayMeaning = isTerm && card.columns && deck.termConfig
                        ? deck.termConfig.answerColumns.map(ci => card.columns![ci]).filter(Boolean).join(' / ')
                        : card.meaning

                      return (
                        <div
                          key={card.id}
                          className="misremembered-item"
                          onClick={() => navigate(`/deck/${deckId}/edit/${card.id}`)}
                        >
                          <span className="misremembered-word">{displayWord}</span>
                          <span className="misremembered-meaning">{displayMeaning}</span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
