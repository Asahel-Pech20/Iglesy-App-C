import { describe, expect, it } from 'vitest';
import { esMergeAutomatico, revisarMensaje } from './reglas-mensaje.mjs';

const TRAILER = '\n\nAsistido-por: Claude Code';

describe('mensaje de commit del arnés', () => {
  it('acepta Conventional Commits con el trailer Asistido-por', () => {
    expect(revisarMensaje(`feat(usuarios): agrega filtro${TRAILER}`)).toEqual([]);
    expect(revisarMensaje('fix(E1)!: cambia el contrato\n\nAsistido-por: ninguno')).toEqual([]);
  });

  it('rechaza una primera línea sin Conventional Commits', () => {
    expect(revisarMensaje(`arreglos varios${TRAILER}`)).toHaveLength(1);
  });

  it('rechaza un mensaje sin el trailer Asistido-por', () => {
    expect(revisarMensaje('docs: actualiza el README')).toEqual([
      'Falta el trailer «Asistido-por: <herramienta>» (o «Asistido-por: ninguno»).',
    ]);
  });

  it('acepta los mensajes automáticos de merge de git y de GitHub', () => {
    for (const mensaje of [
      "Merge remote-tracking branch 'origin/main' into feat/E1-04-zona-horaria",
      "Merge branch 'main' into fix/E1-auditoria2\n\n# Conflicts:\n#\tdocs/bitacora-ia.md\n",
      'Merge pull request #10 from Asahel-Pech20/feat/E1-08-arquitectura-ci',
    ]) {
      expect(esMergeAutomatico(mensaje)).toBe(true);
      expect(revisarMensaje(mensaje)).toEqual([]);
    }
  });

  it('no confunde un commit normal que empieza con «Merge» con un merge automático', () => {
    expect(esMergeAutomatico('Merge de datos sin tipo')).toBe(false);
    expect(revisarMensaje(`Merge de datos sin tipo${TRAILER}`)).toHaveLength(1);
  });
});
