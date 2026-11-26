// OSC-08: genera la colección de Postman (v2.1) y el entorno local a partir de backend/openapi.yaml.
// Uso: `pnpm --filter backend postman`. Es determinista: sin fechas, UUID aleatorios ni orden variable,
// así que correrlo dos veces sin cambiar openapi.yaml no cambia los archivos.
// El «Recorrido de la demo» NO sale del YAML: se escribe a mano aquí abajo.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { format, resolveConfig } from 'prettier';
import { parse } from 'yaml';

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = resolve(AQUI, '../..');
export const RUTA_OPENAPI = resolve(RAIZ, 'backend/openapi.yaml');
export const DIR_SALIDA = resolve(RAIZ, 'docs/postman');
export const ARCHIVO_COLECCION = 'ecclesia.postman_collection.json';
export const ARCHIVO_ENTORNO = 'local.postman_environment.json';

const ESQUEMA_COLECCION = 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json';
const METODOS = ['get', 'post', 'put', 'patch', 'delete'] as const;

/** Contraseña de los usuarios del seed de desarrollo (`SEED_PASSWORD` de backend/.env.example). */
const PASSWORD_PRUEBA = 'Iglesia123';

/** Un usuario del seed por rol (backend/prisma/seed.ts: `<rol>@iglesia.local`, admin@ es ADMIN_IGLESIA). */
export const LOGINS = [
  { rol: 'COORDINACION', email: 'coordinacion@iglesia.local' },
  { rol: 'ADMIN_IGLESIA', email: 'admin@iglesia.local' },
  { rol: 'PASTOR', email: 'pastor@iglesia.local' },
  { rol: 'SECRETARIO', email: 'secretario@iglesia.local' },
  { rol: 'TESORERO', email: 'tesorero@iglesia.local' },
  { rol: 'COORDINADOR', email: 'coordinador@iglesia.local' },
] as const;

// ---------------------------------------------------------------- tipos del OpenAPI (lo mínimo)

type Json = null | boolean | number | string | Json[] | { [clave: string]: Json };

interface Esquema {
  $ref?: string;
  type?: string;
  format?: string;
  enum?: Json[];
  example?: Json;
  default?: Json;
  minimum?: number;
  items?: Esquema;
  properties?: Record<string, Esquema>;
  allOf?: Esquema[];
  oneOf?: Esquema[];
  anyOf?: Esquema[];
}

interface Parametro {
  $ref?: string;
  name?: string;
  in?: string;
  required?: boolean;
  description?: string;
  schema?: Esquema;
}

interface Operacion {
  tags?: string[];
  summary?: string;
  description?: string;
  security?: unknown[];
  parameters?: Parametro[];
  requestBody?: { content?: Record<string, { schema?: Esquema }> };
}

export interface DocOpenApi {
  tags?: { name: string }[];
  paths: Record<string, Record<string, unknown>>;
  components?: { parameters?: Record<string, Parametro>; schemas?: Record<string, Esquema> };
}

// ---------------------------------------------------------------- tipos de Postman (lo mínimo)

interface Evento {
  listen: 'test' | 'prerequest';
  script: { type: 'text/javascript'; exec: string[] };
}

export interface ItemPeticion {
  name: string;
  event?: Evento[];
  request: {
    method: string;
    header: { key: string; value: string }[];
    auth?: { type: 'noauth' };
    url: {
      raw: string;
      host: string[];
      path: string[];
      query?: { key: string; value: string; disabled?: boolean; description?: string }[];
      variable?: { key: string; value: string; description?: string }[];
    };
    body?: Json;
    description?: string;
  };
  response: never[];
}

export interface Carpeta {
  name: string;
  description?: string;
  item: (Carpeta | ItemPeticion)[];
}

export interface Coleccion {
  info: { name: string; description: string; schema: string };
  auth: Json;
  variable: never[];
  item: (Carpeta | ItemPeticion)[];
}

// ---------------------------------------------------------------- resolver $ref y armar ejemplos

class Resolvedor {
  constructor(private readonly doc: DocOpenApi) {}

  private buscar(ref: string): unknown {
    const partes = ref.replace(/^#\//, '').split('/');
    let actual: unknown = this.doc;
    for (const parte of partes) {
      actual = (actual as Record<string, unknown> | undefined)?.[parte];
    }
    return actual;
  }

  esquema(e: Esquema | undefined): Esquema {
    if (!e) return {};
    return e.$ref ? this.esquema(this.buscar(e.$ref) as Esquema) : e;
  }

  parametro(p: Parametro): Parametro {
    return p.$ref ? (this.buscar(p.$ref) as Parametro) : p;
  }

  /** Cuerpo de ejemplo: `example`, `default`, primer `enum` o un valor por tipo. Sin azar. */
  ejemplo(esquema: Esquema | undefined, nombre = '', profundidad = 0): Json {
    const e = this.esquema(esquema);
    if (profundidad > 6) return null;
    if (e.example !== undefined) return e.example;
    if (e.default !== undefined) return e.default;
    if (e.enum?.length) return e.enum[0] ?? null;
    if (e.allOf?.length) {
      const partes = e.allOf.map((p) => this.ejemplo(p, nombre, profundidad + 1));
      return partes.reduce<Json>(
        (acc, p) =>
          acc && p && typeof acc === 'object' && typeof p === 'object' && !Array.isArray(p)
            ? { ...(acc as object), ...(p as object) }
            : p,
        {},
      );
    }
    const alternativa = e.oneOf?.[0] ?? e.anyOf?.[0];
    if (alternativa) return this.ejemplo(alternativa, nombre, profundidad + 1);
    if (e.type === 'object' || e.properties) {
      const salida: Record<string, Json> = {};
      for (const [campo, sub] of Object.entries(e.properties ?? {})) {
        salida[campo] = campo === 'clave' ? '{{clave}}' : this.ejemplo(sub, campo, profundidad + 1);
      }
      return salida;
    }
    if (e.type === 'array') return [this.ejemplo(e.items, nombre, profundidad + 1)];
    if (e.type === 'integer' || e.type === 'number') return e.minimum ?? 1;
    if (e.type === 'boolean') return false;
    switch (e.format) {
      case 'uuid':
        return '00000000-0000-4000-8000-000000000000';
      case 'date':
        return '2026-01-15';
      case 'date-time':
        return '2026-01-15T12:00:00.000Z';
      case 'email':
        return 'persona@ejemplo.test';
      case 'password':
        return '{{passwordPrueba}}';
      default:
        return 'texto';
    }
  }
}

// El folio y la clave de una solicitud de espacio salen de variables del entorno.
const VARIABLES_DE_RUTA: Record<string, string> = {
  iglesiaId: '{{iglesiaId}}',
  folio: '{{folio}}',
};

function enMayusculas(texto: string) {
  return texto.toUpperCase();
}

function peticionDeOperacion(
  r: Resolvedor,
  metodo: string,
  ruta: string,
  op: Operacion,
  paramsDeRuta: Parametro[],
): ItemPeticion {
  const parametros = [...paramsDeRuta, ...(op.parameters ?? [])].map((p) => r.parametro(p));
  const segmentos = ruta
    .split('/')
    .filter(Boolean)
    .map((s) => s.replace(/^\{(.+)\}$/, ':$1'));

  const variables = parametros
    .filter((p) => p.in === 'path')
    .map((p) => ({
      key: p.name ?? '',
      value: VARIABLES_DE_RUTA[p.name ?? ''] ?? '',
      ...(p.description ? { description: p.description } : {}),
    }));

  const consultas = parametros
    .filter((p) => p.in === 'query')
    .map((p) => {
      const valor = r.ejemplo(p.schema, p.name);
      return {
        key: p.name ?? '',
        value: valor === null ? '' : String(valor),
        ...(p.required ? {} : { disabled: true }),
        ...(p.description ? { description: p.description } : {}),
      };
    });

  const raw = `{{baseUrl}}/${segmentos.join('/')}`;
  const contenido = op.requestBody?.content ?? {};
  const header: { key: string; value: string }[] = [];
  let body: Json | undefined;
  if (contenido['application/json']) {
    header.push({ key: 'Content-Type', value: 'application/json' });
    body = {
      mode: 'raw',
      raw: JSON.stringify(r.ejemplo(contenido['application/json'].schema), null, 2),
      options: { raw: { language: 'json' } },
    };
  } else if (contenido['multipart/form-data']) {
    const esquema = r.esquema(contenido['multipart/form-data'].schema);
    body = {
      mode: 'formdata',
      formdata: Object.entries(esquema.properties ?? {}).map(([clave, sub]): Json =>
        r.esquema(sub).format === 'binary'
          ? { key: clave, type: 'file', src: [] as Json[] }
          : { key: clave, type: 'text', value: '' },
      ),
    };
  }

  const descripcion = [`\`${enMayusculas(metodo)} ${ruta}\``, op.summary, op.description]
    .filter(Boolean)
    .join('\n\n');

  return {
    name: op.summary ? `${enMayusculas(metodo)} ${op.summary}` : `${enMayusculas(metodo)} ${ruta}`,
    request: {
      method: enMayusculas(metodo),
      header,
      // `security: []` en openapi.yaml = ruta pública: no manda el Bearer de la colección
      ...(Array.isArray(op.security) && op.security.length === 0
        ? { auth: { type: 'noauth' as const } }
        : {}),
      url: {
        raw,
        host: ['{{baseUrl}}'],
        path: segmentos,
        ...(consultas.length ? { query: consultas } : {}),
        ...(variables.length ? { variable: variables } : {}),
      },
      ...(body !== undefined ? { body } : {}),
      description: descripcion,
    },
    response: [],
  };
}

// ---------------------------------------------------------------- carpetas por integrante

const GESTION_INTERNA = 'Gestión interna';
const SIN_DUENIO = 'Sin dueño asignado';

/** Carpetas de la colección, en orden (dueños: specs.md §9 y §12.6). */
const CARPETAS: Record<string, string> = {
  Santiago: 'Infraestructura, autenticación, usuarios y configuración (B1/F1).',
  Nataly: 'Iglesias, catálogos, patrimonio, criterios del índice y sus consultas públicas.',
  Genaro:
    'Padres, horario de misas, misas celebradas, agenda, servicios, pláticas y sus consultas públicas.',
  Oscar: 'Donaciones, dashboard, reportes, diezmo, espacios y sus consultas públicas.',
  [GESTION_INTERNA]:
    'Módulos heredados de AppIglesia. El dueño está en la descripción de cada grupo.',
  [SIN_DUENIO]:
    'Rutas con una etiqueta que el generador aún no conoce: asígnale dueño en backend/scripts/generar-postman.ts.',
};

/** Etiqueta de openapi.yaml → carpeta. */
const CARPETA_DE_ETIQUETA: Record<string, string> = {
  Sistema: 'Santiago',
  Auth: 'Santiago',
  Usuarios: 'Santiago',
  Configuración: 'Santiago',
  Iglesias: 'Nataly',
  Catálogos: 'Nataly',
  Patrimonio: 'Nataly',
  Misas: 'Genaro',
  Servicios: 'Genaro',
  Donaciones: 'Oscar',
  Dashboard: 'Oscar',
  Reportes: 'Oscar',
  Diezmo: 'Oscar',
  Espacios: 'Oscar',
  Miembros: GESTION_INTERNA,
  Ministerios: GESTION_INTERNA,
  Eventos: GESTION_INTERNA,
  Asistencia: GESTION_INTERNA,
  Anuncios: GESTION_INTERNA,
};

/** Dueño de cada grupo de «Gestión interna». */
const DUENIO_DE_GRUPO: Record<string, string> = {
  Miembros: 'Nataly',
  Ministerios: 'Nataly',
  Eventos: 'Genaro',
  Asistencia: 'Genaro',
  Anuncios: 'Genaro',
  Cartelera: 'Genaro',
};

/** La etiqueta «Público» mezcla dueños, así que se reparte por la ruta. */
export function ubicacion(etiqueta: string, ruta: string): { carpeta: string; grupo: string } {
  if (etiqueta === 'Público') {
    if (ruta.endsWith('/cartelera')) return { carpeta: GESTION_INTERNA, grupo: 'Cartelera' };
    if (ruta.includes('platicas')) return { carpeta: 'Genaro', grupo: 'Pláticas (público)' };
    return { carpeta: SIN_DUENIO, grupo: etiqueta };
  }
  return { carpeta: CARPETA_DE_ETIQUETA[etiqueta] ?? SIN_DUENIO, grupo: etiqueta };
}

/** Un request por cada operación del YAML: carpeta del integrante y, dentro, un grupo por etiqueta. */
export function carpetasDelOpenApi(doc: DocOpenApi): Carpeta[] {
  const r = new Resolvedor(doc);
  const porEtiqueta = new Map<string, { ruta: string; item: ItemPeticion }[]>();
  for (const etiqueta of doc.tags ?? []) porEtiqueta.set(etiqueta.name, []);

  for (const [ruta, definicion] of Object.entries(doc.paths)) {
    const paramsDeRuta = (definicion.parameters as Parametro[] | undefined) ?? [];
    for (const metodo of METODOS) {
      const op = definicion[metodo] as Operacion | undefined;
      if (!op) continue;
      const etiqueta = op.tags?.[0] ?? 'Sistema';
      const lista = porEtiqueta.get(etiqueta) ?? [];
      lista.push({ ruta, item: peticionDeOperacion(r, metodo, ruta, op, paramsDeRuta) });
      porEtiqueta.set(etiqueta, lista);
    }
  }

  const arbol = new Map<string, Map<string, ItemPeticion[]>>(
    Object.keys(CARPETAS).map((nombre) => [nombre, new Map()]),
  );
  for (const [etiqueta, peticiones] of porEtiqueta) {
    for (const { ruta, item } of peticiones) {
      const { carpeta, grupo } = ubicacion(etiqueta, ruta);
      const grupos = arbol.get(carpeta)!;
      grupos.set(grupo, [...(grupos.get(grupo) ?? []), item]);
    }
  }

  return [...arbol.entries()]
    .filter(([, grupos]) => grupos.size > 0)
    .map(([name, grupos]) => ({
      name,
      description: CARPETAS[name]!,
      item: [...grupos.entries()].map(([grupo, item]) => ({
        name: grupo,
        ...(name === GESTION_INTERNA ? { description: `Dueño: ${DUENIO_DE_GRUPO[grupo]}.` } : {}),
        item,
      })),
    }));
}

// ---------------------------------------------------------------- «0. Iniciar sesión»

function peticionLogin(rol: string, email: string): ItemPeticion {
  return {
    name: `Login ${rol}`,
    event: [
      {
        listen: 'test',
        script: {
          type: 'text/javascript',
          exec: [
            "pm.test('Inicia sesión (200)', () => pm.response.to.have.status(200));",
            'const sesion = pm.response.json().data;',
            "pm.environment.set('accessToken', sesion.accessToken);",
            'if (sesion.iglesia && sesion.iglesia.id) {',
            "  pm.environment.set('iglesiaId', sesion.iglesia.id);",
            '}',
          ],
        },
      },
    ],
    request: {
      method: 'POST',
      header: [{ key: 'Content-Type', value: 'application/json' }],
      auth: { type: 'noauth' },
      url: {
        raw: '{{baseUrl}}/auth/login',
        host: ['{{baseUrl}}'],
        path: ['auth', 'login'],
      },
      body: {
        mode: 'raw',
        raw: JSON.stringify({ email, password: '{{passwordPrueba}}' }, null, 2),
        options: { raw: { language: 'json' } },
      },
      description: `Usuario de prueba del seed (${rol}). Guarda accessToken e iglesiaId en el entorno. Ojo: el login permite 5 por minuto por IP.`,
    },
    response: [],
  };
}

function carpetaDeLogins(): Carpeta {
  return {
    name: '0. Iniciar sesión',
    description:
      'Un login por rol. Elige uno y todas las demás carpetas usan su accessToken. El login permite 5 por minuto por IP: no corras la carpeta completa de golpe (son 6).',
    item: LOGINS.map(({ rol, email }) => peticionLogin(rol, email)),
  };
}

// ---------------------------------------------------------------- «Recorrido de la demo» (a mano)

interface PasoDemo {
  nombre: string;
  metodo: 'GET' | 'POST';
  ruta: string; // con {{variables}}; se separa en segmentos
  consulta?: Record<string, string>;
  cuerpo?: Json;
  publico?: boolean;
  /** Líneas del script de prueba (sintaxis de Postman). Siempre revisa el código HTTP. */
  prueba: string[];
}

const codigo = (n: number) => `pm.test('Responde ${n}', () => pm.response.to.have.status(${n}));`;

export const PASOS_DEMO: PasoDemo[] = [
  {
    nombre: '1. Login del tesorero',
    metodo: 'POST',
    ruta: '/auth/login',
    publico: true,
    cuerpo: { email: 'tesorero@iglesia.local', password: '{{passwordPrueba}}' },
    prueba: [
      codigo(200),
      'const sesion = pm.response.json().data;',
      "pm.environment.set('accessToken', sesion.accessToken);",
      "pm.test('Trae la iglesia', () => { if (!sesion.iglesia) throw new Error('sin iglesia'); });",
      "pm.environment.set('iglesiaId', sesion.iglesia.id);",
    ],
  },
  {
    nombre: '2. Misas celebradas de su iglesia',
    metodo: 'GET',
    ruta: '/iglesias/{{iglesiaId}}/misas-celebradas',
    consulta: { limit: '5' },
    prueba: [
      codigo(200),
      'const misas = pm.response.json().data;',
      "pm.test('Hay misas en la semilla', () => { if (!misas.length) throw new Error('sin misas'); });",
      "pm.environment.set('misaId', misas[0].id);",
    ],
  },
  {
    nombre: '3. Diezmo de una misa',
    metodo: 'GET',
    ruta: '/iglesias/{{iglesiaId}}/misas-celebradas/{{misaId}}/diezmo',
    prueba: [codigo(200)],
  },
  {
    nombre: '4. Reporte: resumen del diezmo',
    metodo: 'GET',
    ruta: '/iglesias/{{iglesiaId}}/diezmo/resumen',
    prueba: [codigo(200)],
  },
  {
    nombre: '5. Reporte: diezmo por semana',
    metodo: 'GET',
    ruta: '/iglesias/{{iglesiaId}}/diezmo/agrupado',
    consulta: { por: 'semana' },
    prueba: [codigo(200)],
  },
  {
    nombre: '6. Login del administrador (encargado)',
    metodo: 'POST',
    ruta: '/auth/login',
    publico: true,
    cuerpo: { email: 'admin@iglesia.local', password: '{{passwordPrueba}}' },
    prueba: [
      codigo(200),
      'const sesion = pm.response.json().data;',
      "pm.environment.set('accessToken', sesion.accessToken);",
      "pm.environment.set('iglesiaId', sesion.iglesia.id);",
    ],
  },
  {
    nombre: '7. Público: tipos de espacio de la iglesia',
    metodo: 'GET',
    ruta: '/public/iglesias/{{iglesiaId}}/espacios',
    publico: true,
    prueba: [
      codigo(200),
      'const tipos = pm.response.json().data.tipos;',
      "const conLugar = tipos.find((t) => t.clase !== 'COLUMBARIO');",
      "pm.test('Hay un tipo con lugar', () => { if (!conLugar) throw new Error('sin tipo con lugar'); });",
      "pm.environment.set('tipoEspacioId', conLugar.id);",
    ],
  },
  {
    nombre: '8. Público: solicitar el espacio',
    metodo: 'POST',
    ruta: '/public/iglesias/{{iglesiaId}}/solicitudes-espacio',
    publico: true,
    cuerpo: {
      tipoEspacioId: '{{tipoEspacioId}}',
      contacto: { nombre: 'Persona de Prueba (demo)', telefono: '9990000000' },
      comentarios: 'Solicitud creada por el recorrido de la demo.',
    },
    prueba: [
      codigo(201),
      'const solicitud = pm.response.json().data;',
      "pm.environment.set('folio', solicitud.folio);",
      "pm.environment.set('clave', solicitud.clave);",
    ],
  },
  {
    nombre: '9. Público: consultar con folio y clave',
    metodo: 'POST',
    ruta: '/public/solicitudes-espacio/{{folio}}/consulta',
    publico: true,
    cuerpo: { clave: '{{clave}}' },
    prueba: [
      codigo(200),
      "pm.test('Está recibida', () => { if (pm.response.json().data.estado !== 'RECIBIDA') throw new Error('estado'); });",
    ],
  },
  {
    nombre: '10. Administrador: buscar la solicitud',
    metodo: 'GET',
    ruta: '/iglesias/{{iglesiaId}}/solicitudes-espacio',
    consulta: { estado: 'RECIBIDA', limit: '100' },
    prueba: [
      codigo(200),
      "const propia = pm.response.json().data.find((s) => s.folio === pm.environment.get('folio'));",
      "pm.test('La solicitud aparece en el panel', () => { if (!propia) throw new Error('no aparece'); });",
      "pm.environment.set('solicitudId', propia.id);",
    ],
  },
  {
    nombre: '11. Administrador: cotizar',
    metodo: 'POST',
    ruta: '/iglesias/{{iglesiaId}}/solicitudes-espacio/{{solicitudId}}/cotizacion',
    cuerpo: { monto: '12500.50', condiciones: 'Pago en dos exhibiciones (demo).' },
    prueba: [codigo(201)],
  },
  {
    nombre: '12. Público: aceptar la cotización',
    metodo: 'POST',
    ruta: '/public/solicitudes-espacio/{{folio}}/aceptar',
    publico: true,
    cuerpo: { clave: '{{clave}}' },
    prueba: [codigo(200)],
  },
  {
    nombre: '13. Público: consultar, ya aceptada',
    metodo: 'POST',
    ruta: '/public/solicitudes-espacio/{{folio}}/consulta',
    publico: true,
    cuerpo: { clave: '{{clave}}' },
    prueba: [
      codigo(200),
      "pm.test('Está aceptada', () => { if (pm.response.json().data.estado !== 'ACEPTADA') throw new Error('estado'); });",
    ],
  },
];

function peticionDeDemo(paso: PasoDemo): ItemPeticion {
  const segmentos = paso.ruta.split('/').filter(Boolean);
  const consulta = Object.entries(paso.consulta ?? {}).map(([key, value]) => ({ key, value }));
  const query = consulta.length ? `?${consulta.map((c) => `${c.key}=${c.value}`).join('&')}` : '';
  return {
    name: paso.nombre,
    event: [{ listen: 'test', script: { type: 'text/javascript', exec: paso.prueba } }],
    request: {
      method: paso.metodo,
      header: paso.cuerpo ? [{ key: 'Content-Type', value: 'application/json' }] : [],
      ...(paso.publico ? { auth: { type: 'noauth' as const } } : {}),
      url: {
        raw: `{{baseUrl}}/${segmentos.join('/')}${query}`,
        host: ['{{baseUrl}}'],
        path: segmentos,
        ...(consulta.length ? { query: consulta } : {}),
      },
      ...(paso.cuerpo !== undefined
        ? {
            body: {
              mode: 'raw',
              raw: JSON.stringify(paso.cuerpo, null, 2),
              options: { raw: { language: 'json' } },
            },
          }
        : {}),
    },
    response: [],
  };
}

function carpetaDeDemo(): Carpeta {
  return {
    name: 'Recorrido de la demo',
    description:
      'Corre la carpeta completa, en orden, con el entorno local y la semilla cargada. Usa 2 logins (el límite es 5 por minuto). Si la repites, crea otra solicitud de espacio cada vez.',
    item: PASOS_DEMO.map(peticionDeDemo),
  };
}

// ---------------------------------------------------------------- colección y entorno

export function construirColeccion(doc: DocOpenApi): Coleccion {
  return {
    info: {
      name: 'Ecclesia API',
      description:
        'Generada desde backend/openapi.yaml con `pnpm --filter backend postman`. No se edita a mano: se regenera.',
      schema: ESQUEMA_COLECCION,
    },
    auth: {
      type: 'bearer',
      bearer: [{ key: 'token', value: '{{accessToken}}', type: 'string' }],
    },
    variable: [],
    item: [carpetaDeLogins(), carpetaDeDemo(), ...carpetasDelOpenApi(doc)],
  };
}

export function construirEntorno() {
  const variable = (key: string, value: string, description: string) => ({
    key,
    value,
    type: 'default',
    enabled: true,
    description,
  });
  return {
    name: 'Ecclesia local',
    values: [
      variable('baseUrl', 'http://localhost:3000/api/v1', 'URL base de la API local'),
      variable('accessToken', '', 'Lo llena el login'),
      variable('iglesiaId', '', 'Lo llena el login (vacío en la Coordinación)'),
      variable('folio', '', 'Lo llena la solicitud pública de espacio'),
      variable('clave', '', 'Lo llena la solicitud pública de espacio'),
      variable(
        'passwordPrueba',
        PASSWORD_PRUEBA,
        'SOLO DE PRUEBA: contraseña de los usuarios del seed de desarrollo (SEED_PASSWORD de .env.example). No es un secreto.',
      ),
    ],
    _postman_variable_scope: 'environment',
  };
}

export const serializar = (valor: unknown) => `${JSON.stringify(valor, null, 2)}\n`;

/** Escribe el JSON con el formato de Prettier del repo, para que el arnés no lo rechace. */
async function escribir(archivo: string, texto: string) {
  const opciones = (await resolveConfig(archivo)) ?? {};
  writeFileSync(archivo, await format(texto, { ...opciones, parser: 'json' }));
}

export async function generar(rutaOpenApi = RUTA_OPENAPI, dirSalida = DIR_SALIDA) {
  const doc = parse(readFileSync(rutaOpenApi, 'utf8')) as DocOpenApi;
  const coleccion = construirColeccion(doc);
  mkdirSync(dirSalida, { recursive: true });
  await escribir(resolve(dirSalida, ARCHIVO_COLECCION), serializar(coleccion));
  await escribir(resolve(dirSalida, ARCHIVO_ENTORNO), serializar(construirEntorno()));
  return coleccion;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const coleccion = await generar();
  const contar = (items: (Carpeta | ItemPeticion)[]): number =>
    items.reduce((n, i) => n + ('item' in i ? contar(i.item) : 1), 0);
  process.stdout.write(`Colección escrita en docs/postman: ${contar(coleccion.item)} requests.
`);
}
