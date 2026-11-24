import type { Type } from '@angular/core';
import type { Route, Routes } from '@angular/router';
import { cambiosSinGuardar } from './core/cambios-sin-guardar';
import { rutaProtegida, sinSesion, soloAnonimo } from './core/guards';
import { LoginPage } from './features/auth/login.page';
import { MiCuentaPage } from './features/auth/mi-cuenta.page';
import { RecuperarPage } from './features/auth/recuperar.page';
import { RestablecerPage } from './features/auth/restablecer.page';
import { AnunciosPage } from './features/anuncios/anuncios.page';
import { CarteleraPage } from './features/anuncios/cartelera.page';
import { AsistenciaPage } from './features/asistencia/asistencia.page';
import { PaseListaPage } from './features/asistencia/pase-lista.page';
import { ConfiguracionPage } from './features/configuracion/configuracion.page';
import { EventoDetallePage } from './features/eventos/evento-detalle.page';
import { EventoFormPage } from './features/eventos/evento-form.page';
import { EventosPage } from './features/eventos/eventos.page';
import { IglesiasPage } from './features/iglesias/iglesias.page';
import { InicioPage } from './features/inicio/inicio.page';
import { DiezmoPage } from './features/diezmo/diezmo.page';
import { DonacionesPage } from './features/donaciones/donaciones.page';
import { MiembroFormPage } from './features/miembros/miembro-form.page';
import { MiembroPerfilPage } from './features/miembros/miembro-perfil.page';
import { MiembrosPage } from './features/miembros/miembros.page';
import { MinisterioDetallePage } from './features/ministerios/ministerio-detalle.page';
import { MinisteriosPage } from './features/ministerios/ministerios.page';
import { ReportesPage } from './features/reportes/reportes.page';
import { UsuariosPage } from './features/usuarios/usuarios.page';
import { AppLayout } from './layout/app-layout';
import { AuthLayout } from './layout/auth-layout';
import { NoEncontradoPage, SinAccesoPage } from './paginas/paginas-simples';

/**
 * Registro central de rutas (equivale a app/router.tsx de React).
 * Cada ruta protegida declara su permiso en `data.permiso`, igual que en el menú (core/menu.ts).
 */
/** Pantalla pública dentro del layout de autenticación (login, recuperar, restablecer). */
function publica(
  path: string,
  component: Type<unknown>,
  title: string,
  soloSinSesion = false,
): Route {
  return {
    path,
    component: AuthLayout,
    canActivate: soloSinSesion ? [soloAnonimo] : [],
    children: [{ path: '', component, title }],
  };
}

/**
 * Pantallas públicas de Ecclesia dentro de su propio marco (E2-14). Se cargan al abrirlas
 * (loadComponent), como espacios, para no sumar al paquete inicial.
 */
function explorar(path: string, children: Routes): Route {
  return {
    path,
    loadComponent: () =>
      import('./features/explorar/explorar-layout').then((m) => m.ExplorarLayout),
    children,
  };
}

export const routes: Routes = [
  // Página de entrada de Ecclesia para visitantes sin sesión; con sesión, «/» es el inicio del panel
  {
    ...explorar('', [
      {
        path: '',
        loadComponent: () => import('./features/explorar/landing.page').then((m) => m.LandingPage),
        title: 'Ecclesia · Patrimonio de México',
      },
    ]),
    pathMatch: 'full',
    canMatch: [sinSesion],
  },
  // F3-13: cartelera pública, sin sesión ni layout administrativo
  { path: 'cartelera', component: CarteleraPage, title: 'Cartelera' },
  // E2-14 (Nataly): consultas públicas de Ecclesia, sin sesión y para el celular
  explorar('templos', [
    {
      path: '',
      loadComponent: () => import('./features/explorar/templos.page').then((m) => m.TemplosPage),
      title: 'Iglesias de México',
    },
    {
      path: ':id',
      loadComponent: () => import('./features/explorar/ficha.page').then((m) => m.FichaPage),
      title: 'Ficha de la iglesia',
    },
  ]),
  explorar('reconocidas', [
    {
      path: '',
      loadComponent: () =>
        import('./features/explorar/reconocidas.page').then((m) => m.ReconocidasPage),
      title: 'Iglesias más reconocidas',
    },
  ]),
  explorar('busqueda-patrimonio', [
    {
      path: '',
      loadComponent: () => import('./features/explorar/busqueda.page').then((m) => m.BusquedaPage),
      title: 'Búsqueda por patrimonio',
    },
  ]),
  // E4-19: espacios (criptas, nichos, columbarios y osarios) sin cuenta, con folio y clave.
  // «seguimiento» va antes de «:iglesiaId» para que no se tome como el id de una iglesia.
  {
    path: 'espacios/seguimiento',
    loadComponent: () =>
      import('./features/espacios/seguimiento-espacio.page').then((m) => m.SeguimientoEspacioPage),
    title: 'Seguimiento de solicitud',
  },
  {
    path: 'espacios/:iglesiaId',
    loadComponent: () =>
      import('./features/espacios/solicitar-espacio.page').then((m) => m.SolicitarEspacioPage),
    title: 'Solicitar un espacio',
  },
  publica('login', LoginPage, 'Iniciar sesión', true),
  publica('recuperar', RecuperarPage, 'Recuperar contraseña'),
  publica('restablecer', RestablecerPage, 'Nueva contraseña'),
  {
    path: '',
    component: AppLayout,
    canActivate: [rutaProtegida],
    canActivateChild: [rutaProtegida],
    children: [
      { path: '', pathMatch: 'full', component: InicioPage, title: 'Inicio' },
      {
        path: 'usuarios',
        component: UsuariosPage,
        data: { permiso: 'usuarios:leer' },
        title: 'Usuarios',
      },
      {
        path: 'configuracion',
        component: ConfiguracionPage,
        data: { permiso: 'configuracion:leer' },
        title: 'Configuración',
      },
      // F2: miembros y ministerios
      {
        path: 'miembros',
        component: MiembrosPage,
        data: { permiso: 'miembros:leer' },
        title: 'Miembros',
      },
      {
        path: 'miembros/nuevo',
        component: MiembroFormPage,
        canDeactivate: [cambiosSinGuardar],
        data: { permiso: 'miembros:crear' },
        title: 'Nuevo miembro',
      },
      {
        path: 'miembros/:id',
        component: MiembroPerfilPage,
        data: { permiso: 'miembros:leer' },
        title: 'Perfil del miembro',
      },
      {
        path: 'miembros/:id/editar',
        component: MiembroFormPage,
        canDeactivate: [cambiosSinGuardar],
        data: { permiso: 'miembros:editar' },
        title: 'Editar miembro',
      },
      {
        path: 'ministerios',
        component: MinisteriosPage,
        data: { permiso: 'ministerios:leer' },
        title: 'Ministerios',
      },
      {
        path: 'ministerios/:id',
        component: MinisterioDetallePage,
        data: { permiso: 'ministerios:leer' },
        title: 'Ministerio',
      },
      // F3: eventos, asistencia, anuncios
      {
        path: 'eventos',
        component: EventosPage,
        data: { permiso: 'eventos:leer' },
        title: 'Eventos',
      },
      {
        path: 'eventos/nuevo',
        component: EventoFormPage,
        canDeactivate: [cambiosSinGuardar],
        data: { permiso: ['eventos:crear', 'eventos:crear-propio'] },
        title: 'Nuevo evento',
      },
      {
        path: 'eventos/:id',
        component: EventoDetallePage,
        data: { permiso: 'eventos:leer' },
        title: 'Evento',
      },
      {
        path: 'eventos/:id/editar',
        component: EventoFormPage,
        canDeactivate: [cambiosSinGuardar],
        data: { permiso: ['eventos:editar', 'eventos:editar-propio'] },
        title: 'Editar evento',
      },
      {
        path: 'eventos/:id/asistencia',
        component: PaseListaPage,
        canDeactivate: [cambiosSinGuardar],
        data: { permiso: ['asistencia:leer', 'asistencia:leer-propio'] },
        title: 'Pase de lista',
      },
      {
        path: 'asistencia',
        component: AsistenciaPage,
        data: { permiso: ['asistencia:leer', 'asistencia:leer-propio'] },
        title: 'Asistencia',
      },
      {
        path: 'anuncios',
        component: AnunciosPage,
        data: { permiso: 'anuncios:leer' },
        title: 'Anuncios',
      },
      // F4: donaciones, reportes (el dashboard es la ruta raíz)
      {
        path: 'donaciones',
        component: DonacionesPage,
        data: { permiso: 'donaciones:leer' },
        title: 'Donaciones',
      },
      {
        path: 'iglesias',
        component: IglesiasPage,
        data: { permiso: 'iglesias:leer' },
        title: 'Iglesias',
      },
      // E2-15 (Nataly): patrimonio de una iglesia y criterios del índice
      {
        path: 'iglesias/:id/patrimonio',
        loadComponent: () =>
          import('./features/patrimonio/patrimonio.page').then((m) => m.PatrimonioPage),
        data: { permiso: 'patrimonio:leer' },
        title: 'Patrimonio',
      },
      {
        path: 'patrimonio',
        loadComponent: () =>
          import('./features/patrimonio/patrimonio.page').then((m) => m.PatrimonioPage),
        data: { permiso: 'patrimonio:gestionar' },
        title: 'Patrimonio',
      },
      {
        path: 'criterios-indice',
        loadComponent: () =>
          import('./features/patrimonio/criterios.page').then((m) => m.CriteriosPage),
        data: { permiso: 'criterios:leer' },
        title: 'Criterios del índice',
      },
      // Ecclesia: solicitudes de espacio y su cotización (solo personal de iglesia)
      {
        path: 'espacios',
        loadComponent: () =>
          import('./features/espacios/espacios.page').then((m) => m.EspaciosPage),
        data: { permiso: 'espacios:leer' },
        title: 'Espacios',
      },
      // Ecclesia: diezmo de las misas (solo personal de iglesia)
      {
        path: 'diezmo',
        component: DiezmoPage,
        data: { permiso: 'diezmo:leer' },
        title: 'Diezmo',
      },
      {
        path: 'reportes',
        component: ReportesPage,
        data: { permiso: ['reportes:generales', 'reportes:generales-propio', 'reportes:ingresos'] },
        title: 'Reportes',
      },
      { path: 'mi-cuenta', component: MiCuentaPage, title: 'Mi cuenta' },
      { path: 'sin-acceso', component: SinAccesoPage, title: 'Sin acceso' },
      { path: '**', component: NoEncontradoPage, title: 'Página no encontrada' },
    ],
  },
];
