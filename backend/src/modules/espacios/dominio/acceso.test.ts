import { describe, expect, it } from 'vitest';
import {
  claveDesdeBytes,
  evaluarBloqueo,
  formatearFolio,
  intentosVigentes,
  mostrarClave,
  normalizarClave,
  normalizarFolio,
  trasIntentoFallido,
} from './acceso';
import { SUPUESTOS_ACCESO } from './supuestos';

const AHORA = new Date('2026-11-21T15:00:00.000Z');
const minutos = (m: number) => new Date(AHORA.getTime() + m * 60_000);

describe('folio (supuesto P-25: prefijo genérico)', () => {
  it('usa el prefijo ESP, el año y seis dígitos', () => {
    expect(formatearFolio(2026, 123)).toBe('ESP-2026-000123');
    expect(formatearFolio(2026, 1)).toBe('ESP-2026-000001');
    expect(formatearFolio(2027, 1234567)).toBe('ESP-2027-1234567');
  });

  it('no usa un prefijo que sugiera un solo tipo de espacio', () => {
    expect(formatearFolio(2026, 5)).not.toMatch(/^(CR|NI|CO|OS)-/);
  });

  it('rechaza años y consecutivos inválidos', () => {
    expect(() => formatearFolio(26, 1)).toThrow();
    expect(() => formatearFolio(2026, 0)).toThrow();
    expect(() => formatearFolio(2026, 1.5)).toThrow();
  });

  it('normaliza el folio escrito en minúsculas o con espacios', () => {
    expect(normalizarFolio('  esp-2026-000123 ')).toBe('ESP-2026-000123');
  });
});

describe('clave (supuesto P-25: 10 caracteres sin ambiguos)', () => {
  const { alfabetoClave, longitudClave } = SUPUESTOS_ACCESO;

  it('el alfabeto no tiene caracteres ambiguos ni repetidos', () => {
    expect(alfabetoClave).not.toMatch(/[01OIL]/);
    expect(new Set(alfabetoClave).size).toBe(alfabetoClave.length);
    expect(alfabetoClave).toHaveLength(31);
  });

  it('da unos 50 bits de entropía (31^10)', () => {
    expect(longitudClave * Math.log2(alfabetoClave.length)).toBeGreaterThan(49);
  });

  it('con bytes dados produce siempre la misma clave de 10 caracteres del alfabeto', () => {
    const bytes = Uint8Array.from({ length: 20 }, (_, i) => i);
    const clave = claveDesdeBytes(bytes)!;
    expect(clave).toHaveLength(10);
    expect([...clave].every((c) => alfabetoClave.includes(c))).toBe(true);
    expect(claveDesdeBytes(bytes)).toBe(clave);
    expect(clave).toBe(alfabetoClave.slice(0, 10));
  });

  it('descarta los bytes que sesgarían el reparto (248 a 255)', () => {
    const sesgados = Uint8Array.from({ length: 30 }, () => 250);
    expect(claveDesdeBytes(sesgados)).toBeNull();
    const mezcla = Uint8Array.from([255, 0, 250, 1, 254, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(claveDesdeBytes(mezcla)).toBe(alfabetoClave.slice(0, 10));
  });

  it('devuelve null si los bytes no alcanzan', () => {
    expect(claveDesdeBytes(new Uint8Array(5))).toBeNull();
  });

  it('cada carácter del alfabeto sale de la misma cantidad de bytes válidos', () => {
    const cuenta = new Map<string, number>();
    for (let b = 0; b < 248; b++) {
      const c = claveDesdeBytes(Uint8Array.from({ length: 10 }, () => b))![0]!;
      cuenta.set(c, (cuenta.get(c) ?? 0) + 1);
    }
    expect(cuenta.size).toBe(31);
    expect(new Set(cuenta.values())).toEqual(new Set([8]));
  });

  it('se muestra en dos grupos y se acepta escrita de cualquier forma', () => {
    expect(mostrarClave('ABCDEFGHJK')).toBe('ABCDE-FGHJK');
    for (const escrita of ['abcde-fghjk', 'ABCDE FGHJK', ' abcdefghjk ', 'ABCDE-FGHJK']) {
      expect(normalizarClave(escrita)).toBe('ABCDEFGHJK');
    }
  });
});

describe('bloqueo por intentos fallidos (supuesto P-25: 5 intentos, 15 minutos, por folio)', () => {
  const limpio: { intentosFallidos: number; bloqueadoHasta: Date | null } = {
    intentosFallidos: 0,
    bloqueadoHasta: null,
  };

  it('los primeros cuatro fallos no bloquean y cuentan', () => {
    let s = limpio;
    for (let i = 1; i <= 4; i++) {
      s = trasIntentoFallido(s, AHORA);
      expect(s).toEqual({ intentosFallidos: i, bloqueadoHasta: null });
      expect(evaluarBloqueo(s, AHORA)).toEqual({ bloqueado: false });
    }
  });

  it('el quinto fallo bloquea 15 minutos exactos', () => {
    const s = trasIntentoFallido({ intentosFallidos: 4, bloqueadoHasta: null }, AHORA);
    expect(s.intentosFallidos).toBe(5);
    expect(s.bloqueadoHasta).toEqual(minutos(15));
    expect(evaluarBloqueo(s, AHORA)).toEqual({ bloqueado: true, minutosRestantes: 15 });
  });

  it('el bloqueo termina en el instante exacto y los minutos se redondean hacia arriba', () => {
    const s = { intentosFallidos: 5, bloqueadoHasta: minutos(15) };
    expect(evaluarBloqueo(s, new Date(minutos(15).getTime() - 1))).toEqual({
      bloqueado: true,
      minutosRestantes: 1,
    });
    expect(evaluarBloqueo(s, minutos(15))).toEqual({ bloqueado: false });
  });

  it('pasado el bloqueo los intentos vuelven a empezar', () => {
    const s = { intentosFallidos: 5, bloqueadoHasta: minutos(15) };
    expect(intentosVigentes(s, minutos(16))).toBe(0);
    expect(trasIntentoFallido(s, minutos(16))).toEqual({
      intentosFallidos: 1,
      bloqueadoHasta: null,
    });
  });
});
