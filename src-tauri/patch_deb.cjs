const fs = require('fs')
const path = require('path')
const { execFileSync } = require('child_process')

const ROOT = path.resolve(__dirname)
const DEB_DIR = path.join(ROOT, 'target/release/bundle/deb')
const DESKTOP_SRC = path.join(ROOT, 'PlumaMD.desktop')
const ICONS_DIR = path.join(ROOT, 'icons')
const FAVICON_SVG = path.resolve(ROOT, '..', 'public', 'favicon.svg')

function latestDeb() {
  if (!fs.existsSync(DEB_DIR)) throw new Error('No existe el directorio de bundles .deb: ' + DEB_DIR)
  // Preferir el .deb "base" (sin _fixed) para no encadenar sufijos
  let files = fs.readdirSync(DEB_DIR)
    .filter(f => f.endsWith('.deb') && (f.startsWith('plumamd_') || f.startsWith('pluma-md_')))
    .filter(f => !/_fixed\.deb$/i.test(f))
  if (!files.length) {
    // Si solo quedan _fixed, usa el más reciente (evita fallar en entornos previos)
    files = fs.readdirSync(DEB_DIR)
      .filter(f => f.endsWith('.deb') && (f.startsWith('plumamd_') || f.startsWith('pluma-md_')))
  }
  if (!files.length) throw new Error('No se encontraron .deb en ' + DEB_DIR)
  // Orden lexicográfico por versión debería bastar (formato 1.0.x)
  files.sort()
  return path.join(DEB_DIR, files[files.length - 1])
}

function run(cmd, args, opts={}) {
  return execFileSync(cmd, args, { stdio: 'inherit', ...opts })
}

function ensureDir(p) { fs.mkdirSync(p, { recursive: true }) }

function main() {
  const debPath = latestDeb()
  const workDir = path.join(DEB_DIR, '.work-repack')
  if (fs.existsSync(workDir)) fs.rmSync(workDir, { recursive: true, force: true })
  ensureDir(workDir)

  // Extraer .deb => estructura con DEBIAN + usr/...
  run('dpkg-deb', ['-R', debPath, workDir])

  // Sustituir el .desktop
  if (!fs.existsSync(DESKTOP_SRC)) throw new Error('No se encuentra el .desktop de origen: ' + DESKTOP_SRC)
  const desktopDest = path.join(workDir, 'usr/share/applications/plumamd.desktop')
  ensureDir(path.dirname(desktopDest))
  fs.copyFileSync(DESKTOP_SRC, desktopDest)

  // Copiar iconos en varios tamaños
  const sizes = [
    { src: '32x32.png', destDir: '32x32' },
    { src: '128x128.png', destDir: '128x128' },
    { src: '128x128@2x.png', destDir: '256x256' },
    { src: 'icon.png', destDir: '512x512' },
  ]
  for (const { src, destDir } of sizes) {
    const srcPath = path.join(ICONS_DIR, src)
    if (!fs.existsSync(srcPath)) continue
    // Copiar con ambos nombres para evitar discrepancias
    const dest1 = path.join(workDir, 'usr/share/icons/hicolor', destDir, 'apps', 'pluma-md.png')
    const dest2 = path.join(workDir, 'usr/share/icons/hicolor', destDir, 'apps', 'plumamd.png')
    ensureDir(path.dirname(dest1))
    ensureDir(path.dirname(dest2))
    fs.copyFileSync(srcPath, dest1)
    fs.copyFileSync(srcPath, dest2)
  }

  // Instalar también el SVG escalable si existe
  if (fs.existsSync(FAVICON_SVG)) {
    const scalableDir = path.join(workDir, 'usr/share/icons/hicolor/scalable/apps')
    ensureDir(scalableDir)
    // Copias con ambos nombres por compatibilidad
    fs.copyFileSync(FAVICON_SVG, path.join(scalableDir, 'plumamd.svg'))
    fs.copyFileSync(FAVICON_SVG, path.join(scalableDir, 'pluma-md.svg'))
  }

  // Reempacar .deb sobrescribiendo el original (sin sufijo _fixed)
  const tempOut = path.join(DEB_DIR, '._repacked.deb')
  run('dpkg-deb', ['-b', workDir, tempOut])
  // Sustituir el .deb original por el repaquetado
  fs.renameSync(tempOut, debPath)
  // Limpieza ligera
  try { fs.rmSync(workDir, { recursive: true, force: true }) } catch {}

  console.log('\nReempaquetado .deb (sin sufijo) con .desktop e iconos multi-tamaño:\n' + debPath)
}

try { main() } catch (e) {
  console.error('Error al parchear el .deb:', e.message)
  process.exit(1)
}
