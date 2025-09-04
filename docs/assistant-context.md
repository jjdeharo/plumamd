# Contexto persistente de PlumaMD (plumamd)

Fecha: 2025-09-04

## Objetivo
Unificar el nombre de la app en Linux a "plumamd" y asegurar que el lanzador (.desktop) e iconos aparezcan correctamente en el menú.

## Decisiones
- Nombre definitivo: `plumamd` (paquete, binario, .desktop, iconos y WMClass).
- Mantener marca visible como "PlumaMD" en UI/textos, pero con identificadores del sistema `plumamd`.
- Usar icono con ruta absoluta en el `.desktop` como medida robusta en Wayland.

## Cambios aplicados (commit local)
- `src-tauri/tauri.conf.json`: `package.productName` → `"plumamd"` (antes "PlumaMD").
- `src-tauri/desktop/plumamd.desktop`:
  - `StartupWMClass=plumamd` (antes `pluma-md`).
  - Se mantiene `Exec=plumamd %U`, `TryExec=plumamd`, `Icon=/usr/share/icons/hicolor/512x512/apps/plumamd.png`.
- `src-tauri/patch_deb.cjs`: instala el `.desktop` como `/usr/share/applications/plumamd.desktop` (antes `pluma-md.desktop`).
- `package.json`: versión a `1.0.3` para alinear con Tauri.

## Resultado de build
- Comando: `npm run tauri:build`.
- Artefacto: `src-tauri/target/release/bundle/deb/plumamd_1.0.3_amd64_fixed.deb`.

## Instalación limpia recomendada
1) Desinstalar restos antiguos:
   - `sudo apt remove pluma-md || true`
2) Instalar `.deb`:
   - `cd src-tauri/target/release/bundle/deb`
   - `sudo apt install ./plumamd_1.0.3_amd64_fixed.deb`
3) Refrescar cachés:
   - `sudo update-desktop-database`
   - `sudo gtk-update-icon-cache -f /usr/share/icons/hicolor`
4) Limpiar lanzadores locales:
   - `rm -f ~/.local/share/applications/pluma-md.desktop ~/.local/share/applications/plumamd.desktop`
5) Cerrar sesión y volver a entrar (Wayland).

## Verificaciones
- Binario: `which plumamd` → `/usr/bin/plumamd`.
- `.desktop` instalado: `/usr/share/applications/plumamd.desktop` con:
  - `Exec=plumamd ...`, `TryExec=plumamd`, `StartupWMClass=plumamd`, `Icon=/usr/share/icons/hicolor/512x512/apps/plumamd.png`.
- Iconos: existen `plumamd.png` (y copias `pluma-md.png` por compatibilidad) en hicolor 32/128/256/512.

## Notas
- Advertencias de Tailwind CDN en consola pueden ignorarse según la guía local de depuración.

## Próximos pasos (si hiciera falta)
- Publicar `v1.0.3` en GitHub Releases (tag y binarios).
- Verificar pin/favoritos tras reinstalar (eliminar pins antiguos ligados a `pluma-md`).

## Cómo usar este contexto en futuras sesiones
- Al abrir una nueva sesión, pedir: "carga el contexto de `docs/assistant-context.md`" o simplemente mencionar "usa el contexto persistente". Yo leeré este archivo para recuperar el hilo sin empezar de cero.

## Registro 2025-09-04 — Icono en Zorin
- Situación: tras instalar, el icono no aparece correctamente en el menú/dock.
- Hallazgo: `/usr/share/applications/plumamd.desktop` antiguo tenía `StartupWMClass=pluma-md`.
- Acción aplicada: reemplazado por `src-tauri/desktop/plumamd.desktop` con `StartupWMClass=plumamd` e `Icon=/usr/share/icons/hicolor/512x512/apps/plumamd.png`. Limpiados duplicados en `~/.local/share/applications/` y refrescadas cachés (`update-desktop-database`, `gtk-update-icon-cache`).
- Verificación: `grep -E '^(Icon|StartupWMClass)=' /usr/share/applications/plumamd.desktop` devuelve valores esperados.
- Siguiente paso del usuario: cerrar sesión y volver a entrar (GNOME/Zorin cachea el menú e iconos).
- Si tras reingresar persiste:
  - Confirmar que el lanzador aparece en el menú como "PlumaMD" y se abre.
  - Si el icono del dock al ejecutar es genérico, comprobar la clase de ventana (Xorg: `xprop WM_CLASS` sobre la ventana) y alinear con `StartupWMClass=plumamd`.
  - Forzar recacheo de iconos del tema si se usa uno distinto a `hicolor`.

## Registro 2025-09-04 — Asociación .md con Pluma
- Situación → Al instalar `plumamd`, los `.md` han dejado de abrirse con el editor Pluma.
- Causa → El lanzador de plantilla incluía `MimeType=text/plain;` y registraba `text/markdown`, lo que pudo alterar la preferencia local.
- Acción → Eliminado `text/plain` del `.desktop` de plantilla (`src-tauri/desktop/plumamd.desktop`) y mantenido solo `text/markdown;text/x-markdown;`. No forzamos la app por defecto en los scripts de empaquetado.
- Resultado → Nuevas instalaciones ya no compiten por `text/plain`. El usuario puede restaurar Pluma como predeterminada para Markdown.
- Siguientes pasos (usuario) →
  1) Comprobar el desktop id de Pluma: `ls /usr/share/applications | grep -i pluma` (posibles: `org.mate.pluma.desktop` o `pluma.desktop`).
  2) Fijar Pluma por defecto:
     - `xdg-mime default org.mate.pluma.desktop text/markdown` y `xdg-mime default org.mate.pluma.desktop text/x-markdown`.
       (si falla, usar `pluma.desktop`). Verificar con `xdg-mime query default text/markdown`.
  3) Alternativa GUI: clic derecho en un `.md` → Propiedades → Abrir con → Pluma → Establecer por defecto.

## Registro 2025-09-04 — Revertir a PlumaMD por defecto
- Situación → El usuario desea que los `.md` se abran con PlumaMD (no con Pluma ni otros editores).
- Acción → Indicar comandos para establecer `plumamd.desktop` como predeterminado para `text/markdown` y `text/x-markdown`; refrescar cachés de escritorio e iconos tras instalar el `.deb`.
- Comandos recomendados →
  - `xdg-mime default plumamd.desktop text/markdown`
  - `xdg-mime default plumamd.desktop text/x-markdown`
  - Verificar: `xdg-mime query default text/markdown`
  - Refrescar: `sudo update-desktop-database && sudo gtk-update-icon-cache -f /usr/share/icons/hicolor`
- Resultado esperado → Los `.md` abrirán con PlumaMD y el icono aparecerá correctamente en el menú/dock.

## Registro 2025-09-04 — Ubicación de iconos instalados
- Situación → El usuario quiere verificar manualmente el icono instalado por el .deb.
- Acción → Documentar rutas de instalación y tamaños en el tema `hicolor` y el archivo .desktop que las referencia.
- Resultado → Tras instalar `plumamd_1.0.3_amd64_fixed.deb`, existen:
  - `/usr/share/icons/hicolor/32x32/apps/plumamd.png`
  - `/usr/share/icons/hicolor/128x128/apps/plumamd.png`
  - `/usr/share/icons/hicolor/256x256/apps/plumamd.png`
  - `/usr/share/icons/hicolor/512x512/apps/plumamd.png` (referenciada por el .desktop)
  - (Compatibilidad) Duplicados con nombre `pluma-md.png` en las mismas carpetas.
  - `.desktop`: `/usr/share/applications/plumamd.desktop` con `Icon=/usr/share/icons/hicolor/512x512/apps/plumamd.png`.
- Siguientes pasos → Si el icono no aparece tras instalar: `sudo update-desktop-database && sudo gtk-update-icon-cache -f /usr/share/icons/hicolor` y reiniciar sesión (o sistema) para limpiar caché.
