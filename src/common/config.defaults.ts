/**
 * Valores de respaldo para dev local sin `.env` completo. En cualquier
 * entorno real, `WEB_BASE_URL`/`PUBLIC_API_URL` vienen seteadas; estos
 * defaults solo evitan que `pnpm start:dev` falle sin configuración previa.
 */
export const DEFAULT_WEB_BASE_URL = 'http://localhost:3000';
export const DEFAULT_PUBLIC_API_URL = 'http://localhost:3001';

/**
 * Rutas de la web a las que el backend redirige la pestaña de retorno del PSP.
 * Llevan el prefijo de idioma por defecto (`/es`) porque el front usa
 * `localePrefix: 'always'`: son rutas que existen tanto en `next dev` como en el
 * export estático (S3). Se fija `es` (idioma por defecto del sitio); si en el
 * futuro se necesita respetar el idioma del usuario, habría que propagarlo
 * desde el checkout/inscripción hasta esta redirección.
 */
export const WEB_PAYMENT_RETURN_PATH = '/es/checkout/result/';
export const WEB_ENROLL_RETURN_PATH = '/es/checkout/';
