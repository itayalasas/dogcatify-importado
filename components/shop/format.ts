/**
 * Formato de precios de la tienda, estilo es-UY: "$ 1.298,00".
 * Se arma a mano (sin Intl) para que se vea igual en iOS, Android (Hermes) y web.
 */
export const formatPrice = (value: number | string | null | undefined): string => {
  const n = typeof value === 'string' ? parseFloat(value) : value;
  const safe = typeof n === 'number' && Number.isFinite(n) ? n : 0;
  const negative = safe < 0;
  const [intPart, decPart] = Math.abs(safe).toFixed(2).split('.');
  const withThousands = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${negative ? '-' : ''}$ ${withThousands},${decPart}`;
};

/** Texto de disponibilidad para el comprador: no mostramos el stock exacto. */
export const stockLabel = (stock: number | null | undefined): string | null => {
  if (typeof stock !== 'number') return null;
  if (stock <= 0) return 'Sin stock';
  if (stock <= 5) return 'Últimas unidades';
  return null;
};
