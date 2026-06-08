export function jaccardSimilarity(text1, text2) {
  const clean1 = text1.replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, '')
  const clean2 = text2.replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, '')
  if (!clean1 || !clean2) return 0
  const set1 = new Set(clean1.split(''))
  const set2 = new Set(clean2.split(''))
  const intersection = new Set([...set1].filter(x => set2.has(x)))
  const union = new Set([...set1, ...set2])
  return intersection.size / union.size
}

export function extractKeywords(text) {
  return text.replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, ' ').split(' ').filter(w => w.length > 1)
}

export function sha256Hex(input) {
  const encoder = new TextEncoder()
  return crypto.subtle.digest('SHA-256', encoder.encode(input))
    .then(buf => Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join(''))
}

export function cleanAnswer(text) {
  return text.replace(/[*]+/g, '').trim()
}

export function extractLetterAnswer(answer) {
  const cleaned = cleanAnswer(answer)
  const match = cleaned.match(/[A-Za-z,]+/)
  return match ? match[0].toUpperCase() : cleaned
}

export function hasLetterPrefix(text, letter) {
  const t = text.trim().toUpperCase()
  return t.startsWith(letter) || t.startsWith(letter + '.') || t.startsWith(letter + '、')
}

export function buildAiPrompt(question, options, data) {
  let text = '请帮我分析这道题的正确答案，只给出正确选项的字母即可（多个字母用逗号分隔）。\n\n'
  text += '题目内容：\n' + question + '\n\n'
  text += '选项：\n'
  if (options && options.length) {
    options.forEach((opt, i) => {
      text += String.fromCharCode(65 + i) + '. ' + opt + '\n'
    })
  }
  if (data && data.answer) {
    text += '\n我查到的答案是：' + data.answer + '\n'
    text += '（请验证是否正确）\n'
  } else {
    text += '\n请直接给出正确答案的对应字母。\n'
  }
  return text
}
