export function isTauri(): boolean {
  return typeof window !== 'undefined' && typeof (window as any).__TAURI_IPC__ === 'function'
}
