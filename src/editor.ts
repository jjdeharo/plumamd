import { EditorView, keymap, ViewUpdate } from '@codemirror/view'
import { EditorSelection, EditorState } from '@codemirror/state'
import { defaultKeymap, history, historyKeymap, undo as cmUndo, redo as cmRedo } from '@codemirror/commands'
import { isTauri } from './utils/env'
import { open as openDialog } from '@tauri-apps/api/dialog'
import { readBinaryFile } from '@tauri-apps/api/fs'
import { markdown } from '@codemirror/lang-markdown'
import { basicSetup } from 'codemirror'
import { searchKeymap, openSearchPanel, highlightSelectionMatches } from '@codemirror/search'

let view: EditorView | null = null

export function setupEditor(onChange: (content: string) => void) {
  const parent = document.getElementById('editor')!
  const startDoc = '# Nuevo documento\n\nEscribe Markdown aquí.'

  const customBindings = [
    { key: 'Mod-b', preventDefault: true, run: () => { formatBold(); return true } },
    { key: 'Mod-i', preventDefault: true, run: () => { formatItalic(); return true } },
    { key: 'Mod-`', preventDefault: true, run: () => { formatCodeInline(); return true } },
    { key: 'Mod-Shift-c', preventDefault: true, run: () => { insertCodeBlock(); return true } },
    { key: 'Mod-k', preventDefault: true, run: () => { insertLink(); return true } },
    // Asegura que Ctrl/Cmd+F abre el panel de búsqueda dentro del editor
    { key: 'Mod-f', preventDefault: true, run: () => { if (view) return openSearchPanel(view); return false } },
    { key: 'Mod-Alt-1', preventDefault: true, run: () => { setHeading(1); return true } },
    { key: 'Mod-Alt-2', preventDefault: true, run: () => { setHeading(2); return true } },
    { key: 'Mod-Alt-3', preventDefault: true, run: () => { setHeading(3); return true } },
    { key: 'Mod-Shift-8', preventDefault: true, run: () => { toggleBulletList(); return true } },
    { key: 'Mod-Shift-7', preventDefault: true, run: () => { toggleOrderedList(); return true } },
    { key: 'Mod-Shift-9', preventDefault: true, run: () => { toggleTaskList(); return true } },
    { key: 'Mod-Shift-q', preventDefault: true, run: () => { toggleQuote(); return true } },
    { key: 'Mod-Alt-m', preventDefault: true, run: () => { formatInlineMath(); return true } },
    { key: 'Mod-Alt-Shift-m', preventDefault: true, run: () => { insertBlockMath(); return true } },
  ] as any

  const state = EditorState.create({
    doc: startDoc,
    extensions: [
      basicSetup,
      // Habilita el ajuste de línea para evitar desbordes horizontales
      EditorView.lineWrapping,
      history(),
      markdown(),
      // Resaltado de coincidencias y keymap de búsqueda
      highlightSelectionMatches(),
      keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap, ...customBindings]),
      EditorView.updateListener.of((v: ViewUpdate) => {
        if (v.docChanged) onChange(v.state.doc.toString())
      }),
      EditorView.theme({
        '&': { height: '100%' },
        '.cm-scroller': { overflowX: 'hidden' },
        '.cm-content': {
          fontFamily: 'ui-monospace, monospace',
          fontSize: '14px',
          whiteSpace: 'pre-wrap',
          overflowWrap: 'break-word',
          wordBreak: 'break-word'
        }
      })
    ]
  })

  view = new EditorView({ state, parent })

  // Inicializar vista previa
  onChange(startDoc)

  return {
    set(content: string) {
      if (!view) return
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: content }
      })
    },
    get() {
      return view?.state.doc.toString() ?? ''
    },
    openSearch() {
      if (view) openSearchPanel(view)
    }
  }
}

export function getEditorContent() {
  return view?.state.doc.toString() ?? ''
}

function replaceSelection(replacer: (text: string) => { text: string; selectionFrom?: number; selectionTo?: number }) {
  if (!view) return
  const state = view.state
  const tr = state.changeByRange(range => {
    const selected = state.doc.sliceString(range.from, range.to)
    const { text, selectionFrom, selectionTo } = replacer(selected)
    const changes = { from: range.from, to: range.to, insert: text }
    const newTo = range.from + text.length
    const selFrom = selectionFrom !== undefined ? range.from + selectionFrom : newTo
    const selTo = selectionTo !== undefined ? range.from + selectionTo : selFrom
    return { changes, range: EditorSelection.range(selFrom, selTo) }
  })
  view.dispatch(tr)
  view.focus()
}

function toggleInline(wrapperLeft: string, wrapperRight = wrapperLeft) {
  replaceSelection(selected => {
    const s = selected
    if (s.startsWith(wrapperLeft) && s.endsWith(wrapperRight) && s.length >= wrapperLeft.length + wrapperRight.length) {
      const inner = s.slice(wrapperLeft.length, s.length - wrapperRight.length)
      return { text: inner, selectionFrom: 0, selectionTo: inner.length }
    }
    const out = wrapperLeft + (s || '') + wrapperRight
    const start = wrapperLeft.length
    return { text: out, selectionFrom: start, selectionTo: start + (s || '').length }
  })
}

function togglePrefixLine(prefix: string) {
  if (!view) return
  const state = view.state
  const fromLine = state.doc.lineAt(state.selection.main.from).number
  const toLine = state.doc.lineAt(state.selection.main.to).number
  const ranges: { from: number; to: number; insert: string }[] = []
  let allHave = true
  for (let ln = fromLine; ln <= toLine; ln++) {
    const line = state.doc.line(ln)
    if (!line.text.startsWith(prefix)) allHave = false
  }
  for (let ln = fromLine; ln <= toLine; ln++) {
    const line = state.doc.line(ln)
    if (allHave) {
      if (line.text.startsWith(prefix)) {
        ranges.push({ from: line.from, to: line.from + prefix.length, insert: '' })
      }
    } else {
      ranges.push({ from: line.from, to: line.from, insert: prefix })
    }
  }
  view.dispatch({ changes: ranges })
  view.focus()
}

export function formatBold() { toggleInline('**') }
export function formatItalic() { toggleInline('*') }
export function formatCodeInline() { toggleInline('`') }
export function formatInlineMath() { toggleInline('\\(' , '\\)') }

export function insertCodeBlock() {
  replaceSelection(selected => {
    const text = selected || 'codigo'
    const out = '```\n' + text + '\n```\n'
    return { text: out, selectionFrom: 4, selectionTo: 4 + text.length }
  })
}

export function setHeading(level: 1 | 2 | 3 | 4 | 5 | 6) {
  if (!view) return
  const prefix = '#'.repeat(level) + ' '
  // Si ya tiene otro heading, lo sustituimos
  const state = view.state
  const line = state.doc.lineAt(state.selection.main.from)
  const headingMatch = line.text.match(/^(#{1,6}\s+)/)
  const from = line.from
  const to = headingMatch ? from + headingMatch[0].length : from
  view.dispatch({ changes: { from, to, insert: prefix } })
  view.focus()
}

export function toggleBulletList() { togglePrefixLine('- ') }
export function toggleOrderedList() { togglePrefixLine('1. ') }
export function toggleTaskList() { togglePrefixLine('- [ ] ') }
export function toggleQuote() { togglePrefixLine('> ') }

export function insertLink() {
  if (!view) return
  const url = window.prompt('URL del enlace:') || ''
  if (!url) return
  replaceSelection(selected => {
    const text = selected || 'enlace'
    const out = `[${text}](${url})`
    return { text: out, selectionFrom: 1, selectionTo: 1 + text.length }
  })
}

export function insertImage() {
  if (!view) return
  const doInsert = (src: string, alt = '') => {
    const out = `![${alt}](${src})`
    replaceSelection(() => ({ text: out }))
  }
  const fallback = () => {
    const url = window.prompt('URL o data: de la imagen:') || ''
    if (!url) return
    const alt = window.prompt('Texto alternativo (alt):') || ''
    doInsert(url, alt)
  }
  if (!isTauri()) return fallback()
  ;(async () => {
    try {
      const selected = await openDialog({ multiple: false, filters: [ { name: 'Imágenes', extensions: ['png','jpg','jpeg','gif','webp','svg'] } ] }) as string | null
      if (!selected) return
      const ext = (selected.split('.').pop() || '').toLowerCase()
      const mime = ext === 'svg' ? 'image/svg+xml' : ext === 'jpg' ? 'image/jpeg' : `image/${ext}`
      const data = await readBinaryFile(selected)
      const b64 = btoa(String.fromCharCode(...new Uint8Array(data)))
      const dataUrl = `data:${mime};base64,${b64}`
      const alt = window.prompt('Texto alternativo (alt):') || ''
      doInsert(dataUrl, alt)
    } catch (e) {
      console.warn('Fallo al insertar imagen local, usando fallback URL', e)
      fallback()
    }
  })()
}

export function insertHr() {
  if (!view) return
  replaceSelection(() => ({ text: `\n\n---\n\n` }))
}

export function insertBlockMath() {
  replaceSelection(selected => {
    const text = selected || 'E = mc^2'
    const out = `$$\n${text}\n$$\n`
    return { text: out, selectionFrom: 3, selectionTo: 3 + text.length }
  })
}

export function undo() { if (view) cmUndo(view) }
export function redo() { if (view) cmRedo(view) }
export function focusEditor() { view?.focus() }

export function openSearchInEditor() {
  if (view) {
    openSearchPanel(view)
    view.focus()
  }
}
