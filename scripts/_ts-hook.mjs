/* Engancha el resolutor de arriba. Se carga con `--import`. */
import { register } from 'node:module';
register('./_ts-resolve.mjs', import.meta.url);
