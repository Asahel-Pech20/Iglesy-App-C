// Etiquetas en español de misas, servicios y pláticas (E3-15 a E3-18, Genaro).
import { DIAS_SEMANA, formatearMoneda } from '@/app/core/formato';
import type { IdiomaMisa } from '@/app/tipos/misas';
import type { FormaCosto, HorarioSemanal, TipoMisa, TipoPlatica } from '@/app/tipos/servicios';

export const ETIQUETAS_TIPO_MISA: Record<TipoMisa, string> = {
  DIARIA: 'Diaria',
  DOMINICAL: 'Dominical',
  ESPECIAL: 'Especial',
};

export const ETIQUETAS_IDIOMA: Record<IdiomaMisa, string> = {
  ESPANOL: 'Español',
  NAHUATL: 'Náhuatl',
  MAYA: 'Maya',
  TSELTAL: 'Tseltal',
  TSOTSIL: 'Tsotsil',
  MIXTECO: 'Mixteco',
  ZAPOTECO: 'Zapoteco',
  OTOMI: 'Otomí',
  TOTONACO: 'Totonaco',
  MAZATECO: 'Mazateco',
  CHOL: 'Chol',
  OTRO: 'Otro',
};

export const ETIQUETAS_TIPO_PLATICA: Record<TipoPlatica, string> = {
  PREBAUTISMAL: 'Prebautismal',
  PRIMERA_COMUNION: 'Catecismo de primera comunión',
  CONFIRMACION: 'Confirmación',
  PREMATRIMONIAL: 'Prematrimonial',
};

export const ETIQUETAS_FORMA_COSTO: Record<FormaCosto, string> = {
  MONTO: 'Con costo',
  GRATUITO: 'Gratuito',
  DONATIVO: 'Donativo voluntario',
};

/** Días de la semana en orden, para selects: 0 = domingo … 6 = sábado */
export const OPCIONES_DIA = DIAS_SEMANA.map((etiqueta, valor) => ({ valor, etiqueta }));

/** «Sábado 10:00 · Sábado 12:00» */
export function describirHorarios(horarios: HorarioSemanal[]): string {
  return horarios.map((h) => `${DIAS_SEMANA[h.diaSemana]} ${h.hora}`).join(' · ');
}

/** «$350.00», «Gratuito», «Donativo voluntario (sugerido $200.00)» (RN-22) */
export function describirCosto(forma: FormaCosto, monto: string | null, moneda = 'MXN'): string {
  if (forma === 'GRATUITO') return 'Gratuito';
  if (forma === 'DONATIVO') {
    return monto
      ? `Donativo voluntario (sugerido ${formatearMoneda(monto, moneda)})`
      : 'Donativo voluntario';
  }
  return formatearMoneda(monto, moneda);
}

/** «60 min», «1 h 30 min»; null = una hora en misas (RN-27) */
export function describirDuracion(minutos: number | null, porDefecto = '1 h'): string {
  if (minutos === null) return porDefecto;
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

/** «Pbro. Andrés Ruiz» */
export function nombrePadre(p: { nombre: string; titulo?: string | null }): string {
  return p.titulo ? `${p.titulo} ${p.nombre}` : p.nombre;
}
