const DEFAULT_CONFIG = {
  qSelector: '.topic-main',
  oSelector: '.answer-show > .answer-item',
  interval: 1500,
  retryTimes: 3,
  autoAnswer: true,
  autoSubmit: true,
  queuePaused: false,
  showLog: true,
  bankUrl: 'https://gh-proxy.com/https://github.com/ACG-Q/UserScript/raw/refs/heads/main/questions.json',
  pushUrl: '',
  defaultSpeed: 2.0,
  forwardBackwardStep: 10,
  speedStep: 0.25,
  keepSpeed: true,
  autoResume: true,
  videoRules: [{ match: '.*', path: 'video' }]
}

export async function loadConfig() {
  const result = await chrome.storage.local.get('config')
  if (result.config) return { ...DEFAULT_CONFIG, ...result.config }
  await chrome.storage.local.set({ config: DEFAULT_CONFIG })
  return { ...DEFAULT_CONFIG }
}

export async function saveConfig(partial) {
  const current = await loadConfig()
  const merged = { ...current, ...partial }
  await chrome.storage.local.set({ config: merged })
  return merged
}

export function getDefaultConfig() {
  return { ...DEFAULT_CONFIG }
}
