// Hook de resolución para correr los tests .ts con el runner nativo de Node
// (node:test), sin bundler. Resuelve dos cosas que Node no hace solo:
//   1) el alias "@/x" -> "<repo>/src/x" (igual que el paths del tsconfig), y
//   2) imports relativos SIN extensión (estilo TS): "./time" -> "./time.ts".
// Node quita los tipos de los .ts al vuelo (v22.6+), pero no reescribe estos
// especificadores; por eso el hook.
import { existsSync, statSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const SRC = path.resolve(process.cwd(), 'src');
const EXTS = ['.ts', '.tsx', '.js', '.mjs'];

function resolveFile(absNoExt) {
  if (existsSync(absNoExt) && statSync(absNoExt).isFile()) return absNoExt;
  for (const ext of EXTS) {
    const withExt = absNoExt + ext;
    if (existsSync(withExt) && statSync(withExt).isFile()) return withExt;
  }
  for (const ext of EXTS) {
    const idx = path.join(absNoExt, 'index' + ext);
    if (existsSync(idx) && statSync(idx).isFile()) return idx;
  }
  return null;
}

export async function resolve(specifier, context, next) {
  if (specifier.startsWith('@/')) {
    const file = resolveFile(path.join(SRC, specifier.slice(2)));
    if (file) return { url: pathToFileURL(file).href, shortCircuit: true };
  }
  if (
    (specifier.startsWith('./') || specifier.startsWith('../')) &&
    !path.extname(specifier) &&
    context.parentURL?.startsWith('file:')
  ) {
    const abs = path.resolve(path.dirname(fileURLToPath(context.parentURL)), specifier);
    const file = resolveFile(abs);
    if (file) return { url: pathToFileURL(file).href, shortCircuit: true };
  }
  return next(specifier, context);
}
