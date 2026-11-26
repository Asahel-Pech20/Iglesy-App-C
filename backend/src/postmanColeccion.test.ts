// OSC-08: la colección de Postman sale de openapi.yaml; esta prueba revisa el generador.
// No compara el JSON guardado en docs/postman: así un PR que solo cambia openapi.yaml no la rompe.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import {
  type Carpeta,
  type DocOpenApi,
  type ItemPeticion,
  LOGINS,
  PASOS_DEMO,
  RUTA_OPENAPI,
  construirColeccion,
  construirEntorno,
  serializar,
  ubicacion,
} from '../scripts/generar-postman';
import { ROLES } from './config/permisos';

const doc = parse(readFileSync(RUTA_OPENAPI, 'utf8')) as DocOpenApi;
const coleccion = construirColeccion(doc);

function peticiones(items: (Carpeta | ItemPeticion)[]): ItemPeticion[] {
  return items.flatMap((i) => ('item' in i ? peticiones(i.item) : [i]));
}

const carpeta = (nombre: string) =>
  coleccion.item.find((i): i is Carpeta => 'item' in i && i.name === nombre);

const operaciones = Object.entries(doc.paths).flatMap(([ruta, def]) =>
  ['get', 'post', 'put', 'patch', 'delete']
    .filter((m) => def[m])
    .map((m) => ({
      clave: `${m.toUpperCase()} ${ruta}`,
      publica: Array.isArray((def[m] as { security?: unknown[] }).security)
        ? (def[m] as { security: unknown[] }).security.length === 0
        : false,
    })),
);

/** Texto de cada request generado desde el YAML: «MÉTODO /ruta» queda en su descripción. */
const delYaml = peticiones(
  coleccion.item.filter((i) => !['0. Iniciar sesión', 'Recorrido de la demo'].includes(i.name)),
);

describe('colección de Postman (OSC-08)', () => {
  it('tiene un request por cada operación de openapi.yaml', () => {
    expect(delYaml).toHaveLength(operaciones.length);
    const claves = delYaml.map((p) => (p.request.description ?? '').split('\n')[0]);
    for (const { clave } of operaciones) {
      const [metodo, ruta] = clave.split(' ');
      expect(claves, clave).toContain(`\`${metodo} ${ruta}\``);
    }
  });

  it('ninguna ruta pública lleva autenticación y las demás heredan el Bearer de la colección', () => {
    expect(coleccion.auth).toMatchObject({
      type: 'bearer',
      bearer: [{ key: 'token', value: '{{token}}' }],
    });
    for (const peticion of delYaml) {
      const [metodo, ruta] = (peticion.request.description ?? '')
        .split('\n')[0]!
        .replace(/`/g, '')
        .split(' ');
      const op = operaciones.find((o) => o.clave === `${metodo} ${ruta}`)!;
      if (op.publica) expect(peticion.request.auth, op.clave).toEqual({ type: 'noauth' });
      else expect(peticion.request.auth, op.clave).toBeUndefined();
    }
  });

  it('reparte las carpetas por integrante y deja lo heredado en «Gestión interna»', () => {
    const fijas = ['0. Iniciar sesión', 'Recorrido de la demo'];
    const raiz = coleccion.item.map((i) => i.name);
    expect(raiz.slice(0, 7)).toEqual([
      ...fijas,
      'Santiago',
      'Nataly',
      'Genaro',
      'Oscar',
      'Gestión interna',
    ]);
    const duenio = (clave: string) =>
      raiz
        .filter((nombre) => !fijas.includes(nombre))
        .find((nombre) =>
          peticiones(carpeta(nombre)!.item).some(
            (p) => p.request.description?.split('\n')[0] === '`' + clave + '`',
          ),
        );
    expect(duenio('GET /health')).toBe('Santiago');
    expect(duenio('POST /catalogos/importacion')).toBe('Nataly');
    expect(duenio('GET /public/iglesias/{iglesiaId}/platicas')).toBe('Genaro');
    expect(duenio('GET /iglesias/{iglesiaId}/misas-celebradas')).toBe('Genaro');
    expect(duenio('GET /iglesias/{iglesiaId}/misas-celebradas/{misaId}/diezmo')).toBe('Oscar');
    expect(duenio('GET /public/cartelera')).toBe('Gestión interna');
    const grupos = carpeta('Gestión interna')!.item as Carpeta[];
    expect(Object.fromEntries(grupos.map((g) => [g.name, g.description]))).toEqual({
      Miembros: 'Dueño: Nataly.',
      Ministerios: 'Dueño: Nataly.',
      Eventos: 'Dueño: Genaro.',
      Asistencia: 'Dueño: Genaro.',
      Anuncios: 'Dueño: Genaro.',
      Cartelera: 'Dueño: Genaro.',
    });
  });

  it('una etiqueta nueva no rompe el generador: va a «Sin dueño asignado»', () => {
    expect(ubicacion('Etiqueta nueva', '/algo')).toEqual({
      carpeta: 'Sin dueño asignado',
      grupo: 'Etiqueta nueva',
    });
  });

  it('hay un login por cada rol, incluido COORDINADOR, que guarda token e iglesiaId', () => {
    expect(LOGINS.map((l) => l.rol).sort()).toEqual([...ROLES].sort());
    const logins = peticiones(carpeta('0. Iniciar sesión')!.item);
    expect(logins).toHaveLength(ROLES.length);
    for (const login of logins) {
      const script = login.event?.[0]?.script.exec.join('\n') ?? '';
      expect(script).toContain("pm.environment.set('token'");
      expect(script).toContain("pm.environment.set('iglesiaId'");
      expect(login.request.auth).toEqual({ type: 'noauth' });
      expect(JSON.stringify(login.request.body)).toContain('{{passwordPrueba}}');
    }
  });

  it('el recorrido de la demo prueba el código HTTP de cada paso y usa a lo más 5 logins', () => {
    const pasos = peticiones(carpeta('Recorrido de la demo')!.item);
    expect(pasos).toHaveLength(PASOS_DEMO.length);
    for (const paso of pasos) {
      expect(paso.event?.[0]?.script.exec.join('\n'), paso.name).toContain('to.have.status(');
    }
    expect(
      pasos.filter((p) => p.request.url.raw.endsWith('/auth/login')).length,
    ).toBeLessThanOrEqual(5);
  });

  it('el entorno guarda la contraseña de prueba una sola vez y los requests solo la referencian', () => {
    const entorno = construirEntorno();
    const nombres = entorno.values.map((v) => v.key);
    expect(nombres).toEqual(
      expect.arrayContaining(['baseUrl', 'token', 'iglesiaId', 'folio', 'clave', 'passwordPrueba']),
    );
    const password = entorno.values.find((v) => v.key === 'passwordPrueba')!;
    expect(password.description).toMatch(/SOLO DE PRUEBA/);
    expect(serializar(coleccion)).not.toContain(password.value);
  });

  it('no hay ningún valor que parezca un token o un hash', () => {
    const textos: string[] = [];
    const recorrer = (valor: unknown) => {
      if (typeof valor === 'string') textos.push(valor);
      else if (Array.isArray(valor)) valor.forEach(recorrer);
      else if (valor && typeof valor === 'object') Object.values(valor).forEach(recorrer);
    };
    recorrer(coleccion);
    recorrer(construirEntorno());
    const sospechoso = (t: string) =>
      /eyJ[\w-]{10,}\.[\w-]{10,}/.test(t) || // JWT
      /\b[a-f0-9]{32,}\b/i.test(t) || // hash hexadecimal
      /\$2[aby]\$\d{2}\$/.test(t) || // bcrypt
      /\b[A-Za-z0-9+/_-]{40,}={0,2}(?![A-Za-z0-9+/_-])/.test(t); // base64 largo
    expect(textos.filter(sospechoso)).toEqual([]);
    expect(textos.length).toBeGreaterThan(500);
  });

  it('es determinista: dos generaciones dan el mismo JSON', () => {
    expect(serializar(construirColeccion(doc))).toBe(serializar(construirColeccion(doc)));
  });
});
