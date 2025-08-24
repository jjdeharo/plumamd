import { setupEditor, formatBold, formatItalic, formatCodeInline, insertCodeBlock, setHeading, toggleBulletList, toggleOrderedList, toggleTaskList, toggleQuote, insertLink, insertImage, insertHr, insertBlockMath, formatInlineMath, undo as editorUndo, redo as editorRedo, focusEditor } from './editor'
import { setupPreview, renderMarkdown } from './preview'
import { applyInitialTheme, setupThemeToggle } from './theme'
import { exportAsHtml, printToPdf } from './export'
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
    const allLink = Array.from(document.querySelectorAll('a'))
      .find(a => a.textContent?.toLowerCase().includes('ver todas las descargas')) as HTMLAnchorElement | null
    const baseLatest = 'https://github.com/jjdeharo/plumamd/releases/latest'
    if (primary) primary.href = baseLatest
    if (allLink) allLink.href = baseLatest
    try {
      const res = await fetch('https://api.github.com/repos/jjdeharo/plumamd/releases/latest', { headers: { 'Accept': 'application/vnd.github+json' } })
      if (!res.ok) return
      const data = await res.json()
      const osName = (document.getElementById('osDetected')?.textContent || 'tu sistema')
      const url = pickAssetForOS(osName, data.assets || [])
      if (primary && url) primary.href = url
      if (allLink && data.html_url) allLink.href = data.html_url
    } catch {
      // Silencioso: dejamos enlaces a /latest
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
