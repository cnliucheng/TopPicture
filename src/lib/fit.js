import { loadImage } from './image'

const MAX_FIT_EDGE = 4096
const CROP_RATIO = 16 / 10

function capDimensions(width, height) {
  const scale = Math.min(1, MAX_FIT_EDGE / Math.max(width, height))
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  }
}

function canvasToPngBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob)
        return
      }
      const error = new Error('fit-failed')
      error.i18nKey = 'errors.fitFailed'
      reject(error)
    }, 'image/png')
  })
}

/**
 * Creates an opaque 16:10 derivative from the original image.
 * - cover: largest centered 16:10 crop
 * - contain: full image fitted inside a white 16:10 canvas
 * - stretch: full image stretched to a 16:10 canvas
 */
export async function createStandardizedImage(sourceUrl, mode) {
  const image = await loadImage(sourceUrl)
  const sourceWidth = image.naturalWidth
  const sourceHeight = image.naturalHeight

  if (!sourceWidth || !sourceHeight) {
    const error = new Error('fit-failed')
    error.i18nKey = 'errors.fitFailed'
    throw error
  }

  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')
  if (!context) {
    const error = new Error('fit-failed')
    error.i18nKey = 'errors.fitFailed'
    throw error
  }

  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = 'high'

  if (mode === 'cover') {
    let cropWidth
    let cropHeight
    let sourceX
    let sourceY

    if (sourceWidth / sourceHeight > CROP_RATIO) {
      cropHeight = sourceHeight
      cropWidth = sourceHeight * CROP_RATIO
      sourceX = (sourceWidth - cropWidth) / 2
      sourceY = 0
    } else {
      cropWidth = sourceWidth
      cropHeight = sourceWidth / CROP_RATIO
      sourceX = 0
      sourceY = (sourceHeight - cropHeight) / 2
    }

    const output = capDimensions(cropWidth, cropHeight)
    canvas.width = output.width
    canvas.height = output.height
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.drawImage(
      image,
      sourceX,
      sourceY,
      cropWidth,
      cropHeight,
      0,
      0,
      canvas.width,
      canvas.height,
    )
  } else if (mode === 'contain') {
    const baseWidth =
      sourceWidth / sourceHeight >= CROP_RATIO
        ? sourceWidth
        : sourceHeight * CROP_RATIO
    const baseHeight =
      sourceWidth / sourceHeight >= CROP_RATIO
        ? sourceWidth / CROP_RATIO
        : sourceHeight
    const output = capDimensions(baseWidth, baseHeight)

    canvas.width = output.width
    canvas.height = output.height
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, canvas.width, canvas.height)

    const scale = Math.min(
      canvas.width / sourceWidth,
      canvas.height / sourceHeight,
    )
    const drawWidth = sourceWidth * scale
    const drawHeight = sourceHeight * scale
    const drawX = (canvas.width - drawWidth) / 2
    const drawY = (canvas.height - drawHeight) / 2
    context.drawImage(
      image,
      0,
      0,
      sourceWidth,
      sourceHeight,
      drawX,
      drawY,
      drawWidth,
      drawHeight,
    )
  } else if (mode === 'stretch') {
    const ratio = sourceWidth / sourceHeight
    const baseWidth =
      ratio >= CROP_RATIO ? sourceWidth : sourceHeight * CROP_RATIO
    const baseHeight =
      ratio >= CROP_RATIO ? sourceWidth / CROP_RATIO : sourceHeight
    const output = capDimensions(baseWidth, baseHeight)
    canvas.width = output.width
    canvas.height = output.height
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.drawImage(
      image,
      0,
      0,
      sourceWidth,
      sourceHeight,
      0,
      0,
      canvas.width,
      canvas.height,
    )
  } else {
    const error = new Error('fit-failed')
    error.i18nKey = 'errors.fitFailed'
    throw error
  }

  const blob = await canvasToPngBlob(canvas)
  return {
    url: URL.createObjectURL(blob),
    width: canvas.width,
    height: canvas.height,
    size: blob.size,
  }
}
