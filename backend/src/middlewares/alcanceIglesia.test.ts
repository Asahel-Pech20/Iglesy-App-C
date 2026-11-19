import express, { Router } from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { prisma } from '../lib/prisma';
import { crearIglesia, crearUsuario, loginComo } from '../test/helpers';
import {
  SUPUESTOS_ALCANCE,
  alcanceIglesia,
  evaluarAlcance,
  iglesiaAlcanceDe,
  iglesiaDe,
  iglesiaDeLaRuta,
} from './alcanceIglesia';
import { autenticar } from './auth';
import { manejarErrores } from './errores';

// Mini-aplicación con la forma de las rutas de Ecclesia: /iglesias/:iglesiaId/...
const rutas = Router({ mergeParams: true });
rutas.get('/ping', (_req, res) => {
  res.json({ data: 'ok' });
});
const app = express()
  .use('/iglesias/:iglesiaId', autenticar, alcanceIglesia(iglesiaDeLaRuta), rutas)
  .use(manejarErrores);

describe('regla pura del alcance por iglesia (ADR-0004)', () => {
  it('permite entrar a la propia iglesia', () => {
    expect(evaluarAlcance('a', 'a')).toBe('PERMITIDO');
  });

  it('prohíbe entrar a otra iglesia', () => {
    expect(evaluarAlcance('a', 'b')).toBe('PROHIBIDO');
  });

  it('la Coordinación (sin iglesia) tampoco entra a los datos internos de una iglesia', () => {
    expect(evaluarAlcance(null, 'a')).toBe('PROHIBIDO');
  });

  it('un recurso que no existe es NO_EXISTE, venga quien venga', () => {
    expect(evaluarAlcance('a', undefined)).toBe('NO_EXISTE');
    expect(evaluarAlcance('a', null)).toBe('NO_EXISTE');
    expect(evaluarAlcance(null, undefined)).toBe('NO_EXISTE');
  });
});

describe('alcanceIglesia en una ruta /iglesias/:iglesiaId (RNF-10)', () => {
  it('el personal entra a su propia iglesia', async () => {
    const iglesia = await crearIglesia();
    const { auth } = await loginComo('TESORERO', { iglesiaId: iglesia.id });
    const res = await request(app).get(`/iglesias/${iglesia.id}/ping`).set('Authorization', auth);
    expect(res.status).toBe(200);
  });

  it('el personal de otra iglesia recibe 403', async () => {
    const [propia, ajena] = [await crearIglesia(), await crearIglesia()];
    const { auth } = await loginComo('ADMIN_IGLESIA', { iglesiaId: propia.id });
    const res = await request(app).get(`/iglesias/${ajena.id}/ping`).set('Authorization', auth);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('la Coordinación recibe 403 en los datos internos de una iglesia', async () => {
    const iglesia = await crearIglesia();
    const { auth } = await loginComo('COORDINACION');
    const res = await request(app).get(`/iglesias/${iglesia.id}/ping`).set('Authorization', auth);
    expect(res.status).toBe(403);
  });

  it('una iglesia que no existe responde 404', async () => {
    const { auth } = await loginComo('TESORERO');
    const res = await request(app).get('/iglesias/no-existe/ping').set('Authorization', auth);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('sin sesión responde 401', async () => {
    const iglesia = await crearIglesia();
    const res = await request(app).get(`/iglesias/${iglesia.id}/ping`);
    expect(res.status).toBe(401);
  });

  it('lee la iglesia de la BD: el usuario trasladado a otra iglesia pierde el acceso con su token viejo', async () => {
    const [antes, despues] = [await crearIglesia(), await crearIglesia()];
    const { auth, usuario } = await loginComo('TESORERO', { iglesiaId: antes.id });
    const { prisma } = await import('../lib/prisma');
    await prisma.usuario.update({ where: { id: usuario.id }, data: { iglesiaId: despues.id } });
    const res = await request(app).get(`/iglesias/${antes.id}/ping`).set('Authorization', auth);
    expect(res.status).toBe(403);
  });
});

// ───────── E1-01 (Santiago): Coordinación por ruta, iglesia verificada y datos inyectados ─────────

describe('regla pura: la Coordinación según la ruta (supuesto S-02: P-21, P-28)', () => {
  it('entra si la ruta lo permite y no entra si lo deniega', () => {
    expect(evaluarAlcance(null, 'a', SUPUESTOS_ALCANCE.datosIglesia)).toBe('PERMITIDO');
    expect(evaluarAlcance(null, 'a', SUPUESTOS_ALCANCE.datosPrivados)).toBe('PROHIBIDO');
  });

  it('permitir a la Coordinación no abre la puerta al personal de otra iglesia', () => {
    expect(evaluarAlcance('a', 'b', 'permitir')).toBe('PROHIBIDO');
  });
});

describe('alcanceIglesia con opciones, iglesiaAlcanceDe e iglesiaDe', () => {
  const responder = (req: express.Request, res: express.Response) => {
    res.json({ data: { iglesiaId: iglesiaAlcanceDe(req) } });
  };
  const appE1 = express()
    .use(express.json())
    .get(
      '/iglesias/:iglesiaId/datos',
      autenticar,
      alcanceIglesia(iglesiaDeLaRuta, { coordinacion: SUPUESTOS_ALCANCE.datosIglesia }),
      responder,
    )
    .patch('/iglesias/:iglesiaId/datos', autenticar, alcanceIglesia(iglesiaDeLaRuta), responder)
    .get(
      '/usuarios/:id/iglesia',
      autenticar,
      // Recurso cuya iglesia se lee de la BD (no de la ruta): un usuario
      alcanceIglesia(async (req) => {
        const u = await prisma.usuario.findUnique({
          where: { id: String(req.params['id']) },
          select: { iglesiaId: true },
        });
        return u?.iglesiaId;
      }),
      responder,
    )
    // Crear sin :iglesiaId en la ruta: la iglesia sale de la sesión, nunca del body
    .post('/recursos', autenticar, (req, res) => {
      res.status(201).json({ data: { iglesiaId: iglesiaDe(req) } });
    })
    .use(manejarErrores);

  it('deja la iglesia verificada para el controller', async () => {
    const iglesia = await crearIglesia();
    const { auth } = await loginComo('PASTOR', { iglesiaId: iglesia.id });
    const res = await request(appE1)
      .get(`/iglesias/${iglesia.id}/datos`)
      .set('Authorization', auth);
    expect(res.status).toBe(200);
    expect(res.body.data.iglesiaId).toBe(iglesia.id);
  });

  it('la Coordinación entra donde la ruta lo permite', async () => {
    const iglesia = await crearIglesia();
    const { auth } = await loginComo('COORDINACION');
    const res = await request(appE1)
      .get(`/iglesias/${iglesia.id}/datos`)
      .set('Authorization', auth);
    expect(res.status).toBe(200);
    expect(res.body.data.iglesiaId).toBe(iglesia.id);
  });

  it('un recurso cuya iglesia (leída de la BD) es otra → 403', async () => {
    const [propia, ajena] = [await crearIglesia(), await crearIglesia()];
    const { auth } = await loginComo('ADMIN_IGLESIA', { iglesiaId: propia.id });
    const otro = await crearUsuario('PASTOR', { iglesiaId: ajena.id });
    const res = await request(appE1).get(`/usuarios/${otro.id}/iglesia`).set('Authorization', auth);
    expect(res.status).toBe(403);
  });

  it('enviar otra iglesiaId en body, query o cabecera no cambia nada', async () => {
    const [propia, ajena] = [await crearIglesia(), await crearIglesia()];
    const { auth } = await loginComo('ADMIN_IGLESIA', { iglesiaId: propia.id });
    // Intenta entrar a otra iglesia diciendo que es la suya
    const ajenaRes = await request(appE1)
      .patch(`/iglesias/${ajena.id}/datos?iglesiaId=${propia.id}`)
      .set('Authorization', auth)
      .set('X-Iglesia-Id', propia.id)
      .send({ iglesiaId: propia.id });
    expect(ajenaRes.status).toBe(403);
    // Intenta crear en otra iglesia: se crea en la suya
    const creado = await request(appE1)
      .post(`/recursos?iglesiaId=${ajena.id}`)
      .set('Authorization', auth)
      .send({ iglesiaId: ajena.id });
    expect(creado.status).toBe(201);
    expect(creado.body.data.iglesiaId).toBe(propia.id);
  });

  it('la Coordinación no crea recursos de iglesia (no tiene iglesia) → 403', async () => {
    const iglesia = await crearIglesia();
    const { auth } = await loginComo('COORDINACION');
    const res = await request(appE1)
      .post('/recursos')
      .set('Authorization', auth)
      .send({ iglesiaId: iglesia.id });
    expect(res.status).toBe(403);
  });
});

describe('BD: iglesia según el rol (CHECK usuarios_iglesia_segun_rol)', () => {
  it('rechaza personal de iglesia sin iglesia', async () => {
    await expect(
      prisma.usuario.create({
        data: { nombre: 'Sin iglesia', email: 'sin@prueba.local', rol: 'ADMIN_IGLESIA' },
      }),
    ).rejects.toThrow();
  });

  it('rechaza a la Coordinación con iglesia', async () => {
    const iglesia = await crearIglesia();
    await expect(
      prisma.usuario.create({
        data: {
          nombre: 'Coordinación',
          email: 'coord@prueba.local',
          rol: 'COORDINACION',
          iglesiaId: iglesia.id,
        },
      }),
    ).rejects.toThrow();
  });

  it('no deja borrar una iglesia que tiene personal (RESTRICT)', async () => {
    const iglesia = await crearIglesia();
    await crearUsuario('TESORERO', { iglesiaId: iglesia.id });
    await expect(prisma.iglesia.delete({ where: { id: iglesia.id } })).rejects.toThrow();
  });
});
