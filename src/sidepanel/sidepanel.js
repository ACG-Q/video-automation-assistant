import { ACTIONS } from '../shared/actions.js'
import { loadConfig } from '../lib/configManager.js'
import { buildAiPrompt } from '../lib/utils.js'

const ICONS = {
  play: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>',
  pause: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>',
  forward: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 17l5-5-5-5"/><path d="M6 17l5-5-5-5"/></svg>',
  backward: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 17l-5-5 5-5"/><path d="M18 17l-5-5 5-5"/></svg>',
  skip: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
  copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>',
  user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
  list: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>',
  video: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>',
  speed: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
  cloud: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 002 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>',
  alert: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>',
  pauseCircle: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="10" y1="15" x2="10" y2="9"/><line x1="14" y1="15" x2="14" y2="9"/></svg>',
  trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>',
  database: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>',
}

let currentTab = 'tasks'
let taskQueue = { tasks: [], currentIndex: 0 }
let config = {}
let userInfo = null
let lastActiveTabUrl = ''
let versionInfo = null

function icon(name) {
  return ICONS[name] || ''
}

async function refreshState() {
  const session = await chrome.storage.session.get(['taskQueue', 'userInfo'])
  taskQueue = session.taskQueue || { tasks: [], currentIndex: 0 }
  userInfo = session.userInfo || null
  config = await loadConfig()
}

function renderGuide() {
  const el = document.getElementById('contentArea')
  el.innerHTML = `
    <div style="text-align:center;padding:24px 0 16px;color:var(--text-muted);font-size:13px;">
      请在 cdeaa.com 中使用此扩展
    </div>
    <div class="card">
      <div class="card-title">个人中心</div>
      <div class="card-desc">从课程列表抓取所有视频任务</div>
      <button class="btn btn-block" id="openCenter">${icon('user')} 打开个人中心</button>
    </div>
    <div class="card">
      <div class="card-title">课程播放页</div>
      <div class="card-desc">进入课程后自动识别并控制视频</div>
      <button class="btn btn-block btn-secondary" id="openCourse">${icon('video')} 打开课程</button>
    </div>
  `

  document.getElementById('openCenter')?.addEventListener('click', () => {
    chrome.tabs.create({ url: 'https://cdeaa.com/UserCenter' })
  })
  document.getElementById('openCourse')?.addEventListener('click', async () => {
    const session = await chrome.storage.session.get('taskQueue')
    const q = session.taskQueue
    if (q && q.tasks.length > 0 && q.currentIndex < q.tasks.length) {
      chrome.tabs.create({ url: q.tasks[q.currentIndex].url })
    } else {
      chrome.tabs.create({ url: 'https://cdeaa.com/UserCenter' })
    }
  })
}

function renderTasks() {
  const el = document.getElementById('contentArea')
  const done = taskQueue.tasks.filter(t => t.completed).length
  const total = taskQueue.tasks.length
  const pct = total > 0 ? Math.round(done / total * 100) : 0

  const regText = userInfo.isHaveRegistration === '1' ? '已报名' : userInfo.isHaveRegistration === '0' ? '未报名' : userInfo.isHaveRegistration
  const contText = userInfo.isContinue === '1' ? '已续报' : userInfo.isContinue === '0' ? '未续报' : userInfo.isContinue
  const expireText = userInfo.expireType === '0' ? '未过期' : userInfo.expireType === '1' ? '已过期' : userInfo.expireType === '2' ? '即将过期' : userInfo.expireType
  const userHtml = userInfo ? `
    <div class="user-info">
      <div><span class="ulabel">姓名</span><span>${userInfo.name || '-'}</span></div>
      <div><span class="ulabel">手机</span><span>${userInfo.phone || '-'}</span></div>
      <div><span class="ulabel">有效期至</span><span>${userInfo.cdExpireTime || '-'}</span></div>
      <div><span class="ulabel">报名</span><span>${regText || '-'}</span></div>
      <div><span class="ulabel">续报</span><span>${contText || '-'}</span></div>
      <div><span class="ulabel">到期状态</span><span>${expireText || '-'}</span></div>
    </div>
  ` : ''

  el.innerHTML = `
    ${userHtml}
    <div style="display:flex;gap:6px;">
      <button class="btn btn-block" id="fetchBtn">${icon('cloud')} 抓取</button>
      <button class="btn btn-block btn-secondary" id="appendBtn">${icon('list')} 追加</button>
    </div>
    ${total > 0 ? `
      <div style="margin-top:12px;">
        <div style="display:flex;justify-content:space-between;font-size:12px;color:var(--text-secondary);">
          <span>进度</span>
          <span>${done} / ${total} (${pct}%)</span>
        </div>
        <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>
      </div>
      <div id="queueList" style="margin-top:6px;"></div>
      <div style="display:flex;gap:6px;margin-top:10px;">
        <button class="btn btn-sm btn-secondary" id="pauseBtn" style="flex:1;">
          ${icon(config.queuePaused ? 'play' : 'pauseCircle')}
          ${config.queuePaused ? '恢复队列' : '暂停队列'}
        </button>
        <button class="btn btn-sm btn-danger" id="clearBtn" style="flex:1;">
          ${icon('trash')} 清空队列
        </button>
      </div>
    ` : ''}
  `

  document.getElementById('fetchBtn')?.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: ACTIONS.FETCH_TASKS })
  })
  document.getElementById('appendBtn')?.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: ACTIONS.FETCH_TASKS, append: true })
  })
  document.getElementById('pauseBtn')?.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: ACTIONS.TOGGLE_PAUSE_QUEUE })
  })
  document.getElementById('clearBtn')?.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: ACTIONS.CLEAR_QUEUE })
  })

  const listEl = document.getElementById('queueList')
  if (!listEl) return
  listEl.innerHTML = taskQueue.tasks.map((t, i) => {
    const isDone = t.completed
    const isCur = i === taskQueue.currentIndex && !isDone
    const cls = `queue-item${isDone ? ' done' : ''}${isCur ? ' active' : ''}`
    const statusIcon = isDone ? icon('check') : isCur ? icon('play') : `<span style="color:var(--text-muted)">${i + 1}</span>`
    const statusColor = isDone ? 'var(--success)' : isCur ? 'var(--primary)' : 'transparent'
    return `<div class="${cls}" data-idx="${i}">
      <span class="q-status" style="color:${isDone || isCur ? statusColor : 'var(--text-muted)'}">${statusIcon}</span>
      <span class="q-title">${t.title}</span>
      <span class="q-idx">${isDone ? '' : (isCur ? '' : '')}</span>
    </div>`
  }).join('')

  listEl.querySelectorAll('.queue-item').forEach(el => {
    el.addEventListener('click', () => {
      const idx = parseInt(el.dataset.idx)
      chrome.runtime.sendMessage({ action: ACTIONS.PLAY_SPECIFIC, index: idx })
    })
  })
}

function renderPlay() {
  const el = document.getElementById('contentArea')
  const cur = taskQueue.currentIndex
  const curTask = taskQueue.tasks[cur]
  const done = taskQueue.tasks.filter(t => t.completed).length

  el.innerHTML = `
    <div class="card" style="margin-bottom:10px;">
      <div style="font-size:12px;color:var(--text-muted);margin-bottom:2px;">当前视频</div>
      <div style="font-weight:600;font-size:14px;margin-bottom:4px;" id="vidTitle">${curTask ? curTask.title : '-'}</div>
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <span style="font-size:11px;color:var(--text-secondary);">${done} / ${taskQueue.tasks.length} 已完成</span>
        <button class="btn btn-sm" id="skipBtn" style="padding:5px 12px;">${icon('skip')} 跳过</button>
      </div>
    </div>

    <div class="section-label">${icon('video')} 视频控制</div>
    <div class="control-grid">
      <button class="control-btn" id="backBtn">${icon('backward')}<span>快退</span></button>
      <button class="control-btn is-primary" id="playBtn">${icon('play')}<span>播放/暂停</span></button>
      <button class="control-btn" id="fwdBtn">${icon('forward')}<span>快进</span></button>
    </div>

    <div class="section-label" style="margin-top:4px;">${icon('speed')} 倍速</div>
    <div class="speed-group" style="margin-bottom:12px;">
      <button class="speed-chip" data-sp="1.0">1.0x</button>
      <button class="speed-chip" data-sp="1.5">1.5x</button>
      <button class="speed-chip is-active" data-sp="2.0">2.0x</button>
      <button class="speed-chip" data-sp="2.5">2.5x</button>
      <button class="speed-chip" data-sp="3.0">3.0x</button>
      <input class="speed-input" type="number" step="0.25" min="0.25" max="16" value="2.0" id="spInput">
      <button class="btn btn-sm btn-secondary" id="spSetBtn">设置</button>
    </div>

    <div class="section-label">${icon('cloud')} 自动答题</div>
    <div class="status-row" style="margin-bottom:8px;">
      <span style="font-size:13px;">
        状态: <span class="badge ${config.autoAnswer ? 'badge-on' : 'badge-off'}" id="ansStatus">${config.autoAnswer ? '开' : '关'}</span>
        <span style="margin-left:8px;color:var(--text-muted);font-size:11px;" id="bankCount"></span>
      </span>
      <button class="btn btn-sm btn-secondary" id="toggleAns">${config.autoAnswer ? icon('pauseCircle') : icon('play')} ${config.autoAnswer ? '关闭' : '开启'}</button>
    </div>
    <div class="match-card" id="matchCard" style="display:none;"></div>
  `

  document.getElementById('skipBtn')?.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: ACTIONS.SKIP_VIDEO })
  })
  document.getElementById('backBtn')?.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: ACTIONS.VIDEO_COMMAND, command: 'backward' })
  })
  document.getElementById('playBtn')?.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: ACTIONS.VIDEO_COMMAND, command: 'togglePlay' })
  })
  document.getElementById('fwdBtn')?.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: ACTIONS.VIDEO_COMMAND, command: 'forward' })
  })

  document.querySelectorAll('[data-sp]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-sp]').forEach(b => b.classList.remove('is-active'))
      btn.classList.add('is-active')
      chrome.runtime.sendMessage({ action: ACTIONS.VIDEO_COMMAND, command: 'speed', value: parseFloat(btn.dataset.sp) })
    })
  })
  document.getElementById('spSetBtn')?.addEventListener('click', () => {
    const v = parseFloat(document.getElementById('spInput')?.value)
    if (v) chrome.runtime.sendMessage({ action: ACTIONS.VIDEO_COMMAND, command: 'speed', value: v })
  })
  chrome.storage.local.get('questionBank').then(r => {
    const el = document.getElementById('bankCount')
    if (el) el.textContent = '题库: ' + (r.questionBank?.length || 0) + ' 题'
  })

  document.getElementById('toggleAns')?.addEventListener('click', () => {
    const nv = !config.autoAnswer
    chrome.runtime.sendMessage({ action: ACTIONS.UPDATE_CONFIG, config: { autoAnswer: nv } })
    config.autoAnswer = nv
    const badge = document.getElementById('ansStatus')
    const btn = document.getElementById('toggleAns')
    if (badge) {
      badge.textContent = nv ? '开' : '关'
      badge.className = `badge ${nv ? 'badge-on' : 'badge-off'}`
    }
    if (btn) {
      btn.innerHTML = `${nv ? icon('pauseCircle') : icon('play')} ${nv ? '关闭' : '开启'}`
    }
  })
}

const LOG_MAX_ENTRIES = 200

function appendLog(msg, type) {
  const area = document.getElementById('logArea')
  if (!area) return
  const last = area.lastElementChild
  if (last && last.textContent === msg) return
  const dotClass = type || 'info'
  const entry = document.createElement('div')
  entry.className = 'log-entry'
  entry.innerHTML = `<span class="log-dot ${dotClass}"></span><span>${msg}</span>`
  area.appendChild(entry)
  while (area.childElementCount > LOG_MAX_ENTRIES) {
    area.removeChild(area.firstElementChild)
  }
  area.scrollTop = area.scrollHeight
}

function showMatch(card, data, question, options) {
  if (!card) return
  card.style.display = 'block'
  let html = ''

  html += `<span class="label">题目</span><div class="match-value">${question}</div>`

  if (options && options.length) {
    html += `<span class="label">选项</span><div class="match-value" style="font-size:12px;">${options.join('<br>')}</div>`
  }

  if (data) {
    html += `<div class="match-divider"></div>
      <div class="match-row">
        <span class="match-row-item">${icon('check')} 答案: ${data.answer}</span>
        <span class="match-row-item">${icon('speed')} ${Math.round(data.similarity * 100)}%</span>
        <span class="match-row-item">${icon('cloud')} ${data.source || '题库'}</span>
      </div>`
  } else {
    html += `<div class="match-divider"></div>
      <div class="no-match" style="color:var(--warning);font-size:12px;display:flex;align-items:center;gap:4px;">
        ${icon('alert')} 未匹配到答案
      </div>`
  }

  html += `<div style="display:flex;gap:6px;margin-top:10px;">
    <button class="btn btn-sm" id="copyAiBtn" style="flex:1;">${icon('copy')} 复制到AI</button>
    ${!data ? '<button class="btn btn-sm btn-secondary" id="manualBtn" style="flex:1;">手动选择</button>' : ''}
  </div>`

  card.innerHTML = html

  requestAnimationFrame(() => {
    const copyBtn = document.getElementById('copyAiBtn')
    if (!copyBtn) return
    copyBtn.addEventListener('click', () => {
      const promptText = buildAiPrompt(question, options, data)
      navigator.clipboard.writeText(promptText)
        .then(() => {
          copyBtn.textContent = icon('check') + ' 已复制!'
          setTimeout(() => { copyBtn.innerHTML = icon('copy') + ' 复制到AI' }, 2000)
          appendLog('已复制题目+提示词到剪贴板', 'success')
        })
        .catch(() => {
          copyBtn.textContent = '复制失败'
          setTimeout(() => { copyBtn.innerHTML = icon('copy') + ' 复制到AI' }, 2000)
        })
    })
  })
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.action === ACTIONS.LOG) appendLog(msg.log, msg.logType || 'info')
  if (msg.action === ACTIONS.UPDATE_QUESTION) {
    const card = document.getElementById('matchCard')
    showMatch(card, msg.matchResult, msg.question, msg.options)
    if (!msg.matchResult) {
      setTimeout(() => {
        document.getElementById('manualBtn')?.addEventListener('click', () => {
          chrome.runtime.sendMessage({
            action: ACTIONS.MANUAL_SUBMIT_REQUEST,
            question: { title: msg.question, opts: msg.options || [] }
          })
        })
      }, 100)
    }
  }
  if (msg.action === ACTIONS.ALL_COMPLETE) {
    appendLog('所有视频已完成！', 'success')
  }
  if (msg.action === ACTIONS.QUEUE_PAUSED_CHANGED) {
    if (currentTab === 'tasks') renderTasks()
  }
  if (msg.action === ACTIONS.VERSION_RESULT) {
    versionInfo = msg
    const el = document.getElementById('versionText')
    if (!el) return
    if (msg.hasUpdate) {
      el.className = 'header-update'
      el.textContent = 'v' + msg.current + ' → v' + msg.latest
      el.onclick = () => chrome.tabs.create({ url: msg.url })
    } else {
      el.textContent = 'v' + msg.current
    }
  }
})

chrome.storage.onChanged.addListener((changes) => {
  if (changes.taskQueue) {
    taskQueue = changes.taskQueue.newValue || { tasks: [], currentIndex: 0 }
    if (currentTab === 'tasks') renderTasks()
  }
  if (changes.config) {
    config = changes.config.newValue || {}
  }
  if (changes.userInfo) {
    userInfo = changes.userInfo.newValue || null
  }
  if (changes.questionBank) {
    const el = document.getElementById('bankCount')
    if (el) el.textContent = '题库: ' + (changes.questionBank.newValue?.length || 0) + ' 题'
  }
})

let onTabChangeTimer = null
chrome.tabs.onActivated.addListener(() => {
  clearTimeout(onTabChangeTimer)
  onTabChangeTimer = setTimeout(() => init(), 100)
})
chrome.tabs.onUpdated.addListener((tid, info) => {
  if (info.status === 'complete') {
    clearTimeout(onTabChangeTimer)
    onTabChangeTimer = setTimeout(() => init(), 100)
  }
})

document.getElementById('configBtn')?.addEventListener('click', () => {
  chrome.tabs.create({ url: chrome.runtime.getURL('config.html') })
})
document.getElementById('bankBtn')?.addEventListener('click', () => {
  chrome.tabs.create({ url: chrome.runtime.getURL('question-bank.html') })
})

document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'))
    tab.classList.add('active')
    currentTab = tab.dataset.tab
    if (currentTab === 'tasks') renderTasks()
    else renderPlay()
  })
})

async function init() {
  chrome.runtime.sendMessage({ action: ACTIONS.CHECK_VERSION }).catch(() => {})

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab || !tab.url) return
  if (tab.url === lastActiveTabUrl) return
  lastActiveTabUrl = tab.url

  await refreshState()
  if (tab.url.includes('CourseShow')) currentTab = 'play'
  const tabBar = document.getElementById('tabBar')
  if (tab.url.includes('UserCenter') || tab.url.includes('CourseShow')) {
    tabBar.style.display = 'flex'
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'))
    const activeTab = document.querySelector(`.tab[data-tab="${currentTab}"]`)
    if (activeTab) activeTab.classList.add('active')
    if (currentTab === 'tasks') renderTasks()
    else renderPlay()
  } else {
    tabBar.style.display = 'none'
    renderGuide()
  }
}

document.addEventListener('DOMContentLoaded', init)
