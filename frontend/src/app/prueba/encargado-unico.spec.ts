// E1-09: un solo encargado (ADMIN_IGLESIA) activo por iglesia. Los mocks siguen la misma regla
// que el backend para que la pantalla de usuarios muestre el mismo error sin el servidor real.
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { afterEach, describe, expect, it } from 'vitest';
import { UsuariosService } from '@/app/features/usuarios/usuarios.service';
import { db } from '@/mocks/db';
import { abrirApp } from './entorno';

afterEach(() => {
  document.body.innerHTML = '';
  TestBed.resetTestingModule();
});

const nuevoEncargado = (email: string, iglesiaId?: string) => ({
  nombre: 'Encargado Nuevo',
  email,
  rol: 'ADMIN_IGLESIA' as const,
  ...(iglesiaId && { iglesiaId }),
});

async function estadoDe(peticion: Promise<unknown>): Promise<number> {
  try {
    await peticion;
    return 200;
  } catch (e) {
    // core/api.ts rechaza con ErrorApi: { status, code, message }
    const estado = (e as { status?: unknown }).status;
    return typeof estado === 'number' ? estado : -1;
  }
}

describe('un solo encargado por iglesia (E1-09)', () => {
  it('el encargado no puede nombrar a otro encargado en su iglesia (409)', async () => {
    await abrirApp('/', { como: 'admin@iglesia.local' });
    const usuarios = TestBed.inject(UsuariosService);
    const estado = await estadoDe(
      firstValueFrom(usuarios.guardar(nuevoEncargado('segundo@iglesia.local'))),
    );
    expect(estado).toBe(409);
  });

  it('la Coordinación reemplaza al encargado: lo desactiva y nombra a otro', async () => {
    await abrirApp('/', { como: 'coordinacion@iglesia.local' });
    const usuarios = TestBed.inject(UsuariosService);
    const actual = db.usuarios.find((u) => u.email === 'admin@iglesia.local')!;
    const iglesia = actual.iglesiaId!;

    // Mientras el actual siga activo, no se puede nombrar a otro
    expect(
      await estadoDe(
        firstValueFrom(usuarios.guardar(nuevoEncargado('otro@iglesia.local', iglesia))),
      ),
    ).toBe(409);

    await firstValueFrom(usuarios.cambiarEstado(actual.id, false));
    expect(
      await estadoDe(
        firstValueFrom(usuarios.guardar(nuevoEncargado('reemplazo@iglesia.local', iglesia))),
      ),
    ).toBe(200);

    // El anterior ya no puede volver mientras haya otro encargado
    expect(await estadoDe(firstValueFrom(usuarios.cambiarEstado(actual.id, true)))).toBe(409);
  });
});
