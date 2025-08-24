const THEME_KEY = 'plumamd:theme'

export function applyInitialTheme() {
  const saved = localStorage.getItem(THEME_KEY) as 'system' | 'light' | 'dark' | null
  const select = document.getElementById('themeSelect') as HTMLSelectElement
  const initial = saved ?? 'system'
  select.value = initial
  applyTheme(initial)
}

export function setupThemeToggle() {
  const select = document.getElementById('themeSelect') as HTMLSelectElement
  select.addEventListener('change', () => {
    const val = select.value as 'system' | 'light' | 'dark'
    localStorage.setItem(THEME_KEY, val)
    applyTheme(val)
  })
}

function applyTheme(val: 'system' | 'light' | 'dark') {
  const body = document.body
  if (val === 'system') {
    body.removeAttribute('data-theme')
    const m = window.matchMedia('(prefers-color-scheme: dark)')
    body.setAttribute('data-theme', m.matches ? 'dark' : 'light')
  } else {
    body.setAttribute('data-theme', val)
  }
}

