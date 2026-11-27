// Desarrollo contra el backend real (`pnpm --filter frontend dev:real`): sin mocks.
export const environment = {
  apiUrl: 'http://localhost:3000/api/v1',
  usarMocks: false,
  // Vacío: la app completa en este mismo sitio (ver environment.landing.ts)
  urlAplicacion: '',
};
