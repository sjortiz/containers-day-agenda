/**
 * Generates the Talk Track PWA icons from a reproducible SVG source.
 * Requiere `sharp` (devDependency). Salida: public/icons/*.png y src/app/icon.png.
 */
import sharp from 'sharp';
import { mkdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const iconsDir = join(root, 'public', 'icons');
mkdirSync(iconsDir, { recursive: true });

const svg = readFileSync(join(root, 'public', 'icon-source.svg'));

const targets = [
  { file: join(iconsDir, 'icon-192.png'), size: 192 },
  { file: join(iconsDir, 'icon-512.png'), size: 512 },
  { file: join(iconsDir, 'maskable-512.png'), size: 512 },
  { file: join(iconsDir, 'apple-touch-icon.png'), size: 180 },
  { file: join(root, 'src', 'app', 'icon.png'), size: 512 },
];

await Promise.all(
  targets.map(({ file, size }) =>
    sharp(svg).resize(size, size).png().toFile(file),
  ),
);

console.log(`[make-icons] Generados ${targets.length} iconos.`);
