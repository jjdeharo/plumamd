const fs = require('fs')
const path = require('path')

// Ruta al .desktop personalizado
const srcDesktop = path.resolve(__dirname, 'PlumaMD.desktop')
// Carpeta donde Tauri genera los artefactos .deb
const debDir = path.resolve(__dirname, 'target/release/bundle/deb')

if (!fs.existsSync(srcDesktop)) {
  console.error(`No se encuentra el .desktop personalizado en: ${srcDesktop}`)
  process.exit(1)
}
if (!fs.existsSync(debDir)) {
  console.error(`No se encuentra el directorio de destino. ¿Has compilado ya? (${debDir})`)
  process.exit(1)
}

// Copia sobre cualquier .desktop generado (por nombre) o, si no existe aún,
// usa los nombres más probables según el ID/nombre del paquete.
const candidates = [
  path.join(debDir, 'pluma-md.desktop'),
  path.join(debDir, 'plumamd.desktop')
]

let copied = 0
for (const dest of candidates) {
  try {
    fs.copyFileSync(srcDesktop, dest)
    console.log(`.desktop personalizado copiado: ${dest}`)
    copied++
  } catch {}
}

// Si no existían candidatos, intenta encontrar cualquier .desktop en la carpeta y sobreescribirlo
if (copied === 0) {
  const files = fs.readdirSync(debDir).filter(f => f.endsWith('.desktop'))
  if (files.length) {
    for (const f of files) {
      const dest = path.join(debDir, f)
      try {
        fs.copyFileSync(srcDesktop, dest)
        console.log(`.desktop personalizado copiado: ${dest}`)
        copied++
      } catch {}
    }
  }
}

if (copied === 0) {
  console.warn('No se encontró ningún .desktop para sobreescribir aún. Ejecuta este script después de tauri:build.')
  process.exit(2)
}
