import { loadConfig, saveConfig, getDefaultConfig } from '../lib/configManager.js'
import { ACTIONS } from '../shared/actions.js'

function createField(key, label, type, value, extra) {
  const row = document.createElement('div')
  row.className = 'row'

  const lbl = document.createElement('label')
  lbl.textContent = label
  lbl.htmlFor = `cfg-${key}`

  if (type === 'checkbox') {
    const inp = document.createElement('input')
    inp.type = 'checkbox'
    inp.id = `cfg-${key}`
    inp.name = key
    inp.checked = !!value
    row.appendChild(inp)
    row.appendChild(lbl)
  } else {
    const inp = document.createElement('input')
    inp.type = type
    inp.id = `cfg-${key}`
    inp.name = key
    inp.value = value ?? ''
    if (extra?.step) inp.step = extra.step
    if (extra?.min !== undefined) inp.min = extra.min
    if (extra?.max !== undefined) inp.max = extra.max
    row.appendChild(lbl)
    row.appendChild(inp)
  }

  return row
}

function buildForm(config) {
  const form = document.getElementById('configForm')
  form.innerHTML = ''

  const selectorSection = document.createElement('div')
  selectorSection.className = 'section'
  selectorSection.textContent = '选择器'
  form.appendChild(selectorSection)

  form.appendChild(createField('qSelector', '题干选择器', 'text', config.qSelector))
  form.appendChild(createField('oSelector', '选项选择器', 'text', config.oSelector))

  const timingSection = document.createElement('div')
  timingSection.className = 'section'
  timingSection.textContent = '时间与次数'
  form.appendChild(timingSection)

  form.appendChild(createField('interval', '答题轮询间隔 (ms)', 'number', config.interval, { min: 200, step: 100 }))
  form.appendChild(createField('retryTimes', '重试次数', 'number', config.retryTimes, { min: 0, step: 1 }))

  const speedSection = document.createElement('div')
  speedSection.className = 'section'
  speedSection.textContent = '视频'
  form.appendChild(speedSection)

  form.appendChild(createField('defaultSpeed', '默认倍速', 'number', config.defaultSpeed, { step: 0.25, min: 0.25, max: 16 }))
  form.appendChild(createField('forwardBackwardStep', '快进/快退步长 (s)', 'number', config.forwardBackwardStep, { min: 1, step: 1 }))
  form.appendChild(createField('speedStep', '倍速步长', 'number', config.speedStep, { step: 0.05, min: 0.05 }))

  const toggleSection = document.createElement('div')
  toggleSection.className = 'section'
  toggleSection.textContent = '开关'
  form.appendChild(toggleSection)

  form.appendChild(createField('autoAnswer', '自动答题', 'checkbox', config.autoAnswer))
  form.appendChild(createField('autoSubmit', '自动提交', 'checkbox', config.autoSubmit))
  form.appendChild(createField('keepSpeed', '倍速守护', 'checkbox', config.keepSpeed))
  form.appendChild(createField('autoResume', '自动恢复播放', 'checkbox', config.autoResume))
  form.appendChild(createField('showLog', '显示日志', 'checkbox', config.showLog))

  const otherSection = document.createElement('div')
  otherSection.className = 'section'
  otherSection.textContent = '其他'
  form.appendChild(otherSection)

  form.appendChild(createField('bankUrl', '远程题库 URL', 'text', config.bankUrl))
  form.appendChild(createField('pushUrl', '远程推送 URL', 'text', config.pushUrl))
}

function showToast(msg) {
  const existing = document.querySelector('.toast')
  if (existing) existing.remove()
  const toast = document.createElement('div')
  toast.className = 'toast'
  toast.textContent = msg
  document.body.appendChild(toast)
  setTimeout(() => toast.remove(), 2000)
}

document.getElementById('saveBtn')?.addEventListener('click', async () => {
  const inputs = document.querySelectorAll('#configForm input')
  const updates = {}
  inputs.forEach(inp => {
    if (inp.type === 'checkbox') updates[inp.name] = inp.checked
    else if (inp.type === 'number') updates[inp.name] = parseFloat(inp.value) || inp.value
    else updates[inp.name] = inp.value
  })
  await saveConfig(updates)
  chrome.runtime.sendMessage({ action: ACTIONS.UPDATE_CONFIG, config: updates })
  showToast('配置已保存')
})

document.getElementById('resetBtn')?.addEventListener('click', async () => {
  const def = getDefaultConfig()
  buildForm(def)
  showToast('已恢复默认值（尚未保存）')
})

document.addEventListener('DOMContentLoaded', async () => {
  const config = await loadConfig()
  buildForm(config)
})
