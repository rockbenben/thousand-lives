// Read a WebP's pixel size out of its header.
//
// Three chunk layouts carry the size, and they lay it out differently:
//   VP8   (lossy)    14 bits width, 14 bits height at bytes 26 / 28
//   VP8L  (lossless) 14 bits width + 14 bits height packed into the 32-bit
//                    word at byte 21 (width in the low half)
//   VP8X  (extended) 24 bits width at byte 24, 24 bits height at byte 27
//
// This used to be parsed twice in the repo -- once in scripts/verify-art.mjs
// and once in scripts/art-inventory.ts -- and the two copies disagreed on the
// lossless layout. The copy in art-inventory read the two halves five bits
// off, so a 640x480 lossless file came out as 1x14713 and the slot was
// reported as a missing picture. Two copies of a header parser is exactly how
// that happens, so there is one now and both callers use it.
//
//   node scripts/webp-dims.mjs <file.webp> [more.webp ...]
import fs from 'node:fs'

/**
 * The pixel size of a WebP, or null when the buffer is not one we can read.
 * @param {Buffer} buf
 * @returns {[number, number]|null}
 */
export function webpDims(buf) {
  // the smallest header we read is 30 bytes (VP8X carries its size to byte 29)
  if (!Buffer.isBuffer(buf) || buf.length < 30) return null
  if (buf.toString('ascii', 0, 4) !== 'RIFF') return null
  if (buf.toString('ascii', 8, 12) !== 'WEBP') return null
  const chunk = buf.toString('ascii', 12, 16)
  if (chunk === 'VP8 ') return [buf.readUInt16LE(26) & 0x3fff, buf.readUInt16LE(28) & 0x3fff]
  if (chunk === 'VP8L') {
    const n = buf.readUInt32LE(21)
    return [(n & 0x3fff) + 1, ((n >> 14) & 0x3fff) + 1]
  }
  if (chunk === 'VP8X') return [buf.readUIntLE(24, 3) + 1, buf.readUIntLE(27, 3) + 1]
  return null
}

/**
 * The pixel size of a WebP on disk, or null when the file cannot be read.
 * @param {string} file
 * @returns {[number, number]|null}
 */
export function webpDimsOf(file) {
  try {
    return webpDims(fs.readFileSync(file))
  } catch {
    return null
  }
}

// 直接运行时打印每个文件量到的尺寸
if (process.argv[1] && process.argv[1].endsWith('webp-dims.mjs')) {
  for (const f of process.argv.slice(2)) {
    const d = webpDimsOf(f)
    console.log(`${f}  ${d ? d.join('x') : 'unreadable'}`)
  }
}
