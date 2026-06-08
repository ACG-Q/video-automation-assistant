import { queryAnswer } from '../lib/questionBank.js'
import { extractLetterAnswer } from '../lib/utils.js'
import { ACTIONS } from '../shared/actions.js'
import { state } from './state.js'
import { sendLog } from './logger.js'

export function getQuestion() {
  const el = document.querySelector(state.config.qSelector)
  if (!el) return null

  const clone = el.cloneNode(true)
  const btnContainer = clone.querySelector('.quiz-autopilot-btn-container')
  if (btnContainer) btnContainer.remove()

  const title = clone.textContent.trim().replace(/[\n\r\s]+/g, '').replace('题目内容：', '')
  if (!title) return null

  const opts = [...document.querySelectorAll(state.config.oSelector)].map(e => e.textContent.trim())
  return { title, opts }
}

function tryExactMatch(options, ans) {
  return options.find(e => {
    const cleanOpt = e.textContent.replace(/[^A-Za-z0-9]/g, '').toUpperCase()
    const cleanAns = ans.replace(/[^A-Za-z0-9]/g, '').toUpperCase()
    return cleanOpt === cleanAns || cleanOpt.endsWith(cleanAns)
  })
}

function tryPartialMatch(options, ans) {
  return options.find(e => {
    const t = e.textContent.toUpperCase()
    const cleanAns = ans.replace(/[^A-Za-z0-9]/g, '').toUpperCase()
    return t.includes(cleanAns) ||
      (cleanAns.length === 1 && (t.startsWith(cleanAns + '.') || t.startsWith(cleanAns + '、')))
  })
}

function tryLetterPrefixMatch(options, ans) {
  if (!/^[A-Za-z]$/.test(ans)) return null
  return options.find(e => e.textContent.trim().toUpperCase().startsWith(ans.toUpperCase()))
}

function clickOption(target) {
  const input = target.querySelector('input')
  if (input) {
    input.checked = true
    input.click()
    input.dispatchEvent(new Event('change', { bubbles: true }))
    return true
  }
  const label = target.querySelector('label')
  if (label) { label.click(); return true }
  const child = target.querySelector('span, em, strong')
  if (child) { child.click(); return true }
  target.click()
  return true
}

export function selectAnswer(answerText) {
  if (!answerText) return false

  const options = [...document.querySelectorAll(state.config.oSelector)]
  if (!options.length) return false

  let success = false
  const answers = answerText.includes(',') ? answerText.split(',').map(a => a.trim()) : [answerText]

  answers.forEach(ans => {
    const opt = tryExactMatch(options, ans) || tryPartialMatch(options, ans) || tryLetterPrefixMatch(options, ans)
    if (opt) {
      clickOption(opt)
      success = true
    }
  })

  return success
}

function submitAnswer() {
  const btn = document.querySelector('button[answer=""]')
  if (btn && btn.textContent.includes('答案提交')) {
    btn.click()
    return true
  }
  return false
}

export async function checkAndAnswer() {
  if (state.disposed) return
  const question = getQuestion()
  if (!question || !question.title) return

  if (question.title !== state.lastQuestionTitle) {
    sendLog('检测到新题目')
    state.searchPaused = false
    state.retryCount = 0
    state.lastQuestionTitle = question.title
  } else if (state.searchPaused) {
    return
  }
  const results = await queryAnswer(question.title)
  if (results && results.length > 0 && results[0].similarity >= 0.75) {
    const ans = results[0]
    sendLog('匹配到答案: ' + ans.answer + ' (相似度: ' + Math.round(ans.similarity * 100) + '%, 来源: ' + ans.source + ')')
    if (state.config.autoAnswer) {
      const ok = selectAnswer(ans.answer)
      sendLog(ok ? '已自动选择答案: ' + ans.answer : '选择答案失败: ' + ans.answer, ok ? 'success' : 'error')
      if (state.config.autoSubmit && ok) {
        const submitted = submitAnswer()
        sendLog(submitted ? '已提交答案' : '提交答案失败', submitted ? 'success' : 'error')
      }
    }
    state.searchPaused = true
    state.retryCount = 0
    chrome.runtime.sendMessage({
      action: ACTIONS.UPDATE_QUESTION,
      question: question.title,
      options: question.opts,
      matchResult: { answer: ans.answer, similarity: ans.similarity, source: ans.source }
    }).catch(() => {})
  } else {
    state.retryCount++
    sendLog('未匹配到答案 (' + state.retryCount + '/' + state.config.retryTimes + ')', 'warn')
    if (state.retryCount === 1 || state.retryCount > state.config.retryTimes) {
      chrome.runtime.sendMessage({
        action: ACTIONS.UPDATE_QUESTION,
        question: question.title,
        options: question.opts,
        matchResult: null
      }).catch(() => {})
    }
    if (state.retryCount > state.config.retryTimes) {
      sendLog('已达最大重试次数，暂停搜索', 'warn')
      state.searchPaused = true
      state.retryCount = 0
    }
  }
}

export function startAutoAnswer() {
  if (state.autoAnswerTimer) clearInterval(state.autoAnswerTimer)
  if (!window.location.href.includes('CourseShow')) return
  sendLog('启动自动答题 (间隔: ' + (state.config.interval || 1500) + 'ms)')
  state.autoAnswerTimer = setInterval(checkAndAnswer, state.config.interval || 1500)
}

let _applyingAnswer = false

export function setupCorrectAnswerObserver() {
  if (state.answerObserver) state.answerObserver.disconnect()
  sendLog('启动正确答案监听')

  let lastProcessedTitle = ''

  const observer = new MutationObserver(async () => {
    if (_applyingAnswer) return
    const detailCnt = document.querySelector('.detail-cnt')
    const rightAnswer = document.querySelector('#right')
    if (!detailCnt || !rightAnswer || !rightAnswer.textContent.trim()) return

    const answer = rightAnswer.textContent.trim()
    const question = getQuestion()
    if (!question || question.title === lastProcessedTitle) return

    lastProcessedTitle = question.title

    const entry = {
      title: question.title,
      options: question.opts,
      answer: extractLetterAnswer(answer),
      source: window.location.href,
      dateAdded: new Date().toISOString()
    }

    sendLog('监听到正确答案: ' + entry.answer + '，已更新题库', 'success')
    chrome.runtime.sendMessage({ action: ACTIONS.QUESTION_BANK_UPDATE, entry })

    _applyingAnswer = true
    const results = await queryAnswer(question.title)
    if (results.length > 0 && results[0].similarity >= 0.75) {
      const correctLetter = extractLetterAnswer(answer)
      const selectedText = results[0].answer
      if (selectedText !== correctLetter) {
        selectAnswer(correctLetter)
        submitAnswer()
      }
    }
    _applyingAnswer = false
  })

  observer.observe(document.body, { childList: true, subtree: true })
  state.answerObserver = observer
}

export function setupContinueButtonObserver() {
  if (state.continueObserver) state.continueObserver.disconnect()
  if (state.nextVideoTimer) clearTimeout(state.nextVideoTimer)
  sendLog('启动继续观看按钮监听')
  let lastClickTime = 0
  const observer = new MutationObserver(() => {
    const btn = document.querySelector('button[next=""]') ||
      [...document.querySelectorAll('button')].find(b => b.textContent.includes('继续观看'))
    if (btn && !btn.disabled) {
      const now = Date.now()
      if (now - lastClickTime < 3000) return
      lastClickTime = now
      sendLog('点击继续观看按钮')
      state.searchPaused = false
      state.retryCount = 0
      state.lastQuestionTitle = ''
      btn.click()

      if (state.nextVideoTimer) clearTimeout(state.nextVideoTimer)
      state.nextVideoTimer = setTimeout(() => {
        state.nextVideoTimer = null
        if (!document.querySelector('.topic-main') && !document.querySelector('video')) {
          sendLog('课程已完成，进入下一个任务', 'success')
          chrome.runtime.sendMessage({ action: ACTIONS.VIDEO_ENDED }).catch(() => {})
        }
      }, 8000)
    }
  })
  observer.observe(document.body, { childList: true, subtree: true })
  state.continueObserver = observer
}
