// Registra el hook de resolución (alias @/ + imports .ts sin extensión) antes
// de que el runner nativo cargue los tests. Se engancha con:
//   node --import ./scripts/test-register.mjs --test "src/**/*.test.ts"
import { register } from 'node:module';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

register(pathToFileURL(path.join(import.meta.dirname, 'test-hooks.mjs')).href);
