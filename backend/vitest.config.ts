// Lee DATABASE_URL_TEST de backend/.env (sin Docker la BD de pruebas puede estar en otro puerto)
import 'dotenv/config';
import { defineConfig } from 'vitest/config';

const BD_PRUEBAS = 'postgresql://iglesia:iglesia@localhost:5433/iglesia_test';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    globalSetup: ['./src/test/globalSetup.ts'],
    setupFiles: ['./src/test/setup.ts'],
    // Todas las suites comparten la misma BD de pruebas: se ejecutan una tras otra
    fileParallelism: false,
    // Variables fijas para pruebas: nunca se usa la BD de desarrollo
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: process.env.DATABASE_URL_TEST ?? BD_PRUEBAS,
      DATABASE_URL_TEST: process.env.DATABASE_URL_TEST ?? BD_PRUEBAS,
      JWT_ACCESS_SECRET: 'secreto-access-pruebas',
      JWT_REFRESH_SECRET: 'secreto-refresh-pruebas',
      FRONTEND_URL: 'http://localhost:5173',
      API_PUBLIC_URL: 'http://localhost:3000',
      UPLOAD_DIR: 'uploads-test',
      BCRYPT_COST: '4',
    },
    // RNF-18: `pnpm test:cobertura`. El curso pide 70 % en dominio y servicios; si baja, falla.
    // Solo corre con --coverage, así que `pnpm test` no se hace más lento.
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/generated/**', 'src/test/**', 'src/**/*.test.ts'],
      reporter: ['text-summary', 'html', 'json-summary'],
      reportsDirectory: 'coverage',
      thresholds: {
        'src/**/dominio/**': { lines: 70, statements: 70, branches: 70, functions: 70 },
        'src/**/*.service.ts': { lines: 70, statements: 70, branches: 70, functions: 70 },
      },
    },
  },
});
