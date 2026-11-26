import { describe, expect, it } from 'vitest';
import { validarEnv } from './env';

const BASE = {
  DATABASE_URL: 'postgresql://x:y@localhost:5432/db',
  JWT_ACCESS_SECRET: 'a',
  JWT_REFRESH_SECRET: 'b',
  FRONTEND_URL: 'http://localhost:5173',
};

describe('validarEnv', () => {
  it('aplica valores por defecto', () => {
    const env = validarEnv(BASE);
    expect(env.PORT).toBe(3000);
    // Sin proxy delante, no se confía en X-Forwarded-For
    expect(env.TRUST_PROXY).toBe(0);
    expect(env.JWT_ACCESS_TTL).toBe('15m');
  });

  it('falla con mensaje claro si falta DATABASE_URL', () => {
    const { DATABASE_URL: _omitida, ...sinBd } = BASE;
    expect(() => validarEnv(sinBd)).toThrow(/DATABASE_URL/);
  });
});
