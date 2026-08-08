/*
 * Estilos que ya no usa nadie.
 *
 * Cada refactor deja atrás claves de StyleSheet que nadie referencia. No hacen
 * daño en tiempo de ejecución, y por eso se acumulan: nunca fallan, nunca
 * molestan y nunca se borran. El daño es al leer. Quien abra el fichero dentro
 * de seis meses no sabe si `dayNumToday` es un caso raro que hay que respetar o
 * basura de un rediseño anterior, y ante la duda no lo toca — así que el
 * fichero solo crece.
 *
 * Se recorta SOLO dentro del objeto de `StyleSheet.create`, contando llaves,
 * para no confundirlo con otros objetos del mismo fichero: `Button.tsx` tiene
 * un `variantStyles` que se indexa con una variable (`variantStyles[variant]`)
 * y una búsqueda ingenua lo daría por muerto entero.
 *
 *   node scripts/check-estilos-huerfanos.mjs            (comprueba)
 *   node scripts/check-estilos-huerfanos.mjs --aplicar  (borra)
 */
import { globSync, readFileSync, writeFileSync } from 'node:fs';

const ficheros = [...globSync('app/**/*.tsx'), ...globSync('components/**/*.tsx')].sort();
const aplicar = process.argv.includes('--aplicar');
let totalClaves = 0;
let totalFicheros = 0;

for (const f of ficheros) {
  const texto = readFileSync(f, 'utf8');
  const m = texto.match(/const styles = StyleSheet\.create\(\{/);
  if (!m) continue;
  const inicio = m.index + m[0].length;

  // Fin del objeto: contando llaves desde la de apertura.
  let nivel = 1;
  let i = inicio;
  for (; i < texto.length && nivel > 0; i++) {
    if (texto[i] === '{') nivel++;
    else if (texto[i] === '}') nivel--;
  }
  const bloque = texto.slice(inicio, i - 1);

  // Claves de primer nivel: sangría de exactamente dos espacios.
  const huerfanas = [];
  for (const km of bloque.matchAll(/^ {2}([a-zA-Z][a-zA-Z0-9]*): [{[]/gm)) {
    const clave = km[1];
    // Se busca en TODO el fichero, incluido el propio bloque: un estilo puede
    // componerse dentro de otro.
    if (!texto.includes(`styles.${clave}`)) huerfanas.push(clave);
  }
  if (huerfanas.length === 0) continue;

  totalFicheros++;
  totalClaves += huerfanas.length;
  console.log(`  ${f}\n     ${huerfanas.join(', ')}`);

  if (!aplicar) continue;

  let nuevo = texto;
  for (const clave of huerfanas) {
    const re = new RegExp(`\\n {2}${clave}: [{[]`);
    const km = nuevo.match(re);
    if (!km) continue;
    let j = km.index + km[0].length;
    let n = 1;
    for (; j < nuevo.length && n > 0; j++) {
      const c = nuevo[j];
      if (c === '{' || c === '[') n++;
      else if (c === '}' || c === ']') n--;
    }
    while (j < nuevo.length && (nuevo[j] === ',' || nuevo[j] === ' ')) j++;
    nuevo = nuevo.slice(0, km.index) + nuevo.slice(j);
  }
  writeFileSync(f, nuevo);
}

if (totalClaves === 0) {
  console.log('✔ Ningún estilo sin usar');
  process.exit(0);
}
if (aplicar) {
  console.log(`\n${totalClaves} claves borradas en ${totalFicheros} ficheros`);
  process.exit(0);
}
console.log(
  `\n${totalClaves} estilos sin usar en ${totalFicheros} ficheros.` +
    '\nPara borrarlos: node scripts/check-estilos-huerfanos.mjs --aplicar'
);
process.exit(1);
