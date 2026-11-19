// Dinero del diezmo (RN-44, RNF-06): «no aceptamos diferencias de centavos».
// Los montos viajan como texto («1250.50») y aquí se manejan en centavos enteros, nunca con
// decimales de punto flotante, para que 0.10 + 0.20 sea exactamente 0.30.

/** Hasta 10 dígitos enteros y 2 decimales: cabe en Decimal(12,2). Sin signo ni separadores. */
const FORMATO_MONTO = /^\d{1,10}(\.\d{1,2})?$/;

/** Centavos de un monto, o null si el texto no es un monto válido. */
export function parsearMonto(monto: string): number | null {
  if (!FORMATO_MONTO.test(monto)) return null;
  const [enteros = '0', decimales = ''] = monto.split('.');
  return Number(enteros) * 100 + Number(decimales.padEnd(2, '0'));
}

/** Como `parsearMonto`, pero para datos que ya deberían ser válidos: si no lo son, falla. */
export function aCentavos(monto: string): number {
  const centavos = parsearMonto(monto);
  if (centavos === null) throw new Error(`Monto no válido: "${monto}".`);
  return centavos;
}

/** Monto en texto con siempre 2 decimales: 125050 → «1250.50». */
export function deCentavos(centavos: number): string {
  if (!Number.isSafeInteger(centavos) || centavos < 0) {
    throw new Error(`Cantidad de centavos no válida: ${centavos}.`);
  }
  const decimales = String(centavos % 100).padStart(2, '0');
  return `${Math.floor(centavos / 100)}.${decimales}`;
}
