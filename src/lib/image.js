import { encode as encodePng } from 'fast-png'
import {
  ALLOWED_MIME_TYPES,
  MAX_FILE_BYTES,
  MIN_SOURCE_HEIGHT,
  MIN_SOURCE_WIDTH,
} from './constants'

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
const JPEG_SIGNATURE = [0xff, 0xd8, 0xff]

export class ImageValidationError extends Error {
  constructor(i18nKey, i18nParams = {}) {
    super(i18nKey)
    this.name = 'ImageValidationError'
    this.i18nKey = i18nKey
    this.i18nParams = i18nParams
  }
}

export class ImageProcessingError extends Error {
  constructor(i18nKey, i18nParams = {}) {
    super(i18nKey)
    this.name = 'ImageProcessingError'
    this.i18nKey = i18nKey
    this.i18nParams = i18nParams
  }
}

export function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  if (bytes < 1024) return `${Math.round(bytes)} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function formatPixels(value) {
  return new Intl.NumberFormat('en-US').format(Math.max(0, Math.round(value)))
}

function matchesSignature(bytes, signature) {
  return signature.every((value, index) => bytes[index] === value)
}

export async function validateFile(file) {
  if (!file) {
    throw new ImageValidationError('errors.chooseFile')
  }

  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    throw new ImageValidationError('errors.unsupportedFormat')
  }

  if (file.size > MAX_FILE_BYTES) {
    throw new ImageValidationError('errors.tooLarge')
  }

  if (file.size === 0) {
    throw new ImageValidationError('errors.emptyFile')
  }

  const signature = new Uint8Array(await file.slice(0, 8).arrayBuffer())
  const looksLikeJpeg = matchesSignature(signature, JPEG_SIGNATURE)
  const looksLikePng = matchesSignature(signature, PNG_SIGNATURE)

  if (!looksLikeJpeg && !looksLikePng) {
    throw new ImageValidationError('errors.invalidContent')
  }
}

export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.decoding = 'async'
    image.onload = () => resolve(image)
    image.onerror = () => reject(new ImageValidationError('errors.readFailed'))
    image.src = url
  })
}

export function assertSourceDimensions(width, height) {
  if (width < MIN_SOURCE_WIDTH || height < MIN_SOURCE_HEIGHT) {
    throw new ImageValidationError('errors.dimensionsTooSmall', {
      width: formatPixels(width),
      height: formatPixels(height),
      minWidth: MIN_SOURCE_WIDTH,
      minHeight: MIN_SOURCE_HEIGHT,
    })
  }
}

/**
 * Alpha is checked on a downsampled copy only when an image is too large to
 * scan safely in the browser. Downsampling preserves large transparent regions,
 * while normal screenshots are scanned pixel for pixel.
 */
export async function detectTransparency(image) {
  const naturalWidth = image.naturalWidth || image.width
  const naturalHeight = image.naturalHeight || image.height
  const maxEdge = 4096
  const ratio = Math.min(1, maxEdge / Math.max(naturalWidth, naturalHeight))
  const width = Math.max(1, Math.round(naturalWidth * ratio))
  const height = Math.max(1, Math.round(naturalHeight * ratio))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height

  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) return { transparent: false, sampled: false }

  context.clearRect(0, 0, width, height)
  context.drawImage(image, 0, 0, width, height)

  try {
    const { data } = context.getImageData(0, 0, width, height)
    for (let index = 3; index < data.length; index += 4) {
      if (data[index] < 255) {
        return { transparent: true, sampled: ratio < 1 }
      }
    }
  } catch {
    return { transparent: false, sampled: ratio < 1, unknown: true }
  }

  return { transparent: false, sampled: ratio < 1 }
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob)
        else reject(new ImageProcessingError('errors.encodeFailed'))
      },
      type,
      quality,
    )
  })
}

export async function encodeJpeg(canvas) {
  let quality = 0.92
  let blob = await canvasToBlob(canvas, 'image/jpeg', quality)

  // Apple's upload limit is 5MB. Most screenshots are far below it, but a
  // complex 2880 x 1800 frame can still be heavy, so step down conservatively.
  const qualitySteps = [0.9, 0.86, 0.82, 0.78, 0.74, 0.7, 0.64, 0.58]
  for (const nextQuality of qualitySteps) {
    if (blob.size <= MAX_FILE_BYTES) break
    quality = nextQuality
    blob = await canvasToBlob(canvas, 'image/jpeg', quality)
  }

  return { blob, quality }
}

/**
 * A browser PNG canvas normally carries an RGBA color type even when every
 * pixel is opaque. Apple rejects alpha channels, so encode an RGB (color type 2)
 * PNG explicitly instead of trusting canvas.toBlob().
 */
export function encodeRgbPng(canvas) {
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) throw new ImageProcessingError('errors.canvasUnavailable')

  const { width, height } = canvas
  const rgba = context.getImageData(0, 0, width, height).data
  const rgb = new Uint8Array(width * height * 3)

  for (let source = 0, target = 0; source < rgba.length; source += 4) {
    rgb[target] = rgba[source]
    rgb[target + 1] = rgba[source + 1]
    rgb[target + 2] = rgba[source + 2]
    target += 3
  }

  const png = encodePng({
    width,
    height,
    data: rgb,
    channels: 3,
    depth: 8,
  })

  return new Blob([png], { type: 'image/png' })
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.rel = 'noopener'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 15000)
}
