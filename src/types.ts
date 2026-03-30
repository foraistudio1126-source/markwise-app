export type DeckType = 'word' | 'term'

// 単語タイプ: 発音・接頭辞/接尾辞を問題面か答え面かを選べる
export interface WordConfig {
  pronunciationSide: 'question' | 'answer'  // 発音記号の表示面
  etymologySide: 'question' | 'answer'      // 接頭辞・語源の表示面
}

// 用語タイプ: Markdown列のマッピング設定
export interface TermConfig {
  totalColumns: number             // 総列数
  columnNames: string[]            // 各列の名前
  questionColumns: number[]        // 問題面の列インデックス (0-based)
  answerColumns: number[]          // 答え面の列インデックス (0-based)
  explanationColumns: number[]     // 解説面の列インデックス (0-based)
}

export interface ExplanationDisplay {
  correct: boolean  // ⭕️の時に解説を表示するか
  partial: boolean  // 🔺の時に解説を表示するか
  wrong: boolean    // ❌の時に解説を表示するか
}

export const DEFAULT_EXPLANATION_DISPLAY: ExplanationDisplay = {
  correct: false,
  partial: true,
  wrong: true,
}

export interface Deck {
  id: string
  name: string
  type: DeckType
  wordConfig?: WordConfig
  termConfig?: TermConfig
  explanationDisplay?: ExplanationDisplay
  importSettings?: ImportSettings  // 単語タイプのMarkdownインポート設定
  createdAt: number
  updatedAt: number
}

export interface Card {
  id: string
  deckId: string
  // 単語タイプ用フィールド
  word: string
  pronunciation: string
  etymology: string
  meaning: string
  definition: string  // 語義説明（例: "sudden and unexpected, and often unpleasant"）
  synonyms: string
  antonyms: string
  exampleEn: string
  exampleJa: string
  // 用語タイプ用フィールド
  columns?: string[]
  createdAt: number
  updatedAt: number
}

export type Rating = 'correct' | 'partial' | 'wrong' // ⭕️ 🔺 ❌

export interface StudyRecord {
  cardId: string
  selfRating: Rating    // Step 1: 自己評価
  answerRating: Rating  // Step 2: 正誤確認
  timestamp: number
}

export interface StudyHistory {
  [cardId: string]: StudyRecord[]
}

// 再出題の優先度 (1が最高)
export function getPriority(selfRating: Rating, answerRating: Rating): number {
  if (answerRating === 'correct') return 7
  if (selfRating === 'correct' && answerRating === 'wrong') return 1
  if (selfRating === 'wrong' && answerRating === 'wrong') return 2
  if (selfRating === 'partial' && answerRating === 'wrong') return 3
  if (selfRating === 'correct' && answerRating === 'partial') return 4
  if (selfRating === 'wrong' && answerRating === 'partial') return 5
  if (selfRating === 'partial' && answerRating === 'partial') return 6
  return 7
}

export const DEFAULT_WORD_CONFIG: WordConfig = {
  pronunciationSide: 'question',
  etymologySide: 'question',
}

export interface ImportSettings {
  includeEtymology: boolean         // 接頭辞・接尾辞
  includeDefinition: boolean        // 語義説明
  includeSynonymsAntonyms: boolean  // 類義語・対義語
  includeExamples: boolean          // 例文
}

export const DEFAULT_IMPORT_SETTINGS: ImportSettings = {
  includeEtymology: false,
  includeDefinition: false,
  includeSynonymsAntonyms: true,
  includeExamples: true,
}

export const DECK_TYPE_LABELS: Record<DeckType, string> = {
  'word': '単語',
  'term': '用語',
}
