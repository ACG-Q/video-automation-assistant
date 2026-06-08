import { loadConfig } from '../lib/configManager.js'
import { ACTIONS } from '../shared/actions.js'
import { state, cleanup } from './state.js'
import { extractTaskList, extractUserInfo } from './taskExtractor.js'
import { setupVideoControl, executeVideoCommand } from './videoControl.js'
import { startAutoAnswer, selectAnswer, getQuestion, setupCorrectAnswerObserver, setupContinueButtonObserver } from './autoAnswer.js'
import { extractLetterAnswer } from '../lib/utils.js'
import { sendLog } from './logger.js'

let _listenersReady = false

function setupMessageListeners() {
  if (_listenersReady) return
  _listenersReady = true
  chrome.runtime.onMessage.addListener((message) => {
    switch (message.action) {
      case ACTIONS.EXTRACT_TASK_LIST:
        extractTaskList()
        break
      case ACTIONS.CONFIG_UPDATED:
        Object.assign(state.config, message.config)
        break
      case ACTIONS.VIDEO_COMMAND:
        executeVideoCommand(message.command, message.value)
        break
      case ACTIONS.APPLY_MANUAL_CHOICE: {
        selectAnswer(message.answer)
        const q = getQuestion()
        if (q) {
          const entry = {
            title: q.title,
            options: q.opts,
            answer: extractLetterAnswer(message.answer),
            source: '手动选择',
            dateAdded: new Date().toISOString()
          }
          chrome.runtime.sendMessage({ action: ACTIONS.QUESTION_BANK_UPDATE, entry })
          sendLog('手动答案已保存到题库: ' + entry.answer, 'success')
        }
        break
      }
    }
  })
}

async function init() {
  if (document.getElementById('__va_ready')) {
    cleanup()
    const old = document.getElementById('__va_ready')
    old.parentNode?.removeChild(old)
  }
  const marker = document.createElement('div')
  marker.id = '__va_ready'
  marker.style.display = 'none'
  document.documentElement.appendChild(marker)
  state.config = await loadConfig()
  setupMessageListeners()
  setupCorrectAnswerObserver()
  setupContinueButtonObserver()

  sendLog('内容脚本已初始化 - ' + window.location.href)

  if (window.location.href.includes('CourseShow')) {
    sendLog('检测到课程播放页')
    startAutoAnswer()
    setupVideoControl()
  }

  if (window.location.href.includes('UserCenter')) {
    sendLog('检测到个人中心页')
    const info = extractUserInfo()
    if (info) {
      sendLog('已提取用户信息: ' + info.name)
      chrome.runtime.sendMessage({ action: ACTIONS.USER_INFO_DETECTED, userInfo: info }).catch(() => {})
    }
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init)
} else {
  init()
}
