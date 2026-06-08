import { ACTIONS } from '../shared/actions.js'
import { sendLog } from './logger.js'

function cleanTitle(rawTitle) {
  return rawTitle.replace(/【[^】]*】/g, '').trim()
}

export function extractUserInfo() {
  const scripts = document.querySelectorAll('script')
  let pageScript = ''
  for (const s of scripts) {
    const text = s.textContent
    if (text.includes('var name') || text.includes('CDExpireTime')) {
      pageScript = text
      break
    }
  }

  if (!pageScript) return null

  const extract = (pattern) => {
    const m = pageScript.match(pattern)
    return m ? m[1] : null
  }

  return {
    name: extract(/var\s+name\s*=\s*"([^"]*)"/) || '',
    phone: extract(/var\s+phone\s*=\s*"([^"]*)"/) || '',
    cdExpireTime: extract(/CDExpireTime\s*=\s*"([^"]*)"/) || '',
    isHaveRegistration: extract(/IsHaveRegistration\s*=\s*(\d+)/),
    isContinue: extract(/IsContinue\s*=\s*(\d+)/),
    expireType: extract(/ExpireType\s*=\s*(\d+)/),
  }
}

export function extractTaskList() {
  const container = document.querySelector('.training-list ul')
  if (!container) {
    sendLog('未找到 .training-list ul', 'error')
    return
  }

  const items = container.querySelectorAll('li')
  const tasks = []
  let completedCount = 0

  items.forEach(li => {
    const a = li.querySelector('a')
    if (!a) return
    const rawTitle = a.textContent.trim()
    const url = a.href
    const completed = li.textContent.includes('已学')
    if (completed) completedCount++
    const title = cleanTitle(rawTitle)
    tasks.push({ title, url, completed })
  })

  const userInfo = extractUserInfo()

  chrome.runtime.sendMessage({
    action: ACTIONS.TASK_LIST_EXTRACTED,
    tasks,
    userInfo,
    log: `已抓取 ${tasks.length} 个视频（${completedCount} 个已学）`
  }).catch(e => console.warn('[taskExtractor] sendMessage 失败:', e))
}
