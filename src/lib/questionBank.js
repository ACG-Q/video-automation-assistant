import { jaccardSimilarity, extractKeywords, sha256Hex, extractLetterAnswer } from './utils.js'

const SIMILARITY_THRESHOLD = 0.75
const MIN_KEYWORD_MATCHES = 2

export async function loadQuestionBank() {
  const result = await chrome.storage.local.get('questionBank')
  let bank = result.questionBank || []
  let changed = false
  bank = bank.map(q => {
    if (q.isLocal === undefined) {
      changed = true
      return {
        ...q,
        isLocal: q.source === 'manual' || false,
        syncStatus: 'synced',
        version: 1
      }
    }
    return q
  })
  if (changed) await saveQuestionBank(bank)
  return bank
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
    bank[idx] = {
      ...bank[idx],
      ...entry,
      questionId: hash,
      dateUpdated: new Date().toISOString(),
      version: (bank[idx].version || 0) + 1,
      syncStatus: 'local_modified'
    }
  } else {
    bank.push({
      ...entry,
      questionId: hash,
      isLocal: true,
      source: entry.source || 'manual',
      syncStatus: 'local_modified',
      version: 1,
      dateAdded: entry.dateAdded || new Date().toISOString(),
      dateUpdated: new Date().toISOString()
    })
  }

  await saveQuestionBank(bank)
  return bank
}

export async function syncFromRemote(bankUrl) {
  if (!bankUrl) return { added: 0, conflicts: [] }
  const conflicts = []
  let added = 0

  let remoteList
  try {
    const res = await fetch(bankUrl, { signal: AbortSignal.timeout(10000) })
    if (!res.ok) throw new Error('HTTP ' + res.status)
    remoteList = await res.json()
    if (!Array.isArray(remoteList)) return { added: 0, conflicts: [] }
  } catch (e) {
    console.warn('[questionBank] syncFromRemote 失败:', e.message)
    return { added: -1, conflicts: [] }
  }

  const bank = await loadQuestionBank()

  for (const item of remoteList) {
    if (!item.title) continue

    let options = item.options
    if (!options || !options.length) {
      const keys = ['A', 'B', 'C', 'D', 'E', 'F']
      options = keys.filter(k => item[k]).map(k => k + '. ' + item[k])
    }

    const hash = await sha256Hex(item.title + (options || []).join(''))
    const localIdx = bank.findIndex(q => q.questionId === hash)

    if (localIdx < 0) {
      // 全新远程题
      bank.push({
        questionId: hash,
        title: item.title,
        options: options || [],
        answer: extractLetterAnswer(item.answer || ''),
        source: item.source || bankUrl,
        isLocal: false,
        syncStatus: 'synced',
        version: 1,
        dateAdded: new Date().toISOString(),
        dateUpdated: item.dateUpdated || new Date().toISOString()
      })
      added++
      continue
    }

    // 已存在本地匹配
    const local = bank[localIdx]
    const remoteUpdated = item.dateUpdated || ''

    if (local.isLocal === true) {
      // 本地创建的题，本地权威
      if (remoteUpdated > local.dateUpdated) {
        // 远程有更新，标记冲突
        local.syncStatus = 'conflict'
        conflicts.push({ questionId: hash, title: local.title })
      }
    } else {
      // 之前从远程来的
      if (local.syncStatus === 'local_modified') {
        // 用户改过远程题
        if (local.dateUpdated >= remoteUpdated) {
          // 保留本地，syncStatus 保持 local_modified
        } else if (remoteUpdated > local.dateUpdated) {
          // 远程更新了，覆盖
          bank[localIdx] = {
            ...local,
            title: item.title,
            options: options || [],
            answer: extractLetterAnswer(item.answer || ''),
            source: item.source || local.source,
            dateUpdated: remoteUpdated,
            syncStatus: 'remote_modified',
            version: local.version + 1
          }
        } else {
          local.syncStatus = 'conflict'
          conflicts.push({ questionId: hash, title: local.title })
        }
      } else {
        // 没被改过，直接用远程覆盖
        bank[localIdx] = {
          ...local,
          title: item.title,
          options: options || [],
          answer: extractLetterAnswer(item.answer || ''),
          source: item.source || local.source,
          dateUpdated: remoteUpdated,
          syncStatus: 'synced',
          version: local.version
        }
      }
    }
  }

  if (added > 0 || conflicts.length > 0) await saveQuestionBank(bank)
  return { added, conflicts }
}

export async function syncToRemote(pushUrl) {
  // 预留：后续实现 GitHub API 推送
  return { pushed: 0 }
}
