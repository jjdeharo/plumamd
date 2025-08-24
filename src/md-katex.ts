import type MarkdownIt from 'markdown-it'
import katex from 'katex'

function isEscaped(src: string, pos: number) {
  let count = 0
  pos--
  while (pos >= 0 && src[pos] === '\\') { count++; pos--; }
  return count % 2 === 1
}

export default function mdKatex(md: MarkdownIt) {
  // Inline $...$
  md.inline.ruler.after('escape', 'math_inline', (state, silent) => {
    const src = state.src
    const pos = state.pos
    if (src.charCodeAt(pos) !== 0x24 /* $ */) return false
    // $$ indicates block or not inline
    if (src.charCodeAt(pos + 1) === 0x24) return false
    // Disallow if escaped
    if (isEscaped(src, pos)) return false

    let start = pos + 1
    let end = start
    while ((end = src.indexOf('$', end)) !== -1) {
      if (!isEscaped(src, end)) break
      end++
    }
    if (end === -1) return false
    const content = src.slice(start, end)
    if (!silent) {
      const token = state.push('math_inline', 'math', 0)
      token.markup = '$'
      token.content = content
    }
    state.pos = end + 1
    return true
  })

  // Inline \(...\)
  md.inline.ruler.after('math_inline', 'math_inline_paren', (state, silent) => {
    const src = state.src
    const pos = state.pos
    // Starts with \(
    if (src.charCodeAt(pos) !== 0x5c /* \\ */ || src.charCodeAt(pos + 1) !== 0x28 /* ( */) return false
    // Disallow if the backslash itself is escaped
    if (isEscaped(src, pos)) return false

    const start = pos + 2
    let end = start
    while (true) {
      end = src.indexOf('\\)', end)
      if (end === -1) return false
      if (!isEscaped(src, end)) break
      end++
    }
    const content = src.slice(start, end)
    if (!silent) {
      const token = state.push('math_inline', 'math', 0)
      token.markup = '\\('
      token.content = content
    }
    state.pos = end + 2
    return true
  })

  // Block $$...$$
  md.block.ruler.after('fence', 'math_block', (state, startLine, _maxLine, silent) => {
    const start = state.bMarks[startLine] + state.tShift[startLine]
    const max = state.eMarks[startLine]
    const src = state.src

    // Debe empezar por $$
    if (start + 2 > max) return false
    if (src.slice(start, start + 2) !== '$$') return false

    // 1) Caso de una sola línea: $$...$$ en la misma línea
    const restOfLine = src.slice(start + 2, max)
    const inlineClose = restOfLine.indexOf('$$')
    if (inlineClose !== -1) {
      if (silent) return true
      const content = restOfLine.slice(0, inlineClose).trim()
      const token = state.push('math_block', 'math', 0)
      token.block = true
      token.markup = '$$'
      token.content = content
      state.line = startLine + 1
      return true
    }

    // 2) Caso multilinea: línea de apertura solo con $$ y cierre en línea sola $$
    const lineContent = src.slice(start, max).trim()
    if (lineContent !== '$$') return false

    let nextLine = startLine + 1
    let closingLine = -1
    let content = ''

    while (nextLine < state.lineMax) {
      const lineStart = state.bMarks[nextLine] + state.tShift[nextLine]
      const lineMax = state.eMarks[nextLine]
      const raw = src.slice(lineStart, lineMax)
      const trimmed = raw.trim()

      if (trimmed === '$$') {
        closingLine = nextLine
        break
      }

      if (content) content += '\n'
      content += raw
      nextLine++
    }

    if (closingLine === -1) return false
    if (silent) return true

    const token = state.push('math_block', 'math', 0)
    token.block = true
    token.markup = '$$'
    token.content = content.trim()
    state.line = closingLine + 1
    return true
  }, { alt: ['paragraph', 'reference', 'blockquote', 'list'] })

  // Block \\[ ... \\]
  md.block.ruler.after('math_block', 'math_block_brackets', (state, startLine, _maxLine, silent) => {
    const start = state.bMarks[startLine] + state.tShift[startLine]
    const max = state.eMarks[startLine]
    const lineRaw = state.src.slice(start, max)
    const lineTrim = lineRaw.trim()
    // Must start with \[
    if (!lineTrim.startsWith('\\[')) return false

    // Single line: \[ ... \] on same line
    const openPosInLine = lineRaw.indexOf('\\[')
    let searchPos = start + openPosInLine + 2
    let closePos = state.src.indexOf('\\]', searchPos)

    if (closePos !== -1 && closePos < max) {
      if (silent) return true
      const content = state.src.slice(searchPos, closePos).trim()
      const token = state.push('math_block', 'math', 0)
      token.block = true
      token.markup = '\\['
      token.content = content
      state.line = startLine + 1
      return true
    }

    // Multiline: collect until first \]
    let nextLine = startLine + 1
    let collected = ''
    // append rest of first line
    collected += state.src.slice(searchPos, max)

    while (nextLine < state.lineMax) {
      const lStart = state.bMarks[nextLine] + state.tShift[nextLine]
      const lMax = state.eMarks[nextLine]
      const raw = state.src.slice(lStart, lMax)
      const idx = raw.indexOf('\\]')
      if (idx !== -1 && !isEscaped(raw, idx)) {
        // found close in this line
        collected += '\n' + raw.slice(0, idx)
        if (silent) return true
        const token = state.push('math_block', 'math', 0)
        token.block = true
        token.markup = '\\['
        token.content = collected.trim()
        state.line = nextLine + 1
        return true
      }
      // not found, add line and continue
      collected += '\n' + raw
      nextLine++
    }
    return false
  }, { alt: ['paragraph', 'reference', 'blockquote', 'list'] })

  md.renderer.rules.math_inline = (tokens, idx) => {
    try {
      return katex.renderToString(tokens[idx].content, { throwOnError: false })
    } catch (e) {
      return tokens[idx].content
    }
  }
  md.renderer.rules.math_block = (tokens, idx) => {
    try {
      const html = katex.renderToString(tokens[idx].content, { 
        displayMode: true, 
        throwOnError: false,
        strict: false
      })
      return `<div class="katex-display">${html}</div>\n`
    } catch (e) {
      console.warn('KaTeX error:', e, 'Content:', tokens[idx].content)
      return `<pre class="katex-error">$$\n${tokens[idx].content}\n$$</pre>\n`
    }
  }
}
