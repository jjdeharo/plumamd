import MarkdownIt from 'markdown-it'
import mila from 'markdown-it-link-attributes'
import mdKatex from './md-katex'
import footnote from 'markdown-it-footnote'
import taskLists from 'markdown-it-task-lists'
import DOMPurify from 'dompurify'

let md: MarkdownIt

export function setupPreview() {
  md = new MarkdownIt({
    html: false,
    linkify: true,
    typographer: true,
    breaks: true
  })
    .use(mila, { attrs: { target: '_blank', rel: 'noopener' } })
    .use(footnote)
    .use(taskLists, { label: true })
    .use(mdKatex)
}

export function renderMarkdown(src: string) {
  const container = document.getElementById('preview')!
  const html = md.render(src)
  const clean = DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true, svg: true, mathMl: true },
    ADD_ATTR: ['class', 'style'],
    ALLOWED_TAGS: ['span', 'div', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'a', 'strong', 'em', 'code', 'pre', 'blockquote', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'br', 'hr', 'img'],
    KEEP_CONTENT: true
  } as any)
  container.innerHTML = clean
}

export function renderToHtml(src: string) {
  const html = md.render(src)
  const clean = DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true, svg: true, mathMl: true },
    ADD_ATTR: ['class', 'style'],
    ALLOWED_TAGS: ['span', 'div', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'a', 'strong', 'em', 'code', 'pre', 'blockquote', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'br', 'hr', 'img'],
    KEEP_CONTENT: true
  } as any)
  return clean
}
