import { save } from './storage'
import { renderToHtml } from './preview'
// CSS y fuentes de KaTeX para exportación offline 100% self-contained
import katexCssRaw from 'katex/dist/katex.min.css?raw'

async function embedKatexFonts(css: string): Promise<string> {
  // Cargamos las fuentes de KaTeX directamente desde node_modules (ruta relativa desde src)
  const fontUrlMap = import.meta.glob('../node_modules/katex/dist/fonts/*.woff2', { query: '?url', import: 'default', eager: true }) as Record<string, string>
  const entries: Array<[string, string]> = []
  for (const [path, url] of Object.entries(fontUrlMap)) {
    try {
      const resp = await fetch(url)
      const buf = await resp.arrayBuffer()
      const b64 = btoa(String.fromCharCode(...new Uint8Array(buf)))
      const dataUrl = `data:font/woff2;base64,${b64}`
      const base = path.split('/').pop() as string
      entries.push([base, dataUrl])
    } catch (e) {
      console.warn('No se pudo incrustar fuente KaTeX:', path, e)
    }
  }
  let out = css
  for (const [base, dataUrl] of entries) {
    const re = new RegExp(`url\\((?:\\"|\\')?[^)]*${base}(?:\\"|\\')?\\)`, 'g')
    out = out.replace(re, `url(${dataUrl})`)
  }
  return out
}

export async function exportAsHtml(content: string) {
  // Renderizamos en la app para no depender de librerías externas en el HTML resultante
  const bodyHtml = renderToHtml(content)
  const katexCss = await embedKatexFonts(katexCssRaw)
  const html = `<!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Documento</title>
    <style>
      ${katexCss}
      body { font-family: system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, 'Fira Sans', 'Droid Sans', 'Helvetica Neue', Arial, 'Noto Sans', sans-serif; max-width: 900px; margin: 2rem auto; padding: 0 1rem; }
      pre { background: #0000001a; padding: .5rem; overflow: auto; }
      code { background: #0000001a; padding: .15rem .25rem; border-radius: 4px; }
      table { border-collapse: collapse; }
      table, th, td { border: 1px solid #ccc; }
      th, td { padding: .25rem .5rem; }
      @media print { body { margin: 0; } }
    </style>
  </head>
  <body>
    <main id="content">${bodyHtml}</main>
  </body>
  </html>`
  const dataUrl = 'data:text/html;charset=utf-8,' + encodeURIComponent(html)
  await save(undefined, dataUrl, true)
}

export function printToPdf() {
  window.print()
}
