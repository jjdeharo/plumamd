import { setupEditor, formatBold, formatItalic, formatCodeInline, insertCodeBlock, setHeading, toggleBulletList, toggleOrderedList, toggleTaskList, toggleQuote, insertLink, insertImage, insertHr, insertBlockMath, formatInlineMath, undo as editorUndo, redo as editorRedo, focusEditor, openSearchInEditor } from './editor'
import { setupPreview, renderMarkdown } from './preview'
import { applyInitialTheme, setupThemeToggle } from './theme'
import { exportAsHtml, printToPdf } from './export'
import { open, save, saveAs, setOnDropOpen, getCurrentContent, registerContentGetter, openFromPath } from './storage'
import 'katex/dist/katex.min.css'
import { isTauri } from './utils/env'
import { getVersion } from '@tauri-apps/api/app'
import { appWindow } from '@tauri-apps/api/window'
import { listen } from '@tauri-apps/api/event'
import { invoke } from '@tauri-apps/api/tauri'
import { open as openExternal } from '@tauri-apps/api/shell'

const filePathEl = document.getElementById('filePath') as HTMLSpanElement
const wordCountEl = document.getElementById('wordCount') as HTMLSpanElement
const READING_KEY = 'plumamd:reading'
const EDITING_KEY = 'plumamd:editing'

let currentContent = ''

function updatePreview(content: string) {
  currentContent = content
  renderMarkdown(content)
  const words = (content.match(/\b\w+\b/g) || []).length
  wordCountEl.textContent = `${words} palabra${words === 1 ? '' : 's'}`
}

async function main() {
  applyInitialTheme()
  setupThemeToggle()
  setupPreview()

  const editor = setupEditor(updatePreview)
  registerContentGetter(() => editor.get())

  // Intentar fijar icono de ventana desde el favicon (dev y build)
  if (isTauri()) {
    try {
      const resp = await fetch('favicon.svg')
      if (resp.ok) {
        const svg = await resp.text()
        const svgBlob = new Blob([svg], { type: 'image/svg+xml' })
        const url = URL.createObjectURL(svgBlob)
        await new Promise<void>((resolve, reject) => {
          const img = new Image()
          img.onload = () => {
            try {
              const size = 128
              const canvas = document.createElement('canvas')
              canvas.width = size
              canvas.height = size
              const ctx = canvas.getContext('2d')!
              ctx.clearRect(0, 0, size, size)
              // Dibujar SVG centrado y contenido
              ctx.drawImage(img, 0, 0, size, size)
              canvas.toBlob(async (blob) => {
                try {
                  if (!blob) return resolve()
                  const ab = await blob.arrayBuffer()
                  await appWindow.setIcon(new Uint8Array(ab))
                } catch {}
                resolve()
              }, 'image/png')
            } catch { resolve() }
          }
          img.onerror = () => resolve()
          img.src = url
        })
        URL.revokeObjectURL(url)
      }
    } catch {}
  }

  // Modos de diseño: lectura y edición (excluyentes)
  const layoutEl = document.querySelector('.layout') as HTMLElement
  const readingToggle = document.getElementById('readingToggle') as HTMLInputElement | null
  const editingToggle = document.getElementById('editingToggle') as HTMLInputElement | null
  const savedReading = localStorage.getItem(READING_KEY)
  const savedEditing = localStorage.getItem(EDITING_KEY)
  const readingOn = savedReading === '1'
  const editingOn = savedEditing === '1'

  // Si ambos quedaron guardados por alguna versión anterior, prioriza edición
  const initialMode = editingOn ? 'editing' : (readingOn ? 'reading' : 'split') as 'editing'|'reading'|'split'
  layoutEl.classList.toggle('reading-mode', initialMode === 'reading')
  layoutEl.classList.toggle('editing-mode', initialMode === 'editing')
  if (readingToggle) readingToggle.checked = initialMode === 'reading'
  if (editingToggle) editingToggle.checked = initialMode === 'editing'

  const applyModes = (reading: boolean, editing: boolean) => {
    // Exclusión mutua
    if (reading && editing) editing = false
    layoutEl.classList.toggle('reading-mode', reading)
    layoutEl.classList.toggle('editing-mode', editing)
    if (readingToggle) readingToggle.checked = reading
    if (editingToggle) editingToggle.checked = editing
    localStorage.setItem(READING_KEY, reading ? '1' : '0')
    localStorage.setItem(EDITING_KEY, editing ? '1' : '0')
  }

  readingToggle?.addEventListener('change', () => {
    const reading = !!readingToggle.checked
    const editing = false // apagar edición si se activa lectura
    applyModes(reading, editing)
  })

  editingToggle?.addEventListener('change', () => {
    const editing = !!editingToggle.checked
    const reading = false // apagar lectura si se activa edición
    applyModes(reading, editing)
  })

  document.getElementById('openBtn')?.addEventListener('click', async () => {
    const res = await open()
    if (res) {
      editor.set(res.content)
      filePathEl.textContent = res.path || 'Sin título'
    }
  })

  document.getElementById('saveBtn')?.addEventListener('click', async () => {
    const res = await save(getCurrentContent())
    if (res) filePathEl.textContent = res
  })

  document.getElementById('saveAsBtn')?.addEventListener('click', async () => {
    const res = await saveAs(getCurrentContent())
    if (res) filePathEl.textContent = res
  })

  document.getElementById('exportHtmlBtn')?.addEventListener('click', async () => {
    await exportAsHtml(getCurrentContent())
  })

  document.getElementById('printPdfBtn')?.addEventListener('click', () => {
    printToPdf(getCurrentContent())
  })

  // Exportaciones: HTML y PDF por impresión

  // Acerca de
  const aboutBtn = document.getElementById('aboutBtn')
  const aboutModal = document.getElementById('aboutModal')!
  const aboutClose = document.getElementById('aboutClose')
  const appVersionEl = document.getElementById('appVersion')!
  const openAbout = async () => {
    try {
      const v = isTauri() ? await getVersion() : (import.meta.env?.VITE_APP_VERSION ?? 'dev')
      appVersionEl.textContent = v
    } catch {
      appVersionEl.textContent = 'dev'
    }
    aboutModal.classList.add('open')
    aboutModal.setAttribute('aria-hidden', 'false')
  }
  const closeAbout = () => {
    aboutModal.classList.remove('open')
    aboutModal.setAttribute('aria-hidden', 'true')
  }
  aboutBtn?.addEventListener('click', openAbout)
  aboutClose?.addEventListener('click', closeAbout)
  aboutModal.querySelector('.backdrop')?.addEventListener('click', closeAbout)
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeAbout()
  })

  // Descargas (modal simple con enlaces e instrucciones)
  const downloadBtn = document.getElementById('downloadBtn')
  const downloadModal = document.getElementById('downloadModal') as HTMLElement | null
  const downloadClose = document.getElementById('downloadClose')
  const openDownloads = () => {
    if (!downloadModal) return
    downloadModal.classList.add('open')
    downloadModal.setAttribute('aria-hidden', 'false')
    // Actualizar enlaces para Linux con la última release de GitHub
    updateReleaseLinks()
  }
  const closeDownloads = () => {
    if (!downloadModal) return
    downloadModal.classList.remove('open')
    downloadModal.setAttribute('aria-hidden', 'true')
  }
  downloadBtn?.addEventListener('click', openDownloads)
  const downloadFromAboutBtn = document.getElementById('downloadFromAboutBtn')
  downloadFromAboutBtn?.addEventListener('click', openDownloads)
  downloadClose?.addEventListener('click', closeDownloads)
  downloadModal?.querySelector('.backdrop')?.addEventListener('click', closeDownloads)

  // Modal de descargas enfocado exclusivamente a Linux

  // Abrir enlaces externos en el navegador cuando corremos en Tauri
  if (isTauri()) {
    // Registrar listener para abrir archivos enviados desde el backend
    // lo antes posible para no perder eventos emitidos durante el "page load".
    try {
      listen<string>('open-file', async (event) => {
        const arg = String(event.payload || '')
        if (!arg) return
        try {
          const res = await openFromPath(arg)
          if (res) {
            editor.set(res.content)
            filePathEl.textContent = res.path || 'Sin título'
          }
        } catch {
          // Silenciar errores para no romper la app si llega algo inesperado
        }
      })
    } catch {}

    // Cargar archivo pasado por argumentos al iniciar (robusto frente a timing)
    try {
      const args = await invoke<string[]>('initial_args')
      if (Array.isArray(args)) {
        for (const arg of args) {
          if (!arg) continue
          try {
            const res = await openFromPath(String(arg))
            if (res) {
              editor.set(res.content)
              filePathEl.textContent = res.path || 'Sin título'
            }
          } catch {}
        }
      }
    } catch {}

    const externalLinks = Array.from(document.querySelectorAll('a[target="_blank"]')) as HTMLAnchorElement[]
    externalLinks.forEach((a) => {
      a.addEventListener('click', (ev) => {
        ev.preventDefault()
        if (a.href) openExternal(a.href)
      })
    })
  }

  // Selecciona el mejor asset para Linux
  function pickLinuxAsset(assets: any[]): string | null {
    const names = assets.map((a: any) => ({ name: String(a.name || ''), url: String(a.browser_download_url || '') }))
    const by = (pattern: RegExp) => names.find(n => pattern.test(n.name))?.url || null
    return by(/\.AppImage$/i) || by(/\.deb$/i) || by(/\.rpm$/i)
  }

  async function updateReleaseLinks() {
    const primary = document.getElementById('downloadPrimary') as HTMLAnchorElement | null
    const info = document.getElementById('releaseInfo') as HTMLParagraphElement | null
    const allLink = Array.from(document.querySelectorAll('a'))
      .find(a => a.textContent?.toLowerCase().includes('ver todas las descargas')) as HTMLAnchorElement | null
    const baseLatest = 'https://github.com/jjdeharo/plumamd/releases/latest'
    if (primary) primary.href = baseLatest
    if (allLink) allLink.href = baseLatest
    if (info) info.textContent = 'Buscando última versión…'

    type Rel = { draft: boolean; prerelease: boolean; html_url: string; tag_name: string; name?: string; assets: any[]; created_at: string }
    const fetchJson = async <T>(url: string): Promise<T | null> => {
      try {
        const r = await fetch(url, { headers: { 'Accept': 'application/vnd.github+json' } })
        if (!r.ok) return null
        return (await r.json()) as T
      } catch { return null }
    }

    // 1) Intenta última estable
    let rel: Rel | null = await fetchJson<Rel>('https://api.github.com/repos/jjdeharo/plumamd/releases/latest')
    let usedPrerelease = false

    // 2) Si no hay estable, toma la más reciente (incluidas prerelease)
    if (!rel) {
      const list = await fetchJson<Rel[]>('https://api.github.com/repos/jjdeharo/plumamd/releases?per_page=10')
      if (list && list.length) {
        // Prioriza estables; si no hay, coge la primera no draft
        const stable = list.filter(r => !r.draft && !r.prerelease)
          .sort((a,b) => +new Date(b.created_at) - +new Date(a.created_at))
        rel = (stable[0] ?? null)
        if (!rel) {
          const nonDraft = list.filter(r => !r.draft)
            .sort((a,b) => +new Date(b.created_at) - +new Date(a.created_at))
          rel = nonDraft[0] ?? null
          usedPrerelease = !!rel?.prerelease
        }
      }
    }

    if (!rel) {
      if (info) info.textContent = 'No se pudo obtener la última versión. Usa “Ver todas las descargas”.'
      return
    }

    const url = pickLinuxAsset(rel.assets || [])
    if (primary && url) primary.href = url
    if (allLink && rel.html_url) allLink.href = rel.html_url
    if (info) {
      const ver = rel.tag_name || rel.name || 'desconocida'
      info.textContent = usedPrerelease || rel.prerelease
        ? `Versión detectada: ${ver} (pre-release)`
        : `Versión estable: ${ver}`
    }
  }

  // Escucha el evento desde el menú nativo para abrir el About (solo en Tauri)
  if (isTauri()) {
    listen('open-about', () => openAbout())
  }

  // Atajos
  window.addEventListener('keydown', async (e) => {
    // Buscar: Ctrl/Cmd+F abre el buscador del editor
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'f') {
      e.preventDefault()
      openSearchInEditor()
      return
    }
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'o') {
      e.preventDefault()
      const res = await open()
      if (res) {
        editor.set(res.content)
        filePathEl.textContent = res.path || 'Sin título'
      }
    }
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 's') {
      e.preventDefault()
      const res = await save(getCurrentContent())
      if (res) filePathEl.textContent = res
    }
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 's') {
      e.preventDefault()
      const res = await saveAs(getCurrentContent())
      if (res) filePathEl.textContent = res
    }
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'e') {
      e.preventDefault()
      await exportAsHtml(getCurrentContent())
    }
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'p') {
      e.preventDefault()
      printToPdf(getCurrentContent())
    }
  })

  // Arrastrar y soltar
  setOnDropOpen(async (path, content) => {
    editor.set(content)
    filePathEl.textContent = path
  })

  // Toolbar de formato
  const bind = (id: string, fn: () => void) => document.getElementById(id)?.addEventListener('click', () => { fn(); focusEditor() })
  bind('undoBtn', () => editorUndo())
  bind('redoBtn', () => editorRedo())
  bind('boldBtn', () => formatBold())
  bind('italicBtn', () => formatItalic())
  bind('codeInlineBtn', () => formatCodeInline())
  bind('codeBlockBtn', () => insertCodeBlock())
  bind('h1Btn', () => setHeading(1))
  bind('h2Btn', () => setHeading(2))
  bind('h3Btn', () => setHeading(3))
  bind('ulBtn', () => toggleBulletList())
  bind('olBtn', () => toggleOrderedList())
  bind('taskBtn', () => toggleTaskList())
  bind('quoteBtn', () => toggleQuote())
  bind('linkBtn', () => insertLink())
  bind('imageBtn', () => insertImage())
  bind('hrBtn', () => insertHr())
  bind('mathInlineBtn', () => formatInlineMath())
  bind('mathBlockBtn', () => insertBlockMath())
  const searchBtn = document.getElementById('searchBtn')
  searchBtn?.addEventListener('click', () => { openSearchInEditor(); focusEditor() })

}

main()
