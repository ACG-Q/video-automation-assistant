import { jaccardSimilarity, extractKeywords, sha256Hex, extractLetterAnswer } from './utils.js'

const SIMILARITY_THRESHOLD = 0.75
const MIN_KEYWORD_MATCHES = 2

export async function loadQuestionBank() {
  const result = await chrome.storage.local.get('questionBank')
  return result.questionBank || []
}

export async function saveQuestionBank(bank) {
  await chrome.storage.local.set({ questionBank: bank })
}

export async function queryAnswer(title) {
  const bank = await loadQuestionBank()
  if (!title || !bank.length) return []

  const matches = []

  const exact = bank.find(q => q.title && q.title.trim() === title.trim())
  if (exact) {
    matches.push({ ...exact, similarity: 1.0 })
    return matches
  }

  for (const q of bank) {
    if (!q.title) continue
    const score = jaccardSimilarity(title, q.title)
    if (score >= SIMILARITY_THRESHOLD) {
      matches.push({ ...q, similarity: score })
    }
  }

  if (matches.length === 0) {
    const keywords = extractKeywords(title)
    if (keywords.length >= MIN_KEYWORD_MATCHES) {
      for (const q of bank) {
        if (!q.title) continue
        const matched = keywords.filter(k => q.title.includes(k))
        if (matched.length >= MIN_KEYWORD_MATCHES) {
          matches.push({ ...q, similarity: SIMILARITY_THRESHOLD })
        }
      }
    }
  }

  matches.sort((a, b) => b.similarity - a.similarity)
  return matches.map(q => ({
    ...q,
    answer: extractLetterAnswer(q.answer || '')
  }))
}

export async function updateQuestionBank(entry) {
  const bank = await loadQuestionBank()
  const hash = await sha256Hex(entry.title + (entry.options || []).join(''))

  const idx = bank.findIndex(q => q.questionId === hash)
  if (idx >= 0) {
    if (bank[idx].answer !== entry.answer) {
      bank[idx] = { ...bank[idx], ...entry, questionId: hash, dateUpdated: new Date().toISOString() }
    }
  } else {
    bank.push({
      ...entry,
      questionId: hash,
      dateAdded: entry.dateAdded || new Date().toISOString()
    })
  }

  await saveQuestionBank(bank)
  return bank
}

export async function syncRemoteQuestionBank(bankUrl) {
  if (!bankUrl) return 0
  try {
    const res = await fetch(bankUrl, { signal: AbortSignal.timeout(10000) })
    if (!res.ok) throw new Error('HTTP ' + res.status)
    const list = await res.json()
    if (!Array.isArray(list) || !list.length) return 0

    const bank = await loadQuestionBank()
    let added = 0

    for (const item of list) {
      let options = item.options
      if (!options || !options.length) {
        const keys = ['A', 'B', 'C', 'D', 'E', 'F']
        options = keys.filter(k => item[k]).map(k => k + '. ' + item[k])
      }
      if (!item.title) continue
      const hash = await sha256Hex(item.title + (options || []).join(''))
      if (bank.findIndex(q => q.questionId === hash) >= 0) continue
      bank.push({
        questionId: hash,
        title: item.title,
        options: options || [],
        answer: extractLetterAnswer(item.answer || ''),
        source: bankUrl,
        dateAdded: new Date().toISOString()
      })
      added++
    }

    if (added > 0) await saveQuestionBank(bank)
    return added
  } catch (e) {
    console.warn('[questionBank] 远程同步失败:', e.message)
    return -1
  }
}
