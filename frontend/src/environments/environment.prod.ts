// Producción = el servicio «principal» de Render. La API va en la misma dirección: Render reescribe
// /api/* y /uploads/* hacia el servicio de la API (docs/despliegue-render.md), así la cookie de
// sesión sigue con SameSite=Strict y no hace falta CORS.
export const environment = {
  apiUrl: '/api/v1',
  usarMocks: false,
  // Vacío: la app completa en este mismo sitio (ver environment.landing.ts)
  urlAplicacion: '',
};
