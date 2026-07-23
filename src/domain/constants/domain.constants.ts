/** Minutos que una reserva de stock permanece activa antes de expirar. */
export const RESERVATION_TTL_MINUTES = 10;

/** Gracia extra (minutos) que el sweep respeta si el intento más reciente está `Redirected` (pago en vuelo). */
export const IN_FLIGHT_GRACE_MINUTES = 5;

/** TTL (minutos) de un `callback_pivot` antes de considerarse inválido. */
export const PIVOT_TTL_MINUTES = 5;

/** Única moneda soportada por la demo. */
export const CURRENCY = 'CLP';

/** Nombre de la cookie httpOnly que identifica la sesión anónima. */
export const SESSION_COOKIE_NAME = 'pl_session';

/** Dominio usado para construir el email sintético que exige la inscripción Oneclick. */
export const SYNTHETIC_EMAIL_DOMAIN = 'payments-lab.dev';
