import type { Deck, Card, StudyHistory, StudyRecord, SRSData, CardSRS, GlobalSettings } from '../types'
import { DEFAULT_GLOBAL_SETTINGS } from '../types'

const KEYS = {
  decks: 'tangocho-decks',
  cards: 'tangocho-cards',
  history: 'tangocho-history',
  srs: 'tangocho-srs',
  globalSettings: 'tangocho-global-settings',
} as const

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

function save(key: string, data: unknown): void {
  localStorage.setItem(key, JSON.stringify(data))
}

// Decks
export function loadDecks(): Deck[] {
  return load<Deck[]>(KEYS.decks, [])
}

export function saveDecks(decks: Deck[]): void {
  save(KEYS.decks, decks)
}

// Cards
export function loadCards(): Card[] {
  return load<Card[]>(KEYS.cards, [])
}

export function saveCards(cards: Card[]): void {
  save(KEYS.cards, cards)
}

// Study History
export function loadHistory(): StudyHistory {
  return load<StudyHistory>(KEYS.history, {})
}

export function saveHistory(history: StudyHistory): void {
  save(KEYS.history, history)
}

export function addStudyRecord(cardId: string, record: StudyRecord): void {
  const history = loadHistory()
  if (!history[cardId]) history[cardId] = []
  history[cardId].push(record)
  saveHistory(history)
}

export function getLatestRecord(cardId: string): StudyRecord | null {
  const history = loadHistory()
  const records = history[cardId]
  if (!records || records.length === 0) return null
  return records[records.length - 1]
}

// ===== SRS Data =====
export function loadSRS(): SRSData {
  return load<SRSData>(KEYS.srs, {})
}

export function saveSRS(data: SRSData): void {
  save(KEYS.srs, data)
}

export function getCardSRS(cardId: string): CardSRS | undefined {
  const data = loadSRS()
  return data[cardId]
}

export function updateCardSRS(cardId: string, srs: CardSRS): void {
  const data = loadSRS()
  data[cardId] = srs
  saveSRS(data)
}

export function deleteCardSRS(cardId: string): void {
  const data = loadSRS()
  delete data[cardId]
  saveSRS(data)
}

// ===== Global Settings =====
export function loadGlobalSettings(): GlobalSettings {
  return load<GlobalSettings>(KEYS.globalSettings, { ...DEFAULT_GLOBAL_SETTINGS })
}

export function saveGlobalSettings(settings: GlobalSettings): void {
  save(KEYS.globalSettings, settings)
}

// ===== 復習対象カードの取得 =====
export function getReviewDueCards(cardIds: string[]): string[] {
  const srsData = loadSRS()
  const now = Date.now()
  return cardIds.filter(id => {
    const srs = srsData[id]
    if (!srs) return false
    // 定着カードで復習日が来ているもの
    if (srs.status === 'mastered' && srs.nextReview <= now) return true
    // 復習必要カード
    if (srs.status === 'review_needed') return true
    return false
  })
}
