export const ACTIONS = {
  // Sidepanel → Background
  FETCH_TASKS: 'fetchTasks',
  SKIP_VIDEO: 'skipVideo',
  PLAY_SPECIFIC: 'playSpecific',
  TOGGLE_PAUSE_QUEUE: 'togglePauseQueue',
  START_QUEUE: 'startQueue',
  CLEAR_QUEUE: 'clearQueue',
  UPDATE_CONFIG: 'updateConfig',

  // Content → Background
  VIDEO_ENDED: 'videoEnded',
  USER_INFO_DETECTED: 'userInfoDetected',
  TASK_LIST_EXTRACTED: 'taskListExtracted',
  UPDATE_QUESTION: 'updateQuestion',
  UPDATE_VIDEO_PROGRESS: 'updateVideoProgress',
  MANUAL_SUBMIT_REQUEST: 'manualSubmitRequest',
  MANUAL_CHOICE_MADE: 'manualChoiceMade',

  // Background → Content
  EXTRACT_TASK_LIST: 'extractTaskList',
  VIDEO_COMMAND: 'videoCommand',
  CONFIG_UPDATED: 'configUpdated',
  APPLY_MANUAL_CHOICE: 'applyManualChoice',

  // Background → Sidepanel
  LOG: 'log',
  QUEUE_PAUSED_CHANGED: 'queuePausedChanged',
  ALL_COMPLETE: 'allComplete',
  QUESTION_BANK_UPDATE: 'questionBankUpdate',
  VERSION_RESULT: 'versionResult',

  // Sidepanel → Background
  CHECK_VERSION: 'checkVersion',

  // Question bank page → Background
  REQUEST_SYNC: 'requestSync',
  PUSH_SYNC: 'pushSync',

  // Background → Question bank page
  SYNC_RESULT: 'syncResult',
  PUSH_SYNC_RESULT: 'pushSyncResult',
}
