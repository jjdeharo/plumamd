import { setupEditor } from './editor'
import { setupPreview, renderMarkdown } from './preview'
import { applyInitialTheme, setupThemeToggle } from './theme'
import { exportAsHtml, printToPdf } from './export'
import { open, save, saveAs, setOnDropOpen, getCurrentContent, registerContentGetter } from './storage'
import 'katex/dist/katex.min.css'
import { isTauri } from './utils/env'
import { getVersion } from '@tauri-apps/api/app'
import { listen } from '@tauri-apps/api/event'

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
    printToPdf()
  })

  // Acerca de
  const aboutBtn = document.getElementById('aboutBtn')
  const aboutModal = document.getElementById('aboutModal')!
  const aboutClose = document.getElementById('aboutClose')
  const appVersionEl = document.getElementById('appVersion')!
  const openAbout = async () => {
    try {
      const v = isTauri ? await getVersion() : (import.meta.env?.VITE_APP_VERSION ?? 'dev')
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

  // Escucha el evento desde el menú nativo para abrir el About
  listen('open-about', () => openAbout())

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
      printToPdf()
    }
  })

  // Arrastrar y soltar
  setOnDropOpen(async (path, content) => {
    editor.set(content)
    filePathEl.textContent = path
  })

}

main()
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
