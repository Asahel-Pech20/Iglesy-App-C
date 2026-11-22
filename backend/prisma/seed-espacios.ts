// Seed de espacios (E4-21, parte de espacios): tipos de espacio y 12 solicitudes repartidas en 4
// iglesias, con al menos una por cada estado del flujo. Datos FICTICIOS (personas inventadas).
// Idempotente: cada solicitud se identifica por su folio y las que ya existen no se tocan.
// Todas usan la misma clave de demostración, que NO es un secreto: ABCDE-FGHJK.
import type { ClaseEspacio, EstadoSolicitudEspacio } from '../src/generated/prisma/client';
import { prisma } from '../src/lib/prisma';
import { hashToken } from '../src/lib/seguridad';
import { normalizarClave } from '../src/modules/espacios/dominio/acceso';
import { fechaVencimiento } from '../src/modules/espacios/dominio/vigencia-cotizacion';

const DIA = 24 * 60 * 60 * 1000;
export const CLAVE_DEMOSTRACION = 'ABCDE-FGHJK';
const CLASES: ClaseEspacio[] = ['CRIPTA', 'NICHO', 'COLUMBARIO', 'OSARIO'];

type RespuestaCotizacion = 'ACEPTADA' | 'RECHAZADA' | 'VENCIDA' | null;

interface Muestra {
  folio: string;
  /** Índice de la iglesia (0 a 3) en el orden en que se crearon */
  iglesia: number;
  clase: ClaseEspacio;
  estado: EstadoSolicitudEspacio;
  nombre: string;
  telefono: string;
  /** Días desde que se recibió la solicitud */
  recibidaHace: number;
  /** Si tiene cotización: monto, días desde que se emitió y cómo respondió la persona */
  cotizacion?: { monto: string; hace: number; respuesta: RespuestaCotizacion };
}

// Un caso por estado y varios extra. La 6.ª está «Cotizada» pero su cotización venció hace días y
// nadie lo ha guardado todavía: en pantalla se ve «Vencida» (CA-29); la 10.ª ya quedó guardada.
const MUESTRAS: Muestra[] = [
  {
    folio: 'ESP-2026-900001',
    iglesia: 0,
    clase: 'CRIPTA',
    estado: 'RECIBIDA',
    nombre: 'Ana Pérez Uc',
    telefono: '9991110001',
    recibidaHace: 1,
  },
  {
    folio: 'ESP-2026-900002',
    iglesia: 1,
    clase: 'NICHO',
    estado: 'RECIBIDA',
    nombre: 'Luis Canul Poot',
    telefono: '9991110002',
    recibidaHace: 2,
  },
  {
    folio: 'ESP-2026-900003',
    iglesia: 0,
    clase: 'COLUMBARIO',
    estado: 'SIN_LUGAR',
    nombre: 'Pedro Euán Ku',
    telefono: '9991110003',
    recibidaHace: 9,
  },
  {
    folio: 'ESP-2026-900004',
    iglesia: 0,
    clase: 'NICHO',
    estado: 'COTIZADA',
    nombre: 'María Dzul Chan',
    telefono: '9991110004',
    recibidaHace: 6,
    cotizacion: { monto: '12500.50', hace: 3, respuesta: null },
  },
  {
    folio: 'ESP-2026-900005',
    iglesia: 2,
    clase: 'CRIPTA',
    estado: 'COTIZADA',
    nombre: 'Rosa May Tun',
    telefono: '9991110005',
    recibidaHace: 8,
    cotizacion: { monto: '38000.00', hace: 5, respuesta: null },
  },
  {
    folio: 'ESP-2026-900006',
    iglesia: 1,
    clase: 'NICHO',
    estado: 'COTIZADA',
    nombre: 'Jorge Cauich Dzib',
    telefono: '9991110006',
    recibidaHace: 30,
    cotizacion: { monto: '9800.00', hace: 20, respuesta: null },
  },
  {
    folio: 'ESP-2026-900007',
    iglesia: 0,
    clase: 'CRIPTA',
    estado: 'ACEPTADA',
    nombre: 'Carmen Uc Pech',
    telefono: '9991110007',
    recibidaHace: 20,
    cotizacion: { monto: '41500.00', hace: 12, respuesta: 'ACEPTADA' },
  },
  {
    folio: 'ESP-2026-900008',
    iglesia: 3,
    clase: 'OSARIO',
    estado: 'ACEPTADA',
    nombre: 'Tomás Ek Cime',
    telefono: '9991110008',
    recibidaHace: 18,
    cotizacion: { monto: '6200.00', hace: 10, respuesta: 'ACEPTADA' },
  },
  {
    folio: 'ESP-2026-900009',
    iglesia: 1,
    clase: 'NICHO',
    estado: 'RECHAZADA',
    nombre: 'Lucía Tec Balam',
    telefono: '9991110009',
    recibidaHace: 14,
    cotizacion: { monto: '15000.00', hace: 9, respuesta: 'RECHAZADA' },
  },
  {
    folio: 'ESP-2026-900010',
    iglesia: 2,
    clase: 'CRIPTA',
    estado: 'VENCIDA',
    nombre: 'Andrés Ku Mex',
    telefono: '9991110010',
    recibidaHace: 45,
    cotizacion: { monto: '36000.00', hace: 30, respuesta: 'VENCIDA' },
  },
  {
    folio: 'ESP-2026-900011',
    iglesia: 0,
    clase: 'NICHO',
    estado: 'CANCELADA',
    nombre: 'Sofía Pool Ake',
    telefono: '9991110011',
    recibidaHace: 11,
  },
  {
    folio: 'ESP-2026-900012',
    iglesia: 3,
    clase: 'COLUMBARIO',
    estado: 'CANCELADA',
    nombre: 'Daniel Chi Poot',
    telefono: '9991110012',
    recibidaHace: 16,
    cotizacion: { monto: '7400.00', hace: 7, respuesta: null },
  },
];

export async function seedEspacios() {
  const iglesias = await prisma.iglesia.findMany({
    where: { activa: true },
    orderBy: { createdAt: 'asc' },
    take: 4,
    select: { id: true },
  });
  if (iglesias.length === 0) return { iglesias: 0, tipos: 0, solicitudes: 0 };

  // Cada iglesia ofrece las cuatro clases; el columbario de la primera no tiene lugar y el osario de la tercera se dejó de ofrecer
  let tipos = 0;
  const tipoDe = new Map<string, string>();
  for (const [i, iglesia] of iglesias.entries()) {
    for (const clase of CLASES) {
      const tipo = await prisma.tipoEspacio.upsert({
        where: { iglesiaId_clase: { iglesiaId: iglesia.id, clase } },
        create: {
          iglesiaId: iglesia.id,
          clase,
          activo: !(i === 2 && clase === 'OSARIO'),
          disponible: !(clase === 'COLUMBARIO' && i === 0),
        },
        update: {},
        select: { id: true },
      });
      tipoDe.set(`${i}:${clase}`, tipo.id);
      tipos += 1;
    }
  }

  const claveHash = hashToken(normalizarClave(CLAVE_DEMOSTRACION));
  let solicitudes = 0;
  for (const m of MUESTRAS) {
    const iglesia = iglesias[m.iglesia];
    const tipoEspacioId = tipoDe.get(`${m.iglesia}:${m.clase}`);
    if (!iglesia || !tipoEspacioId) continue;
    if (
      await prisma.solicitudEspacio.findUnique({ where: { folio: m.folio }, select: { id: true } })
    ) {
      continue;
    }
    const creada = await prisma.solicitudEspacio.create({
      data: {
        folio: m.folio,
        claveHash,
        iglesiaId: iglesia.id,
        tipoEspacioId,
        contactoNombre: m.nombre,
        contactoTelefono: m.telefono,
        estado: m.estado,
        createdAt: new Date(Date.now() - m.recibidaHace * DIA),
      },
      select: { id: true },
    });
    if (m.cotizacion) {
      const emitidaEn = new Date(Date.now() - m.cotizacion.hace * DIA);
      await prisma.cotizacion.create({
        data: {
          solicitudId: creada.id,
          monto: m.cotizacion.monto,
          condiciones: 'Anticipo del 50 % y el resto al entregar el espacio.',
          emitidaEn,
          venceEn: fechaVencimiento(emitidaEn),
          respuesta: m.cotizacion.respuesta,
          respondidaEn:
            m.cotizacion.respuesta === 'VENCIDA'
              ? fechaVencimiento(emitidaEn)
              : m.cotizacion.respuesta
                ? new Date(emitidaEn.getTime() + 2 * DIA)
                : null,
        },
      });
    }
    solicitudes += 1;
  }
  return { iglesias: iglesias.length, tipos, solicitudes };
}
