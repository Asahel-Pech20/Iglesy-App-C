// Supuestos del diezmo. ÚNICO lugar donde viven.
//
// ⚠ Estos valores NO son reglas del cliente. P-22 y P-23 de docs/requerimientos.md siguen sin
// respuesta; mientras tanto el dominio asume lo de abajo. Cuando el cliente responda, se cambia
// solo este archivo (y las pruebas que lo cubren).

export interface SupuestosDiezmo {
  /**
   * SUPUESTO (P-22, «¿cuándo está ya celebrada una misa?»): una misa está celebrada cuando su
   * celebración ya fue registrada Y su hora de inicio ya pasó. Con `false` basta con la hora.
   */
  exigeRegistroDeCelebracion: boolean;
  /** SUPUESTO (P-22, «¿se puede capturar cero?»): sí, cuando en una misa no se recogió nada. */
  permiteMontoCero: boolean;
  /** SUPUESTO (P-22): una corrección que deja el mismo monto no es corrección y se rechaza. */
  rechazaCorreccionSinCambio: boolean;
  /**
   * SUPUESTO (P-23, «¿cuántas son las misas con más y con menos?»): una sola de cada lado. Si
   * empatan, va primero la más antigua.
   */
  cuantasMisasExtremas: number;
  /**
   * SUPUESTO (P-23, «¿la semana empieza en lunes o domingo?»): lunes. Es el día de la semana
   * como lo cuenta JavaScript: 0 = domingo, 1 = lunes.
   */
  inicioDeSemana: 0 | 1;
}

export const SUPUESTOS_DIEZMO: SupuestosDiezmo = {
  exigeRegistroDeCelebracion: true,
  permiteMontoCero: true,
  rechazaCorreccionSinCambio: true,
  cuantasMisasExtremas: 1,
  inicioDeSemana: 1,
};
