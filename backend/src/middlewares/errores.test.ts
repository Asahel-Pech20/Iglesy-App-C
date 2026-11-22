import '../config/zod';
import express from 'express';
import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { env } from '../config/env';
import { AppError } from '../lib/appError';
import { manejarErrores, noEncontrado } from './errores';
import { validar } from './validar';

function appDePrueba() {
  const app = express();
  app.use(express.json());
  app.get('/app-error', () => {
    throw AppError.reglaNegocio('No se puede registrar asistencia en un evento cancelado.');
  });
  app.post(
    '/validar',
    validar({ body: z.object({ nombre: z.string().trim().min(1) }).strict() }),
    (req, res) => {
      res.json({ data: req.body });
    },
  );
  app.get(
    '/validar-query',
    validar({ query: z.object({ page: z.coerce.number() }) }),
    (req, res) => {
      res.json({ data: req.query });
    },
  );
  app.get('/prisma/:codigo', (req) => {
    throw Object.assign(new Error('prisma'), {
      name: 'PrismaClientKnownRequestError',
      code: req.params.codigo,
      meta: { target: ['email'] },
    });
  });
  // Forma real de Prisma 7 + adaptador pg ante un CHECK (A2-E1-02)
  app.get('/check', () => {
    throw Object.assign(new Error('prisma'), {
      name: 'PrismaClientKnownRequestError',
      code: 'P2039',
      meta: {
        modelName: 'Usuario',
        driverAdapterError: {
          cause: {
            originalCode: '23514',
            originalMessage: 'new row for relation "usuarios" violates check constraint "regla_x"',
            detail: 'Failing row contains (dato-personal@correo.local)',
          },
        },
      },
    });
  });
  app.get('/inesperado', () => {
    throw new Error('fallo interno con datos sensibles');
  });
  app.use(noEncontrado);
  app.use(manejarErrores);
  return app;
}

const entornoOriginal = env.NODE_ENV;
afterEach(() => {
  env.NODE_ENV = entornoOriginal;
});

describe('manejarErrores', () => {
  it('traduce AppError con su código y estado', async () => {
    const res = await request(appDePrueba()).get('/app-error');
    expect(res.status).toBe(422);
    expect(res.body).toEqual({
      error: {
        code: 'BUSINESS_RULE',
        message: 'No se puede registrar asistencia en un evento cancelado.',
      },
    });
  });

  it('traduce ZodError a 400 con detalles por campo', async () => {
    const res = await request(appDePrueba()).post('/validar').send({ nombre: '', extra: 1 });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ campo: 'nombre' })]),
    );
  });

  it('rechaza JSON mal formado con 400', async () => {
    const res = await request(appDePrueba())
      .post('/validar')
      .set('Content-Type', 'application/json')
      .send('{"nombre":');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('traduce P2002 a 409 y P2025 a 404', async () => {
    const conflicto = await request(appDePrueba()).get('/prisma/P2002');
    expect(conflicto.status).toBe(409);
    expect(conflicto.body.error.code).toBe('CONFLICT');
    const noExiste = await request(appDePrueba()).get('/prisma/P2025');
    expect(noExiste.status).toBe(404);
    expect(noExiste.body.error.code).toBe('NOT_FOUND');
  });

  it('traduce una violación de CHECK de la BD a 422 sin exponer la fila (A2-E1-02)', async () => {
    const res = await request(appDePrueba()).get('/check');
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('BUSINESS_RULE');
    expect(JSON.stringify(res.body)).not.toContain('dato-personal');
    expect(JSON.stringify(res.body)).not.toContain('regla_x');
  });

  it('responde 404 en rutas inexistentes', async () => {
    const res = await request(appDePrueba()).get('/no-existe');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('no filtra el stack ni el mensaje interno en producción', async () => {
    env.NODE_ENV = 'production';
    const res = await request(appDePrueba()).get('/inesperado');
    expect(res.status).toBe(500);
    expect(res.body).toEqual({
      error: { code: 'INTERNAL_ERROR', message: 'Ocurrió un error inesperado.' },
    });
  });

  it('incluye el stack fuera de producción para depurar', async () => {
    env.NODE_ENV = 'development';
    const res = await request(appDePrueba()).get('/inesperado');
    expect(res.status).toBe(500);
    expect(res.body.error.details.stack).toContain('fallo interno');
  });
});

describe('validar', () => {
  it('normaliza el body validado', async () => {
    const res = await request(appDePrueba()).post('/validar').send({ nombre: '  Ana  ' });
    expect(res.body).toEqual({ data: { nombre: 'Ana' } });
  });

  it('reemplaza req.query con el valor convertido', async () => {
    const res = await request(appDePrueba()).get('/validar-query?page=3');
    expect(res.body).toEqual({ data: { page: 3 } });
  });
});
