// Solo para Playwright: se sirve en dev (/e2e/index.html) y no entra al build de producción.
import { createImageVariants, type ImageKind } from '../src/lib/imageVariants'

async function makeNoisyJpeg(width: number, height: number): Promise<Blob> {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')!
  const img = ctx.createImageData(width, height)
  for (let i = 0; i < img.data.length; i += 4) {
    img.data[i] = Math.random() * 256
    img.data[i + 1] = Math.random() * 256
    img.data[i + 2] = Math.random() * 256
    img.data[i + 3] = 255
  }
  ctx.putImageData(img, 0, 0)
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob null'))), 'image/jpeg', 0.9),
  )
}

// Simula un navegador sin codificador WebP (Safari histórico): pedir WebP devuelve PNG.
function disableWebpEncoding() {
  const offscreen = OffscreenCanvas.prototype.convertToBlob
  OffscreenCanvas.prototype.convertToBlob = function (options) {
    return offscreen.call(this, options?.type === 'image/webp' ? { ...options, type: 'image/png' } : options)
  }
  const dom = HTMLCanvasElement.prototype.toBlob
  HTMLCanvasElement.prototype.toBlob = function (cb, type, quality) {
    dom.call(this, cb, type === 'image/webp' ? 'image/png' : type, quality)
  }
}

async function errorCode(source: Blob): Promise<string> {
  try {
    await createImageVariants(source, 'product')
    return 'NO_ERROR'
  } catch (e) {
    return (e as { code?: string }).code ?? 'UNKNOWN'
  }
}

;(window as unknown as { runErrors: () => Promise<unknown> }).runErrors = async () => ({
  notAnImage: await errorCode(new Blob(['no soy una imagen'], { type: 'image/png' })),
  tooLarge: await errorCode(new Blob([new Uint8Array(10 * 1024 * 1024 + 1)], { type: 'image/jpeg' })),
})

;(window as unknown as { run: (kind: ImageKind, noWebp?: boolean) => Promise<unknown> }).run = async (kind, noWebp) => {
  if (noWebp) disableWebpEncoding()
  const source = await makeNoisyJpeg(3000, 2000)
  const variants = await createImageVariants(source, kind)
  return Promise.all(
    variants.map(async (v) => {
      const bmp = await createImageBitmap(v.blob)
      const out = { label: v.width, w: bmp.width, h: bmp.height, size: v.blob.size, type: v.blob.type, format: v.format }
      bmp.close()
      return out
    }),
  )
}
