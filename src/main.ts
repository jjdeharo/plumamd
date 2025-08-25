import { setupEditor, formatBold, formatItalic, formatCodeInline, insertCodeBlock, setHeading, toggleBulletList, toggleOrderedList, toggleTaskList, toggleQuote, insertLink, insertImage, insertHr, insertBlockMath, formatInlineMath, undo as editorUndo, redo as editorRedo, focusEditor } from './editor'
import { setupPreview, renderMarkdown } from './preview'
import { applyInitialTheme, setupThemeToggle } from './theme'
import { exportAsHtml, printToPdf } from './export'
import { detectPandoc, exportWithPandoc } from './pandoc'
import { open, save, saveAs, setOnDropOpen, getCurrentContent, registerContentGetter } from './storage'
import 'katex/dist/katex.min.css'
import { isTauri } from './utils/env'
import { getVersion } from '@tauri-apps/api/app'
import { listen } from '@tauri-apps/api/event'
import { open as openExternal } from '@tauri-apps/api/shell'

const filePathEl = document.getElementById('filePath') as HTMLSpanElement
const wordCountEl = document.getElementById('wordCount') as HTMLSpanElement
const READING_KEY = 'plumamd:reading'

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

  // Modo lectura (ocultar editor y que la vista previa ocupe todo)
  const layoutEl = document.querySelector('.layout') as HTMLElement
  const readingToggle = document.getElementById('readingToggle') as HTMLInputElement | null
  const savedReading = localStorage.getItem(READING_KEY)
  const readingOn = savedReading === '1'
  if (readingToggle) {
    readingToggle.checked = readingOn
    layoutEl.classList.toggle('reading-mode', readingOn)
    readingToggle.addEventListener('change', () => {
      const on = readingToggle.checked
      layoutEl.classList.toggle('reading-mode', on)
      localStorage.setItem(READING_KEY, on ? '1' : '0')
    })
  }

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

  // Pandoc: detección y handlers
  const pandocCmd = await detectPandoc()
  const btnDocx = document.getElementById('exportDocxBtn')
  const btnOdt = document.getElementById('exportOdtBtn')
  const btnEpub = document.getElementById('exportEpubBtn')
  const btnPdfPandoc = document.getElementById('exportPdfPandocBtn')
  const showPandoc = !!pandocCmd
  ;[btnDocx, btnOdt, btnEpub, btnPdfPandoc].forEach(b => { if (b) b.classList.toggle('hidden', !showPandoc) })
  if (pandocCmd) {
    btnDocx?.addEventListener('click', async () => { await exportWithPandoc(getCurrentContent(), 'docx', pandocCmd) })
    btnOdt?.addEventListener('click', async () => { await exportWithPandoc(getCurrentContent(), 'odt', pandocCmd) })
    btnEpub?.addEventListener('click', async () => { await exportWithPandoc(getCurrentContent(), 'epub', pandocCmd) })
    btnPdfPandoc?.addEventListener('click', async () => { await exportWithPandoc(getCurrentContent(), 'pdf', pandocCmd) })
  }

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
    // Actualizar enlaces según SO y última release de GitHub
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

  // Detección simple de sistema para el modal de descargas
  const osDetectedEl = document.getElementById('osDetected')
  const osLabelEl = document.getElementById('osLabel')
  const detectOS = () => {
    const ua = navigator.userAgent || ''
    if (/Windows/i.test(ua)) return 'Windows'
    if (/Macintosh|Mac OS X/i.test(ua)) return 'macOS'
    if (/Linux|X11/i.test(ua)) return 'Linux'
    return 'tu sistema'
  }
  const osName = detectOS()
  if (osDetectedEl) osDetectedEl.textContent = osName
  if (osLabelEl) osLabelEl.textContent = osName

  // Abrir enlaces externos en el navegador cuando corremos en Tauri
  if (isTauri()) {
    const externalLinks = Array.from(document.querySelectorAll('a[target="_blank"]')) as HTMLAnchorElement[]
    externalLinks.forEach((a) => {
      a.addEventListener('click', (ev) => {
        ev.preventDefault()
        if (a.href) openExternal(a.href)
      })
    })
  }

  // Resuelve el mejor asset para el SO detectado
  function pickAssetForOS(os: string, assets: any[]): string | null {
    const names = assets.map((a: any) => ({ name: String(a.name || ''), url: String(a.browser_download_url || '') }))
    const by = (pattern: RegExp) => names.find(n => pattern.test(n.name))?.url || null
    if (os === 'Windows') {
      return by(/\.msi$/i) || by(/\.exe$/i)
    }
    if (os === 'macOS') {
      // Prefer universal/arm dmg
      return by(/universal.*\.dmg$/i) || by(/arm64.*\.dmg$/i) || by(/x64.*\.dmg$/i) || by(/\.dmg$/i)
    }
    if (os === 'Linux') {
      return by(/\.AppImage$/i) || by(/\.deb$/i) || by(/\.rpm$/i)
    }
    return null
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

    const osName = (document.getElementById('osDetected')?.textContent || 'tu sistema')

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

    const url = pickAssetForOS(osName, rel.assets || [])
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
    // Atajo alternativo para PDF con Pandoc: Ctrl+Shift+P
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'p') {
      e.preventDefault()
      const pc = await detectPandoc()
      if (pc) await exportWithPandoc(getCurrentContent(), 'pdf', pc)
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

}

main()
