import type { Type } from '@angular/core';
import type { Route, Routes } from '@angular/router';
import { cambiosSinGuardar } from './core/cambios-sin-guardar';
import { rutaProtegida, soloAnonimo } from './core/guards';
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

export const routes: Routes = [
  // F3-13: cartelera pública, sin sesión ni layout administrativo
  { path: 'cartelera', component: CarteleraPage, title: 'Cartelera' },
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
