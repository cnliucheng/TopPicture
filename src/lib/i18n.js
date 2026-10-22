import { ref } from 'vue'

const STORAGE_KEY = 'framecheck-locale'
const SUPPORTED_LOCALES = ['zh', 'en']

const messages = {
  zh: {
    'meta.title': 'Framecheck · Mac App Store 截图合规工具',
    'meta.description':
      '在浏览器里完成 Mac App Store 截图合规裁剪：锁定 16:10、压平透明通道，精确导出 Apple 审核尺寸。',

    'locale.groupLabel': '切换语言',
    'locale.zhLabel': '切换到中文',
    'locale.enLabel': '切换到英文',

    'brand.descriptor': 'Mac App Store 截图合规',
    'topbar.local': '纯本地处理',
    'topbar.githubAria': '在 GitHub 查看 Framecheck 源码',
    'topbar.githubTitle': '在 GitHub 查看源码',
    'topbar.spec': 'Apple 规范',

    'intro.eyebrow': '截图合规',
    'intro.titleLead': '截图，',
    'intro.titleAccent': '一次过审',
    'intro.lede':
      '锁定 16:10 比例，自动压平透明通道。导出即可提交的 Mac App Store 截图。',

    'library.title': '截图列表',
    'library.aria': '截图列表',
    'library.empty': '还没有截图，请在右侧画布导入或拖入。',
    'library.importing': '正在导入...',
    'library.errorsTitle': '{count} 张截图未导入',
    'library.removeAria': '移除 {name}',
    'library.transparent': '含透明像素',
    'library.opaque': '无透明像素',
    'library.hint': '点击缩略图切换当前截图',
    'library.addOne': '添加一张',
    'library.addOneAria': '再添加一张截图',

    'app.fileInputAria': '选择截图文件',
    'app.transparencyNotice':
      '检测到透明区域，导出时将自动填充为白色背景。',
    'app.stepSize': '目标尺寸',
    'app.targetResolution': '目标分辨率',
    'app.aspectLocked': '锁定比例',
    'app.upscaleWarning':
      '裁剪区域约 {width} × {height} px，导出会放大 {scale} 倍，画质可能下降。',
    'app.stepFormat': '导出格式',
    'app.formatLegend': '选择导出格式',
    'app.jpegQuality': '92% 质量',
    'app.pngLossless': '无损输出',
    'app.recommended': '推荐',
    'app.noAlpha': '无 Alpha',
    'app.export': '导出合规截图',
    'app.exporting': '正在生成合规截图',
    'app.preparing': '正在准备画布',
    'app.exportFootIdle': '选择截图后即可导出合规文件',
    'app.exportFootPreparing': '正在准备裁剪画布',
    'app.exportFootJpeg': 'JPG · 92% 质量 · 自动白底',
    'app.exportFootPng': 'PNG · RGB 无 Alpha · 自动白底',
    'app.exportFootLast': '最近导出 {filename} · {size}',

    'stage.addImages': '添加图片',
    'stage.autoFit': '一键适配',
    'stage.fitCover': '裁切填满',
    'stage.fitCoverHint': '推荐 · 等比填满，裁掉多余边缘',
    'stage.fitContain': '完整留白',
    'stage.fitContainHint': '保留完整截图，补白色边',
    'stage.fitStretch': '拉伸填满',
    'stage.fitStretchHint': '会变形 · 不建议作为默认',
    'stage.limitReached': '已达上限',
    'stage.limitTitle': '最多添加 {max} 张截图',
    'stage.emptyTitle': '把截图放到这里',
    'stage.emptyCopy': '点击选择，或直接拖入画布',
    'stage.emptyMeta': 'JPEG / PNG · 最多 {max} 张 · 每张 ≤ 5 MB',
    'stage.importing': '正在导入截图...',
    'stage.eyebrow': '预览画布',
    'stage.title': '裁剪画布',
    'stage.hint': '拖动裁剪 · 滚轮缩放',
    'stage.reset': '重置裁剪区域',
    'stage.loading': '正在准备 16:10 画布',
    'stage.retry': '重新加载画布',
    'stage.initFailed': '无法初始化裁剪画布，请重新选择截图。',
    'stage.alt': '待裁剪的截图',
    'stage.dropOverlay': '松手添加截图',
    'stage.cropArea': '裁剪区域',
    'stage.waiting': '等待导入',
    'stage.output': '输出',
    'stage.flatten': '白底压平',

    'spec.eyebrow': 'Apple 要求',
    'spec.title': 'Mac App Store 截图规范',
    'spec.intro':
      'App Store Connect 只接受固定规格的 Mac 截图。尺寸、比例或透明度不符，都可能在审核阶段被退回。',
    'spec.resolutions': '可用分辨率',
    'spec.pickOne': '四选一',
    'spec.current': '当前',
    'spec.requirements': '必须满足',
    'spec.preSubmit': '提交前检查',
    'spec.fixedRatioTitle': '固定 16:10',
    'spec.fixedRatioBody': '四种尺寸全部为 16:10，本工具会锁死裁剪比例。',
    'spec.noAlphaTitle': '无 Alpha 通道',
    'spec.noAlphaBody':
      '透明区域会在导出时压平为白色，PNG 也会移除 Alpha 通道。',
    'spec.formatsTitle': 'JPEG 或 PNG',
    'spec.formatsBody': '仅接受 .jpg、.jpeg 或 .png 文件。',
    'spec.sizeTitle': '不超过 5MB',
    'spec.sizeBody': '上传与导出的文件都应控制在 5MB 以内。',
    'spec.tip': '不确定时，优先使用 1440 × 900 与 JPEG 92% 质量。',
    'spec.official': 'Apple 官方说明',
    'spec.closeAria': '关闭规范说明',

    'delete.title': '删除这张截图？',
    'delete.body': '删除前是否保存当前裁剪修改？保存会按当前格式和分辨率导出一份文件。',
    'delete.cancel': '取消',
    'delete.skip': '不保存，删除',
    'delete.save': '保存并删除',
    'delete.saving': '正在保存...',
    'delete.closeAria': '关闭删除确认',
    'toast.savedAndDeleted': '已保存并删除',
    'toast.fitApplied': '已应用一键适配',
    'toast.fitFailed': '适配失败',
    'toast.fitMode.cover': '裁切填满 · 无变形',
    'toast.fitMode.contain': '完整留白 · 保留全部内容',
    'toast.fitMode.stretch': '拉伸填满 · 画面已变形',
    'toast.importPartial': '部分截图未导入',
    'toast.importFailed': '截图未导入',
    'toast.exported': '截图已导出',
    'toast.exportedOversize': '已导出，但文件超过 5MB',
    'toast.exportFailed': '导出失败',
    'toast.canvasFailed': '画布初始化失败',
    'toast.exportDetail': '{filename} · {size}',
    'toast.qualityReduced': '为控制在 5MB 内，质量降至 {quality}%',
    'toast.oversizeHint': '已超过 5MB，建议改用 JPEG',
    'toast.closeAria': '关闭通知',

    'errors.chooseFile': '请选择一张截图后再开始裁剪。',
    'errors.unsupportedFormat':
      '仅支持 JPEG 或 PNG 格式。GIF、WebP 等格式无法用于 App Store 截图。',
    'errors.tooLarge': '文件大小超过 5MB，请压缩后重试。',
    'errors.emptyFile': '这个文件是空的，请重新选择截图。',
    'errors.invalidContent': '文件内容不是有效的 JPEG 或 PNG，请重新导出后上传。',
    'errors.readFailed': '无法读取这张图片，请换一张 JPEG 或 PNG 重试。',
    'errors.dimensionsTooSmall':
      '图片尺寸为 {width} × {height}，低于最低要求 {minWidth} × {minHeight}。请更换更高分辨率的截图。',
    'errors.exportFailed': '浏览器未能生成截图，请重试。',
    'errors.encodeFailed': '浏览器未能生成图片，请重试。',
    'errors.canvasUnavailable': '浏览器无法创建导出画布。',
    'errors.fitFailed': '无法生成 16:10 标准图片，请重试。',
    'errors.batchLimit':
      '最多保留 {max} 张截图，本次仅处理了前 {count} 张。',
    'errors.listFull':
      '截图列表已满（最多 {max} 张）。请先删除一张再添加。',
  },
  en: {
    'meta.title': 'Framecheck · Mac App Store screenshot compliance',
    'meta.description':
      'Crop Mac App Store screenshots in your browser. Lock 16:10, flatten transparency, and export exact Apple review sizes.',

    'locale.groupLabel': 'Language',
    'locale.zhLabel': 'Switch to Chinese',
    'locale.enLabel': 'Switch to English',

    'brand.descriptor': 'Mac App Store compliance',
    'topbar.local': 'Processed locally',
    'topbar.githubAria': 'View Framecheck source on GitHub',
    'topbar.githubTitle': 'View source on GitHub',
    'topbar.spec': 'Apple rules',

    'intro.eyebrow': 'Screenshot compliance',
    'intro.titleLead': 'Screenshots that ',
    'intro.titleAccent': 'pass',
    'intro.lede':
      'Lock 16:10, flatten transparency, and export screenshots ready for Mac App Store review.',

    'library.title': 'Screenshots',
    'library.aria': 'Screenshot list',
    'library.empty': 'No screenshots yet. Import or drop them on the right.',
    'library.importing': 'Importing...',
    'library.errorsTitle': 'Not imported: {count}',
    'library.removeAria': 'Remove {name}',
    'library.transparent': 'Has transparency',
    'library.opaque': 'No transparency',
    'library.hint': 'Select a thumbnail to switch the active screenshot',
    'library.addOne': 'Add one',
    'library.addOneAria': 'Add one more screenshot',

    'app.fileInputAria': 'Choose a screenshot file',
    'app.transparencyNotice':
      'Transparency detected. It will be flattened to white on export.',
    'app.stepSize': 'Target size',
    'app.targetResolution': 'Target resolution',
    'app.aspectLocked': 'Aspect locked',
    'app.upscaleWarning':
      'Crop area is about {width} × {height} px. Export upscales {scale}× and may look soft.',
    'app.stepFormat': 'Export format',
    'app.formatLegend': 'Choose export format',
    'app.jpegQuality': '92% quality',
    'app.pngLossless': 'Lossless',
    'app.recommended': 'Recommended',
    'app.noAlpha': 'No alpha',
    'app.export': 'Export compliant screenshot',
    'app.exporting': 'Encoding screenshot',
    'app.preparing': 'Preparing canvas',
    'app.exportFootIdle': 'Import a screenshot to export',
    'app.exportFootPreparing': 'Preparing crop canvas',
    'app.exportFootJpeg': 'JPG · 92% quality · White background',
    'app.exportFootPng': 'PNG · RGB · No alpha · White background',
    'app.exportFootLast': 'Last export {filename} · {size}',

    'stage.addImages': 'Add images',
    'stage.autoFit': 'Auto-fit',
    'stage.fitCover': 'Crop to fill',
    'stage.fitCoverHint': 'Recommended · Proportional fill, trims edges',
    'stage.fitContain': 'Fit with white padding',
    'stage.fitContainHint': 'Keep the full screenshot with white padding',
    'stage.fitStretch': 'Stretch to fill',
    'stage.fitStretchHint': 'Distorts the image · Not recommended',
    'stage.limitReached': 'Limit reached',
    'stage.limitTitle': 'Up to {max} screenshots',
    'stage.emptyTitle': 'Drop screenshots here',
    'stage.emptyCopy': 'Click to choose, or drag them into the canvas',
    'stage.emptyMeta': 'JPEG / PNG · Up to {max} · 5 MB each',
    'stage.importing': 'Importing screenshots...',
    'stage.eyebrow': 'Preview canvas',
    'stage.title': 'Crop canvas',
    'stage.hint': 'Drag to crop · Scroll to zoom',
    'stage.reset': 'Reset crop area',
    'stage.loading': 'Preparing 16:10 canvas',
    'stage.retry': 'Reload canvas',
    'stage.initFailed':
      'Could not initialise the crop canvas. Try importing the image again.',
    'stage.alt': 'Screenshot to crop',
    'stage.dropOverlay': 'Drop to add screenshots',
    'stage.cropArea': 'Crop area',
    'stage.waiting': 'Waiting for image',
    'stage.output': 'Output',
    'stage.flatten': 'Flattened to white',

    'spec.eyebrow': 'Apple requirements',
    'spec.title': 'Mac App Store screenshot rules',
    'spec.intro':
      'App Store Connect only accepts Mac screenshots in fixed formats. Wrong dimensions, aspect ratio, or transparency can cause rejection.',
    'spec.resolutions': 'Accepted resolutions',
    'spec.pickOne': 'Choose one',
    'spec.current': 'Current',
    'spec.requirements': 'Requirements',
    'spec.preSubmit': 'Pre-submit checks',
    'spec.fixedRatioTitle': 'Fixed 16:10',
    'spec.fixedRatioBody':
      'All four sizes are 16:10. This tool locks the crop ratio.',
    'spec.noAlphaTitle': 'No alpha channel',
    'spec.noAlphaBody':
      'Transparent areas are flattened to white, and PNG exports are encoded without an alpha channel.',
    'spec.formatsTitle': 'JPEG or PNG',
    'spec.formatsBody': 'Only .jpg, .jpeg, or .png files are accepted.',
    'spec.sizeTitle': 'Under 5MB',
    'spec.sizeBody': 'Keep both uploads and exports under 5MB.',
    'spec.tip': 'When unsure, use 1440 × 900 and JPEG at 92% quality.',
    'spec.official': 'Official Apple docs',
    'spec.closeAria': 'Close guidelines',

    'delete.title': 'Delete this screenshot?',
    'delete.body': 'Save your current crop before deleting? Saving downloads a file using the current format and size.',
    'delete.cancel': 'Cancel',
    'delete.skip': 'Delete without saving',
    'delete.save': 'Save and delete',
    'delete.saving': 'Saving...',
    'delete.closeAria': 'Close delete confirmation',
    'toast.savedAndDeleted': 'Saved and deleted',
    'toast.fitApplied': 'Auto-fit applied',
    'toast.fitFailed': 'Auto-fit failed',
    'toast.fitMode.cover': 'Crop to fill · No distortion',
    'toast.fitMode.contain': 'Fit with white padding · Full content kept',
    'toast.fitMode.stretch': 'Stretch to fill · Image distorted',
    'toast.importPartial': 'Some screenshots were not imported',
    'toast.importFailed': 'Screenshots not imported',
    'toast.exported': 'Screenshot exported',
    'toast.exportedOversize': 'Exported, but the file exceeds 5MB',
    'toast.exportFailed': 'Export failed',
    'toast.canvasFailed': 'Canvas initialisation failed',
    'toast.exportDetail': '{filename} · {size}',
    'toast.qualityReduced': 'Quality reduced to {quality}% to stay under 5MB',
    'toast.oversizeHint': 'Over 5MB, try JPEG instead',
    'toast.closeAria': 'Close notification',

    'errors.chooseFile': 'Choose a screenshot before cropping.',
    'errors.unsupportedFormat':
      'Only JPEG or PNG. GIF, WebP, and other formats cannot be used for App Store screenshots.',
    'errors.tooLarge': 'File is larger than 5MB. Compress it and try again.',
    'errors.emptyFile': 'This file is empty. Choose another screenshot.',
    'errors.invalidContent': 'File content is not a valid JPEG or PNG.',
    'errors.readFailed': 'Could not read this image. Try another JPEG or PNG.',
    'errors.dimensionsTooSmall':
      'Image is {width} × {height}, below the minimum {minWidth} × {minHeight}. Use a higher-resolution screenshot.',
    'errors.exportFailed':
      'The browser could not generate the screenshot. Try again.',
    'errors.encodeFailed': 'The browser could not encode the image. Try again.',
    'errors.canvasUnavailable': 'The browser could not create the export canvas.',
    'errors.fitFailed': 'Could not create a 16:10 image. Try again.',
    'errors.batchLimit':
      'Up to {max} screenshots can be kept. Only the first {count} were processed.',
    'errors.listFull':
      'Screenshot list is full ({max} max). Remove one before adding more.',
  },
}

function detectLocale() {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY)
    if (SUPPORTED_LOCALES.includes(saved)) return saved
  } catch {
    // Storage can be unavailable in private or restricted contexts.
  }

  const languages = window.navigator.languages?.length
    ? window.navigator.languages
    : [window.navigator.language]
  const preferred = String(languages[0] || 'en').toLowerCase()

  return preferred.startsWith('zh') ? 'zh' : 'en'
}

export const locale = ref(detectLocale())

function interpolate(template, params = {}) {
  return template.replace(/\{(\w+)\}/g, (match, key) => {
    const value = params[key]
    return value === undefined || value === null ? match : String(value)
  })
}

export function t(key, params = {}) {
  const template =
    messages[locale.value]?.[key] ?? messages.zh[key] ?? key
  return interpolate(template, params)
}

function applyDocumentLocale() {
  if (typeof document === 'undefined') return
  document.documentElement.lang = locale.value === 'zh' ? 'zh-CN' : 'en'
  document.title = t('meta.title')

  const description = document.querySelector('meta[name="description"]')
  if (description) {
    description.setAttribute('content', t('meta.description'))
  }
}

export function setLocale(nextLocale) {
  if (!SUPPORTED_LOCALES.includes(nextLocale)) return
  locale.value = nextLocale

  try {
    window.localStorage.setItem(STORAGE_KEY, nextLocale)
  } catch {
    // Keep the in-memory selection even when persistence is unavailable.
  }

  applyDocumentLocale()
}

applyDocumentLocale()
