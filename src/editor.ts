import { EditorView, keymap, ViewUpdate } from '@codemirror/view'
import { EditorState } from '@codemirror/state'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { markdown } from '@codemirror/lang-markdown'
import { basicSetup } from 'codemirror'

let view: EditorView | null = null

export function setupEditor(onChange: (content: string) => void) {
  const parent = document.getElementById('editor')!
  const startDoc = '# Nuevo documento\n\nEscribe Markdown aquí.'

  const state = EditorState.create({
    doc: startDoc,
    extensions: [
      basicSetup,
      history(),
      markdown(),
      keymap.of([...defaultKeymap, ...historyKeymap]),
      EditorView.updateListener.of((v: ViewUpdate) => {
        if (v.docChanged) onChange(v.state.doc.toString())
      }),
      EditorView.theme({
        '&': { height: '100%' },
        '.cm-content': { fontFamily: 'ui-monospace, monospace', fontSize: '14px' }
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
    }
  }
}

export function getEditorContent() {
  return view?.state.doc.toString() ?? ''
}
