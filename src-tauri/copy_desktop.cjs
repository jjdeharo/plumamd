const fs = require('fs');
const path = require('path');

// Ruta al .desktop personalizado
const srcDesktop = path.resolve(__dirname, 'PlumaMD.desktop');
// Ruta destino donde Tauri genera el .desktop para el .deb
const destDesktop = path.resolve(__dirname, 'target/release/bundle/deb/plumamd.desktop');

if (!fs.existsSync(srcDesktop)) {
  console.error(`No se encuentra el .desktop personalizado en: ${srcDesktop}`);
  process.exit(1);
}
if (!fs.existsSync(path.dirname(destDesktop))) {
  console.error(`No se encuentra el directorio de destino. ¿Has compilado ya?`);
  process.exit(1);
}

try {
  fs.copyFileSync(srcDesktop, destDesktop);
  console.log(`Archivo .desktop personalizado copiado correctamente.`);
} catch (err) {
  console.error('Error al copiar el archivo .desktop:', err);
  process.exit(1);
}
