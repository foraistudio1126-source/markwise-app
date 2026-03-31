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
  importSettings?: ImportSettings       // 単語タイプのMarkdownインポート設定
  autoAdvance?: AutoAdvanceConfig       // 自動コマ送り設定
  reviewInterval?: ReviewIntervalConfig // 復習間隔設定
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

// ===== 復習システム =====

// カードの状態
export type CardStatus = 'new' | 'mastered' | 'review_needed' | 'unmastered'

// カードごとのSRSデータ
export interface CardSRS {
  status: CardStatus
  interval: number            // 現在の復習間隔（日数）
  nextReview: number          // 次回復習日（タイムスタンプ）
  consecutiveCorrect: number  // 連続正解数（間隔増加用）
}

export interface SRSData {
  [cardId: string]: CardSRS
}

// 自動コマ送り設定
export interface AutoAdvanceConfig {
  enabled: boolean
  seconds: number  // 何秒後に自動で裏返すか
}

export const DEFAULT_AUTO_ADVANCE: AutoAdvanceConfig = {
  enabled: false,
  seconds: 5,
}

// 復習間隔設定
export interface ReviewIntervalConfig {
  mode: 'fixed' | 'increasing'  // 固定 or 増加
  baseDays: number              // 基本間隔（日数）
  maxDays: number               // 増加モード時の上限
  resetOnMistake: boolean       // ミス時に間隔をリセットするか
}

export const DEFAULT_REVIEW_INTERVAL: ReviewIntervalConfig = {
  mode: 'increasing',
  baseDays: 1,
  maxDays: 7,
  resetOnMistake: true,
}

// グローバル設定（基本設定）
export interface GlobalSettings {
  defaultWordConfig: WordConfig
  defaultExplanationDisplay: ExplanationDisplay
  defaultAutoAdvance: AutoAdvanceConfig
  defaultReviewInterval: ReviewIntervalConfig
  defaultImportSettings: ImportSettings
}

// ===== 状態遷移ロジック =====

export function determineCardStatus(
  selfRating: Rating,
  answerRating: Rating,
  currentStatus: CardStatus
): CardStatus {
  // 新規カード: どの結果でも「復習必要」に送る
  if (currentStatus === 'new') return 'review_needed'

  // ❌（自己評価）→ 全て未定着
  if (selfRating === 'wrong') return 'unmastered'

  // ⭕️→⭕️ = 定着
  if (selfRating === 'correct' && answerRating === 'correct') return 'mastered'
  // ⭕️→🔺 = 復習必要
  if (selfRating === 'correct' && answerRating === 'partial') return 'review_needed'
  // ⭕️→❌ = 未定着
  if (selfRating === 'correct' && answerRating === 'wrong') return 'unmastered'

  // 🔺→⭕️ = 復習必要
  if (selfRating === 'partial' && answerRating === 'correct') return 'review_needed'
  // 🔺→🔺 = 復習必要
  if (selfRating === 'partial' && answerRating === 'partial') return 'review_needed'
  // 🔺→❌ = 未定着
  if (selfRating === 'partial' && answerRating === 'wrong') return 'unmastered'

  return 'unmastered'
}

// 次回復習日を計算
export function calculateNextReview(
  newStatus: CardStatus,
  currentSRS: CardSRS | undefined,
  config: ReviewIntervalConfig
): { nextReview: number; interval: number; consecutiveCorrect: number } {
  const now = Date.now()
  const DAY = 24 * 60 * 60 * 1000

  if (newStatus === 'mastered') {
    const prevConsecutive = currentSRS?.consecutiveCorrect ?? 0
    const newConsecutive = prevConsecutive + 1

    let interval: number
    if (config.mode === 'fixed') {
      interval = config.baseDays
    } else {
      // 増加: baseDays * consecutive（1→2→3...最大maxDays）
      interval = Math.min(config.baseDays * newConsecutive, config.maxDays)
    }

    return {
      nextReview: now + interval * DAY,
      interval,
      consecutiveCorrect: newConsecutive,
    }
  }

  if (newStatus === 'review_needed') {
    return {
      nextReview: now, // すぐ復習キューに入る
      interval: 0,
      consecutiveCorrect: 0,
    }
  }

  // unmastered / new
  return {
    nextReview: 0,
    interval: 0,
    consecutiveCorrect: 0,
  }
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

export const DEFAULT_GLOBAL_SETTINGS: GlobalSettings = {
  defaultWordConfig: { ...DEFAULT_WORD_CONFIG },
  defaultExplanationDisplay: { ...DEFAULT_EXPLANATION_DISPLAY },
  defaultAutoAdvance: { ...DEFAULT_AUTO_ADVANCE },
  defaultReviewInterval: { ...DEFAULT_REVIEW_INTERVAL },
  defaultImportSettings: { ...DEFAULT_IMPORT_SETTINGS },
}
