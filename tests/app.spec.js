import fs from 'node:fs/promises'
import path from 'node:path'
import { expect, test } from '@playwright/test'
import { decode } from 'fast-png'

const fixture = (name) => path.resolve('tests/fixtures', name)

async function openApp(page) {
  await page.goto('/')
  await expect(page.locator('.intro h1')).toBeVisible()
  await page.waitForTimeout(700)
}

async function uploadFile(page, file) {
  await page.locator('input[type=file]').setInputFiles(file)
}

async function uploadFixture(page, name) {
  await uploadFile(page, fixture(name))
  await expect(page.locator('.crop-surface')).toHaveClass(/is-ready/)
  await expect(page.locator('.export-button')).toBeEnabled()
}

async function readDownload(download) {
  const downloadPath = await download.path()
  return fs.readFile(downloadPath)
}

function readJpegSize(buffer) {
  let offset = 2
  while (offset < buffer.length - 1) {
    if (buffer[offset] !== 0xff) {
      offset += 1
      continue
    }

    const marker = buffer[offset + 1]
    const isStartOfFrame =
      marker >= 0xc0 &&
      marker <= 0xcf &&
      ![0xc4, 0xc8, 0xcc].includes(marker)

    if (isStartOfFrame) {
      return {
        height: buffer.readUInt16BE(offset + 5),
        width: buffer.readUInt16BE(offset + 7),
      }
    }

    if (marker === 0xd8 || marker === 0xd9) {
      offset += 2
      continue
    }

    const segmentLength = buffer.readUInt16BE(offset + 2)
    offset += 2 + segmentLength
  }

  throw new Error('JPEG dimensions not found')
}

function readPngHeader(buffer) {
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
    bitDepth: buffer[24],
    colorType: buffer[25],
  }
}

function readPngChunkTypes(buffer) {
  const types = []
  let offset = 8
  while (offset + 8 <= buffer.length) {
    const length = buffer.readUInt32BE(offset)
    const type = buffer.toString('ascii', offset + 4, offset + 8)
    types.push(type)
    offset += 12 + length
  }
  return types
}

test.beforeEach(async ({ page }) => {
  await openApp(page)
})

test('acceptance 1: rejects files over 5MB before initialising the cropper', async ({
  page,
}) => {
  await uploadFile(page, {
    name: 'too-large.jpg',
    mimeType: 'image/jpeg',
    buffer: Buffer.alloc(5 * 1024 * 1024 + 1, 0x20),
  })

  await expect(page.locator('.inline-notice--error')).toContainText(
    '文件大小超过 5MB',
  )
  await expect(page.locator('cropper-canvas')).toHaveCount(0)
})

test('acceptance 2: rejects GIF and WebP files', async ({ page }) => {
  await uploadFile(page, {
    name: 'animation.gif',
    mimeType: 'image/gif',
    buffer: Buffer.from('GIF89a'),
  })
  await expect(page.locator('.inline-notice--error')).toContainText(
    '仅支持 JPEG 或 PNG',
  )

  await uploadFile(page, {
    name: 'capture.webp',
    mimeType: 'image/webp',
    buffer: Buffer.from('RIFF'),
  })
  await expect(page.locator('.inline-notice--error')).toContainText(
    '仅支持 JPEG 或 PNG',
  )
  await expect(page.locator('cropper-canvas')).toHaveCount(0)
})

test('acceptance 3: detects transparency and flattens it to opaque white PNG', async ({
  page,
}) => {
  await uploadFixture(page, 'all-transparent.png')

  await expect(page.locator('.scan-state')).toContainText('有透明像素')
  await expect(page.locator('.inline-notice--warn').first()).toContainText(
    '检测到透明区域，导出时将自动填充为白色背景。',
  )

  await page.locator('input[type=radio][value=png]').check()
  const downloadPromise = page.waitForEvent('download')
  await page.locator('.export-button').click()
  const download = await downloadPromise
  const buffer = await readDownload(download)

  expect(download.suggestedFilename()).toBe('screenshot_1440x900.png')
  expect(readPngHeader(buffer)).toEqual({
    width: 1440,
    height: 900,
    bitDepth: 8,
    colorType: 2,
  })
  expect(readPngChunkTypes(buffer)).not.toContain('tRNS')

  const decoded = decode(buffer)
  expect(decoded.channels).toBe(3)
  expect(decoded.data.every((value) => value === 255)).toBe(true)
})

test('acceptance 4 and 6: exports a 2880x1800 JPEG below 5MB', async ({
  page,
}) => {
  await uploadFixture(page, 'app-screenshot.jpg')
  await page.selectOption('#target-size', { index: 3 })
  await page.locator('input[type=radio][value=jpeg]').check()

  const downloadPromise = page.waitForEvent('download')
  await page.locator('.export-button').click()
  const download = await downloadPromise
  const buffer = await readDownload(download)

  expect(download.suggestedFilename()).toBe('screenshot_2880x1800.jpg')
  expect(readJpegSize(buffer)).toEqual({ width: 2880, height: 1800 })
  expect(buffer.length).toBeLessThanOrEqual(5 * 1024 * 1024)
})

test('acceptance 5: keeps the crop ratio at 16:10 while resizing', async ({
  page,
}) => {
  await uploadFixture(page, 'app-screenshot.jpg')

  const before = await page.evaluate(() => {
    const selection = document.querySelector('cropper-selection')
    return { width: selection.width, height: selection.height }
  })

  const handle = await page
    .locator('cropper-handle[action="se-resize"]')
    .boundingBox()
  expect(handle).not.toBeNull()

  const startX = handle.x + handle.width / 2
  const startY = handle.y + handle.height / 2
  await page.mouse.move(startX, startY)
  await page.mouse.down()
  await page.mouse.move(startX + 28, startY + 18, { steps: 8 })
  await page.mouse.up()

  await expect
    .poll(async () =>
      page.evaluate(() => {
        const selection = document.querySelector('cropper-selection')
        return selection.width / selection.height
      }),
    )
    .toBeCloseTo(1.6, 4)

  const after = await page.evaluate(() => {
    const selection = document.querySelector('cropper-selection')
    return { width: selection.width, height: selection.height }
  })
  expect(after.width).toBeGreaterThan(before.width)
})

test('acceptance 7: exports an RGB PNG with no alpha channel at exact size', async ({
  page,
}) => {
  await uploadFixture(page, 'app-screenshot.jpg')
  const downloadPromise = page.waitForEvent('download')
  await page.locator('input[type=radio][value=png]').check()
  await page.locator('.export-button').click()
  const download = await downloadPromise
  const buffer = await readDownload(download)

  expect(download.suggestedFilename()).toBe('screenshot_1440x900.png')
  expect(readPngHeader(buffer)).toEqual({
    width: 1440,
    height: 900,
    bitDepth: 8,
    colorType: 2,
  })
  expect(readPngChunkTypes(buffer)).not.toContain('tRNS')
})

test('acceptance 8: rejects images below 1280x800', async ({ page }) => {
  await uploadFile(page, fixture('low-resolution.png'))
  await expect(page.locator('.inline-notice--error')).toContainText(
    '低于最低要求 1280 × 800',
  )
  await expect(page.locator('cropper-canvas')).toHaveCount(0)
})

test('supports wheel zoom and resetting the crop view', async ({ page }) => {
  await uploadFixture(page, 'app-screenshot.jpg')

  const initialScale = await page.evaluate(
    () => document.querySelector('cropper-image').$getTransform()[0],
  )

  await page.mouse.move(900, 450)
  await page.mouse.wheel(0, -240)

  await expect
    .poll(async () =>
      page.evaluate(
        () => document.querySelector('cropper-image').$getTransform()[0],
      ),
    )
    .toBeGreaterThan(initialScale)

  await page.locator('.stage-icon-button').click()
  await expect
    .poll(async () =>
      page.evaluate(
        () => document.querySelector('cropper-image').$getTransform()[0],
      ),
    )
    .toBeCloseTo(initialScale, 2)
})

test('defaults to 1440x900 and changes export size without rebuilding the cropper', async ({
  page,
}) => {
  await uploadFixture(page, 'app-screenshot.jpg')

  await expect(page.locator('#target-size')).toHaveValue('1')
  await expect(page.locator('#target-size option:checked')).toHaveText(
    '1440 × 900',
  )

  await page.evaluate(() => {
    document.querySelector('cropper-canvas').dataset.instanceMarker = 'kept'
  })

  await page.selectOption('#target-size', { index: 2 })
  await expect(page.locator('#target-size option:checked')).toHaveText(
    '2560 × 1600',
  )
  await expect(page.locator('.stage-metric .metric-value--accent')).toContainText(
    '2560 × 1600 px',
  )

  const marker = await page.evaluate(
    () => document.querySelector('cropper-canvas').dataset.instanceMarker,
  )
  expect(marker).toBe('kept')
})
