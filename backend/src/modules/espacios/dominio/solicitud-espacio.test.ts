import { describe, expect, it } from 'vitest';
import {
  ESTADO_INICIAL,
  QUIEN_PROVOCA,
  estadoEfectivo,
  evaluarTransicion,
  puedeProvocar,
} from './solicitud-espacio';
import { SUPUESTOS } from './supuestos';
import type { Accion, Actor, EstadoSolicitud, SolicitudDominio } from './tipos';

const DIA = 24 * 60 * 60 * 1000;
// El «ahora» de todas las pruebas es un instante fijo: nunca se lee el reloj real.
const AHORA = new Date('2026-11-10T15:00:00.000Z');
const haceMs = (ms: number) => new Date(AHORA.getTime() - ms);

/** Solicitud en un estado; las que tienen cotización la emitieron `haceMs` antes del «ahora». */
const solicitud = (
  estado: EstadoSolicitud,
  cotizadaHaceMs: number | null = null,
): SolicitudDominio => ({
  estado,
  cotizacion: cotizadaHaceMs === null ? null : { emitidaEn: haceMs(cotizadaHaceMs) },
});
const vigente = solicitud('COTIZADA', 5 * DIA);

const ESTADOS: EstadoSolicitud[] = [
  'RECIBIDA',
  'SIN_LUGAR',
  'COTIZADA',
  'ACEPTADA',
  'RECHAZADA',
  'VENCIDA',
  'CANCELADA',
];
const ACCIONES: Accion[] = [
  'COTIZAR',
  'MARCAR_SIN_LUGAR',
  'ACEPTAR',
  'RECHAZAR',
  'VENCER',
  'CANCELAR',
];
const ACTORES: Actor[] = ['SOLICITANTE', 'ADMINISTRADOR', 'SISTEMA'];

// Sección 7, escrita aparte de la tabla de producción para que la prueba no sea una tautología.
const ACTOR_DE: Record<Accion, Actor> = {
  COTIZAR: 'ADMINISTRADOR',
  MARCAR_SIN_LUGAR: 'ADMINISTRADOR',
  ACEPTAR: 'SOLICITANTE',
  RECHAZAR: 'SOLICITANTE',
  CANCELAR: 'SOLICITANTE',
  VENCER: 'SISTEMA',
};

describe('transiciones válidas (sección 7)', () => {
  const casos: [string, SolicitudDominio, Accion, EstadoSolicitud][] = [
    ['Recibida → Cotizada: el administrador cotiza', solicitud('RECIBIDA'), 'COTIZAR', 'COTIZADA'],
    [
      'Recibida → Sin lugar: el administrador avisa que no hay lugar',
      solicitud('RECIBIDA'),
      'MARCAR_SIN_LUGAR',
      'SIN_LUGAR',
    ],
    ['Cotizada → Aceptada: la persona acepta el precio', vigente, 'ACEPTAR', 'ACEPTADA'],
    ['Cotizada → Rechazada: la persona rechaza el precio', vigente, 'RECHAZAR', 'RECHAZADA'],
    [
      'Cotizada → Vencida: el sistema vence la cotización pasados los 15 días',
      solicitud('COTIZADA', 16 * DIA),
      'VENCER',
      'VENCIDA',
    ],
    ['Recibida → Cancelada: la persona cancela', solicitud('RECIBIDA'), 'CANCELAR', 'CANCELADA'],
    ['Cotizada → Cancelada: la persona cancela antes de aceptar', vigente, 'CANCELAR', 'CANCELADA'],
  ];

  it.each(casos)('%s', (_nombre, origen, accion, esperado) => {
    expect(evaluarTransicion(origen, accion, ACTOR_DE[accion], AHORA)).toEqual({
      ok: true,
      estadoNuevo: esperado,
    });
  });

  it('una solicitud nueva nace Recibida', () => {
    expect(ESTADO_INICIAL).toBe('RECIBIDA');
  });
});

describe('transiciones prohibidas (sección 7, RN-52)', () => {
  // Pares (estado, acción) que sí existen; todo lo demás está prohibido.
  const validas = new Set([
    'RECIBIDA/COTIZAR',
    'RECIBIDA/MARCAR_SIN_LUGAR',
    'RECIBIDA/CANCELAR',
    'COTIZADA/ACEPTAR',
    'COTIZADA/RECHAZAR',
    'COTIZADA/CANCELAR',
    'COTIZADA/VENCER', // solo con la cotización vencida; con una vigente se rechaza por otro motivo
  ]);
  const prohibidas = ESTADOS.flatMap((estado) =>
    ACCIONES.filter((accion) => !validas.has(`${estado}/${accion}`)).map(
      (accion) => [estado, accion] as const,
    ),
  );

  /** Una solicitud de ese estado, con cotización cuando el estado la implica. */
  const enEstado = (estado: EstadoSolicitud): SolicitudDominio =>
    estado === 'COTIZADA'
      ? vigente
      : ['ACEPTADA', 'RECHAZADA', 'VENCIDA'].includes(estado)
        ? solicitud(estado, 5 * DIA)
        : solicitud(estado);

  it.each(prohibidas)('%s no admite %s', (estado, accion) => {
    const resultado = evaluarTransicion(enEstado(estado), accion, ACTOR_DE[accion], AHORA);
    expect(resultado.ok).toBe(false);
    if (!resultado.ok) {
      expect(['TRANSICION_NO_PERMITIDA', 'COTIZACION_VENCIDA']).toContain(resultado.motivo);
    }
  });

  it('RN-52: una solicitud aceptada ya no se cancela', () => {
    expect(
      evaluarTransicion(solicitud('ACEPTADA', 5 * DIA), 'CANCELAR', 'SOLICITANTE', AHORA),
    ).toEqual({
      ok: false,
      motivo: 'TRANSICION_NO_PERMITIDA',
    });
  });

  it('de los estados finales no sale ninguna acción', () => {
    for (const estado of ['SIN_LUGAR', 'ACEPTADA', 'RECHAZADA', 'VENCIDA', 'CANCELADA'] as const) {
      for (const accion of ACCIONES) {
        expect(evaluarTransicion(enEstado(estado), accion, ACTOR_DE[accion], AHORA).ok).toBe(false);
      }
    }
  });

  it('no se cotiza dos veces ni se acepta una solicitud que nadie ha cotizado', () => {
    expect(evaluarTransicion(vigente, 'COTIZAR', 'ADMINISTRADOR', AHORA)).toEqual({
      ok: false,
      motivo: 'TRANSICION_NO_PERMITIDA',
    });
    expect(evaluarTransicion(solicitud('RECIBIDA'), 'ACEPTAR', 'SOLICITANTE', AHORA)).toEqual({
      ok: false,
      motivo: 'TRANSICION_NO_PERMITIDA',
    });
  });

  it('el vencimiento no se puede forzar antes de tiempo', () => {
    expect(evaluarTransicion(vigente, 'VENCER', 'SISTEMA', AHORA)).toEqual({
      ok: false,
      motivo: 'COTIZACION_VIGENTE',
    });
    expect(evaluarTransicion(solicitud('RECIBIDA'), 'VENCER', 'SISTEMA', AHORA)).toEqual({
      ok: false,
      motivo: 'TRANSICION_NO_PERMITIDA',
    });
  });
});

describe('quién provoca cada cambio (sección 7)', () => {
  it('cada acción la provoca únicamente su actor', () => {
    for (const accion of ACCIONES) {
      for (const actor of ACTORES) {
        expect(puedeProvocar(accion, actor)).toBe(ACTOR_DE[accion] === actor);
      }
    }
    expect(QUIEN_PROVOCA).toEqual(ACTOR_DE);
  });

  it('un actor que no corresponde se rechaza aunque el estado sea el correcto', () => {
    // La persona no cotiza; el administrador no acepta ni cancela por ella; nadie vence a mano.
    expect(evaluarTransicion(solicitud('RECIBIDA'), 'COTIZAR', 'SOLICITANTE', AHORA)).toEqual({
      ok: false,
      motivo: 'ACTOR_NO_AUTORIZADO',
    });
    expect(evaluarTransicion(vigente, 'ACEPTAR', 'ADMINISTRADOR', AHORA)).toEqual({
      ok: false,
      motivo: 'ACTOR_NO_AUTORIZADO',
    });
    expect(evaluarTransicion(vigente, 'CANCELAR', 'ADMINISTRADOR', AHORA)).toEqual({
      ok: false,
      motivo: 'ACTOR_NO_AUTORIZADO',
    });
    expect(
      evaluarTransicion(solicitud('COTIZADA', 16 * DIA), 'VENCER', 'ADMINISTRADOR', AHORA),
    ).toEqual({ ok: false, motivo: 'ACTOR_NO_AUTORIZADO' });
  });
});

describe('estado efectivo', () => {
  it('una cotizada con la cotización vencida cuenta como Vencida aunque nadie la haya actualizado', () => {
    expect(estadoEfectivo(solicitud('COTIZADA', 16 * DIA), AHORA)).toBe('VENCIDA');
    expect(estadoEfectivo(solicitud('COTIZADA', 15 * DIA), AHORA)).toBe('VENCIDA');
  });

  it('una cotizada con la cotización vigente sigue Cotizada', () => {
    expect(estadoEfectivo(solicitud('COTIZADA', 15 * DIA - 1), AHORA)).toBe('COTIZADA');
    expect(estadoEfectivo(vigente, AHORA)).toBe('COTIZADA');
  });

  it('una aceptada antes del vencimiento sigue Aceptada aunque su cotización sea vieja', () => {
    expect(estadoEfectivo(solicitud('ACEPTADA', 40 * DIA), AHORA)).toBe('ACEPTADA');
  });

  it('los demás estados no cambian con el tiempo', () => {
    for (const estado of ['RECIBIDA', 'SIN_LUGAR', 'RECHAZADA', 'VENCIDA', 'CANCELADA'] as const) {
      expect(estadoEfectivo(solicitud(estado), AHORA)).toBe(estado);
    }
  });

  it('una cotizada sin cotización es un dato incoherente y falla', () => {
    expect(() => estadoEfectivo(solicitud('COTIZADA'), AHORA)).toThrow('necesita su cotización');
  });
});

describe('CA-27: no hay lugar', () => {
  it('Dado una solicitud Recibida, Cuando el administrador avisa que no hay lugar, Entonces queda Sin lugar y ya no se acepta ni se cotiza', () => {
    const recibida = solicitud('RECIBIDA');
    const resultado = evaluarTransicion(recibida, 'MARCAR_SIN_LUGAR', 'ADMINISTRADOR', AHORA);
    expect(resultado).toEqual({ ok: true, estadoNuevo: 'SIN_LUGAR' });

    const sinLugar = solicitud('SIN_LUGAR');
    expect(evaluarTransicion(sinLugar, 'ACEPTAR', 'SOLICITANTE', AHORA).ok).toBe(false);
    expect(evaluarTransicion(sinLugar, 'COTIZAR', 'ADMINISTRADOR', AHORA).ok).toBe(false);
  });
});

describe('CA-28: cotización aceptada', () => {
  it('Dado una solicitud Recibida, Cuando el administrador cotiza y la persona acepta a los 5 días, Entonces queda Aceptada y ya no se cancela', () => {
    const emision = new Date('2026-11-01T10:00:00.000Z');
    const cotizar = evaluarTransicion(solicitud('RECIBIDA'), 'COTIZAR', 'ADMINISTRADOR', emision);
    expect(cotizar).toEqual({ ok: true, estadoNuevo: 'COTIZADA' });

    const cotizada: SolicitudDominio = { estado: 'COTIZADA', cotizacion: { emitidaEn: emision } };
    const alQuintoDia = new Date(emision.getTime() + 5 * DIA);
    expect(evaluarTransicion(cotizada, 'ACEPTAR', 'SOLICITANTE', alQuintoDia)).toEqual({
      ok: true,
      estadoNuevo: 'ACEPTADA',
    });

    const aceptada: SolicitudDominio = { estado: 'ACEPTADA', cotizacion: { emitidaEn: emision } };
    expect(evaluarTransicion(aceptada, 'CANCELAR', 'SOLICITANTE', alQuintoDia)).toEqual({
      ok: false,
      motivo: 'TRANSICION_NO_PERMITIDA',
    });
  });
});

describe('CA-29: vencimiento y cancelación', () => {
  it('Dado una cotización emitida hace 15 días sin respuesta, Cuando pasan los 15 días, Entonces queda Vencida por el sistema y no se puede aceptar', () => {
    const vencida = solicitud('COTIZADA', 15 * DIA);
    expect(estadoEfectivo(vencida, AHORA)).toBe('VENCIDA');
    expect(evaluarTransicion(vencida, 'ACEPTAR', 'SOLICITANTE', AHORA)).toEqual({
      ok: false,
      motivo: 'COTIZACION_VENCIDA',
    });
    expect(evaluarTransicion(vencida, 'RECHAZAR', 'SOLICITANTE', AHORA)).toEqual({
      ok: false,
      motivo: 'COTIZACION_VENCIDA',
    });
    expect(evaluarTransicion(vencida, 'VENCER', 'SISTEMA', AHORA)).toEqual({
      ok: true,
      estadoNuevo: 'VENCIDA',
    });
    // Ya guardada como Vencida, tampoco se acepta
    expect(
      evaluarTransicion(solicitud('VENCIDA', 15 * DIA), 'ACEPTAR', 'SOLICITANTE', AHORA),
    ).toEqual({
      ok: false,
      motivo: 'COTIZACION_VENCIDA',
    });
  });

  it('el límite de los 15 días: un milisegundo antes se acepta, en el instante exacto ya no', () => {
    const unMsAntes = solicitud('COTIZADA', 15 * DIA - 1);
    expect(evaluarTransicion(unMsAntes, 'ACEPTAR', 'SOLICITANTE', AHORA)).toEqual({
      ok: true,
      estadoNuevo: 'ACEPTADA',
    });
    expect(evaluarTransicion(unMsAntes, 'VENCER', 'SISTEMA', AHORA)).toEqual({
      ok: false,
      motivo: 'COTIZACION_VIGENTE',
    });

    const justo = solicitud('COTIZADA', 15 * DIA);
    expect(evaluarTransicion(justo, 'ACEPTAR', 'SOLICITANTE', AHORA).ok).toBe(false);
    expect(evaluarTransicion(justo, 'VENCER', 'SISTEMA', AHORA).ok).toBe(true);
  });

  it('Dado una cotización vigente, Cuando la persona cancela antes de aceptar, Entonces queda Cancelada', () => {
    expect(evaluarTransicion(vigente, 'CANCELAR', 'SOLICITANTE', AHORA)).toEqual({
      ok: true,
      estadoNuevo: 'CANCELADA',
    });
  });

  it('una cotización vencida sin actualizar ya no se cancela (supuesto P-26/P-27)', () => {
    expect(
      evaluarTransicion(solicitud('COTIZADA', 20 * DIA), 'CANCELAR', 'SOLICITANTE', AHORA),
    ).toEqual({ ok: false, motivo: 'TRANSICION_NO_PERMITIDA' });
  });
});

describe('supuestos P-26 y P-27: se cambian en un solo lugar', () => {
  it('si el cliente permite cotizar de nuevo, basta ampliar estadosDesdeLosQueSeCotiza', () => {
    const permisivo = {
      ...SUPUESTOS,
      estadosDesdeLosQueSeCotiza: ['RECIBIDA', 'SIN_LUGAR', 'RECHAZADA', 'VENCIDA'],
    } as const;
    for (const estado of ['SIN_LUGAR', 'RECHAZADA', 'VENCIDA'] as const) {
      expect(
        evaluarTransicion(solicitud(estado), 'COTIZAR', 'ADMINISTRADOR', AHORA, permisivo),
      ).toEqual({
        ok: true,
        estadoNuevo: 'COTIZADA',
      });
    }
    // Con los supuestos de hoy sigue prohibido
    expect(evaluarTransicion(solicitud('RECHAZADA'), 'COTIZAR', 'ADMINISTRADOR', AHORA).ok).toBe(
      false,
    );
  });

  it('si el cliente permite cancelar una vencida, basta ampliar estadosCancelables', () => {
    const permisivo = {
      ...SUPUESTOS,
      estadosCancelables: ['RECIBIDA', 'COTIZADA', 'VENCIDA'],
    } as const;
    expect(
      evaluarTransicion(
        solicitud('COTIZADA', 20 * DIA),
        'CANCELAR',
        'SOLICITANTE',
        AHORA,
        permisivo,
      ),
    ).toEqual({ ok: true, estadoNuevo: 'CANCELADA' });
  });
});
