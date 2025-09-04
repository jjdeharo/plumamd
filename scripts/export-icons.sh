#!/usr/bin/env bash
set -euo pipefail

# Genera los PNG de iconos desde un SVG o un PNG de origen.
# Origen preferido: public/app-icon.png (PNG). Alternativa: public/favicon.svg (SVG).
# Uso:
#   bash scripts/export-icons.sh [RUTA_REPO]
# Si no se pasa ruta, se usa la carpeta padre de este script.

if [[ "${1-}" != "" ]]; then
  REPO="$(realpath "$1")"
else
  REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
fi

SRC_PNG="$REPO/public/app-icon.png"
SRC_SVG="$REPO/public/favicon.svg"
OUT_DIR="$REPO/src-tauri/icons"

mkdir -p "$OUT_DIR"

if [[ -f "$SRC_PNG" ]]; then
  SRC_TYPE=png
  SRC_FILE="$SRC_PNG"
elif [[ -f "$SRC_SVG" ]]; then
  SRC_TYPE=svg
  SRC_FILE="$SRC_SVG"
else
  echo "No se encontró origen: ni $SRC_PNG ni $SRC_SVG" >&2
  echo "Coloca tu PNG en public/app-icon.png (recomendado) o un SVG en public/favicon.svg." >&2
  exit 1
fi

echo "Usando $SRC_TYPE: $SRC_FILE"
echo "Exportando a: $OUT_DIR"

export_with_inkscape() {
  inkscape "$SRC_FILE" -w 1024 -h 1024 -o "$OUT_DIR/icon.png"
  inkscape "$SRC_FILE" -w 256 -h 256 -o "$OUT_DIR/128x128@2x.png"
  inkscape "$SRC_FILE" -w 128 -h 128 -o "$OUT_DIR/128x128.png"
  inkscape "$SRC_FILE" -w 32 -h 32 -o "$OUT_DIR/32x32.png"
}

export_with_rsvg() {
  rsvg-convert -w 1024 -h 1024 "$SRC_FILE" > "$OUT_DIR/icon.png"
  rsvg-convert -w 256 -h 256 "$SRC_FILE" > "$OUT_DIR/128x128@2x.png"
  rsvg-convert -w 128 -h 128 "$SRC_FILE" > "$OUT_DIR/128x128.png"
  rsvg-convert -w 32 -h 32 "$SRC_FILE" > "$OUT_DIR/32x32.png"
}

export_with_magick() {
  local CONVERT_BIN=""
  if command -v magick >/dev/null 2>&1; then
    CONVERT_BIN="magick convert"
  elif command -v convert >/dev/null 2>&1; then
    CONVERT_BIN="convert"
  else
    echo "No se encontró ImageMagick ('magick' ni 'convert')." >&2
    exit 3
  fi
  $CONVERT_BIN "$SRC_FILE" -alpha on -background none -colorspace sRGB -type TrueColorAlpha -define png:color-type=6 -strip -resize 1024x1024 "$OUT_DIR/icon.png"
  $CONVERT_BIN "$SRC_FILE" -alpha on -background none -colorspace sRGB -type TrueColorAlpha -define png:color-type=6 -strip -resize 256x256  "$OUT_DIR/128x128@2x.png"
  $CONVERT_BIN "$SRC_FILE" -alpha on -background none -colorspace sRGB -type TrueColorAlpha -define png:color-type=6 -strip -resize 128x128  "$OUT_DIR/128x128.png"
  $CONVERT_BIN "$SRC_FILE" -alpha on -background none -colorspace sRGB -type TrueColorAlpha -define png:color-type=6 -strip -resize 32x32   "$OUT_DIR/32x32.png"
}

if [[ "$SRC_TYPE" == "svg" ]]; then
  if command -v inkscape >/dev/null 2>&1; then
    echo "Exportando SVG con Inkscape..."
    export_with_inkscape
  elif command -v rsvg-convert >/dev/null 2>&1; then
    echo "Exportando SVG con rsvg-convert..."
    export_with_rsvg
  elif command -v magick >/dev/null 2>&1; then
    echo "Exportando SVG con ImageMagick..."
    export_with_magick
  else
    echo "No se encontró herramienta para SVG (inkscape, rsvg-convert o magick)." >&2
    exit 2
  fi
else
  echo "Reescalando PNG con ImageMagick..."
  export_with_magick
fi

echo "Listo. Archivos generados en $OUT_DIR"
