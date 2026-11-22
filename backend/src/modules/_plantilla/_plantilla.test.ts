// PLANTILLA — por endpoint: 1 caso feliz, 1 de validación (400) y 1 de permisos (401/403) (AGENTS.md §3).
// La BD de pruebas se vacía antes de cada prueba (src/test/setup.ts). loginComo(rol) da la cabecera Authorization.
import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { prisma } from '../../lib/prisma';
import { manejarErrores } from '../../middlewares/errores';
import { loginComo } from '../../test/helpers';
import { plantillaRouter } from './_plantilla.routes';

// En tu módulo usa crearApp() y la ruta real (/api/v1/<modulo>); la plantilla no está registrada
const app = express().use(express.json()).use('/ejemplo', plantillaRouter).use(manejarErrores);

describe('plantilla de módulo', () => {
  it('caso feliz: lista paginada', async () => {
    await prisma.horarioReunion.create({
      data: { nombre: 'Culto', diaSemana: 0, horaInicio: '10:00' },
    });
    const { auth } = await loginComo('SECRETARIO');
    const res = await request(app).get('/ejemplo?q=cul').set('Authorization', auth);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      data: [expect.objectContaining({ nombre: 'Culto' })],
      meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
  });

  it('validación: query inválida → 400', async () => {
    const { auth } = await loginComo('ADMIN_IGLESIA');
    const res = await request(app).get('/ejemplo?limit=500').set('Authorization', auth);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('permisos: sin sesión → 401', async () => {
    const res = await request(app).get('/ejemplo');
    expect(res.status).toBe(401);
  });

  it('no encontrado → 404', async () => {
    const { auth } = await loginComo('ADMIN_IGLESIA');
    const res = await request(app)
      .get('/ejemplo/00000000-0000-4000-8000-000000000000')
      .set('Authorization', auth);
    expect(res.status).toBe(404);
  });
});
