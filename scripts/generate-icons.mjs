import { writeFileSync, mkdirSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { deflateSync } from 'zlib'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const ICONS_DIR = resolve(ROOT, 'icons')

const BG = { r: 79, g: 106, b: 240 }

function crc32(buf) {
  let crc = 0xFFFFFFFF
  const table = new Int32Array(256)
  for (let i = 0; i < 256; i++) {
    let c = i
    for (let j = 0; j < 8; j++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1)
    }
    table[i] = c
  }
  for (let i = 0; i < buf.length; i++) {
    crc = table[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8)
  }
  return (crc ^ 0xFFFFFFFF) >>> 0
}

function makeChunk(type, data) {
  const typeBytes = Buffer.from(type, 'ascii')
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const crcInput = Buffer.concat([typeBytes, data])
  const crcVal = Buffer.alloc(4)
  crcVal.writeUInt32BE(crc32(crcInput))
  return Buffer.concat([len, typeBytes, data, crcVal])
}

function createPNG(width, height, pixels) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8
  ihdr[9] = 6
  ihdr[10] = 0
  ihdr[11] = 0
  ihdr[12] = 0
  const raw = Buffer.alloc(height * (width * 4 + 1))
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0
    raw.set(pixels.subarray(y * width * 4, (y + 1) * width * 4), y * (width * 4 + 1) + 1)
  }
  const compressed = deflateSync(raw)
  return Buffer.concat([
    signature,
    makeChunk('IHDR', ihdr),
    makeChunk('IDAT', compressed),
    makeChunk('IEND', Buffer.alloc(0))
  ])
}

function pointToSegmentDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax
  const dy = by - ay
  const lenSq = dx * dx + dy * dy
  if (lenSq === 0) return Math.hypot(px - ax, py - ay)
  let t = ((px - ax) * dx + (py - ay) * dy) / lenSq
  t = Math.max(0, Math.min(1, t))
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy))
}

function generateIcon(size) {
  const pixels = new Uint8Array(size * size * 4)
  const radius = Math.max(4, size * 0.22)
  const rr = radius * radius

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4
      let inRect = false
      if (x >= radius && x < size - radius) {
        inRect = true
      } else if (y >= radius && y < size - radius) {
        inRect = true
      } else {
        const cx = x < size / 2 ? radius : size - 1 - radius
        const cy = y < size / 2 ? radius : size - 1 - radius
        const dx2 = x - cx
        const dy2 = y - cy
        if (dx2 * dx2 + dy2 * dy2 <= rr) inRect = true
      }
      if (inRect) {
        pixels[idx] = BG.r; pixels[idx + 1] = BG.g
        pixels[idx + 2] = BG.b; pixels[idx + 3] = 255
      }
    }
  }

  const t = Math.max(2, Math.round(size * 0.1))
  const x1 = Math.round(size * 0.30), y1 = Math.round(size * 0.22)
  const xb = Math.round(size * 0.50), yb = Math.round(size * 0.74)
  const x2 = Math.round(size * 0.70), y2 = Math.round(size * 0.22)

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4
      if (pixels[idx + 3] === 0) continue
      const d1 = pointToSegmentDist(x, y, x1, y1, xb, yb)
      const d2 = pointToSegmentDist(x, y, xb, yb, x2, y2)
      if (d1 < t || d2 < t) {
        pixels[idx] = 255; pixels[idx + 1] = 255
        pixels[idx + 2] = 255; pixels[idx + 3] = 255
      }
    }
  }

  return createPNG(size, size, pixels)
}

if (!existsSync(ICONS_DIR)) mkdirSync(ICONS_DIR, { recursive: true })
for (const size of [16, 48, 128]) {
  const png = generateIcon(size)
  writeFileSync(resolve(ICONS_DIR, `icon${size}.png`), png)
  console.log(`[icons] generated icon${size}.png (${size}x${size})`)
}
