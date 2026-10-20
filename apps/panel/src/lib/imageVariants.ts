// Pipeline de variantes de imagen en el navegador (ADR-06, TRD §8.1).

export const IMAGE_KINDS = {
  logo: { widths: [128, 256], ratio: 1, quality: 0.85 },
  cover: { widths: [540, 1080], ratio: 16 / 9, quality: 0.8 },
  card: { widths: [540, 1080], ratio: 1.586, quality: 0.8 },
  product: { widths: [360, 720], ratio: 1, quality: 0.8 },
  offer: { widths: [540, 1080], ratio: 16 / 9, quality: 0.8 },
} as const

export type ImageKind = keyof typeof IMAGE_KINDS

export const MAX_SOURCE_BYTES = 10 * 1024 * 1024
export const MAX_VARIANT_BYTES = 300 * 1024
const MIN_QUALITY = 0.5
const QUALITY_STEP = 0.1

export type ImageVariant = { width: number; blob: Blob; format: 'webp' | 'jpeg' }

export type ImageErrorCode = 'SOURCE_TOO_LARGE' | 'NOT_AN_IMAGE' | 'VARIANT_TOO_LARGE' | 'ENCODE_FAILED'

// Mapea a E-22 (docs/ekko_appflow.md §7); la UI decide el mensaje según `code`.
export class ImageProcessingError extends Error {
  readonly code: ImageErrorCode
  constructor(code: ImageErrorCode, message: string) {
    super(message)
    this.name = 'ImageProcessingError'
    this.code = code
  }
}

type Canvas = OffscreenCanvas | HTMLCanvasElement

function createCanvas(width: number, height: number): Canvas {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(width, height)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  return canvas
}

function canvasToBlob(canvas: Canvas, type: string, quality: number): Promise<Blob | null> {
  if ('convertToBlob' in canvas) return canvas.convertToBlob({ type, quality }).catch(() => null)
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality))
}

// WHY: Safari históricamente no soporta WebP en toBlob y devuelve PNG en silencio,
// así que se verifica el blob.type devuelto en vez de confiar en lo solicitado.
async function encode(canvas: Canvas, quality: number): Promise<{ blob: Blob; format: ImageVariant['format'] }> {
  const webp = await canvasToBlob(canvas, 'image/webp', quality)
  if (webp?.type === 'image/webp') return { blob: webp, format: 'webp' }
  const jpeg = await canvasToBlob(canvas, 'image/jpeg', quality)
  if (jpeg?.type === 'image/jpeg') return { blob: jpeg, format: 'jpeg' }
  throw new ImageProcessingError('ENCODE_FAILED', 'El navegador no pudo codificar la imagen')
}

async function encodeUnderLimit(canvas: Canvas, startQuality: number): Promise<{ blob: Blob; format: ImageVariant['format'] }> {
  for (let q = startQuality; q >= MIN_QUALITY - 1e-9; q -= QUALITY_STEP) {
    const result = await encode(canvas, Math.round(q * 100) / 100)
    if (result.blob.size <= MAX_VARIANT_BYTES) return result
  }
  throw new ImageProcessingError('VARIANT_TOO_LARGE', 'La imagen excede el tamaño máximo tras comprimir')
}

async function decode(file: Blob): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file)
  } catch {
    throw new ImageProcessingError('NOT_AN_IMAGE', 'El archivo no es una imagen válida')
  }
}

export async function createImageVariants(file: Blob, kind: ImageKind): Promise<ImageVariant[]> {
  if (file.size > MAX_SOURCE_BYTES) {
    throw new ImageProcessingError('SOURCE_TOO_LARGE', 'La imagen supera 10 MB')
  }
  const { widths, ratio, quality } = IMAGE_KINDS[kind]
  const bitmap = await decode(file)
  try {
    // Recorte centrado a la proporción del tipo.
    const cropWidth = Math.min(bitmap.width, Math.round(bitmap.height * ratio))
    const cropHeight = Math.round(cropWidth / ratio)
    const sx = Math.round((bitmap.width - cropWidth) / 2)
    const sy = Math.round((bitmap.height - cropHeight) / 2)

    const variants: ImageVariant[] = []
    for (const width of widths) {
      // NOTE: nunca se hace upscale; si el origen es menor, se emite a min(width, origen)
      // y se conserva `width` como etiqueta de la variante (el consumidor elige por etiqueta).
      const outWidth = Math.min(width, cropWidth)
      const outHeight = Math.round(outWidth / ratio)
      const canvas = createCanvas(outWidth, outHeight)
      const ctx = canvas.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null
      if (!ctx) throw new ImageProcessingError('ENCODE_FAILED', 'Canvas 2D no disponible')
      ctx.drawImage(bitmap, sx, sy, cropWidth, cropHeight, 0, 0, outWidth, outHeight)
      variants.push({ width, ...(await encodeUnderLimit(canvas, quality)) })
    }
    return variants
  } finally {
    bitmap.close()
  }
}
