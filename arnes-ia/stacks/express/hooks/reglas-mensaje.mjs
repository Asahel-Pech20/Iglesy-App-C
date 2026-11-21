// Reglas del mensaje de commit del arnés (funciones puras, sin leer archivos ni git).
// Las usa hooks/verificar.mjs (commit-msg) y las prueba reglas-mensaje.test.mjs.

const CONVENTIONAL =
  /^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(\([\w-]+\))?!?: .+/;
const TRAILER_IA = /^Asistido-por: .+/m;
// Mensajes que git escribe solo al fusionar (`git merge`, `git pull`, botón de GitHub)
const MERGE_AUTOMATICO = /^Merge (branch|remote-tracking branch|pull request|commit|tag) /;

/** ¿Es el mensaje automático de un merge de git? */
export function esMergeAutomatico(mensaje) {
  return MERGE_AUTOMATICO.test(mensaje.split('\n')[0] ?? '');
}

/**
 * Errores del mensaje; lista vacía si es válido.
 * - Un merge automático se acepta tal cual: git lo escribe y no sigue Conventional Commits.
 * - Todo lo demás: primera línea con Conventional Commits y trailer «Asistido-por:».
 */
export function revisarMensaje(mensaje) {
  if (esMergeAutomatico(mensaje)) return [];
  const errores = [];
  if (!CONVENTIONAL.test(mensaje.split('\n')[0] ?? '')) {
    errores.push(
      'La primera línea debe seguir Conventional Commits: «tipo(alcance): descripción».',
    );
  }
  if (!TRAILER_IA.test(mensaje)) {
    errores.push('Falta el trailer «Asistido-por: <herramienta>» (o «Asistido-por: ninguno»).');
  }
  return errores;
}
