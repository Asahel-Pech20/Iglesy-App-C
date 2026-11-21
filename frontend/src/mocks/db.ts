import type { ConfiguracionIglesia, HorarioReunion } from '@/app/tipos/configuracion';
import type { Miembro } from '@/app/tipos/miembros';
import type { Usuario } from '@/app/tipos/usuarios';
import { configuracionInicial, horariosIniciales, usuariosIniciales } from './datos/b1';
import {
  type CoordinacionMock,
  coordinacionesIniciales,
  type MinisterioMock,
  miembrosIniciales,
  ministeriosIniciales,
  type VinculoMock,
  vinculosIniciales,
} from './datos/b2';
import {
  type AnuncioMock,
  anunciosIniciales,
  type AsistenciaMock,
  asistenciasIniciales,
  type EventoMock,
  eventosIniciales,
  type ResponsableMock,
  responsablesIniciales,
} from './datos/b3';
import { type DonacionMock, donacionesIniciales } from './datos/b4';
import {
  type CorreccionMock,
  correccionesIniciales,
  type DiezmoMock,
  diezmosIniciales,
  iglesiasIniciales,
  type MisaMock,
  misasIniciales,
  padresIniciales,
} from './datos/diezmo';
import type { Padre } from '@/app/tipos/diezmo';
import type { Iglesia, LugarInegi } from '@/app/tipos/iglesias';
import type { VersionCriterios } from '@/app/tipos/patrimonio';
import {
  conDatosDeFicha,
  criteriosIniciales,
  estadosIniciales,
  iglesiasPatrimonioIniciales,
  type LocalidadMock,
  localidadesIniciales,
  type MunicipioMock,
  municipiosIniciales,
  type ObjetoMock,
  objetosIniciales,
} from './datos/patrimonio';

/** Iglesias de Oscar (diezmo) con los datos de ficha de E2-06 y las de las consultas públicas. */
const todasLasIglesias = () => [
  ...conDatosDeFicha(iglesiasIniciales()),
  ...iglesiasPatrimonioIniciales(),
];

// "Base de datos" en memoria de los mocks. Cada dueño agrega aquí sus colecciones (B2–B4).
export const db = {
  usuarios: usuariosIniciales(),
  configuracion: configuracionInicial(),
  horarios: horariosIniciales(),
  /** Tokens de restablecimiento válidos → id de usuario */
  tokensReset: new Map<string, string>([['token-valido', 'u-pastor']]),
  // F2: miembros, ministerios y sus relaciones
  miembros: miembrosIniciales(),
  ministerios: ministeriosIniciales(),
  vinculos: vinculosIniciales(),
  coordinaciones: coordinacionesIniciales(),
  // F3: eventos, responsables, asistencia y anuncios
  eventos: eventosIniciales(),
  responsables: responsablesIniciales(),
  asistencias: asistenciasIniciales(),
  anuncios: anunciosIniciales(),
  // F4: donaciones
  donaciones: donacionesIniciales(),
  // Ecclesia: diezmo de las misas
  iglesias: todasLasIglesias(),
  padres: padresIniciales(),
  misas: misasIniciales(),
  diezmos: diezmosIniciales(),
  correcciones: correccionesIniciales(),
  // E2 (Nataly): catálogo del INEGI, objetos del patrimonio y criterios del índice
  estadosInegi: estadosIniciales(),
  municipiosInegi: municipiosIniciales(),
  localidadesInegi: localidadesIniciales(),
  objetos: objetosIniciales(),
  criterios: criteriosIniciales(),
} satisfies {
  usuarios: Usuario[];
  configuracion: ConfiguracionIglesia;
  horarios: HorarioReunion[];
  tokensReset: Map<string, string>;
  miembros: Miembro[];
  ministerios: MinisterioMock[];
  vinculos: VinculoMock[];
  coordinaciones: CoordinacionMock[];
  eventos: EventoMock[];
  responsables: ResponsableMock[];
  asistencias: AsistenciaMock[];
  anuncios: AnuncioMock[];
  donaciones: DonacionMock[];
  iglesias: Iglesia[];
  estadosInegi: LugarInegi[];
  municipiosInegi: MunicipioMock[];
  localidadesInegi: LocalidadMock[];
  objetos: ObjetoMock[];
  criterios: VersionCriterios[];
  padres: Padre[];
  misas: MisaMock[];
  diezmos: DiezmoMock[];
  correcciones: CorreccionMock[];
};

/** Restaura los datos iniciales (se llama entre pruebas). */
export function reiniciarDb() {
  db.usuarios = usuariosIniciales();
  db.configuracion = configuracionInicial();
  db.horarios = horariosIniciales();
  db.tokensReset = new Map([['token-valido', 'u-pastor']]);
  db.miembros = miembrosIniciales();
  db.ministerios = ministeriosIniciales();
  db.vinculos = vinculosIniciales();
  db.coordinaciones = coordinacionesIniciales();
  db.eventos = eventosIniciales();
  db.responsables = responsablesIniciales();
  db.asistencias = asistenciasIniciales();
  db.anuncios = anunciosIniciales();
  db.donaciones = donacionesIniciales();
  db.iglesias = todasLasIglesias();
  db.padres = padresIniciales();
  db.misas = misasIniciales();
  db.diezmos = diezmosIniciales();
  db.correcciones = correccionesIniciales();
  db.estadosInegi = estadosIniciales();
  db.municipiosInegi = municipiosIniciales();
  db.localidadesInegi = localidadesIniciales();
  db.objetos = objetosIniciales();
  db.criterios = criteriosIniciales();
  sesionMock.cerrar();
}
// Sesión simulada: en el navegador sobrevive a recargas (como la cookie de refresh real)
const CLAVE_SESION = 'msw:sesion';
let sesionEnMemoria: string | null = null;

export const sesionMock = {
  obtener(): string | null {
    try {
      return sessionStorage.getItem(CLAVE_SESION) ?? sesionEnMemoria;
    } catch {
      return sesionEnMemoria;
    }
  },
  abrir(usuarioId: string) {
    sesionEnMemoria = usuarioId;
    try {
      sessionStorage.setItem(CLAVE_SESION, usuarioId);
    } catch {
      // sin almacenamiento
    }
  },
  cerrar() {
    sesionEnMemoria = null;
    try {
      sessionStorage.removeItem(CLAVE_SESION);
    } catch {
      // sin almacenamiento
    }
  },
};
