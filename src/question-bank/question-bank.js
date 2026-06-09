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

function sourceTag(source) {
  if (!source || source === 'manual') return '<span class="tag tag-manual">手动</span>'
  return '<span class="tag tag-remote">远程</span>'
}

function render() {
  const list = document.getElementById('list')
  const stats = document.getElementById('statsLine')
  const q = filterText.trim().toLowerCase()
  const filtered = q ? bank.filter(item => (item.title || '').toLowerCase().includes(q)) : bank

  const bySource = {}
  for (const item of bank) {
    const src = item.source || 'manual'
    bySource[src] = (bySource[src] || 0) + 1
  }
  const srcParts = Object.entries(bySource).map(([k, v]) => `${k === 'manual' ? '手动' : '远程'}: ${v}`)
  stats.textContent = `总计 ${bank.length} 题  |  ${srcParts.join('  ')}`

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
    return `
      <div class="card">
        <div class="card-title">${escapeHtml(item.title || '')}</div>
        <div class="card-answer">答案: ${answer || '-'}</div>
        <div class="card-meta">
          <span>${sourceTag(item.source)}</span>
          <span>ID: ${(item.questionId || '').slice(0, 8)}...</span>
          <span>${item.dateAdded ? new Date(item.dateAdded).toLocaleDateString() : '-'}</span>
        </div>
        <div class="card-actions">
          <button class="btn btn-sm btn-secondary" data-toggle-edit="${realIdx}">编辑</button>
          <button class="btn btn-sm btn-danger" data-delete="${realIdx}">删除</button>
        </div>
        <div class="edit-area" id="edit-${realIdx}">
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
      const textarea = document.getElementById('edit-text-' + idx)
      bank[idx].answer = textarea.value
      if (bank[idx].dateUpdated) bank[idx].dateUpdated = new Date().toISOString()
      else bank[idx].dateUpdated = new Date().toISOString()
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
}

function escapeHtml(text) {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
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
        dateAdded: new Date().toISOString()
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
  let optCount = 2

  document.getElementById('addToggleBtn').addEventListener('click', () => {
    const form = document.getElementById('addForm')
    form.classList.toggle('hidden')
    if (!form.classList.contains('hidden')) {
      document.getElementById('addTitle').focus()
    }
  })

  document.getElementById('addCancelBtn').addEventListener('click', () => {
    document.getElementById('addForm').classList.add('hidden')
  })

  document.getElementById('addOptBtn').addEventListener('click', () => {
    if (optCount >= 6) return
    const label = String.fromCharCode(65 + optCount)
    const row = document.createElement('div')
    row.className = 'opt-row'
    row.innerHTML = `
      <span style="color:#9a9aaf;font-size:12px;min-width:16px;">${label}</span>
      <input type="text" class="opt-input" placeholder="选项 ${label} 内容">
      <button class="btn btn-sm btn-secondary" data-remove-opt style="font-size:10px;padding:2px 8px;">x</button>
    `
    document.getElementById('addOptions').appendChild(row)
    optCount++
  })

  document.getElementById('addOptions').addEventListener('click', (e) => {
    if (e.target.matches('[data-remove-opt]')) {
      const row = e.target.closest('.opt-row')
      if (document.querySelectorAll('.opt-row').length <= 2) return
      row.remove()
      optCount--
      const rows = document.querySelectorAll('#addOptions .opt-row')
      rows.forEach((r, i) => {
        r.querySelector('span').textContent = String.fromCharCode(65 + i)
      })
    }
  })

  document.getElementById('addSubmitBtn').addEventListener('click', async () => {
    const title = document.getElementById('addTitle').value.trim()
    if (!title) { showToast('请输入题目标题', true); return }

    const optInputs = document.querySelectorAll('.opt-input')
    const options = []
    for (const inp of optInputs) {
      const val = inp.value.trim()
      if (val) options.push(val)
    }

    const answerRaw = document.getElementById('addAnswer').value.trim()
    const answer = answerRaw ? extractLetterAnswer(answerRaw) : ''

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
      source: 'manual',
      dateAdded: new Date().toISOString()
    })
    await saveQuestionBank(bank)
    showToast('已添加')
    document.getElementById('addTitle').value = ''
    document.querySelectorAll('.opt-input').forEach(inp => inp.value = '')
    document.getElementById('addAnswer').value = ''
    document.getElementById('addForm').classList.add('hidden')
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
  document.getElementById('clearBtn').addEventListener('click', doClear)

  setupAddForm()

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.action === ACTIONS.SYNC_RESULT) {
      document.getElementById('syncBtn').disabled = false
      document.getElementById('syncBtn').textContent = '同步远程'
      if (msg.added > 0) {
        showToast(`同步完成，新增 ${msg.added} 题，共计 ${msg.total} 题`)
      } else if (msg.added === 0) {
        showToast('题库已是最新，无新增')
      } else {
        showToast('同步失败', true)
      }
      bank = []
      loadQuestionBank().then(newBank => { bank = newBank; render() })
    }
  })
})
