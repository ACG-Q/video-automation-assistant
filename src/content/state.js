export const state = {
  config: {},
  autoAnswerTimer: null,
  lastQuestionTitle: '',
  searchPaused: false,
  retryCount: 0,
  lastUserPauseTime: 0,
  currentVideo: null,
  answerObserver: null,
  continueObserver: null,
  videoResumeTimer: null,
  videoProgressTimer: null,
  disposed: false
}

export function cleanup() {
  state.disposed = true
  if (state.autoAnswerTimer) {
    clearInterval(state.autoAnswerTimer)
    state.autoAnswerTimer = null
  }
  if (state.videoResumeTimer) {
    clearInterval(state.videoResumeTimer)
    state.videoResumeTimer = null
  }
  if (state.videoProgressTimer) {
    clearInterval(state.videoProgressTimer)
    state.videoProgressTimer = null
  }
  if (state.answerObserver) {
    state.answerObserver.disconnect()
    state.answerObserver = null
  }
  if (state.continueObserver) {
    state.continueObserver.disconnect()
    state.continueObserver = null
  }
}
