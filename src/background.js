import { loadConfig, saveConfig } from './lib/configManager.js'
import { updateQuestionBank, loadQuestionBank, syncFromRemote, syncToRemote } from './lib/questionBank.js'
import { ACTIONS } from './shared/actions.js'

const logCache = new Map()
let pendingAppend = false

function compareVersions(a, b) {
  const pa = a.split('.').map(Number)
  const pb = b.split('.').map(Number)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const na = pa[i] || 0
    const nb = pb[i] || 0
    if (na > nb) return 1
    if (na < nb) return -1
  }
  return 0
}

async function checkLatestVersion() {
  try {
    const res = await fetch('https://api.github.com/repos/ACG-Q/video-automation-assistant/releases/latest', {
      signal: AbortSignal.timeout(10000)
    })
    if (!res.ok) throw new Error('HTTP ' + res.status)
    const data = await res.json()
    const latest = data.tag_name.replace(/^v/, '')
    const current = chrome.runtime.getManifest().version
    return {
      current,
      latest,
      hasUpdate: compareVersions(latest, current) > 0,
      url: data.html_url,
      releaseName: data.name || data.tag_name
    }
  } catch {
    return null
  }
}

async function getTaskQueue() {
  const result = await chrome.storage.session.get('taskQueue')
  return result.taskQueue || { tasks: [], currentIndex: 0 }
}

async function setTaskQueue(queue) {
  await chrome.storage.session.set({ taskQueue: queue })
}

async function clearTaskQueue() {
  await chrome.storage.session.remove('taskQueue')
}

async function notifySidebar(data) {
  chrome.runtime.sendMessage(data).catch(() => {})
}

async function playNextVideo() {
  const queue = await getTaskQueue()
  const config = await loadConfig()
  if (config.queuePaused) return

  let { tasks, currentIndex } = queue
  while (currentIndex < tasks.length && tasks[currentIndex].completed) {
    currentIndex++
  }

  if (currentIndex < tasks.length) {
    queue.currentIndex = currentIndex
    await setTaskQueue(queue)
    await chrome.tabs.update({ url: tasks[currentIndex].url })
  } else {
    await clearTaskQueue()
    notifySidebar({ action: ACTIONS.ALL_COMPLETE })
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  ;(async () => {
    try {
      switch (message.action) {
      case ACTIONS.FETCH_TASKS: {
        pendingAppend = !!message.append
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
        if (tab && tab.url && tab.url.includes('UserCenter')) {
          chrome.tabs.sendMessage(tab.id, { action: ACTIONS.EXTRACT_TASK_LIST }).catch(() => {})
        }
        break
      }

      case ACTIONS.TASK_LIST_EXTRACTED: {
        const existing = pendingAppend ? await getTaskQueue() : { tasks: [], currentIndex: 0 }
        pendingAppend = false
        const merged = existing.tasks.slice()
        message.tasks.forEach(t => {
          if (!merged.find(m => m.url === t.url)) merged.push(t)
        })
        const queue = { tasks: merged, currentIndex: existing.currentIndex }
        await setTaskQueue(queue)
        if (message.userInfo) {
          await chrome.storage.session.set({ userInfo: message.userInfo })
        }
        break
      }

      case ACTIONS.VIDEO_ENDED: {
        await playNextVideo()
        break
      }

      case ACTIONS.SKIP_VIDEO: {
        const queue = await getTaskQueue()
        queue.currentIndex++
        await setTaskQueue(queue)
        await playNextVideo()
        break
      }

      case ACTIONS.PLAY_SPECIFIC: {
        const queue = await getTaskQueue()
        queue.currentIndex = message.index
        await setTaskQueue(queue)
        if (queue.tasks[message.index]) {
          await chrome.tabs.update({ url: queue.tasks[message.index].url })
        }
        break
      }

      case ACTIONS.TOGGLE_PAUSE_QUEUE: {
        const config = await loadConfig()
        config.queuePaused = !config.queuePaused
        await saveConfig({ queuePaused: config.queuePaused })
        notifySidebar({ action: ACTIONS.QUEUE_PAUSED_CHANGED, paused: config.queuePaused })
        if (!config.queuePaused) await playNextVideo()
        break
      }

      case ACTIONS.START_QUEUE: {
        const cfg = await loadConfig()
        cfg.queuePaused = false
        await saveConfig({ queuePaused: false })
        notifySidebar({ action: ACTIONS.QUEUE_PAUSED_CHANGED, paused: false })
        await playNextVideo()
        break
      }

      case ACTIONS.CLEAR_QUEUE: {
        await clearTaskQueue()
        break
      }

      case ACTIONS.USER_INFO_DETECTED: {
        await chrome.storage.session.set({ userInfo: message.userInfo })
        break
      }

      case ACTIONS.UPDATE_CONFIG: {
        await saveConfig(message.config)
        const tabs = await chrome.tabs.query({ url: '*://cdeaa.com/*' })
        for (const tab of tabs) {
          chrome.tabs.sendMessage(tab.id, { action: ACTIONS.CONFIG_UPDATED, config: message.config }).catch(() => {})
        }
        break
      }

      case ACTIONS.UPDATE_QUESTION: {
        notifySidebar(message)
        break
      }

      case ACTIONS.UPDATE_VIDEO_PROGRESS: {
        notifySidebar(message)
        break
      }

      case ACTIONS.QUESTION_BANK_UPDATE: {
        const bank = await updateQuestionBank(message.entry)
        sendResponse({ bank })
        break
      }

      case ACTIONS.LOG: {
        const key = (sender.tab?.id || 'bg') + '|' + message.log
        const now = Date.now()
        if (logCache.has(key) && now - logCache.get(key) < 2000) break
        logCache.set(key, now)
        if (logCache.size > 200) {
          const entries = [...logCache.entries()].sort((a, b) => a[1] - b[1])
          const cutoff = now - 5000
          const toDelete = entries.filter(([k, t]) => t < cutoff)
          if (toDelete.length === 0) toDelete.push(entries[0])
          for (const [k] of toDelete) logCache.delete(k)
        }
        notifySidebar({ action: ACTIONS.LOG, log: message.log, logType: message.logType })
        break
      }

      case ACTIONS.MANUAL_SUBMIT_REQUEST: {
        await chrome.windows.create({
          url: `manual-select.html?title=${encodeURIComponent(message.question.title)}&opts=${encodeURIComponent(JSON.stringify(message.question.opts))}`,
          type: 'popup',
          width: 400,
          height: 500
        })
        break
      }

      case ACTIONS.MANUAL_CHOICE_MADE: {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
        if (tab) {
          chrome.tabs.sendMessage(tab.id, { action: ACTIONS.APPLY_MANUAL_CHOICE, answer: message.answer }).catch(() => {})
        }
        break
      }

      case ACTIONS.VIDEO_COMMAND: {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
        if (tab) {
          chrome.tabs.sendMessage(tab.id, { action: ACTIONS.VIDEO_COMMAND, command: message.command, value: message.value }).catch(() => {})
        }
        break
      }

      case ACTIONS.CHECK_VERSION: {
        const info = await checkLatestVersion()
        if (info) notifySidebar({ action: ACTIONS.VERSION_RESULT, ...info })
        break
      }

      case ACTIONS.REQUEST_SYNC: {
        const cfg = await loadConfig()
        const result = await syncFromRemote(cfg.bankUrl)
        const bank = await loadQuestionBank()
        chrome.runtime.sendMessage({
          action: ACTIONS.SYNC_RESULT,
          added: result.added,
          total: bank.length,
          conflicts: result.conflicts
        }).catch(() => {})
        break
      }

      case ACTIONS.PUSH_SYNC: {
        const cfg = await loadConfig()
        const result = await syncToRemote(cfg.pushUrl)
        const bank = await loadQuestionBank()
        chrome.runtime.sendMessage({
          action: ACTIONS.PUSH_SYNC_RESULT,
          pushed: result.pushed,
          total: bank.length
        }).catch(() => {})
        break
      }
    }
  } catch (e) {
    console.error('[background] 消息处理错误:', e)
  }
  })()
  return message.action === ACTIONS.QUESTION_BANK_UPDATE
})

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'version-check') {
    const info = await checkLatestVersion()
    if (info && info.hasUpdate) {
      notifySidebar({ action: ACTIONS.VERSION_RESULT, ...info })
    }
  }
})

async function trySync() {
  const config = await loadConfig()
  if (config.bankUrl) {
    const result = await syncFromRemote(config.bankUrl)
    if (result.added > 0) notifySidebar({ action: ACTIONS.LOG, log: '远程题库已同步，新增 ' + result.added + ' 题' })
  }
}

chrome.runtime.onInstalled.addListener(async () => {
  await loadConfig()
  await trySync()
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {})
  chrome.alarms.create('version-check', { periodInMinutes: 1440 })
})
