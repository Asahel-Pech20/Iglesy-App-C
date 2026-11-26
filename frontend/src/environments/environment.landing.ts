// Sitio «principal» de Render: solo la landing. Cualquier otra ruta (Iglesias, Búsqueda, el acceso
// del personal…) abre la aplicación en su propio sitio, así que la dirección cambia
// (docs/despliegue-render.md). Si cambia el nombre del servicio de la aplicación, se cambia aquí.
export const environment = {
  apiUrl: '/api/v1',
  usarMocks: false,
  urlAplicacion: 'https://demo-iglesy.onrender.com',
};
