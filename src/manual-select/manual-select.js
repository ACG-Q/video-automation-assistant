import { ACTIONS } from '../shared/actions.js'

let selected = ''

function init() {
  const params = new URLSearchParams(window.location.search)
  const title = params.get('title') || ''
  let opts = []
  try { opts = JSON.parse(params.get('opts') || '[]') } catch {}

  document.getElementById('qTitle').textContent = title

  const container = document.getElementById('optsList')
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

  opts.forEach((opt, i) => {
    const el = document.createElement('div')
    el.className = 'opt'
    el.textContent = `${letters[i]}. ${opt}`
    el.dataset.letter = letters[i]
    el.addEventListener('click', () => {
      document.querySelectorAll('.opt').forEach(o => o.classList.remove('selected'))
      el.classList.add('selected')
      selected = letters[i]
      document.getElementById('confirmBtn').disabled = false
    })
    container.appendChild(el)
  })

  document.getElementById('confirmBtn').addEventListener('click', () => {
    if (!selected) return
    chrome.runtime.sendMessage({ action: ACTIONS.MANUAL_CHOICE_MADE, answer: selected })
    window.close()
  })
}

document.addEventListener('DOMContentLoaded', init)
