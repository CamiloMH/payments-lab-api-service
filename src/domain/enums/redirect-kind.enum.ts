/**
 * Forma en que un proveedor de pago devuelve el control al usuario. Absorbe la
 * asimetría entre PSPs: Transbank exige un form POST, Mercado Pago un redirect
 * simple por URL, y el cobro directo con tarjeta inscrita no redirige.
 */
export enum RedirectKind {
  FormPost = 'form_post',
  Url = 'url',
  None = 'none',
}
