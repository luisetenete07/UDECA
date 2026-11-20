/**
 * Lo que queda del acceso, para las pantallas.
 *
 * Las reglas viven en lib/planBase.ts (sin React Native, para poder probarlas
 * desde Node); aquí se reexportan para que las pantallas las importen de un
 * solo sitio.
 */
export {
  ADMIN_EMAILS,
  CLIENT_GRACE_DAYS,
  clientDaysUntilLock,
  clientIsLocked,
  DAY_MS,
  isAdmin,
} from './planBase';

/** Correo de contacto de Mastery. */
export const CONTACT_EMAIL = 'luistenaf@gmail.com';
