import { ACTIONS } from '../shared/actions.js'

let lastLogMsg = ''
let lastLogTime = 0

export function sendLog(msg, type) {
  const now = Date.now()
  if (msg === lastLogMsg && now - lastLogTime < 2000) return
  lastLogMsg = msg
  lastLogTime = now
  chrome.runtime.sendMessage({ action: ACTIONS.LOG, log: msg, logType: type || 'info' }).catch(() => {})
}
