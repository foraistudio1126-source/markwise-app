import type { Deck, Card, StudyHistory, StudyRecord } from '../types'

const KEYS = {
  decks: 'tangocho-decks',
  cards: 'tangocho-cards',
  history: 'tangocho-history',
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
