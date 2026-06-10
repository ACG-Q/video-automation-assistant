import { ACTIONS } from '../shared/actions.js'
import { state } from './state.js'
import { sendLog } from './logger.js'

function getVideoElement() {
  const url = window.location.href
  const rules = state.config.videoRules || []
  for (const rule of rules) {
    try {
      if (!new RegExp(rule.match, 'i').test(url)) continue
      const videos = rule.path.startsWith('/')
        ? document.evaluate(rule.path, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null)
        : document.querySelectorAll(rule.path)
      const len = videos.length || videos.snapshotLength
      for (let i = 0; i < len; i++) {
        const v = videos[i] || videos.snapshotItem(i)
        if (v && v.tagName === 'VIDEO') return v
      }
    } catch {}
  }
  return document.querySelector('video')
}

export function bindVideo(video) {
  if (state.currentVideo === video) return
  state.currentVideo = video
  if (state.videoResumeTimer) clearInterval(state.videoResumeTimer)
  if (state.videoProgressTimer) clearInterval(state.videoProgressTimer)
  sendLog('发现视频元素，已绑定')

  const savedSpeeds = JSON.parse(localStorage.getItem('savedSpeeds') || '{}')
  const domain = window.location.hostname
  const savedSpeed = savedSpeeds[domain] || state.config.defaultSpeed || 1.0

  function restoreSpeed() {
    if (!state.config.keepSpeed) return
    if (video.playbackRate !== savedSpeed) {
      video.playbackRate = savedSpeed
      sendLog('恢复倍速: ' + savedSpeed + 'x')
    }
  }

  restoreSpeed()
  video.addEventListener('loadedmetadata', restoreSpeed)
  video.addEventListener('canplay', restoreSpeed)

  video.addEventListener('play', () => {
    if (state.config.autoMute && !video.muted) {
      video.muted = true
      sendLog('视频已自动静音')
    }
  })

  video.addEventListener('ratechange', () => {
    const speeds = JSON.parse(localStorage.getItem('savedSpeeds') || '{}')
    speeds[window.location.hostname] = video.playbackRate
    localStorage.setItem('savedSpeeds', JSON.stringify(speeds))
  })

  state.videoResumeTimer = setInterval(() => {
    if (state.disposed) return
    if (!state.config.autoResume) return
    if (document.hidden) return
    if (!video || !document.body.contains(video) || video.ended || !video.paused) return
    if (Date.now() - state.lastUserPauseTime < 3000) return
    video.play().catch(() => {})
  }, 1000)

  video.addEventListener('pause', () => {
    if (video.ended) {
      sendLog('视频已播放完毕', 'success')
      chrome.runtime.sendMessage({ action: ACTIONS.VIDEO_ENDED })
    }
  })

  state.videoProgressTimer = setInterval(() => {
    if (state.disposed) return
    if (!video || !document.body.contains(video) || !video.duration) return
    chrome.runtime.sendMessage({
      action: ACTIONS.UPDATE_VIDEO_PROGRESS,
      currentTime: video.currentTime,
      duration: video.duration,
      paused: video.paused,
      muted: video.muted
    }).catch(() => {})
  }, 1000)
}

export function setupVideoControl() {
  sendLog('启动视频发现监听')
  const observer = new MutationObserver(() => {
    const video = getVideoElement()
    if (video && video !== state.currentVideo) bindVideo(video)
  })
  observer.observe(document, { childList: true, subtree: true })

  const video = getVideoElement()
  if (video) bindVideo(video)
}

export function executeVideoCommand(command, value) {
  const v = state.currentVideo
  if (!v) return
  switch (command) {
    case 'play': v.play(); break
    case 'pause':
      state.lastUserPauseTime = Date.now()
      v.pause()
      break
    case 'forward':
      v.currentTime = Math.min(v.duration, v.currentTime + (value || state.config.forwardBackwardStep || 10))
      break
    case 'backward':
      v.currentTime = Math.max(0, v.currentTime - (value || state.config.forwardBackwardStep || 10))
      break
    case 'speed': {
      v.playbackRate = value
      const speeds = JSON.parse(localStorage.getItem('savedSpeeds') || '{}')
      speeds[window.location.hostname] = value
      localStorage.setItem('savedSpeeds', JSON.stringify(speeds))
      break
    }
    case 'togglePlay':
      v.paused ? v.play() : (state.lastUserPauseTime = Date.now(), v.pause())
      break
    case 'toggleMute':
      v.muted = !v.muted
      break
  }
}
