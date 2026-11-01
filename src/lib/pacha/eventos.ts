// ============================================================
// PACHA Simulador · Entorno nacional y eventos de BOLIVIA (doc §10, §11, §15)
// Cada evento tiene: nombre, categoría, fecha o regla de fecha, región,
// intensidad, probabilidad, duración y efectos sobre demanda, costos,
// distribución, ventas e inventarios. Los eventos modifican realmente
// los cálculos del motor (no solo se muestran).
// ============================================================

import { hash01 } from './hash'

export type CategoriaEvento = 'FESTIVO' | 'SOCIAL' | 'ECONOMICO' | 'LOGISTICO' | 'CLIMATICO'

export interface EventoDef {
  nombre: string
  categoria: CategoriaEvento
  region: string // 'NACIONAL' o id de departamento
  regla: string // 'MM-DD' fija · 'PASCUA-n' móvil · 'AGR-MM' mes (editable) · 'EDU-INVERNAL' (Ministerio)
  mesesDuracion: number
  intensidad: number // 0..1
  probabilidad: number // 1 = programado (calendario) · <1 = extraordinario
  efectoDemanda: number // -0.20..0.25 (topes doc §11)
  efectoCosto: number // -0.10..0.30
  efectoLogistica: number // 0..0.5 reducción de disponibilidad/entregas
  canal?: string // 'horeca' para eventos sociales
  signo: 'POSITIVO' | 'NEGATIVO' | 'NEUTRO'
  tipoDato: 'oficial' | 'hipotesis'
  fuente: string
}

// ---------- 10.1 Eventos festivos y culturales ----------
// Fechas móviles calculadas por regla de Pascua; las fijadas por una autoridad
// quedan editables por gestión (regla EDU-INVERNAL, AGR-MM).

export const EVENTOS_FESTIVOS: EventoDef[] = [
  { nombre: 'Año Nuevo', categoria: 'FESTIVO', region: 'NACIONAL', regla: '01-01', mesesDuracion: 1, intensidad: 0.5, probabilidad: 1, efectoDemanda: 0.05, efectoCosto: 0, efectoLogistica: 0, signo: 'POSITIVO', tipoDato: 'oficial', fuente: 'Calendario oficial de Bolivia' },
  { nombre: 'Feria de Alasitas', categoria: 'FESTIVO', region: 'la_paz', regla: '01-24', mesesDuracion: 1, intensidad: 0.5, probabilidad: 1, efectoDemanda: 0.06, efectoCosto: 0, efectoLogistica: 0, signo: 'POSITIVO', tipoDato: 'oficial', fuente: 'Calendario oficial de Bolivia' },
  { nombre: 'San Valentín', categoria: 'FESTIVO', region: 'NACIONAL', regla: '02-14', mesesDuracion: 1, intensidad: 0.3, probabilidad: 1, efectoDemanda: 0.04, efectoCosto: 0, efectoLogistica: 0, canal: 'horeca', signo: 'POSITIVO', tipoDato: 'oficial', fuente: 'Calendario oficial de Bolivia' },
  { nombre: 'Carnaval de Oruro', categoria: 'FESTIVO', region: 'oruro', regla: 'PASCUA-47', mesesDuracion: 1, intensidad: 0.8, probabilidad: 1, efectoDemanda: 0.10, efectoCosto: 0.02, efectoLogistica: 0.05, signo: 'POSITIVO', tipoDato: 'oficial', fuente: 'Calendario oficial (47 días antes de Pascua)' },
  { nombre: 'Carnaval cruceño', categoria: 'FESTIVO', region: 'santa_cruz', regla: 'PASCUA-47', mesesDuracion: 1, intensidad: 0.8, probabilidad: 1, efectoDemanda: 0.10, efectoCosto: 0.02, efectoLogistica: 0.05, signo: 'POSITIVO', tipoDato: 'oficial', fuente: 'Calendario oficial (47 días antes de Pascua)' },
  { nombre: 'Carnaval de Cochabamba', categoria: 'FESTIVO', region: 'cochabamba', regla: 'PASCUA-47', mesesDuracion: 1, intensidad: 0.6, probabilidad: 1, efectoDemanda: 0.08, efectoCosto: 0.02, efectoLogistica: 0.05, signo: 'POSITIVO', tipoDato: 'oficial', fuente: 'Calendario oficial (47 días antes de Pascua)' },
  { nombre: 'Día del Niño', categoria: 'FESTIVO', region: 'NACIONAL', regla: '04-12', mesesDuracion: 1, intensidad: 0.5, probabilidad: 1, efectoDemanda: 0.08, efectoCosto: 0, efectoLogistica: 0, signo: 'POSITIVO', tipoDato: 'oficial', fuente: 'Calendario oficial de Bolivia' },
  { nombre: 'Semana Santa', categoria: 'FESTIVO', region: 'NACIONAL', regla: 'PASCUA-0', mesesDuracion: 1, intensidad: 0.6, probabilidad: 1, efectoDemanda: 0.06, efectoCosto: 0, efectoLogistica: 0.03, signo: 'POSITIVO', tipoDato: 'oficial', fuente: 'Calendario oficial (según Pascua)' },
  { nombre: 'Día de la Madre', categoria: 'FESTIVO', region: 'NACIONAL', regla: '05-27', mesesDuracion: 1, intensidad: 0.6, probabilidad: 1, efectoDemanda: 0.07, efectoCosto: 0, efectoLogistica: 0, canal: 'horeca', signo: 'POSITIVO', tipoDato: 'oficial', fuente: 'Calendario oficial de Bolivia (27 de mayo)' },
  { nombre: 'Fiesta del Gran Poder', categoria: 'FESTIVO', region: 'la_paz', regla: 'PASCUA+56', mesesDuracion: 1, intensidad: 0.7, probabilidad: 1, efectoDemanda: 0.08, efectoCosto: 0, efectoLogistica: 0.04, signo: 'POSITIVO', tipoDato: 'oficial', fuente: 'Sábado previo a la Santísima Trinidad (móvil)' },
  { nombre: 'Año Nuevo Andino Amazónico', categoria: 'FESTIVO', region: 'NACIONAL', regla: '06-21', mesesDuracion: 1, intensidad: 0.4, probabilidad: 1, efectoDemanda: 0.03, efectoCosto: 0, efectoLogistica: 0, signo: 'POSITIVO', tipoDato: 'oficial', fuente: 'Calendario oficial de Bolivia' },
  { nombre: 'San Juan', categoria: 'FESTIVO', region: 'NACIONAL', regla: '06-23', mesesDuracion: 1, intensidad: 0.6, probabilidad: 1, efectoDemanda: 0.06, efectoCosto: 0, efectoLogistica: 0, signo: 'POSITIVO', tipoDato: 'oficial', fuente: 'Calendario oficial (23 y 24 de junio; efecto regional en frío)' },
  { nombre: 'Vacaciones de invierno', categoria: 'FESTIVO', region: 'NACIONAL', regla: 'EDU-INVERNAL', mesesDuracion: 1, intensidad: 0.5, probabilidad: 1, efectoDemanda: 0.07, efectoCosto: 0, efectoLogistica: 0, signo: 'POSITIVO', tipoDato: 'oficial', fuente: 'Las fija el Ministerio de Educación cada gestión (editable)' },
  { nombre: 'Aniversario de Bolivia', categoria: 'FESTIVO', region: 'NACIONAL', regla: '08-06', mesesDuracion: 1, intensidad: 0.7, probabilidad: 1, efectoDemanda: 0.07, efectoCosto: 0, efectoLogistica: 0.03, signo: 'POSITIVO', tipoDato: 'oficial', fuente: 'Calendario oficial de Bolivia' },
  { nombre: "Ch'utillos", categoria: 'FESTIVO', region: 'potosi', regla: 'AGR-08', mesesDuracion: 1, intensidad: 0.6, probabilidad: 1, efectoDemanda: 0.07, efectoCosto: 0, efectoLogistica: 0.03, signo: 'POSITIVO', tipoDato: 'oficial', fuente: 'Festividad de agosto, Potosí (editable)' },
  { nombre: 'Virgen de Urkupiña', categoria: 'FESTIVO', region: 'cochabamba', regla: 'AGR-08', mesesDuracion: 1, intensidad: 0.7, probabilidad: 1, efectoDemanda: 0.08, efectoCosto: 0, efectoLogistica: 0.03, signo: 'POSITIVO', tipoDato: 'oficial', fuente: '14 al 16 de agosto, Quillacollo (editable)' },
  { nombre: 'Virgen de Guadalupe', categoria: 'FESTIVO', region: 'chuquisaca', regla: '09-08', mesesDuracion: 1, intensidad: 0.6, probabilidad: 1, efectoDemanda: 0.07, efectoCosto: 0, efectoLogistica: 0.02, signo: 'POSITIVO', tipoDato: 'oficial', fuente: 'Festividad de Sucre (editable)' },
  { nombre: 'Aniversario de Santa Cruz', categoria: 'FESTIVO', region: 'santa_cruz', regla: '09-24', mesesDuracion: 1, intensidad: 0.7, probabilidad: 1, efectoDemanda: 0.08, efectoCosto: 0, efectoLogistica: 0.03, signo: 'POSITIVO', tipoDato: 'oficial', fuente: 'Calendario oficial de Bolivia' },
  { nombre: 'Día del Estudiante', categoria: 'FESTIVO', region: 'NACIONAL', regla: '09-21', mesesDuracion: 1, intensidad: 0.5, probabilidad: 1, efectoDemanda: 0.06, efectoCosto: 0, efectoLogistica: 0, signo: 'POSITIVO', tipoDato: 'oficial', fuente: 'Calendario oficial de Bolivia' },
  { nombre: 'Expocruz', categoria: 'FESTIVO', region: 'santa_cruz', regla: 'AGR-09', mesesDuracion: 1, intensidad: 0.8, probabilidad: 1, efectoDemanda: 0.10, efectoCosto: 0, efectoLogistica: 0.02, canal: 'horeca', signo: 'POSITIVO', tipoDato: 'oficial', fuente: 'Feria Internacional de Santa Cruz, septiembre (editable)' },
  { nombre: 'Todos Santos', categoria: 'FESTIVO', region: 'NACIONAL', regla: '11-01', mesesDuracion: 1, intensidad: 0.5, probabilidad: 1, efectoDemanda: 0.05, efectoCosto: 0, efectoLogistica: 0, signo: 'POSITIVO', tipoDato: 'oficial', fuente: '1 y 2 de noviembre; efecto regional en frío' },
  { nombre: 'Navidad', categoria: 'FESTIVO', region: 'NACIONAL', regla: '12-25', mesesDuracion: 1, intensidad: 0.9, probabilidad: 1, efectoDemanda: 0.12, efectoCosto: 0, efectoLogistica: 0.02, signo: 'POSITIVO', tipoDato: 'oficial', fuente: 'Calendario oficial de Bolivia' },
]

// ---------- 10.2 Eventos sociales y comerciales (canal HORECA) ----------

export const EVENTOS_SOCIALES: EventoDef[] = [
  { nombre: 'Temporada de matrimonios y quinceañeras', categoria: 'SOCIAL', region: 'NACIONAL', regla: 'PROB', mesesDuracion: 2, intensidad: 0.5, probabilidad: 0.35, efectoDemanda: 0.08, efectoCosto: 0, efectoLogistica: 0, canal: 'horeca', signo: 'POSITIVO', tipoDato: 'hipotesis', fuente: 'Hipótesis de simulación (doc §10.2)' },
  { nombre: 'Graduaciones y promociones escolares', categoria: 'SOCIAL', region: 'NACIONAL', regla: 'PROB', mesesDuracion: 2, intensidad: 0.5, probabilidad: 0.30, efectoDemanda: 0.07, efectoCosto: 0, efectoLogistica: 0, canal: 'horeca', signo: 'POSITIVO', tipoDato: 'hipotesis', fuente: 'Hipótesis de simulación (doc §10.2)' },
  { nombre: 'Feria comercial / congreso empresarial', categoria: 'SOCIAL', region: 'NACIONAL', regla: 'PROB', mesesDuracion: 1, intensidad: 0.4, probabilidad: 0.25, efectoDemanda: 0.05, efectoCosto: 0, efectoLogistica: 0, canal: 'horeca', signo: 'POSITIVO', tipoDato: 'hipotesis', fuente: 'Hipótesis de simulación (doc §10.2)' },
  { nombre: 'Evento deportivo masivo', categoria: 'SOCIAL', region: 'NACIONAL', regla: 'PROB', mesesDuracion: 1, intensidad: 0.4, probabilidad: 0.20, efectoDemanda: 0.05, efectoCosto: 0, efectoLogistica: 0, canal: 'horeca', signo: 'POSITIVO', tipoDato: 'hipotesis', fuente: 'Hipótesis de simulación (doc §10.2)' },
]

// ---------- 10.3 Eventos económicos negativos ----------
// El evento "Inflación elevada" NO suma efectos sobre costos: activa el
// escenario desfavorable (doc §18.6, sin doble conteo).

export const EVENTOS_ECONOMICOS: EventoDef[] = [
  { nombre: 'Escasez de combustible', categoria: 'ECONOMICO', region: 'NACIONAL', regla: 'PROB', mesesDuracion: 2, intensidad: 0.6, probabilidad: 0.14, efectoDemanda: -0.04, efectoCosto: 0.15, efectoLogistica: 0.10, signo: 'NEGATIVO', tipoDato: 'hipotesis', fuente: 'Hipótesis de simulación (doc §10.3)' },
  { nombre: 'Incremento del dólar', categoria: 'ECONOMICO', region: 'NACIONAL', regla: 'PROB', mesesDuracion: 3, intensidad: 0.5, probabilidad: 0.12, efectoDemanda: -0.03, efectoCosto: 0.12, efectoLogistica: 0.03, signo: 'NEGATIVO', tipoDato: 'hipotesis', fuente: 'Hipótesis de simulación (doc §10.3)' },
  { nombre: 'Escasez de leche', categoria: 'ECONOMICO', region: 'NACIONAL', regla: 'PROB', mesesDuracion: 2, intensidad: 0.6, probabilidad: 0.10, efectoDemanda: -0.02, efectoCosto: 0.18, efectoLogistica: 0.02, signo: 'NEGATIVO', tipoDato: 'hipotesis', fuente: 'Hipótesis de simulación (doc §10.3)' },
  { nombre: 'Crisis económica', categoria: 'ECONOMICO', region: 'NACIONAL', regla: 'PROB', mesesDuracion: 3, intensidad: 0.8, probabilidad: 0.08, efectoDemanda: -0.12, efectoCosto: 0.10, efectoLogistica: 0.05, signo: 'NEGATIVO', tipoDato: 'hipotesis', fuente: 'Hipótesis; puede llevar la inflación hasta el techo (doc §18.4)' },
  { nombre: 'Reducción del poder adquisitivo', categoria: 'ECONOMICO', region: 'NACIONAL', regla: 'PROB', mesesDuracion: 2, intensidad: 0.5, probabilidad: 0.12, efectoDemanda: -0.08, efectoCosto: 0.02, efectoLogistica: 0, signo: 'NEGATIVO', tipoDato: 'hipotesis', fuente: 'Hipótesis de simulación (doc §10.3)' },
  { nombre: 'Aumento del costo de materias primas importadas', categoria: 'ECONOMICO', region: 'NACIONAL', regla: 'PROB', mesesDuracion: 2, intensidad: 0.5, probabilidad: 0.12, efectoDemanda: -0.02, efectoCosto: 0.14, efectoLogistica: 0.02, signo: 'NEGATIVO', tipoDato: 'hipotesis', fuente: 'Hipótesis de simulación (doc §10.3)' },
  { nombre: 'Aumento de costos de energía', categoria: 'ECONOMICO', region: 'NACIONAL', regla: 'PROB', mesesDuracion: 1, intensidad: 0.4, probabilidad: 0.10, efectoDemanda: -0.01, efectoCosto: 0.10, efectoLogistica: 0.02, signo: 'NEGATIVO', tipoDato: 'hipotesis', fuente: 'Hipótesis de simulación (doc §10.3)' },
]

// ---------- 10.4 Eventos sociales y logísticos negativos ----------

export const EVENTOS_LOGISTICOS: EventoDef[] = [
  { nombre: 'Bloqueo de carreteras', categoria: 'LOGISTICO', region: 'NACIONAL', regla: 'PROB', mesesDuracion: 1, intensidad: 0.7, probabilidad: 0.15, efectoDemanda: -0.03, efectoCosto: 0.06, efectoLogistica: 0.18, signo: 'NEGATIVO', tipoDato: 'hipotesis', fuente: 'Hipótesis de simulación (doc §10.4)' },
  { nombre: 'Paro de transporte', categoria: 'LOGISTICO', region: 'NACIONAL', regla: 'PROB', mesesDuracion: 1, intensidad: 0.6, probabilidad: 0.10, efectoDemanda: -0.02, efectoCosto: 0.05, efectoLogistica: 0.15, signo: 'NEGATIVO', tipoDato: 'hipotesis', fuente: 'Hipótesis de simulación (doc §10.4)' },
  { nombre: 'Conflictos sociales', categoria: 'LOGISTICO', region: 'NACIONAL', regla: 'PROB', mesesDuracion: 1, intensidad: 0.5, probabilidad: 0.10, efectoDemanda: -0.04, efectoCosto: 0.04, efectoLogistica: 0.10, signo: 'NEGATIVO', tipoDato: 'hipotesis', fuente: 'Hipótesis de simulación (doc §10.4)' },
  { nombre: 'Interrupción de abastecimiento', categoria: 'LOGISTICO', region: 'NACIONAL', regla: 'PROB', mesesDuracion: 1, intensidad: 0.5, probabilidad: 0.08, efectoDemanda: -0.02, efectoCosto: 0.06, efectoLogistica: 0.12, signo: 'NEGATIVO', tipoDato: 'hipotesis', fuente: 'Hipótesis de simulación (doc §10.4)' },
]

// ---------- 10.5 Eventos climáticos negativos ----------

export const EVENTOS_CLIMATICOS: EventoDef[] = [
  { nombre: 'Sequía', categoria: 'CLIMATICO', region: 'NACIONAL', regla: 'PROB', mesesDuracion: 3, intensidad: 0.6, probabilidad: 0.10, efectoDemanda: -0.02, efectoCosto: 0.10, efectoLogistica: 0.03, signo: 'NEGATIVO', tipoDato: 'hipotesis', fuente: 'Hipótesis de simulación (doc §10.5)' },
  { nombre: 'Inundaciones', categoria: 'CLIMATICO', region: 'NACIONAL', regla: 'PROB', mesesDuracion: 2, intensidad: 0.6, probabilidad: 0.10, efectoDemanda: -0.04, efectoCosto: 0.08, efectoLogistica: 0.14, signo: 'NEGATIVO', tipoDato: 'hipotesis', fuente: 'Hipótesis de simulación (doc §10.5)' },
  { nombre: 'Heladas severas', categoria: 'CLIMATICO', region: 'NACIONAL', regla: 'PROB', mesesDuracion: 1, intensidad: 0.5, probabilidad: 0.08, efectoDemanda: -0.03, efectoCosto: 0.05, efectoLogistica: 0.08, signo: 'NEGATIVO', tipoDato: 'hipotesis', fuente: 'Hipótesis; efecto diferenciado en altiplano' },
  { nombre: 'Ola de calor (verano intenso)', categoria: 'CLIMATICO', region: 'NACIONAL', regla: 'PROB', mesesDuracion: 1, intensidad: 0.5, probabilidad: 0.15, efectoDemanda: 0.09, efectoCosto: 0.03, efectoLogistica: 0.02, signo: 'POSITIVO', tipoDato: 'hipotesis', fuente: 'Hipótesis de simulación (sube demanda de helados)' },
  { nombre: 'Fenómeno de La Niña', categoria: 'CLIMATICO', region: 'NACIONAL', regla: 'PROB', mesesDuracion: 3, intensidad: 0.6, probabilidad: 0.06, efectoDemanda: -0.05, efectoCosto: 0.10, efectoLogistica: 0.08, signo: 'NEGATIVO', tipoDato: 'hipotesis', fuente: 'Hipótesis de simulación (doc §10.5)' },
]

/** Catálogo por defecto completo. */
export function catalogoPorDefecto(): EventoDef[] {
  return [...EVENTOS_FESTIVOS, ...EVENTOS_SOCIALES, ...EVENTOS_ECONOMICOS, ...EVENTOS_LOGISTICOS, ...EVENTOS_CLIMATICOS]
}

// ============================================================
// Fechas móviles: cálculo de Pascua (algoritmo de Meeus/Jones/Butcher)
// ============================================================

/** Domingo de Pascua de un año (UTC, sin zonas horarias). */
export function pascua(anio: number): Date {
  const a = anio % 19
  const b = Math.floor(anio / 100)
  const c = anio % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const mes = Math.floor((h + l - 7 * m + 114) / 31)
  const dia = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(Date.UTC(anio, mes - 1, dia))
}

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

/** Meses (1..12) que cubre un evento según su regla, año y duración. */
export function mesesDeEvento(ev: { regla: string; mesesDuracion: number }, anio: number): number[] {
  const dur = Math.max(1, Math.min(3, ev.mesesDuracion))
  const salida = new Set<number>()

  if (ev.regla.startsWith('PASCUA')) {
    const offset = parseInt(ev.regla.slice(6), 10) || 0
    const d = pascua(anio)
    d.setUTCDate(d.getUTCDate() + offset)
    let mes = d.getUTCMonth() + 1
    for (let i = 0; i < dur; i++) { salida.add(Math.min(12, Math.max(1, mes))); mes++ }
    return [...salida].sort((a, b) => a - b)
  }

  if (ev.regla === 'EDU-INVERNAL') {
    // Vacaciones de invierno: junio en la práctica (editable por gestión)
    for (let i = 0; i < dur; i++) salida.add(Math.min(12, 6 + i))
    return [...salida].sort((a, b) => a - b)
  }

  if (ev.regla.startsWith('AGR-')) {
    const mes = parseInt(ev.regla.slice(4), 10)
    for (let i = 0; i < dur; i++) salida.add(Math.min(12, mes + i))
    return [...salida].sort((a, b) => a - b)
  }

  if (ev.regla === 'PROB') return [] // se resuelven al sortear el periodo

  // 'MM-DD' fija
  const mes = parseInt(ev.regla.slice(0, 2), 10)
  if (!Number.isNaN(mes) && mes >= 1 && mes <= 12) {
    for (let i = 0; i < dur; i++) salida.add(Math.min(12, mes + i))
  }
  return [...salida].sort((a, b) => a - b)
}

/** Etiqueta legible de la fecha de un evento (para reportes). */
export function etiquetaFecha(ev: { regla: string }, anio: number): string {
  if (ev.regla.startsWith('PASCUA')) {
    const offset = parseInt(ev.regla.slice(6), 10) || 0
    const d = pascua(anio)
    d.setUTCDate(d.getUTCDate() + offset)
    return `${offset === 0 ? 'Pascua' : `${Math.abs(offset)} días ${offset < 0 ? 'antes' : 'después'} de Pascua`} · ${d.getUTCDate()} ${MESES[d.getUTCMonth()]} ${anio}`
  }
  if (ev.regla === 'EDU-INVERNAL') return `Vacaciones de invierno (Ministerio de Educación, gestión ${anio})`
  if (ev.regla.startsWith('AGR-')) return `Mes ${ev.regla.slice(4)} ${anio} (editable)`
  if (ev.regla === 'PROB') return `Extraordinario ${anio}`
  const mes = parseInt(ev.regla.slice(0, 2), 10)
  const dia = parseInt(ev.regla.slice(3, 5), 10)
  return `${dia} de ${MESES[mes - 1] ?? mes} ${anio}`
}

// ============================================================
// Resolución y agrupación de eventos de un periodo (doc §15)
// ============================================================

export interface EventoPeriodo {
  nombre: string
  categoria: CategoriaEvento
  region: string // 'NACIONAL' o id de región
  meses: number[]
  efectoDemanda: number
  efectoCosto: number
  efectoLogistica: number
  canal?: string
  origen: 'PLAN_DOCENTE' | 'PLAN_AUTO'
  traza: string
}

// ============================================================
// PLAN DE EVENTOS POR AÑO (corrección del docente)
// · Los eventos ocurren dentro de cada simulación (por industria)
// · Ocurren por años: el docente puede fijar un evento para un año determinado
// · De 1 a 3 eventos por año, sin repetir categoría dentro del mismo año
// ============================================================

export interface EntradaPlan {
  evento: EventoDef
  origenPlan: 'DOCENTE' | 'AUTO'
}

/** Meses de un evento planificado: regla de calendario o sorteo determinista. */
function mesesPlanificados(ev: EventoDef, anio: number, semillaBase: string): number[] {
  const meses = mesesDeEvento(ev, anio)
  if (meses.length > 0) return meses
  // regla PROB u otros: mes de inicio determinista por semilla (auditable)
  const mesInicio = 1 + Math.floor(hash01(`${semillaBase}|${anio}|${ev.nombre}|mes`) * 12)
  const salida: number[] = []
  for (let i = 0; i < Math.max(1, Math.min(3, ev.mesesDuracion)); i++) salida.push(Math.min(12, mesInicio + i))
  return [...new Set(salida)].sort((a, b) => a - b)
}

/**
 * Resuelve las entradas del PLAN de un año de una simulación en eventos del
 * periodo. Determinista: la misma planificación produce siempre el mismo
 * resultado (doc §15: semilla registrada y auditable).
 */
export function resolverEventosDesdePlan(entradas: EntradaPlan[], anio: number, semillaBase: string): EventoPeriodo[] {
  const salida: EventoPeriodo[] = []
  for (const entrada of entradas) {
    const ev = entrada.evento
    const meses = mesesPlanificados(ev, anio, semillaBase)
    const origenLabel = entrada.origenPlan === 'DOCENTE' ? 'Planificado por el docente' : 'Completado automáticamente'
    salida.push({
      nombre: ev.nombre, categoria: ev.categoria, region: ev.region, meses,
      efectoDemanda: ev.efectoDemanda, efectoCosto: ev.efectoCosto, efectoLogistica: ev.efectoLogistica,
      canal: ev.canal, origen: entrada.origenPlan === 'DOCENTE' ? 'PLAN_DOCENTE' : 'PLAN_AUTO',
      traza: `${origenLabel} para el Año ${anio} · ${etiquetaFecha(ev, anio)}`,
    })
  }
  return salida.sort((a, b) => a.nombre.localeCompare(b.nombre))
}

/**
 * Elige 1 a 3 eventos de categorías DISTINTAS para completar automáticamente
 * un año sin planificación (corrección: de uno a tres eventos por año, sin
 * repetir categoría). Determinista por semilla; sesgo adverso configurable.
 */
export function elegirEventosAuto(
  catalogo: EventoDef[],
  anio: number,
  semillaBase: string,
  config: { eventosPorAnio: { min: number; max: number }; probEconomicoAdverso: number; probClimaticoAdverso: number; probLogisticoAdverso: number },
  nombresYaPlanificados: string[] = []
): EventoDef[] {
  const { min, max } = config.eventosPorAnio ?? { min: 1, max: 3 }
  const minC = Math.max(1, Math.min(3, min))
  const maxC = Math.max(minC, Math.min(3, max))
  const cantidad = minC + Math.floor(hash01(`${semillaBase}|${anio}|cantidad`) * (maxC - minC + 1))

  const ocupadas = new Set<CategoriaEvento>()
  const usados = new Set(nombresYaPlanificados)
  const elegidos: EventoDef[] = []
  const probAdverso = (config.probEconomicoAdverso + config.probClimaticoAdverso + config.probLogisticoAdverso) / 3

  for (let slot = 0; slot < cantidad; slot++) {
    const libres = catalogo.filter((ev) => !ocupadas.has(ev.categoria) && !usados.has(ev.nombre))
    if (libres.length === 0) break
    // lado adverso o favorable para este slot (probabilidad configurable)
    const ladoAdverso = hash01(`${semillaBase}|${anio}|slot${slot}|lado`) < probAdverso
    const preferidos = libres.filter((ev) => (ladoAdverso ? ev.signo === 'NEGATIVO' : ev.signo === 'POSITIVO'))
    const candidatos = preferidos.length > 0 ? preferidos : libres
    const elegido = candidatos[Math.floor(hash01(`${semillaBase}|${anio}|slot${slot}|ev`) * candidatos.length)]
    elegidos.push(elegido)
    ocupadas.add(elegido.categoria)
    usados.add(elegido.nombre)
  }
  return elegidos
}

/**
 * Agrupa efectos de eventos simultáneos evitando duplicar (doc §15):
 * · por variable, región y mes
 * · pesos decrecientes: 100% al mayor, 50% al segundo, 25% a los demás
 * · dos eventos del mismo tipo y región: solo el de mayor intensidad
 * · limitado a los topes de la sección 11
 */
export interface EfectosAgrupados {
  demanda: Record<string, number[]> // región → 12 meses (multiplicador 1+x)
  costo: number[] // nacional, por mes (multiplicador 1+x)
  logistica: Record<string, number[]> // región → 12 meses (disponibilidad 1-x)
  demandaHoreca: number[] // extra canal HORECA por mes
  trazabilidad: { variable: string; region: string; mes: number; eventos: { nombre: string; efecto: number; peso: number }[]; total: number }[]
}

const TOPES = { demandaMas: 0.25, demandaMenos: 0.20, costoMas: 0.30, costoMenos: 0.10, logistica: 0.5 }

export function agruparEfectos(eventos: EventoPeriodo[]): EfectosAgrupados {
  const meses = Array.from({ length: 12 }, (_, i) => i + 1)

  // 1) deduplicar mismo tipo+categoría+región (queda el de mayor intensidad)
  const vistos = new Map<string, EventoPeriodo>()
  for (const ev of eventos) {
    const clave = `${ev.categoria}|${ev.region}|${ev.nombre}`
    const previo = vistos.get(clave)
    if (!previo || Math.abs(ev.efectoDemanda) + Math.abs(ev.efectoCosto) > Math.abs(previo.efectoDemanda) + Math.abs(previo.efectoCosto)) {
      vistos.set(clave, ev)
    }
  }
  const lista = [...vistos.values()]

  const demanda: Record<string, number[]> = {}
  const logistica: Record<string, number[]> = {}
  const demandaHoreca = Array(12).fill(0)
  const trazabilidad: EfectosAgrupados['trazabilidad'] = []

  const acumular = (mapa: Record<string, number[]>, region: string, mes: number, valor: number) => {
    if (!mapa[region]) mapa[region] = Array(12).fill(0)
    mapa[region][mes - 1] += valor
  }

  // 2) por variable: agrupar por región y mes, ordenar por magnitud, pesos 100/50/25
  for (const variable of ['demanda', 'costo', 'logistica'] as const) {
    const grupos = new Map<string, { ev: EventoPeriodo; valor: number }[]>()
    for (const ev of lista) {
      const valor = variable === 'demanda' ? ev.efectoDemanda : variable === 'costo' ? ev.efectoCosto : ev.efectoLogistica
      if (Math.abs(valor) < 1e-9) continue
      for (const mes of ev.meses) {
        const clave = `${variable === 'costo' ? 'NACIONAL' : ev.region}|${mes}`
        const arr = grupos.get(clave) ?? []
        arr.push({ ev, valor })
        grupos.set(clave, arr)
      }
    }
    for (const [clave, items] of grupos) {
      const [region, mesStr] = clave.split('|')
      const mes = parseInt(mesStr, 10)
      items.sort((a, b) => Math.abs(b.valor) - Math.abs(a.valor))
      // mismo tipo y región ya deduplicado; pesos decrecientes
      let total = 0
      const trazas: { nombre: string; efecto: number; peso: number }[] = []
      items.forEach((it, idx) => {
        const peso = idx === 0 ? 1 : idx === 1 ? 0.5 : 0.25
        total += it.valor * peso
        trazas.push({ nombre: it.ev.nombre, efecto: it.valor, peso })
      })
      // topes por variable y mes
      const tope = variable === 'demanda' ? (total >= 0 ? TOPES.demandaMas : TOPES.demandaMenos)
        : variable === 'costo' ? (total >= 0 ? TOPES.costoMas : TOPES.costoMenos)
        : TOPES.logistica
      total = Math.max(-tope, Math.min(tope, total))
      trazabilidad.push({ variable, region, mes, eventos: trazas, total })
      if (variable === 'demanda') {
        acumular(demanda, region, mes, total)
        // eventos sociales impulsan el canal HORECA además de la demanda general
        if (items[0].ev.canal === 'horeca') demandaHoreca[mes - 1] += Math.max(0, total)
      } else if (variable === 'logistica') {
        acumular(logistica, region, mes, total)
      }
    }
  }

  const costo = Array(12).fill(0)
  for (const t of trazabilidad) {
    if (t.variable === 'costo') costo[t.mes - 1] += t.total
  }

  return {
    demanda: Object.fromEntries(Object.entries(demanda).map(([r, arr]) => [r, arr.map((v) => 1 + v)])),
    costo: costo.map((v) => 1 + v),
    logistica: Object.fromEntries(Object.entries(logistica).map(([r, arr]) => [r, arr.map((v) => 1 - v)])),
    demandaHoreca: demandaHoreca.map((v) => 1 + v),
    trazabilidad,
  }
}

/** Señales de inflación derivadas de los eventos (traspaso del 20%, doc §18.6). */
export function senalesInflacionDesdeEventos(
  eventos: EventoPeriodo[],
  traspaso = 0.2
): { factor: string; senal: number }[] {
  const senales: Record<string, number> = {}
  const sumar = (factor: string, efectoCosto: number) => {
    if (Math.abs(efectoCosto) < 1e-9) return
    const s = Math.sign(efectoCosto) * Math.min(1, Math.abs(efectoCosto) * traspaso * 10)
    senales[factor] = (senales[factor] ?? 0) + s
  }
  for (const ev of eventos) {
    switch (ev.nombre) {
      case 'Escasez de combustible': sumar('combustibles', ev.efectoCosto); break
      case 'Incremento del dólar': sumar('tipo_cambio', ev.efectoCosto); break
      case 'Escasez de leche': sumar('leche', ev.efectoCosto); break
      case 'Aumento del costo de materias primas importadas': sumar('envases', ev.efectoCosto * 0.5); sumar('azucar_frutas', ev.efectoCosto * 0.5); break
      case 'Aumento de costos de energía': sumar('transporte', ev.efectoCosto); break
      case 'Bloqueo de carreteras':
      case 'Paro de transporte':
      case 'Conflictos sociales':
      case 'Interrupción de abastecimiento': sumar('abastecimiento', ev.efectoCosto); break
      case 'Sequía':
      case 'Inundaciones':
      case 'Heladas severas':
      case 'Fenómeno de La Niña': sumar('clima', ev.efectoCosto); break
      default: break
    }
  }
  return Object.entries(senales).map(([factor, senal]) => ({ factor, senal: Math.max(-1, Math.min(1, senal)) }))
}
