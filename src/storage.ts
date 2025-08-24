import { open as openDialog, save as saveDialog } from '@tauri-apps/api/dialog'
import { readTextFile, writeTextFile } from '@tauri-apps/api/fs'
import { isTauri } from './utils/env'

let currentPath: string | null = null
let getContent: (() => string) | null = null

export function getCurrentContent() {
  return getContent ? getContent() : ''
}

export async function open() {
  if (isTauri()) {
    const selected = await openDialog({ filters: [{ name: 'Markdown', extensions: ['md', 'markdown', 'txt'] }] })
    if (!selected || Array.isArray(selected)) return null
    const content = await readTextFile(selected as string)
    currentPath = selected as string
    return { path: currentPath, content }
  } else {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.md,.markdown,.txt'
    return new Promise((resolve) => {
      input.onchange = () => {
        const file = input.files?.[0]
        if (!file) return resolve(null)
        const reader = new FileReader()
        reader.onload = () => {
          currentPath = file.name
          resolve({ path: currentPath, content: String(reader.result || '') })
        }
        reader.readAsText(file)
      }
      input.click()
    })
  }
}

export async function save(content?: string, dataUrl?: string, htmlExport = false) {
  if (isTauri()) {
    if (htmlExport) {
      const file = await saveDialog({ defaultPath: 'documento.html', filters: [{ name: 'HTML', extensions: ['html'] }] })
      if (!file) return null
      const payload = decodeURIComponent((dataUrl || '').split(',')[1] || '')
      await writeTextFile(file as string, payload)
      return file as string
    }
    if (!currentPath) {
      return saveAs(content ?? getCurrentContent())
    }
    await writeTextFile(currentPath, content ?? getCurrentContent())
    return currentPath
  } else {
    // Web: forzar descarga (save y saveAs se comportan igual)
    const filename = htmlExport ? 'documento.html' : (currentPath || 'documento.md')
    const text = htmlExport
      ? decodeURIComponent((dataUrl || '').split(',')[1] || '')
      : (content ?? getCurrentContent())
    const blob = new Blob([text], { type: htmlExport ? 'text/html;charset=utf-8' : 'text/markdown;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(a.href)
    return filename
  }
}

export async function saveAs(content?: string) {
  if (isTauri()) {
    const file = await saveDialog({ defaultPath: 'documento.md', filters: [{ name: 'Markdown', extensions: ['md'] }] })
    if (!file) return null
    await writeTextFile(file as string, content ?? getCurrentContent())
    currentPath = file as string
    return currentPath
  } else {
    // Web: descargar como nuevo archivo
    const filename = 'documento.md'
    const text = content ?? getCurrentContent()
    const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(a.href)
    currentPath = filename
    return currentPath
  }
}

export function setOnDropOpen(handler: (path: string, content: string) => void) {
  window.addEventListener('dragover', (e) => { e.preventDefault() })
  window.addEventListener('drop', async (e) => {
    e.preventDefault()
    const file = e.dataTransfer?.files?.[0]
    if (!file) return
    // @ts-ignore: Ruta completa en Tauri
    const path = (file as any).path as string | undefined
    if (isTauri() && path) {
      const content = await readTextFile(path)
      handler(path, content)
    } else {
      const reader = new FileReader()
      reader.onload = () => handler(file.name, String(reader.result || ''))
      reader.readAsText(file)
    }
  })
}

export function registerContentGetter(fn: () => string) {
  getContent = fn
}
