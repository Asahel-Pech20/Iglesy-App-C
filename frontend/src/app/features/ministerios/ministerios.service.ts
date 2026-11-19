import { inject, Injectable } from '@angular/core';
import { Api } from '@/app/core/api';
import { SesionService } from '@/app/core/sesion.service';
import type {
  CrearMinisterio,
  EditarMinisterio,
  Integrante,
  Ministerio,
  QueryIntegrantes,
  QueryMinisterios,
} from '@/app/tipos/ministerios';

@Injectable({ providedIn: 'root' })
export class MinisteriosService {
  private readonly api = inject(Api);
  private readonly sesion = inject(SesionService);

  /**
   * ¿Puede agregar o quitar integrantes? ADMIN_IGLESIA/PASTOR siempre; COORDINADOR solo en los que coordina.
   * El backend lo valida de nuevo (AGENTS.md regla 2).
   */
  puedeGestionarIntegrantes(ministerio: Pick<Ministerio, 'coordinadores'> | undefined) {
    if (this.sesion.puede('ministerios:editar')) return true;
    const yo = this.sesion.usuario()?.id;
    return (
      this.sesion.puede('ministerios:editar-propio') &&
      Boolean(ministerio?.coordinadores.some((c) => c.id === yo))
    );
  }

  listar(query: QueryMinisterios) {
    return this.api.lista<Ministerio>('/ministerios', { ...query });
  }

  obtener(id: string) {
    return this.api.objeto<Ministerio>(`/ministerios/${id}`);
  }

  guardar(datos: CrearMinisterio | EditarMinisterio, id?: string) {
    return id
      ? this.api.patch<Ministerio>(`/ministerios/${id}`, datos)
      : this.api.post<Ministerio>('/ministerios', datos);
  }

  cambiarEstado(id: string, activo: boolean) {
    return this.api.patch<Ministerio>(`/ministerios/${id}/estado`, { activo });
  }

  asignarCoordinadores(id: string, usuarioIds: string[]) {
    return this.api.put<Ministerio>(`/ministerios/${id}/coordinadores`, { usuarioIds });
  }

  listarIntegrantes(id: string, query: QueryIntegrantes) {
    return this.api.lista<Integrante>(`/ministerios/${id}/miembros`, { ...query });
  }

  vincularMiembros(id: string, miembroIds: string[]) {
    return this.api.post<Ministerio>(`/ministerios/${id}/miembros`, { miembroIds });
  }

  desvincularMiembro(id: string, miembroId: string) {
    return this.api.delete(`/ministerios/${id}/miembros/${miembroId}`);
  }
}
