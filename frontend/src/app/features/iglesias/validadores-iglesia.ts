import type { ValidatorFn } from '@angular/forms';

// Mismas reglas que backend/src/modules/iglesias y patrimonio (E2-06, E2-08). Vacío pasa:
// los campos opcionales se envían como null.

/** Número entero entre `min` y `max`. */
export function entero(min: number, max: number, mensaje: string): ValidatorFn {
  return (c) => {
    const v = String(c.value ?? '').trim();
    if (v === '') return null;
    const n = Number(v);
    return Number.isInteger(n) && n >= min && n <= max ? null : { mensaje };
  };
}

/** Número (con decimales) entre `-limite` y `limite`, para latitud y longitud. */
export function coordenada(limite: number, nombre: string): ValidatorFn {
  return (c) => {
    const v = String(c.value ?? '').trim();
    if (v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) && Math.abs(n) <= limite ? null : { mensaje: `${nombre} no válida.` };
  };
}

/** Teléfono de 7 a 15 dígitos (se ignoran espacios y guiones). */
export const telefono: ValidatorFn = (c) => {
  const v = String(c.value ?? '').replace(/[\s-]/g, '');
  return v === '' || /^\+?\d{7,15}$/.test(v)
    ? null
    : { mensaje: 'El teléfono debe tener de 7 a 15 dígitos.' };
};

/** Fecha `yyyy-MM-dd` que no sea futura. */
export const fechaNoFutura: ValidatorFn = (c) => {
  const v = String(c.value ?? '');
  if (v === '') return { mensaje: 'Elige la fecha.' };
  return v > new Date().toISOString().slice(0, 10)
    ? { mensaje: 'La fecha no puede ser futura.' }
    : null;
};

/** Texto → número o null. */
export function numeroONull(v: unknown): number | null {
  const t = String(v ?? '').trim();
  return t === '' ? null : Number(t);
}
