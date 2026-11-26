// Desarrollo: arranca con mocks MSW para no depender del backend (CLAUDE.md).
// Para usar el backend real en desarrollo, cambia usarMocks a false.
export const environment = {
  apiUrl: 'http://localhost:3000/api/v1',
  usarMocks: true,
  // Vacío: la app completa en este mismo sitio (ver environment.landing.ts)
  urlAplicacion: '',
};
