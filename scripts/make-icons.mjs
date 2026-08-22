/**
 * Genera los iconos PWA a partir de un SVG monograma. Correr: `npm run make-icons`.
 * Requiere `sharp` (devDependency). Salida: public/icons/*.png y src/app/icon.png.
 */
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const iconsDir = join(root, 'public', 'icons');
mkdirSync(iconsDir, { recursive: true });

const svg = `<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#4f8cff"/>
      <stop offset="1" stop-color="#2ee6a6"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" fill="#0b1020"/>
  <rect x="64" y="64" width="384" height="384" rx="88" fill="url(#g)"/>
  <text x="256" y="322" font-family="Arial, Helvetica, sans-serif" font-size="196"
        font-weight="800" text-anchor="middle" fill="#0b1020">CD</text>
  <circle cx="378" cy="150" r="36" fill="#ff5d6c" stroke="#0b1020" stroke-width="12"/>
</svg>`;

const targets = [
  { file: join(iconsDir, 'icon-192.png'), size: 192 },
  { file: join(iconsDir, 'icon-512.png'), size: 512 },
  { file: join(iconsDir, 'maskable-512.png'), size: 512 },
  { file: join(iconsDir, 'apple-touch-icon.png'), size: 180 },
  { file: join(root, 'src', 'app', 'icon.png'), size: 512 },
];

const buf = Buffer.from(svg);
await Promise.all(
  targets.map(({ file, size }) =>
    sharp(buf).resize(size, size).png().toFile(file),
  ),
);

console.log(`[make-icons] Generados ${targets.length} iconos.`);
