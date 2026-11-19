// Pruebas unitarias del arnés (sin BD). Se ejecutan con el Vitest del backend:
//   pnpm --filter backend exec vitest run --config ../arnes-ia/stacks/express/vitest.config.mjs
// Objeto plano (sin importar 'vitest/config') para que no dependa de node_modules en esta carpeta.
export default {
  test: {
    root: import.meta.dirname,
    include: ['modulo-referencia/**/*.test.ts'],
    environment: 'node',
  },
};
