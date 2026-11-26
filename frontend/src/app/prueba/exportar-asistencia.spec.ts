import { HttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/mocks/db';
import { ReportesService } from '@/app/features/reportes/reportes.service';
import { abrirApp, esperarA } from './entorno';

// PR #2: el resumen de asistencia mandaba `ministerioId` al exportar, pero el backend lo
// descartaba y el archivo salía con todos los ministerios. Ahora el backend lo aplica; aquí se
// comprueba que la pantalla sí lo envía y que el reporte sale filtrado.

afterEach(() => {
  document.body.innerHTML = '';
  TestBed.resetTestingModule();
});

describe('exportar el resumen de asistencia con el filtro de ministerio', () => {
  const clic = vi.spyOn(HTMLAnchorElement.prototype, 'click');

  beforeEach(() => {
    clic.mockImplementation(() => undefined);
    URL.createObjectURL = vi.fn(() => 'blob:prueba') as typeof URL.createObjectURL;
    URL.revokeObjectURL = vi.fn();
  });
  afterEach(() => clic.mockReset());

  const botonExportar = () =>
    [...document.querySelectorAll<HTMLElement>('button')].find(
      (b) => b.textContent?.trim() === 'Exportar',
    );

  async function exportar(formato: 'PDF' | 'Excel') {
    await esperarA(() => botonExportar() !== undefined);
    botonExportar()!.click();
    await esperarA(() => document.querySelector('[role=menuitem]') !== null);
    [...document.querySelectorAll<HTMLElement>('[role=menuitem]')]
      .find((m) => m.textContent?.includes(formato))!
      .click();
    // La descarga termina con el aviso: así no queda trabajo pendiente al destruir la prueba
    await esperarA(() => (document.body.textContent ?? '').includes('Descargado'));
  }

  it('la petición de descarga lleva el ministerio elegido', async () => {
    await abrirApp('/asistencia?tab=resumen&ministerioId=min-jovenes', {
      como: 'pastor@iglesia.local',
    });
    const http = TestBed.inject(HttpClient);
    const pedidas: string[] = [];
    const original = http.get.bind(http) as (...a: unknown[]) => unknown;
    vi.spyOn(http, 'get').mockImplementation(((url: string, opciones: unknown) => {
      const params = (opciones as { params?: object } | undefined)?.params ?? {};
      pedidas.push(`${url}?${new URLSearchParams(params as Record<string, string>).toString()}`);
      return original(url, opciones);
    }) as never);

    await exportar('PDF');
    await esperarA(() => clic.mock.calls.length === 1);
    const descarga = pedidas.find((u) => u.includes('/reportes/asistencia') && u.includes('pdf'));
    expect(descarga).toContain('ministerioId=min-jovenes');
    expect(descarga).toContain('formato=pdf');
  });

  it('sin ministerio elegido no se manda ministerioId', async () => {
    await abrirApp('/asistencia?tab=resumen', { como: 'pastor@iglesia.local' });
    const servicio = TestBed.inject(ReportesService);
    const archivo = vi.spyOn(servicio, 'archivo');
    await exportar('Excel');
    await esperarA(() => archivo.mock.calls.length === 1);
    const [tipo, filtros, formato] = archivo.mock.calls[0]!;
    expect(tipo).toBe('asistencia');
    expect(formato).toBe('xlsx');
    expect(filtros.ministerioId).toBeUndefined();
  });

  it('la vista previa del simulador (igual que el backend) sale filtrada por ministerio', async () => {
    await abrirApp('/', { como: 'pastor@iglesia.local' });
    // Pase de lista de un evento de Jóvenes y otro de Música, para que el filtro tenga qué separar
    for (const [eventoId, presente] of [
      ['ev-jovenes-hoy', true],
      ['ev-ensayo', true],
      ['ev-ensayo', false],
    ] as const) {
      db.asistencias.push({
        id: `as-prueba-${db.asistencias.length}`,
        eventoId,
        miembroId: presente ? 'm-ana' : 'm-jose',
        presente,
        registradoPorId: 'u-secretario',
        registradoEn: new Date().toISOString(),
      });
    }
    // Eventos con asistencia de cada ministerio (los cancelados no cuentan)
    const conAsistencia = (ministerioId: string | null) =>
      db.eventos.filter(
        (e) =>
          e.estado !== 'CANCELADO' &&
          (ministerioId === null || e.ministerioId === ministerioId) &&
          db.asistencias.some((a) => a.eventoId === e.id),
      );
    const totales = conAsistencia(null).length;
    const elegido = db.ministerios.find((m) => {
      const n = conAsistencia(m.id).length;
      return n > 0 && n < totales;
    });
    expect(
      elegido,
      'los datos de prueba necesitan un ministerio con parte de los eventos',
    ).toBeDefined();

    const servicio = TestBed.inject(ReportesService);
    const leer = (filtros: { ministerioId?: string }) =>
      new Promise<{ filtros: { etiqueta: string; valor: string }[]; secciones: unknown[] }>(
        (resolver) =>
          servicio
            .vistaPrevia('asistencia', { periodo: 'mensual', ...filtros })
            .subscribe((r) => resolver(r as never)),
      );
    const titulos = (r: { secciones: unknown[] }) =>
      (r.secciones[1] as { filas: { evento: string }[] }).filas.map((f) => f.evento).sort();

    const todos = await leer({});
    const uno = await leer({ ministerioId: elegido!.id });
    expect(todos.filtros.some((f) => f.etiqueta === 'Ministerio')).toBe(false);
    expect(uno.filtros).toContainEqual({ etiqueta: 'Ministerio', valor: elegido!.nombre });
    expect(titulos(todos)).toEqual(
      conAsistencia(null)
        .map((e) => e.titulo)
        .sort(),
    );
    expect(titulos(uno)).toEqual(
      conAsistencia(elegido!.id)
        .map((e) => e.titulo)
        .sort(),
    );
  });
});
