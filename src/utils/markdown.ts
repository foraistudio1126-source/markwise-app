import type { Card, TermConfig, ImportSettings } from '../types'
import { DEFAULT_IMPORT_SETTINGS } from '../types'

export function parseMarkdownTable(text: string, deckId: string, importSettings?: ImportSettings): Card[] {
  const settings = { ...DEFAULT_IMPORT_SETTINGS, ...importSettings }

  // 動的に列インデックスを計算
  // 列順: 単語(0), 意味(1), [接頭辞(2)?], [語義説明(?)?], [類義語対義語(?)?], [例文En(?)?], [例文Ja(?)?]
  let nextIdx = 2
  const etymologyIdx = settings.includeEtymology ? nextIdx++ : -1
  const definitionIdx = settings.includeDefinition ? nextIdx++ : -1
  const synonymsIdx = settings.includeSynonymsAntonyms ? nextIdx++ : -1
  const exampleEnIdx = settings.includeExamples ? nextIdx++ : -1
  const exampleJaIdx = settings.includeExamples ? nextIdx++ : -1

  // 前処理: <br> タグを全てスペースに変換
  let normalized = text.replace(/<br\s*\/?>/gi, ' ')

  // 全行を取得し、テーブル行を結合する
  const rawLines = normalized.split('\n')
  const joinedLines: string[] = []
  for (const line of rawLines) {
    const trimmed = line.trim()
    if (trimmed.length === 0) continue

    if (joinedLines.length > 0) {
      const lastLine = joinedLines[joinedLines.length - 1]
      const isLastLineTable = lastLine.startsWith('|')
      const lastPipeCount = (lastLine.match(/\|/g) || []).length
      const expectedCols = nextIdx + 1  // 期待する最大列数 + 区切り
      if (isLastLineTable && lastPipeCount < expectedCols && !trimmed.startsWith('#')) {
        joinedLines[joinedLines.length - 1] = lastLine + ' ' + trimmed
        continue
      }
    }
    joinedLines.push(trimmed)
  }

  const cards: Card[] = []

  for (const line of joinedLines) {
    if (line.startsWith('#')) continue
    if (/^\|[\s\-:|\u2014]+\|?\s*$/.test(line)) continue
    if (line.includes('単語と発音記号') || line.includes('品詞と意味')) continue

    if (!line.startsWith('|')) continue

    const cells = line
      .split('|')
      .map(c => c.trim())
      .filter((_, i, arr) => i > 0 && i < arr.length)

    if (cells.length < 2) continue

    const wordAndPron = (cells[0] || '').replace(/^\*\*(.+?)\*\*/, '$1')
    const meaning = cells[1] || ''

    const pronMatch = wordAndPron.match(/^(.+?)\s*[\[\/](.+?)[\]\/]\s*$/)
    let word = wordAndPron
    let pronunciation = ''
    if (pronMatch) {
      word = pronMatch[1].trim()
      pronunciation = `[${pronMatch[2]}]`
    }
    word = word.replace(/\s+/g, ' ').trim()

    const etymologyRaw = etymologyIdx >= 0 ? (cells[etymologyIdx] || '') : ''
    const definitionRaw = definitionIdx >= 0 ? (cells[definitionIdx] || '') : ''
    const synonymsAntonymsRaw = synonymsIdx >= 0 ? (cells[synonymsIdx] || '') : ''
    const exampleEn = exampleEnIdx >= 0 ? (cells[exampleEnIdx] || '') : ''
    const exampleJa = exampleJaIdx >= 0 ? (cells[exampleJaIdx] || '') : ''

    let synonyms = ''
    let antonyms = ''
    if (synonymsAntonymsRaw && synonymsAntonymsRaw !== '-') {
      const synMatch = synonymsAntonymsRaw.match(/類[:：]\s*(.+?)(?:\s+対[:：]|$)/)
      const antMatch = synonymsAntonymsRaw.match(/対[:：]\s*(.+)$/)
      if (synMatch) synonyms = synMatch[1].trim()
      if (antMatch) antonyms = antMatch[1].trim()
    }

    const now = Date.now()
    cards.push({
      id: crypto.randomUUID(),
      deckId,
      word: word.trim(),
      pronunciation,
      etymology: cleanDash(etymologyRaw),
      meaning: cleanDash(meaning),
      definition: cleanDash(definitionRaw),
      synonyms: cleanDash(synonyms),
      antonyms: cleanDash(antonyms),
      exampleEn: cleanDash(exampleEn),
      exampleJa: cleanDash(exampleJa),
      createdAt: now,
      updatedAt: now,
    })
  }

  return cards
}

// 用語タイプ用: Markdown表を列数に基づいてパース
export function parseMarkdownTableForTerm(text: string, deckId: string, termConfig: TermConfig): Card[] {
  const normalized = text.replace(/<br\s*\/?>/gi, ' ')
  const rawLines = normalized.split('\n')
  const cards: Card[] = []
  let headerSkipped = false

  for (const line of rawLines) {
    const trimmed = line.trim()
    if (trimmed.length === 0) continue
    if (trimmed.startsWith('#')) continue
    if (/^\|[\s\-:|\u2014]+\|?\s*$/.test(trimmed)) {
      headerSkipped = true
      continue
    }
    if (!trimmed.startsWith('|')) continue

    // 最初のデータ行の前にヘッダー行がある場合スキップ
    if (!headerSkipped) {
      headerSkipped = true
      continue
    }

    const cells = trimmed
      .split('|')
      .map(c => c.trim())
      .filter((_, i, arr) => i > 0 && i < arr.length)

    if (cells.length < 2) continue

    // 列数に合わせてパディング
    while (cells.length < termConfig.totalColumns) cells.push('')
    const columns = cells.slice(0, termConfig.totalColumns).map(c => cleanDash(c))

    const wordVal = columns[termConfig.questionColumns[0]] || ''
    const meaningVal = columns[termConfig.answerColumns[0]] || ''

    if (!wordVal && !meaningVal) continue

    const now = Date.now()
    cards.push({
      id: crypto.randomUUID(),
      deckId,
      word: wordVal,
      pronunciation: '',
      etymology: '',
      meaning: meaningVal,
      definition: '',
      synonyms: '',
      antonyms: '',
      exampleEn: '',
      exampleJa: '',
      columns,
      createdAt: now,
      updatedAt: now,
    })
  }

  return cards
}

function cleanDash(val: string): string {
  const trimmed = val.trim()
  return (trimmed === '-' || trimmed === '$-$') ? '' : trimmed
}

export function exportToMarkdown(cards: Card[]): string {
  if (cards.length === 0) return ''

  const header = '| 単語と発音記号 | 品詞と意味 | 類義語・対義語 | 例文（英語） | 例文（日本語訳） |'
  const separator = '|---|---|---|---|---|'

  const rows = cards.map(card => {
    const wordPron = card.pronunciation
      ? `${card.word} ${card.pronunciation}`
      : card.word

    let synAnt = ''
    if (card.synonyms && card.antonyms) {
      synAnt = `類: ${card.synonyms} 対: ${card.antonyms}`
    } else if (card.synonyms) {
      synAnt = `類: ${card.synonyms}`
    } else if (card.antonyms) {
      synAnt = `対: ${card.antonyms}`
    }

    const cells = [
      wordPron || '-',
      card.meaning || '-',
      synAnt || '-',
      card.exampleEn || '-',
      card.exampleJa || '-',
    ]

    return `| ${cells.join(' | ')} |`
  })

  return [header, separator, ...rows].join('\n')
}

// 用語タイプ用エクスポート
export function exportToMarkdownForTerm(cards: Card[], termConfig: TermConfig): string {
  if (cards.length === 0) return ''

  const header = '| ' + termConfig.columnNames.map((n, i) => n || `${i + 1}列目`).join(' | ') + ' |'
  const separator = '|' + termConfig.columnNames.map(() => '---').join('|') + '|'

  const rows = cards.map(card => {
    const cols = card.columns || []
    const cells = termConfig.columnNames.map((_, i) => cols[i] || '-')
    return `| ${cells.join(' | ')} |`
  })

  return [header, separator, ...rows].join('\n')
}
