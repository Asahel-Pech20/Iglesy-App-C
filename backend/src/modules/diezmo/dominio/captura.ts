// Captura y corrección del diezmo (RF-60–RF-63, RN-40–RN-43). Funciones puras: el «ahora» y
// todo lo que está en la BD (si la misa ya tiene captura) llegan por parámetro.

import { aCentavos, deCentavos, parsearMonto } from './dinero';
import { SUPUESTOS_DIEZMO, type SupuestosDiezmo } from './supuestos';

export interface MisaParaDiezmo {
  /** Instante de inicio de la misa. */
  inicio: Date;
  /** ¿Ya se registró su celebración (quién la dio realmente)? */
  celebracionRegistrada: boolean;
}

export type MotivoCaptura =
  /** El monto no es válido: formato, signo, más de 2 decimales o cero no permitido (RN-44). */
  | 'MONTO_INVALIDO'
  /** La misa todavía no se celebra (RN-40). */
  | 'MISA_NO_CELEBRADA'
  /** La misa ya tiene captura: se corrige, no se captura otra vez (RN-41, RN-42). */
  | 'YA_TIENE_CAPTURA';

export type ResultadoCaptura =
  { ok: true; monto: string; centavos: number } | { ok: false; motivo: MotivoCaptura };

function esMontoValido(monto: string, supuestos: SupuestosDiezmo): number | null {
  const centavos = parsearMonto(monto);
  if (centavos === null) return null;
  if (centavos === 0 && !supuestos.permiteMontoCero) return null;
  return centavos;
}

/** RN-40: ¿ya se celebró la misa en el instante `ahora`? */
export function misaCelebrada(
  misa: MisaParaDiezmo,
  ahora: Date,
  supuestos: SupuestosDiezmo = SUPUESTOS_DIEZMO,
): boolean {
  if (supuestos.exigeRegistroDeCelebracion && !misa.celebracionRegistrada) return false;
  return misa.inicio.getTime() <= ahora.getTime();
}

/** RN-40, RN-41: ¿se puede capturar este diezmo? Si sí, devuelve el monto normalizado. */
export function evaluarCaptura(
  misa: MisaParaDiezmo,
  monto: string,
  yaTieneCaptura: boolean,
  ahora: Date,
  supuestos: SupuestosDiezmo = SUPUESTOS_DIEZMO,
): ResultadoCaptura {
  const centavos = esMontoValido(monto, supuestos);
  if (centavos === null) return { ok: false, motivo: 'MONTO_INVALIDO' };
  if (!misaCelebrada(misa, ahora, supuestos)) return { ok: false, motivo: 'MISA_NO_CELEBRADA' };
  if (yaTieneCaptura) return { ok: false, motivo: 'YA_TIENE_CAPTURA' };
  return { ok: true, monto: deCentavos(centavos), centavos };
}

/** Registro de una corrección: quién, cuándo y la cantidad anterior (RN-43). Solo se inserta. */
export interface CorreccionDiezmo {
  readonly anterior: string;
  readonly nuevo: string;
  readonly hechaPor: string;
  readonly hechaEn: Date;
}

export type ResultadoCorreccion =
  | { ok: true; correccion: CorreccionDiezmo }
  | { ok: false; motivo: 'MONTO_INVALIDO' | 'SIN_CAMBIO' };

/** RN-42, RN-43: valida una corrección y arma su registro de historial. */
export function evaluarCorreccion(
  montoActual: string,
  montoNuevo: string,
  hechaPor: string,
  ahora: Date,
  supuestos: SupuestosDiezmo = SUPUESTOS_DIEZMO,
): ResultadoCorreccion {
  if (hechaPor.trim() === '') throw new Error('Una corrección necesita saber quién la hizo.');
  const nuevo = esMontoValido(montoNuevo, supuestos);
  if (nuevo === null) return { ok: false, motivo: 'MONTO_INVALIDO' };
  const anterior = aCentavos(montoActual);
  if (supuestos.rechazaCorreccionSinCambio && nuevo === anterior) {
    return { ok: false, motivo: 'SIN_CAMBIO' };
  }
  const correccion: CorreccionDiezmo = Object.freeze({
    anterior: deCentavos(anterior),
    nuevo: deCentavos(nuevo),
    hechaPor,
    hechaEn: new Date(ahora.getTime()),
  });
  return { ok: true, correccion };
}
