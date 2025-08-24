# PlumaMD

Editor Markdown de escritorio (Linux/Windows/macOS) con Tauri, Vite y TypeScript. Incluye edición con CodeMirror 6, vista previa con markdown-it y KaTeX, apertura/guardado con diálogos nativos, atajos y exportación básica.

## Requisitos (Zorin OS/Ubuntu/Debian)
- Node.js 18+ y npm
- Rust y toolchain (instalar con `curl https://sh.rustup.rs -sSf | sh`)
- Dependencias de Tauri (GTK/WebKit, etc.).
  - Zorin OS 17 / Ubuntu 22.04 (Jammy):
    - `sudo apt update && sudo apt install -y build-essential pkg-config libgtk-3-dev libwebkit2gtk-4.0-dev libayatana-appindicator3-dev librsvg2-dev`
  - Ubuntu 24.04 (Noble) y derivados:
    - `sudo apt update && sudo apt install -y build-essential pkg-config libgtk-3-dev libwebkit2gtk-4.1-dev libayatana-appindicator3-dev librsvg2-dev`

## Desarrollo
- Instalar dependencias: `npm install`
- Ejecutar en modo dev: `npm run tauri:dev`
  - Seguridad dev: el servidor Vite queda enlazado a `127.0.0.1`.

## Build
- Generar binarios: `npm run tauri:build`

## Atajos
- `Ctrl+O`: Abrir
- `Ctrl+S`: Guardar
- `Ctrl+Shift+S`: Guardar como
- `Ctrl+E`: Exportar a HTML
- `Ctrl+P`: PDF por impresión

## Estado actual
- Editor y vista previa funcionando con KaTeX, tareas y notas al pie.
- Abrir/guardar/arrastrar-soltar funcionando.
- Exportar HTML offline: el HTML exportado incluye estilos y fuentes de KaTeX incrustadas (archivo único, 100% offline).
- Exportar con pandoc (si está instalado): DOCX/EPUB/ODT y PDF con XeLaTeX.
 - Sanitización: el HTML renderizado y exportado se sanea con DOMPurify (MathML permitido). Se sustituyó `markdown-it-katex` por un plugin local seguro basado en KaTeX.

## Pandoc (opcional)
- Instalar: `sudo apt install pandoc`
- PDF avanzado: `sudo apt install texlive-xetex`
- Si `pandoc` está disponible en PATH, aparecerán botones para DOCX/EPUB/ODT y PDF (XeLaTeX).

## Pendiente / Próximos pasos
- Incrustar fuentes de KaTeX en el HTML exportado (actualmente usa tipografías del sistema).
- Mejoras de accesibilidad y más atajos.
 - Revisar `npm audit` periódicamente; se añadió `overrides.esbuild >=0.24.3` para mitigar advisory del dev server sin subir a Vite 7.
