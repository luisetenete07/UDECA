/**
 * La biblioteca del atleta es LA MISMA pantalla que la del entrenador.
 *
 * No es un atajo por vagancia: es que son el mismo producto. Los ejercicios se
 * guardan igual (por `trainerId`, y el atleta es su propio entrenador), se
 * editan igual y se agrupan igual. Copiar la pantalla habría creado dos sitios
 * donde arreglar el mismo fallo, y el segundo se arregla siempre más tarde.
 *
 * Lo único que cambia es dónde vive la ruta, y de eso se encarga
 * `baseDeEjercicios` (lib/rutas.ts).
 */
export { default } from '../../(trainer)/exercises/index';
