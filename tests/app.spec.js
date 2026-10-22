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

async function dropFixtures(page, names) {
  const payload = await Promise.all(
    names.map(async (name) => {
      const data = await fs.readFile(fixture(name))
      return {
        name,
        type: name.endsWith('.png') ? 'image/png' : 'image/jpeg',
        data: data.toString('base64'),
      }
    }),
  )

  await page.evaluate((files) => {
    const transfer = new DataTransfer()
    for (const file of files) {
      const bytes = Uint8Array.from(atob(file.data), (char) =>
        char.charCodeAt(0),
      )
      transfer.items.add(new File([bytes], file.name, { type: file.type }))
    }

    const surface = document.querySelector('.crop-surface')
    for (const type of ['dragenter', 'dragover', 'drop']) {
      surface.dispatchEvent(
        new DragEvent(type, {
          bubbles: true,
          cancelable: true,
          dataTransfer: transfer,
        }),
      )
    }
  }, payload)
}

async function sampleThumbnail(page) {
  return page.evaluate(async () => {
    const image = document.querySelector('.thumb-frame img')
    await image.decode()
    const canvas = document.createElement('canvas')
    canvas.width = image.naturalWidth
    canvas.height = image.naturalHeight
    const context = canvas.getContext('2d')
    context.drawImage(image, 0, 0)
    return {
      width: canvas.width,
      height: canvas.height,
      corner: [...context.getImageData(0, 0, 1, 1).data],
    }
  })
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
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('__locale_seeded')) {
      localStorage.setItem('framecheck-locale', 'zh')
      sessionStorage.setItem('__locale_seeded', '1')
    }
  })
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

  await expect(
    page.locator('.thumb-card').first().locator('.alpha-dot'),
  ).toBeVisible()
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

test('uses the canvas empty state and add button as the only upload entry', async ({
  page,
}) => {
  await expect(page.locator('.stage-empty')).toBeVisible()

  const firstChooser = page.waitForEvent('filechooser')
  await page.locator('.stage-empty').click()
  const first = await firstChooser
  await first.setFiles(fixture('app-screenshot.jpg'))

  await expect(page.locator('.thumb-card')).toHaveCount(1)
  await expect(page.locator('.crop-surface')).toHaveClass(/is-ready/)

  const secondChooser = page.waitForEvent('filechooser')
  await page.locator('.stage-add-button').click()
  const second = await secondChooser
  await second.setFiles(fixture('transparent-screenshot.png'))

  await expect(page.locator('.thumb-card')).toHaveCount(2)
  await expect(page.locator('.thumb-card').nth(1)).toHaveClass(/is-active/)
})

test('imports multiple images and preserves each crop view', async ({ page }) => {
  await uploadFile(page, [
    fixture('app-screenshot.jpg'),
    fixture('transparent-screenshot.png'),
  ])

  await expect(page.locator('.thumb-card')).toHaveCount(2)
  await expect(page.locator('.thumb-card').first()).toHaveClass(/is-active/)
  await expect(page.locator('.crop-surface')).toHaveClass(/is-ready/)
  await expect(
    page.locator('#step-library').locator('..').locator('.step-note'),
  ).toHaveText('2 / 5')

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

  const zoomedScale = await page.evaluate(
    () => document.querySelector('cropper-image').$getTransform()[0],
  )

  await page.locator('.thumb-card').nth(1).locator('.thumb-select').click()
  await expect(page.locator('.thumb-card').nth(1)).toHaveClass(/is-active/)
  await expect(page.locator('.crop-surface')).toHaveClass(/is-ready/)

  await page.locator('.thumb-card').first().locator('.thumb-select').click()
  await expect(page.locator('.crop-surface')).toHaveClass(/is-ready/)
  await expect
    .poll(async () =>
      page.evaluate(
        () => document.querySelector('cropper-image').$getTransform()[0],
      ),
    )
    .toBeCloseTo(zoomedScale, 4)

  await page.locator('.thumb-card').first().locator('.thumb-remove').click()
  await expect(page.locator('.delete-dialog')).toBeVisible()
  await page.getByRole('button', { name: '不保存，删除' }).click()
  await expect(page.locator('.thumb-card')).toHaveCount(1)
  await expect(page.locator('.thumb-card').first()).toHaveClass(/is-active/)
  await expect(page.locator('.thumb-add')).toBeVisible()
})

test('keeps valid images when part of a batch fails validation', async ({
  page,
}) => {
  await uploadFile(page, [
    fixture('app-screenshot.jpg'),
    fixture('low-resolution.png'),
  ])

  await expect(page.locator('.thumb-card')).toHaveCount(1)
  await expect(page.locator('.thumb-name')).toHaveText('app-screenshot.jpg')
  await expect(page.locator('.crop-surface')).toHaveClass(/is-ready/)
  await expect(page.locator('.import-errors')).toContainText(
    '低于最低要求 1280 × 800',
  )
})

test('caps the library at five images and reports extras', async ({ page }) => {
  await uploadFile(page, [
    fixture('app-screenshot.jpg'),
    fixture('transparent-screenshot.png'),
    fixture('all-transparent.png'),
    fixture('app-screenshot.jpg'),
    fixture('transparent-screenshot.png'),
    fixture('all-transparent.png'),
  ])

  await expect(page.locator('.thumb-card')).toHaveCount(5)
  await expect(
    page.locator('#step-library').locator('..').locator('.step-note'),
  ).toHaveText('5 / 5')
  await expect(page.locator('.import-errors')).toContainText(
    '最多保留 5 张截图',
  )
  await expect(page.locator('.stage-add-button')).toBeDisabled()
  await expect(page.locator('.stage-add-button')).toContainText('已达上限')
  await expect(page.locator('input[type=file]')).toBeDisabled()
})

test('imports multiple images by dropping them on the canvas', async ({
  page,
}) => {
  await dropFixtures(page, [
    'app-screenshot.jpg',
    'transparent-screenshot.png',
  ])

  await expect(page.locator('.thumb-card')).toHaveCount(2)
  await expect(page.locator('.thumb-card').first()).toHaveClass(/is-active/)
  await expect(page.locator('.crop-surface')).toHaveClass(/is-ready/)
  await expect(page.locator('.thumb-name').nth(0)).toHaveText(
    'app-screenshot.jpg',
  )
  await expect(page.locator('.thumb-name').nth(1)).toHaveText(
    'transparent-screenshot.png',
  )
})

test('exports only the active image in a multi-image library', async ({
  page,
}) => {
  await uploadFile(page, [
    fixture('app-screenshot.jpg'),
    fixture('all-transparent.png'),
  ])

  await page.locator('.thumb-card').nth(1).locator('.thumb-select').click()
  await expect(page.locator('.thumb-card').nth(1)).toHaveClass(/is-active/)
  await expect(page.locator('.crop-surface')).toHaveClass(/is-ready/)

  await page.locator('input[type=radio][value=png]').check()
  const downloadPromise = page.waitForEvent('download')
  await page.locator('.export-button').click()
  const download = await downloadPromise
  const buffer = await readDownload(download)
  const decoded = decode(buffer)

  expect(download.suggestedFilename()).toBe('screenshot_1440x900.png')
  expect(decoded.channels).toBe(3)
  expect(decoded.data.every((value) => value === 255)).toBe(true)
})

test('keeps the import entry point on the canvas only', async ({ page }) => {
  await expect(page.locator('.dropzone')).toHaveCount(0)
  await expect(page.locator('.control-panel input[type=file]')).toHaveCount(0)
  await expect(page.locator('.control-panel .stage-empty')).toHaveCount(0)
  await expect(page.locator('.stage-empty')).toHaveCount(1)
  await expect(page.locator('.stage-empty')).toBeVisible()
  await expect(page.locator('input[type=file]')).toHaveCount(1)
})

test('shows a plus slot after deletion and allows adding one image', async ({
  page,
}) => {
  await uploadFile(page, [
    fixture('app-screenshot.jpg'),
    fixture('transparent-screenshot.png'),
  ])
  await expect(page.locator('.thumb-card')).toHaveCount(2)

  await page.locator('.thumb-card').first().locator('.thumb-remove').click()
  await expect(page.locator('.delete-dialog')).toBeVisible()
  await expect(page.locator('.delete-file')).toHaveText('app-screenshot.jpg')
  await page.getByRole('button', { name: '取消', exact: true }).click()
  await expect(page.locator('.thumb-card')).toHaveCount(2)
  await expect(page.locator('.thumb-add')).toHaveCount(0)

  await page.locator('.thumb-card').first().locator('.thumb-remove').click()
  await page.getByRole('button', { name: '不保存，删除' }).click()
  await expect(page.locator('.thumb-card')).toHaveCount(1)
  await expect(page.locator('.thumb-add')).toBeVisible()

  const chooserPromise = page.waitForEvent('filechooser')
  await page.locator('.thumb-add').click()
  const chooser = await chooserPromise
  await chooser.setFiles(fixture('app-screenshot.jpg'))

  await expect(page.locator('.thumb-card')).toHaveCount(2)
  await expect(page.locator('.thumb-add')).toHaveCount(0)
  await expect(
    page.locator('.image-library input[type=file]'),
  ).toHaveCount(0)
})

test('saves a non-active image before deleting it', async ({ page }) => {
  await uploadFile(page, [
    fixture('app-screenshot.jpg'),
    fixture('transparent-screenshot.png'),
  ])
  await expect(page.locator('.thumb-card').first()).toHaveClass(/is-active/)

  await page.locator('.thumb-card').nth(1).locator('.thumb-remove').click()
  await expect(page.locator('.delete-file')).toHaveText(
    'transparent-screenshot.png',
  )

  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: '保存并删除' }).click()
  const download = await downloadPromise
  const buffer = await readDownload(download)

  expect(download.suggestedFilename()).toBe('screenshot_1440x900.jpg')
  expect(readJpegSize(buffer)).toEqual({ width: 1440, height: 900 })
  await expect(page.locator('.thumb-card')).toHaveCount(1)
  await expect(page.locator('.thumb-card').first()).toHaveClass(/is-active/)
  await expect(page.locator('.thumb-card').first()).toContainText(
    'app-screenshot.jpg',
  )
  await expect(page.locator('.toast')).toContainText('已保存并删除')
  await expect(page.locator('.thumb-add')).toBeVisible()
})

test('auto-fits a 16:9 screenshot using all three modes', async ({ page }) => {
  await uploadFixture(page, 'wide-screenshot.jpg')
  await expect(page.locator('.thumb-dims')).toHaveText('1,920 × 1,080')

  await page.locator('.stage-fit-button').click()
  await expect(page.locator('.fit-menu')).toBeVisible()
  await expect(page.locator('.fit-option')).toHaveCount(3)
  await expect(page.getByRole('menuitem', { name: /裁切填满/ })).toBeVisible()
  await expect(page.getByRole('menuitem', { name: /完整留白/ })).toBeVisible()
  await expect(page.getByRole('menuitem', { name: /拉伸填满/ })).toBeVisible()

  await page.getByRole('menuitem', { name: /裁切填满/ }).click()
  await expect(page.locator('.thumb-dims')).toHaveText('1,728 × 1,080')
  await expect(page.locator('.toast')).toContainText('裁切填满 · 无变形')
  await expect(page.locator('.crop-surface')).toHaveClass(/is-ready/)
  let sample = await sampleThumbnail(page)
  expect(sample.width).toBe(1728)
  expect(sample.height).toBe(1080)
  expect(sample.corner.slice(0, 3)).not.toEqual([255, 255, 255])

  await page.locator('.stage-fit-button').click()
  await page.getByRole('menuitem', { name: /完整留白/ }).click()
  await expect(page.locator('.thumb-dims')).toHaveText('1,920 × 1,200')
  await expect(page.locator('.toast')).toContainText('完整留白 · 保留全部内容')
  await expect(page.locator('.crop-surface')).toHaveClass(/is-ready/)
  sample = await sampleThumbnail(page)
  expect(sample.width).toBe(1920)
  expect(sample.height).toBe(1200)
  expect(sample.corner.slice(0, 3)).toEqual([255, 255, 255])

  await page.locator('input[type=radio][value=png]').check()
  const downloadPromise = page.waitForEvent('download')
  await page.locator('.export-button').click()
  const download = await downloadPromise
  const exported = await readDownload(download)
  const decoded = decode(exported)
  expect(readPngHeader(exported)).toEqual({
    width: 1440,
    height: 900,
    bitDepth: 8,
    colorType: 2,
  })
  expect([...decoded.data.slice(0, 3)]).toEqual([255, 255, 255])

  await page.locator('.stage-fit-button').click()
  await page.getByRole('menuitem', { name: /拉伸填满/ }).click()
  await expect(page.locator('.thumb-dims')).toHaveText('1,920 × 1,200')
  await expect(page.locator('.toast')).toContainText('拉伸填满 · 画面已变形')
  await expect(page.locator('.crop-surface')).toHaveClass(/is-ready/)
  sample = await sampleThumbnail(page)
  expect(sample.width).toBe(1920)
  expect(sample.height).toBe(1200)
  expect(sample.corner.slice(0, 3)).not.toEqual([255, 255, 255])
  await expect(page.locator('.toast')).toContainText('已应用一键适配')
})

test('switches between Chinese and English and persists the choice', async ({
  page,
}) => {
  await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN')
  await expect(page.locator('.intro h1')).toHaveText('截图，一次过审.')

  await page.locator('[data-locale="en"]').click()

  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.locator('.intro h1')).toHaveText('Screenshots that pass.')
  await expect(page.locator('#step-library')).toHaveText('Screenshots')
  await expect(page.locator('.export-button')).toContainText(
    'Export compliant screenshot',
  )
  await expect(page.getByRole('button', { name: 'Apple rules' })).toBeVisible()

  const headlineOverflow = await page
    .locator('.intro h1')
    .evaluate((element) => element.scrollWidth > element.clientWidth + 1)
  expect(headlineOverflow).toBe(false)

  await page.getByRole('button', { name: 'Apple rules' }).click()
  await expect(page.locator('#spec-title')).toHaveText(
    'Mac App Store screenshot rules',
  )
  await page.locator('.spec-close').click()

  await page.reload()
  await expect(page.locator('.intro h1')).toHaveText('Screenshots that pass.')

  await uploadFile(page, {
    name: 'too-large.jpg',
    mimeType: 'image/jpeg',
    buffer: Buffer.alloc(5 * 1024 * 1024 + 1, 0x20),
  })
  await expect(page.locator('.inline-notice--error')).toContainText(
    'File is larger than 5MB',
  )

  await page.locator('[data-locale="zh"]').click()
  await expect(page.locator('.intro h1')).toHaveText('截图，一次过审.')
  await expect(page.locator('.inline-notice--error')).toContainText(
    '文件大小超过 5MB',
  )
})

test('localizes the auto-fit and delete controls', async ({ page }) => {
  await page.locator('[data-locale="en"]').click()
  await uploadFixture(page, 'app-screenshot.jpg')

  await expect(page.getByRole('button', { name: 'Auto-fit' })).toBeVisible()
  await page.getByRole('button', { name: 'Auto-fit' }).click()
  await expect(
    page.getByRole('menuitem', { name: /Crop to fill/ }),
  ).toBeVisible()
  await expect(
    page.getByRole('menuitem', { name: /Fit with white padding/ }),
  ).toBeVisible()
  await expect(
    page.getByRole('menuitem', { name: /Stretch to fill/ }),
  ).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.locator('.fit-menu')).toHaveCount(0)

  await page.locator('.thumb-remove').click()
  await expect(page.locator('#delete-title')).toHaveText(
    'Delete this screenshot?',
  )
  await expect(
    page.getByRole('button', { name: 'Delete without saving' }),
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Save and delete' }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect(page.locator('.thumb-card')).toHaveCount(1)
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
