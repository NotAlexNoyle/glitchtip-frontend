#!/bin/sh
# png dir -> hero-*.avif and hero-*.webp, at the given width (2x the shown size)
set -e
I="$1"; O="$2"; W="${3:-1600}"
mkdir -p "$O"
for n in list detail; do
  magick "$I/$n.png" -resize "${W}x" -strip "$I/$n-$W.png"
  avifenc -q 62 -s 4 -y 444 "$I/$n-$W.png" "$O/hero-$n.avif" >/dev/null
  cwebp -quiet -q 82 -m 6 "$I/$n-$W.png" -o "$O/hero-$n.webp"
done
ls -la "$O"
