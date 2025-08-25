import { isTauri } from './utils/env'
import { Command } from '@tauri-apps/api/shell'
import { save as saveDialog } from '@tauri-apps/api/dialog'
import { writeTextFile } from '@tauri-apps/api/fs'
import { tempDir, sep } from '@tauri-apps/api/path'

export type PandocFormat = 'docx' | 'odt' | 'epub' | 'pdf'

async function tryCommand(name: string): Promise<boolean> {
  try {
    const cmd = new Command(name, ['--version'])
    const res = await cmd.execute()
    return res.code === 0
  } catch {
    return false
  }
}

export async function detectPandoc(): Promise<string | null> {
  if (!isTauri()) return null
  // Probar rutas/nombres comunes declarados en tauri.conf.json
  const candidates = ['pandoc', 'pandoc_linux', 'pandoc_win']
  for (const c of candidates) {
    if (await tryCommand(c)) return c
  }
  return null
}

function defaultFilename(ext: PandocFormat): string {
  switch (ext) {
    case 'docx': return 'documento.docx'
    case 'odt': return 'documento.odt'
    case 'epub': return 'documento.epub'
    case 'pdf': return 'documento.pdf'
  }
}

export async function exportWithPandoc(currentMarkdown: string, format: PandocFormat, cmdName: string): Promise<boolean> {
  if (!isTauri()) return false
  const outPath = await saveDialog({ defaultPath: defaultFilename(format), filters: [{ name: format.toUpperCase(), extensions: [format] }] })
  if (!outPath) return false

  // Escribimos entrada temporal
  const tmp = await tempDir()
  const inPath = `${tmp}${tmp.endsWith(sep) ? '' : sep}plumamd_export.md`
  await writeTextFile(inPath, currentMarkdown)

  // Argumentos básicos
  const args: string[] = ['-o', String(outPath), String(inPath)]
  // Motor PDF
  if (format === 'pdf') {
    args.unshift('--pdf-engine=xelatex')
  }
  // Formato de entrada: gfm + matemáticas con $...$
  args.unshift('-f', 'gfm+tex_math_dollars+footnotes+task_lists')

  try {
    const cmd = new Command(cmdName, args)
    const res = await cmd.execute()
    if (res.code !== 0) {
      console.error('Pandoc error:', res)
      alert('No se pudo exportar con Pandoc. Revisa que Pandoc (y XeLaTeX para PDF) estén instalados.')
      return false
    }
    return true
  } catch (e) {
    console.error('Pandoc exception:', e)
    alert('No se pudo ejecutar Pandoc. Comprueba la instalación y permisos.')
    return false
  }
}

