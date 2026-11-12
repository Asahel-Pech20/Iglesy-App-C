// B1-18: falla si alguna ruta no pública carece de autenticar + autorizar.
// Al agregar un módulo en routes.ts (crearModulos) esta prueba lo revisa automáticamente.
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { crearApp } from './app';
import { crearModulos } from './routes';

/** Rutas sin sesión (specs.md §7.2). Cualquier otra pública debe agregarse aquí a propósito. */
const PUBLICAS = new Set([
  'POST /auth/login',
  'POST /auth/refresh',
  'POST /auth/logout',
  'POST /auth/forgot-password',
  'POST /auth/reset-password',
  'GET /configuracion',
  'GET /configuracion/horarios',
  // B3-15: cartelera pública de solo lectura
  'GET /public/cartelera',
  // E2-05: catálogo del INEGI para elegir el lugar (RF-01, RF-09)
  'GET /public/estados',
  'GET /public/estados/:clave/municipios',
  'GET /public/municipios/:clave/localidades',
]);

/** Rutas de la propia cuenta: requieren sesión pero no un permiso de módulo. */
const SOLO_SESION = new Set(['GET /auth/me', 'PATCH /auth/me/password']);

interface CapaRuta {
  route?: { path: string; methods: Record<string, boolean>; stack: { name: string }[] };
}

function rutasDe() {
  return crearModulos().flatMap(({ prefijo, router }) =>
    (router.stack as CapaRuta[])
      .filter((capa) => capa.route)
      .flatMap(({ route }) =>
        Object.keys(route!.methods).map((metodo) => ({
          clave: `${metodo.toUpperCase()} ${prefijo}${route!.path === '/' ? '' : route!.path}`,
          middlewares: route!.stack.map((c) => c.name),
        })),
      ),
  );
}

describe('rutas protegidas (B1-18)', () => {
  const rutas = rutasDe();

  it('encuentra las rutas de los módulos registrados', () => {
    expect(rutas.length).toBeGreaterThan(15);
  });

  it.each(rutas.map((r) => [r.clave, r] as const))('%s', (clave, { middlewares }) => {
    if (PUBLICAS.has(clave)) {
      expect(middlewares).not.toContain('autenticar');
      return;
    }
    const iAut = middlewares.indexOf('autenticar');
    expect(iAut, `${clave} no usa autenticar`).toBeGreaterThanOrEqual(0);
    if (SOLO_SESION.has(clave)) return;
    const iPermiso = middlewares.indexOf('autorizar');
    expect(iPermiso, `${clave} no usa autorizar`).toBeGreaterThan(iAut);
  });

  it('las listas de excepciones no tienen rutas obsoletas', () => {
    const existentes = new Set(rutas.map((r) => r.clave));
    for (const clave of [...PUBLICAS, ...SOLO_SESION]) {
      if (!clave.startsWith('GET /public')) expect(existentes, clave).toContain(clave);
    }
  });

  it('/api/docs muestra la documentación con health, auth, usuarios y configuración', async () => {
    const app = crearApp();
    expect((await request(app).get('/api/docs/')).status).toBe(200);
    const { body } = await request(app).get('/api/docs/openapi.json');
    for (const ruta of ['/health', '/auth/login', '/auth/me', '/usuarios', '/configuracion/logo']) {
      expect(body.paths).toHaveProperty([ruta]);
    }
  });
});
