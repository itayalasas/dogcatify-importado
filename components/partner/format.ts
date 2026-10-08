/**
 * Formatos numéricos del panel del negocio (es-UY), sin depender de Intl,
 * que no está completo en todos los motores de React Native.
 */

const groupThousands = (intPart: string) => intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');

const toNumber = (value: unknown): number => {
  const n = typeof value === 'number' ? value : parseFloat(String(value ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
};

/** 1298 -> "1.298". Redondea a entero. */
export const formatNumber = (value: unknown): string => {
  const n = Math.round(toNumber(value));
  const sign = n < 0 ? '-' : '';
  return sign + groupThousands(String(Math.abs(n)));
};

/** 1298 -> "$ 1.298,00". Con decimals=0 -> "$ 1.298". */
export const formatMoney = (value: unknown, decimals: number = 2): string => {
  const n = toNumber(value);
  const sign = n < 0 ? '-' : '';
  const fixed = Math.abs(n).toFixed(decimals);
  const [intPart, decPart] = fixed.split('.');
  return `${sign}$ ${groupThousands(intPart)}${decPart ? ',' + decPart : ''}`;
};
