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

    'app.stepImport': '导入截图',
    'app.fileInputAria': '选择截图文件',
    'app.removeAria': '移除当前截图',
    'app.dropTitle': '选择或拖入截图',
    'app.dropChecking': '正在检查截图',
    'app.dropMeta': 'JPEG / PNG · 最大 5 MB',
    'app.browse': '浏览',
    'app.checking': '检查中',
    'app.replace': '更换图片',
    'app.scanTransparent': '有透明像素',
    'app.scanOpaque': '无透明像素',
    'app.transparencyNotice':
      '检测到透明区域，导出时将自动填充为白色背景。',
    'app.fileSummary': '{width} × {height} px · {size}',
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

    'stage.eyebrow': '预览画布',
    'stage.title': '裁剪画布',
    'stage.hint': '拖动裁剪 · 滚轮缩放',
    'stage.reset': '重置裁剪区域',
    'stage.readyTitle': '画布已准备就绪',
    'stage.readyCopy': '导入截图后，在这里调整构图',
    'stage.loading': '正在准备 16:10 画布',
    'stage.retry': '重新加载画布',
    'stage.initFailed': '无法初始化裁剪画布，请重新选择截图。',
    'stage.alt': '待裁剪的截图',
    'stage.dropOverlay': '松手导入截图',
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

    'app.stepImport': 'Import screenshot',
    'app.fileInputAria': 'Choose a screenshot file',
    'app.removeAria': 'Remove current screenshot',
    'app.dropTitle': 'Choose or drop a screenshot',
    'app.dropChecking': 'Checking screenshot',
    'app.dropMeta': 'JPEG / PNG · Up to 5 MB',
    'app.browse': 'Browse',
    'app.checking': 'Checking',
    'app.replace': 'Replace image',
    'app.scanTransparent': 'Transparency found',
    'app.scanOpaque': 'No transparency',
    'app.transparencyNotice':
      'Transparency detected. It will be flattened to white on export.',
    'app.fileSummary': '{width} × {height} px · {size}',
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

    'stage.eyebrow': 'Preview canvas',
    'stage.title': 'Crop canvas',
    'stage.hint': 'Drag to crop · Scroll to zoom',
    'stage.reset': 'Reset crop area',
    'stage.readyTitle': 'Canvas ready',
    'stage.readyCopy': 'Import a screenshot, then compose the crop here',
    'stage.loading': 'Preparing 16:10 canvas',
    'stage.retry': 'Reload canvas',
    'stage.initFailed':
      'Could not initialise the crop canvas. Try importing the image again.',
    'stage.alt': 'Screenshot to crop',
    'stage.dropOverlay': 'Drop to import',
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
