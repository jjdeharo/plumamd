# Repository Guidelines

## Project Structure & Module Organization
- `src/`: Código TypeScript (editor, vista previa, exportación, almacenamiento, temas, utilidades). Entradas clave: `main.ts`, `editor.ts`, `preview.ts`, `export.ts`.
- `public/`: Activos estáticos (p. ej., `favicon.svg`).
- `src-tauri/`: Backend Tauri en Rust (`src/main.rs`), configuración (`tauri.conf.json`), iconos y build scripts.
- Raíz: `index.html`, `vite.config.ts`, `tsconfig.json`, `package.json`, `README.md`.

## Build, Test, and Development Commands
- `npm install`: Instala dependencias.
- `npm run tauri:dev`: Ejecuta la app de escritorio (Vite + Tauri) en desarrollo.
- `npm run dev`: Servidor Vite en navegador (útil para iterar UI web).
- `npm run build`: Compila assets web a `dist/`.
- `npm run preview`: Sirve la build web localmente.
- `npm run tauri:build`: Empaqueta binarios nativos solo para Linux.
- Rust (opcional): `cd src-tauri && cargo fmt && cargo clippy` para formateo/lint.

## Coding Style & Naming Conventions
- TypeScript estricto (`tsconfig.json: strict: true`). Indentación de 2 espacios.
- Nombres: variables/funciones `camelCase`, tipos/interfaces `PascalCase`, constantes `UPPER_SNAKE_CASE` cuando aplique.
- Archivos: `kebab-case` en `src/` (ej.: `md-katex.ts`). Mantén módulos pequeños y centrados.
- Rust: sigue `rustfmt` por defecto; módulos y funciones en `snake_case`.

## Testing Guidelines
- No hay framework de tests configurado actualmente. Prioriza pruebas manuales:
  - `npm run tauri:dev`: verifica abrir/guardar, renderizado KaTeX, arrastrar‑soltar y exportaciones (HTML y PDF por impresión).
  - Revisa errores en consola (frontend) y trazas en `src-tauri`.
- Si añades tests, propone Vitest para TS y `cargo test` para Rust (con nomenclatura `*.spec.ts`).

## Commit & Pull Request Guidelines
- Mensajes tipo Conventional Commits: `feat:`, `fix:`, `docs:`, `chore:`, `refactor:`, `ci:` (observado en el histórico).
- Escribe en imperativo y breve en el título (~50 caracteres); añade cuerpo si es necesario.
- PRs: describe el cambio, enlaza issue(s), indica SO probado (Zorin/Ubuntu) y adjunta capturas/GIF si hay cambios de UI.

## Security & Configuration Tips
- Dependencias del sistema para Tauri en Debian/Ubuntu/Zorin: ver sección “Requisitos” en `README.md`.
- Sanitiza HTML siempre (el proyecto usa DOMPurify). Evita introducir plugins que ejecuten código arbitrario en la vista previa.
