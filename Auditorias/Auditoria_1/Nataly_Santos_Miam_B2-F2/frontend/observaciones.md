# Auditoría 1 · F2 — Miembros, ministerios, SelectorMiembros (Nataly)

> Lee solo este archivo y los que cita. Contexto general: [../../README.md](../../README.md).
> Tu PR #8 (`feat/F2-11-asistencia-actividades`) sigue abierto y **no se auditó**. Estas observaciones son sobre `develop`.
> **Actualización (2026-11-25, Nataly):** revisado contra `main` (Angular): 01, 03 y 04 están hechas; 02 espera el PR #2 de Oscar.

## Resultado

- Las páginas de listado tienen los estados cargando, vacío y error.
- `SelectorMiembros` ya lo usan F3 (responsables y asistencia) y F4 (donante).

## Observaciones

| ID | Sev. | Dónde | Observación | Acción sugerida | Estado |
|---|---|---|---|---|---|
| A1-F2-01 | Info | `features/miembros/pages/MiembroPerfilPage.tsx` | F4 dejó listo `features/donaciones/components/AportacionesDelMiembro.tsx` (prop `miembroId`) para la pestaña «Aportaciones» del perfil. No tocó tu archivo para no chocar con el PR #8. | Cuando se fusione el PR #8: agregar la pestaña con `<Puede permiso="donaciones:leer"><AportacionesDelMiembro miembroId={id} /></Puede>`. | [x] Hecha en Angular: pestaña «Aportaciones» del perfil con `app-aportaciones-del-miembro` (`miembro-perfil.page.html`), solo con `donaciones:leer` |
| A1-F2-02 | Info | `MiembrosPage.tsx`, `MinisterioDetallePage.tsx` | F4-11 pide botones «Exportar» con los filtros actuales. El componente ya existe: `features/reportes/components/BotonExportar.tsx`. | `<BotonExportar tipo="miembros" filtros={{ estado }} />` en el listado y `<BotonExportar tipo="ministerios" filtros={{ ministerioId: id }} />` en el detalle. | [ ] Depende del PR #2 de Oscar (F4-11, botones «Exportar»), que sigue abierto; no es de F2 |
| A1-F2-03 | Media | `docs/frontend/F2-…/tasks-01-miembros.md:9` | Criterio sin cumplir: «Clic en fila abre el perfil» (por ahora es clic en el nombre). Depende de `DataTable` (F1), que el PR #8 modifica. | Cerrarlo en el PR #8 o anotar el acuerdo con F1. | [x] Hecha en Angular: clic en cualquier parte de la fila abre el perfil (`abrirFila` en `miembros.page`); marcado en `tasks-01-miembros.md` |
| A1-F2-04 | Media | `MinisterioDetallePage.tsx:265` | F2-11, pestaña «Actividades»: sigue el comentario `se conecta con la lista de eventos de F3`. Hay que reutilizar `ListaEventos` y `useEventos({ ministerioId })` de F3 sin duplicarlos. | Cerrarlo en el PR #8. | [x] Hecha en Angular: pestaña «Actividades» con `app-actividades-ministerio` de F3 (`ministerio-detalle.page.html`), sin duplicar la lista |

## Pendientes de tus tasks

- **F2-06:** marcado; F3 y F4 usan `SelectorMiembros`.
- **F2-01:** hecho (ver `A1-F2-03`).
- **F2-11:** hecho (ver `A1-F2-04`).
