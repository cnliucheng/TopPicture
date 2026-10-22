export const MAX_FILE_BYTES = 5 * 1024 * 1024
export const MIN_SOURCE_WIDTH = 1280
export const MIN_SOURCE_HEIGHT = 800
export const CROP_RATIO = 16 / 10

export const TARGETS = [
  { width: 1280, height: 800, label: '1280 × 800' },
  { width: 1440, height: 900, label: '1440 × 900' },
  { width: 2560, height: 1600, label: '2560 × 1600' },
  { width: 2880, height: 1800, label: '2880 × 1800' },
]

export const DEFAULT_TARGET_INDEX = 1

export const ALLOWED_MIME_TYPES = new Map([
  ['image/jpeg', 'JPEG'],
  ['image/png', 'PNG'],
])
