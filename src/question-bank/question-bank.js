import { loadQuestionBank, saveQuestionBank } from '../lib/questionBank.js'
import { extractLetterAnswer } from '../lib/utils.js'
import { ACTIONS } from '../shared/actions.js'

let bank = []
let filterText = ''

function showToast(msg, isError) {
  const existing = document.querySelector('.toast')
  if (existing) existing.remove()
  const el = document.createElement('div')
  el.className = 'toast' + (isError ? ' error' : '')
  el.textContent = msg
  document.body.appendChild(el)
  setTimeout(() => el.remove(), 2500)
}

function sourceTag(isLocal) {
  return isLocal
    ? '<span class="tag tag-manual">本地</span>'
    : '<span class="tag tag-remote">远程</span>'
}

function truncateSource(src) {
  if (!src) return '—'
  return src.length > 30 ? src.slice(0, 30) + '...' : src
}

function escapeHtml(text) {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}

function render() {
  const list = document.getElementById('list')
  const stats = document.getElementById('statsLine')
  const q = filterText.trim().toLowerCase()
  const filtered = q ? bank.filter(item => (item.title || '').toLowerCase().includes(q)) : bank

  const localCount = bank.filter(q => q.isLocal).length
  const remoteCount = bank.length - localCount
  const parts = [`本地: ${localCount}`]
  if (remoteCount > 0) parts.push(`远程: ${remoteCount}`)
  stats.textContent = `总计 ${bank.length} 题  |  ${parts.join('  ')}`

  if (filtered.length === 0) {
    list.innerHTML = `<div class="empty">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 002 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/></svg>
      <div>${q ? '没有匹配的题目' : '题库为空，请导入或同步'}</div>
    </div>`
    return
  }

  list.innerHTML = filtered.map((item, i) => {
    const realIdx = bank.indexOf(item)
    const answer = extractLetterAnswer(item.answer || '')
    const optsHtml = (item.options || []).map(o =>
      `<div class="opt-line">${escapeHtml(o)}</div>`
    ).join('')
    const syncLabel = item.syncStatus === 'conflict'
      ? '<span class="tag tag-conflict">冲突</span>'
      : item.syncStatus === 'local_modified'
        ? '<span class="tag tag-modified">已修改</span>'
        : item.syncStatus === 'remote_modified'
          ? '<span class="tag tag-remote">远程更新</span>'
          : ''
    return `
      <div class="card">
        <div class="card-title">${escapeHtml(item.title || '')}</div>
        ${optsHtml ? `<div class="card-options">${optsHtml}</div>` : ''}
        <div class="card-answer">答案: ${answer || '-'}</div>
        <div class="card-meta">
          <span>${sourceTag(item.isLocal)}</span>
          ${syncLabel}
          <span>来源: ${escapeHtml(truncateSource(item.source))}</span>
          <span>ID: ${(item.questionId || '').slice(0, 8)}...</span>
          <span>${item.dateAdded ? new Date(item.dateAdded).toLocaleDateString() : '-'}</span>
        </div>
        <div class="card-actions">
          <button class="btn btn-sm btn-secondary" data-toggle-edit="${realIdx}">编辑</button>
          <button class="btn btn-sm btn-danger" data-delete="${realIdx}">删除</button>
          ${item.syncStatus === 'conflict'
            ? `<button class="btn btn-sm btn-primary" data-keep-local="${realIdx}">保留本地</button>
               <button class="btn btn-sm btn-success" data-accept-remote="${realIdx}">采纳远程</button>`
            : ''}
        </div>
        <div class="edit-area" id="edit-${realIdx}">
          <textarea id="edit-title-${realIdx}">${escapeHtml(item.title || '')}</textarea>
          <textarea id="edit-options-${realIdx}" placeholder="每行一个选项">${escapeHtml((item.options || []).join('\n'))}</textarea>
          <textarea id="edit-text-${realIdx}">${escapeHtml(item.answer || '')}</textarea>
          <div class="edit-btns">
            <button class="btn btn-sm btn-primary" data-save-edit="${realIdx}">保存</button>
            <button class="btn btn-sm btn-secondary" data-cancel-edit="${realIdx}">取消</button>
          </div>
        </div>
      </div>
    `
  }).join('')

  list.querySelectorAll('[data-toggle-edit]').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.toggleEdit)
      const area = document.getElementById('edit-' + idx)
      area.classList.toggle('open')
    })
  })
  list.querySelectorAll('[data-save-edit]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const idx = parseInt(btn.dataset.saveEdit)
      const titleEl = document.getElementById('edit-title-' + idx)
      const optsEl = document.getElementById('edit-options-' + idx)
      const answerEl = document.getElementById('edit-text-' + idx)
      if (titleEl) bank[idx].title = titleEl.value
      if (optsEl) bank[idx].options = optsEl.value.split('\n').filter(s => s.trim())
      if (answerEl) bank[idx].answer = answerEl.value
      bank[idx].version = (bank[idx].version || 0) + 1
      bank[idx].syncStatus = 'local_modified'
      bank[idx].dateUpdated = new Date().toISOString()
      await saveQuestionBank(bank)
      showToast('已保存')
      render()
    })
  })
  list.querySelectorAll('[data-cancel-edit]').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.cancelEdit)
      document.getElementById('edit-' + idx).classList.remove('open')
    })
  })
  list.querySelectorAll('[data-delete]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const idx = parseInt(btn.dataset.delete)
      if (!confirm('确认删除此题？')) return
      bank.splice(idx, 1)
      await saveQuestionBank(bank)
      showToast('已删除')
      render()
    })
  })
  list.querySelectorAll('[data-keep-local]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const idx = parseInt(btn.dataset.keepLocal)
      delete bank[idx]._remote
      bank[idx].syncStatus = 'synced'
      await saveQuestionBank(bank)
      render()
    })
  })
  list.querySelectorAll('[data-accept-remote]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const idx = parseInt(btn.dataset.acceptRemote)
      if (bank[idx]._remote) {
        Object.assign(bank[idx], bank[idx]._remote)
        delete bank[idx]._remote
      }
      bank[idx].syncStatus = 'remote_modified'
      bank[idx].dateUpdated = new Date().toISOString()
      await saveQuestionBank(bank)
      render()
    })
  })
}

async function doExport() {
  if (bank.length === 0) {
    showToast('题库为空，无可导出', true)
    return
  }
  const blob = new Blob([JSON.stringify(bank, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `question-bank-${new Date().toISOString().slice(0, 10)}.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
  showToast('导出成功')
}

async function doImport(file) {
  if (!file) return
  try {
    const text = await file.text()
    const data = JSON.parse(text)
    if (!Array.isArray(data) || !data.length) {
      showToast('导入文件格式错误', true)
      return
    }
    const { sha256Hex } = await import('../lib/utils.js')
    let added = 0
    for (const item of data) {
      if (!item.title) continue
      const options = item.options || []
      const hash = await sha256Hex(item.title + options.join(''))
      if (bank.findIndex(q => q.questionId === hash) >= 0) continue
      bank.push({
        questionId: hash,
        title: item.title,
        options: options,
        answer: extractLetterAnswer(item.answer || ''),
        source: item.source || 'import',
        isLocal: true,
        syncStatus: 'local_modified',
        version: 1,
        dateAdded: new Date().toISOString(),
        dateUpdated: new Date().toISOString()
      })
      added++
    }
    await saveQuestionBank(bank)
    showToast(`导入完成，新增 ${added} 题`)
    render()
  } catch (e) {
    showToast('导入失败: ' + e.message, true)
  }
}

async function doSync() {
  document.getElementById('syncBtn').disabled = true
  document.getElementById('syncBtn').textContent = '同步中...'
  try {
    chrome.runtime.sendMessage({ action: ACTIONS.REQUEST_SYNC })
  } catch {
    document.getElementById('syncBtn').disabled = false
    document.getElementById('syncBtn').textContent = '同步远程'
  }
}

async function doClear() {
  if (bank.length === 0) return
  if (!confirm(`确认清空全部 ${bank.length} 题？此操作不可恢复！`)) return
  if (!confirm('再次确认：真的要清空整个题库吗？')) return
  bank = []
  await saveQuestionBank(bank)
  showToast('题库已清空')
  render()
}

function setupAddForm() {
  const titleEl = document.getElementById('addTitle')
  const optsEl = document.getElementById('addOptions')
  const answerEl = document.getElementById('addAnswer')
  const sourceEl = document.getElementById('addSource')
  const form = document.getElementById('addForm')

  document.getElementById('addToggleBtn').addEventListener('click', () => {
    form.classList.toggle('hidden')
    if (!form.classList.contains('hidden')) titleEl.focus()
  })

  document.getElementById('addCancelBtn').addEventListener('click', () => {
    form.classList.add('hidden')
  })

  document.getElementById('addSubmitBtn').addEventListener('click', async () => {
    const title = titleEl.value.trim()
    if (!title) { showToast('请输入题目', true); return }

    const options = optsEl.value.split('\n').map(s => s.trim()).filter(Boolean)
    if (options.length < 2) { showToast('至少需要 2 个选项', true); return }

    const answerRaw = answerEl.value.trim()
    const answer = answerRaw ? extractLetterAnswer(answerRaw) : ''
    const source = sourceEl.value.trim() || 'manual'

    const { sha256Hex } = await import('../lib/utils.js')
    const hash = await sha256Hex(title + options.join(''))
    if (bank.findIndex(q => q.questionId === hash) >= 0) {
      showToast('该题目已存在', true)
      return
    }

    bank.push({
      questionId: hash,
      title,
      options,
      answer,
      source,
      isLocal: true,
      syncStatus: 'local_modified',
      version: 1,
      dateAdded: new Date().toISOString(),
      dateUpdated: new Date().toISOString()
    })
    await saveQuestionBank(bank)
    showToast('已添加')
    titleEl.value = ''
    optsEl.value = ''
    answerEl.value = ''
    sourceEl.value = ''
    form.classList.add('hidden')
    render()
  })
}

document.addEventListener('DOMContentLoaded', async () => {
  bank = await loadQuestionBank()
  render()

  document.getElementById('searchInput').addEventListener('input', (e) => {
    filterText = e.target.value
    render()
  })

  document.getElementById('exportBtn').addEventListener('click', doExport)
  document.getElementById('importBtn').addEventListener('click', () => {
    document.getElementById('importFileInput').click()
  })
  document.getElementById('importFileInput').addEventListener('change', (e) => {
    doImport(e.target.files[0])
    e.target.value = ''
  })
  document.getElementById('syncBtn').addEventListener('click', doSync)
  document.getElementById('pushBtn')?.addEventListener('click', async () => {
    document.getElementById('pushBtn').disabled = true
    document.getElementById('pushBtn').textContent = '推送中...'
    try {
      chrome.runtime.sendMessage({ action: ACTIONS.PUSH_SYNC })
    } catch {
      document.getElementById('pushBtn').disabled = false
      document.getElementById('pushBtn').textContent = '推送远程'
    }
  })
  document.getElementById('clearBtn').addEventListener('click', doClear)

  setupAddForm()

  chrome.runtime.onMessage.addListener(async (msg) => {
    if (msg.action === ACTIONS.SYNC_RESULT) {
      document.getElementById('syncBtn').disabled = false
      document.getElementById('syncBtn').textContent = '同步远程'
      const parts = []
      if (msg.added > 0) parts.push(`新增 ${msg.added} 题`)
      else if (msg.added === 0) parts.push('题库已是最新')
      else parts.push('同步失败')
      if (msg.conflicts?.length > 0) parts.push(`${msg.conflicts.length} 个冲突待解决`)
      showToast(parts.join('，'), msg.added < 0)
      bank = await loadQuestionBank()
      render()
    }
    if (msg.action === ACTIONS.PUSH_SYNC_RESULT) {
      document.getElementById('pushBtn').disabled = false
      document.getElementById('pushBtn').textContent = '推送远程'
      showToast(msg.pushed > 0 ? `已推送 ${msg.pushed} 题` : '无需推送')
      bank = await loadQuestionBank()
      render()
    }
  })
})
