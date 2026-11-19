import jwt from 'jsonwebtoken';
import { describe, expect, it } from 'vitest';
import { env } from '../config/env';
import {
  duracionMs,
  esquemaPassword,
  firmarAccessToken,
  generarTokenAleatorio,
  hashPassword,
  hashToken,
  verificarAccessToken,
  verificarPassword,
} from './seguridad';

describe('contraseñas', () => {
  it('aplica la regla de AGENTS.md §3', () => {
    expect(esquemaPassword.safeParse('abc12345').success).toBe(true);
    expect(esquemaPassword.safeParse('corta1').success).toBe(false);
    expect(esquemaPassword.safeParse('sinnumeros').success).toBe(false);
    expect(esquemaPassword.safeParse('12345678').success).toBe(false);
  });

  it('hash y verificación con bcrypt', async () => {
    const hash = await hashPassword('Iglesia123');
    expect(hash).not.toContain('Iglesia123');
    expect(await verificarPassword('Iglesia123', hash)).toBe(true);
    expect(await verificarPassword('otra1234', hash)).toBe(false);
    expect(await verificarPassword('Iglesia123', null)).toBe(false);
  });
});

describe('tokens', () => {
  it('genera tokens de 32 bytes y su hash es estable', () => {
    const token = generarTokenAleatorio();
    expect(token).toMatch(/^[0-9a-f]{64}$/);
    expect(hashToken(token)).toBe(hashToken(token));
    expect(hashToken(token)).not.toBe(token);
  });

  it('convierte duraciones', () => {
    expect(duracionMs('15m')).toBe(900_000);
    expect(duracionMs('7d')).toBe(604_800_000);
    expect(() => duracionMs('7 semanas')).toThrow();
  });

  it('firma y verifica el access token', () => {
    const token = firmarAccessToken({ sub: 'u1', rol: 'ADMIN_IGLESIA' });
    expect(verificarAccessToken(token)).toEqual({ sub: 'u1', rol: 'ADMIN_IGLESIA' });
  });

  it('token expirado → TOKEN_EXPIRED; token alterado → UNAUTHENTICATED', () => {
    const expirado = jwt.sign({ sub: 'u1', rol: 'ADMIN_IGLESIA' }, env.JWT_ACCESS_SECRET, {
      expiresIn: -10,
    });
    expect(() => verificarAccessToken(expirado)).toThrow(
      expect.objectContaining({ code: 'TOKEN_EXPIRED', status: 401 }),
    );
    const ajeno = jwt.sign({ sub: 'u1', rol: 'ADMIN_IGLESIA' }, 'otro-secreto');
    expect(() => verificarAccessToken(ajeno)).toThrow(
      expect.objectContaining({ code: 'UNAUTHENTICATED' }),
    );
  });
});
