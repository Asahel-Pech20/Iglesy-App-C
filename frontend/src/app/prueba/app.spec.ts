import { afterEach, describe, expect, it } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { PASSWORD_MOCK } from '@/mocks/datos/b1';
import { abrirApp, escribir, esperarA, textoPagina } from './entorno';

afterEach(() => {
  document.body.innerHTML = '';
  TestBed.resetTestingModule();
});

describe('sesión y rutas (F1-08, F1-09)', () => {
  it('sin sesión, una ruta protegida redirige a /login con redirect', async () => {
    const { router } = await abrirApp('/miembros');
    expect(router.url).toBe('/login?redirect=%2Fmiembros');
    expect(textoPagina()).toContain('Inicia sesión');
  });

  it('inicia sesión con credenciales válidas y vuelve a la ruta pedida', async () => {
    const { harness, router } = await abrirApp('/login?redirect=%2Fusuarios');
    const raiz = harness.routeNativeElement!;
    escribir(raiz.querySelector('input[type=email]'), 'admin@iglesia.local');
    escribir(raiz.querySelector('input[autocomplete=current-password]'), PASSWORD_MOCK);
    (raiz.querySelector('button[type=submit]') as HTMLButtonElement).click();
    await esperarA(() => router.url === '/usuarios');
    await esperarA(() => textoPagina().includes('admin@iglesia.local'));
  });

  it('credenciales inválidas muestran el mensaje del servidor', async () => {
    const { harness } = await abrirApp('/login');
    const raiz = harness.routeNativeElement!;
    escribir(raiz.querySelector('input[type=email]'), 'admin@iglesia.local');
    escribir(raiz.querySelector('input[autocomplete=current-password]'), 'incorrecta1');
    (raiz.querySelector('button[type=submit]') as HTMLButtonElement).click();
    await esperarA(() => raiz.querySelector('[role=alert]') !== null);
  });

  it('el login lleva la foto de la landing con su crédito y un enlace de vuelta al inicio', async () => {
    await abrirApp('/login');
    await esperarA(() => textoPagina().includes('Inicia sesión'));
    const fondo = document.querySelector<HTMLElement>('app-auth-layout .fondo')!;
    expect(fondo.style.backgroundImage).toContain('landing/mamatla.webp');
    expect(fondo.querySelector('.credito')?.textContent).toContain('Álvaro Jacobo Lagunas');
    expect(fondo.querySelector('a.volver')?.getAttribute('href')).toBe('/');
  });

  it('valida el formulario antes de enviar', async () => {
    const { harness } = await abrirApp('/login');
    const raiz = harness.routeNativeElement!;
    (raiz.querySelector('button[type=submit]') as HTMLButtonElement).click();
    await esperarA(() => textoPagina().includes('Escribe tu correo.'));
    expect(textoPagina()).toContain('Escribe tu contraseña.');
  });

  it('un rol sin permiso ve "No tienes acceso"', async () => {
    const { router } = await abrirApp('/usuarios', { como: 'tesorero@iglesia.local' });
    expect(router.url).toBe('/sin-acceso');
    expect(textoPagina()).toContain('No tienes acceso');
  });

  it('el menú se filtra por permisos', async () => {
    await abrirApp('/', { como: 'tesorero@iglesia.local' });
    const menu = document.querySelector('nav[aria-label="Menú principal"]')!.textContent!;
    expect(menu).toContain('Miembros');
    expect(menu).not.toContain('Usuarios');
  });
});

describe('usuarios (F1-12)', () => {
  it('lista los usuarios con su rol y estado', async () => {
    await abrirApp('/usuarios', { como: 'admin@iglesia.local' });
    await esperarA(() => textoPagina().includes('tesorero@iglesia.local'));
    expect(textoPagina()).toContain('Tesorero');
    expect(textoPagina()).toContain('Activo');
  });
});

describe('miembros y ministerios (F2-01, F2-07, F2-10)', () => {
  it('lista los miembros activos con sus ministerios', async () => {
    await abrirApp('/miembros', { como: 'secretario@iglesia.local' });
    await esperarA(() => textoPagina().includes('José Chan May'));
    expect(textoPagina()).toContain('Jóvenes, Música');
  });

  it('la búsqueda en la URL filtra sin acentos', async () => {
    await abrirApp('/miembros?q=jose', { como: 'secretario@iglesia.local' });
    await esperarA(() => textoPagina().includes('José Chan May'));
    expect(textoPagina()).not.toContain('María Pech Canul');
  });

  it('muestra el estado vacío si no hay resultados', async () => {
    await abrirApp('/miembros?q=zzzz', { como: 'secretario@iglesia.local' });
    await esperarA(() => textoPagina().includes('No hay miembros con estos filtros'));
  });

  it('el perfil muestra datos y ministerios del miembro', async () => {
    const { router } = await abrirApp('/miembros', { como: 'admin@iglesia.local' });
    await esperarA(() => textoPagina().includes('José Chan May'));
    const enlace = [...document.querySelectorAll('a')].find((a) =>
      a.textContent?.includes('José Chan May'),
    )!;
    await router.navigateByUrl(enlace.getAttribute('href')!);
    await esperarA(() => textoPagina().includes('Datos personales'));
    expect(textoPagina()).toContain('jose.chan@gmail.com');
    expect(textoPagina()).toContain('Música');
  });

  it('el detalle del ministerio lista a sus integrantes', async () => {
    await abrirApp('/ministerios/min-jovenes', { como: 'admin@iglesia.local' });
    await esperarA(() => textoPagina().includes('Daniel Cauich Tun'));
    expect(textoPagina()).toContain('Coordinación: María Chan');
  });

  it('el formulario de miembro valida campos obligatorios', async () => {
    const { harness } = await abrirApp('/miembros/nuevo', { como: 'admin@iglesia.local' });
    const raiz = harness.routeNativeElement!;
    (raiz.querySelector('button[type=submit]') as HTMLButtonElement).click();
    await esperarA(() => textoPagina().includes('Escribe el nombre.'));
    expect(textoPagina()).toContain('Escribe los apellidos.');
  });

  it('crea un miembro y abre su perfil', async () => {
    const { harness, router } = await abrirApp('/miembros/nuevo', { como: 'admin@iglesia.local' });
    const raiz = harness.routeNativeElement!;
    escribir(raiz.querySelector('input[formcontrolname=nombre]'), 'Rosa');
    escribir(raiz.querySelector('input[formcontrolname=apellidos]'), 'Canché Pool');
    (raiz.querySelector('button[type=submit]') as HTMLButtonElement).click();
    await esperarA(
      () => /^\/miembros\/[^/]+$/.test(router.url) && router.url !== '/miembros/nuevo',
    );
    await esperarA(() => textoPagina().includes('Rosa Canché Pool'));
  });
});
