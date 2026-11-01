// ============================================================
// PACHA Simulador · Configuración central del mercado de BOLIVIA
// Todos los parámetros del documento "Prompt corregido: simulador
// de helados de Bolivia (31 de octubre de 2026)".
// Regla: ningún valor fijo disperso en el código; cada parámetro
// declara tipo (oficial | referencia | hipotesis | definicion),
// fuente, año de referencia y fecha de consulta.
// Unidades del motor: volumen = miles de litros · dinero = miles Bs
// ============================================================

export type TipoDato = 'oficial' | 'referencia' | 'hipotesis' | 'definicion'

export interface Param<T = number> {
  valor: T
  tipo: TipoDato
  fuente: string
  anio: number
  fechaConsulta: string
}

const F_INE = 'INE Bolivia (Censo 2024, resultados agosto 2025)'
const F_DOC = 'Documento del proyecto (31-10-2026)'

// ---------- 1. Configuración general ----------

export const GENERAL = {
  pais: 'Bolivia',
  industria: 'Helados',
  moneda: 'Boliviano (Bs)',
  poblacionTotal: { valor: 11365333, tipo: 'oficial', fuente: F_INE, anio: 2024, fechaConsulta: '31-10-2026' } as Param,
  poblacionUrbana: { valor: 7846708, tipo: 'oficial', fuente: F_INE, anio: 2024, fechaConsulta: '31-10-2026' } as Param,
  poblacionRural: { valor: 3518625, tipo: 'oficial', fuente: F_INE, anio: 2024, fechaConsulta: '31-10-2026' } as Param,
  consumidoresPotencialesPct: { valor: 0.65, tipo: 'hipotesis', fuente: F_DOC, anio: 2026, fechaConsulta: '31-10-2026' } as Param,
  empresasCompetidoras: ['Delizia', 'PIL Andina', 'Frigo', 'Panda (INAL)', 'Cabrera'] as string[],
  marcasInicialesPorEmpresa: 2 as 2, // una de helado de agua + una de crema
  maxMarcasPorEmpresa: { valor: 5, tipo: 'definicion', fuente: F_DOC, anio: 2026, fechaConsulta: '31-10-2026' } as Param,
  periodosOperativos: { valor: 10, tipo: 'definicion', fuente: F_DOC, anio: 2026, fechaConsulta: '31-10-2026' } as Param,
  crecimientoBaseMercado: { valor: 0.04, tipo: 'hipotesis', fuente: F_DOC, anio: 2026, fechaConsulta: '31-10-2026' } as Param, // 4% en volumen, independiente de la inflación
}

// ---------- 1.1 Regiones (departamentos, Censo 2024) ----------
// La suma debe ser exactamente 11.365.333 (se valida en validarConfiguracion).

export interface RegionDef {
  id: string
  nombre: string
  habitantes: number
  zona: 'altiplano' | 'valles' | 'llanos'
  factorLogistico: number // 1.0 base; >1 región más costosa (hipótesis editable)
}

export const REGIONES: RegionDef[] = [
  { id: 'santa_cruz', nombre: 'Santa Cruz', habitantes: 3122605, zona: 'llanos', factorLogistico: 0.9 },
  { id: 'la_paz', nombre: 'La Paz', habitantes: 3030917, zona: 'altiplano', factorLogistico: 1.1 },
  { id: 'cochabamba', nombre: 'Cochabamba', habitantes: 2016357, zona: 'valles', factorLogistico: 1.0 },
  { id: 'potosi', nombre: 'Potosí', habitantes: 861292, zona: 'altiplano', factorLogistico: 1.5 },
  { id: 'chuquisaca', nombre: 'Chuquisaca', habitantes: 606027, zona: 'valles', factorLogistico: 1.3 },
  { id: 'oruro', nombre: 'Oruro', habitantes: 571471, zona: 'altiplano', factorLogistico: 1.2 },
  { id: 'tarija', nombre: 'Tarija', habitantes: 534210, zona: 'valles', factorLogistico: 1.35 },
  { id: 'beni', nombre: 'Beni', habitantes: 488260, zona: 'llanos', factorLogistico: 1.6 },
  { id: 'pando', nombre: 'Pando', habitantes: 134194, zona: 'llanos', factorLogistico: 1.8 },
]
export const FACTOR_LOGISTICO_TIPO: Param = { valor: 0, tipo: 'hipotesis', fuente: F_DOC, anio: 2026, fechaConsulta: '31-10-2026' }

/** Poder adquisitivo relativo por región (hipótesis editable, escala 1..10) — doc §1.2:
 * "La demanda por región se reparte según el peso poblacional, ajustado por poder adquisitivo". */
export const PODER_ADQUISITIVO_REGIONAL: Record<string, number> = {
  santa_cruz: 7, la_paz: 6.5, cochabamba: 6, tarija: 5.5, chuquisaca: 5, oruro: 4.5, potosi: 4.5, beni: 4, pando: 4,
}

// ---------- 1.2 Dimensionamiento del Año 0 ----------

export const MERCADO = {
  consumoPerCapitaLitros: { valor: 1.4, tipo: 'referencia', fuente: 'Tesis universitaria que cita datos de 2017 (referencia débil, editable)', anio: 2017, fechaConsulta: '31-10-2026' } as Param,
  utilizacionInicial: { valor: 0.7, tipo: 'definicion', fuente: F_DOC, anio: 2026, fechaConsulta: '31-10-2026' } as Param,
  capacidadInicialLitros: { valor: 1000000, tipo: 'definicion', fuente: F_DOC, anio: 2026, fechaConsulta: '31-10-2026' } as Param,
  capacidadMaximaLitros: { valor: 3000000, tipo: 'definicion', fuente: F_DOC, anio: 2026, fechaConsulta: '31-10-2026' } as Param,
}

/** Mercado total del Año 0 en litros: población × consumo per cápita. */
export function mercadoTotalAnio0(poblacion = GENERAL.poblacionTotal.valor, perCapita = MERCADO.consumoPerCapitaLitros.valor): number {
  return Math.round(poblacion * perCapita)
}

/** Oferta inicial de las N empresas jugables en litros (N × capacidad × utilización). */
export function ofertaEmpresasAnio0(nEmpresas: number): number {
  return Math.round(nEmpresas * MERCADO.capacidadInicialLitros.valor * MERCADO.utilizacionInicial.valor)
}

// ---------- 2. Segmentos ----------

export interface SegmentoDef {
  id: string
  nombre: string
  peso: number // % de la demanda (suma 100)
  poderAdquisitivo: number // 1..10
  sensibilidadPrecio: number // 1..10
  sensibilidadPublicidad: number // 1..10
  preferenciaCalidad: number // 1..10
  preferenciaPresentacion: number // 1..10
  preferenciaSabores: number // 1..10
  lealtad: number // 1..10
  elasticidadIngreso: number // hipótesis: respuesta del volumen al poder adquisitivo real
  precioIdeal: number // Bs por litro en el Año 0 (hipótesis, sin IVA)
  ideal: number[] // 6 atributos ideales del producto (1..10)
  // pesos del modelo de atractivo (hipótesis internas del motor)
  pesoPrecio: number
  pesoAwareness: number
  pesoCanales: number
  pesoAjuste: number
}

/** Pesos de simulación (hipótesis). Niños y Jóvenes podrían calibrarse con la
 * estructura por edades del Censo 2024 del INE; se documentan como hipótesis. */
export const SEGMENTOS_BOLIVIA: SegmentoDef[] = [
  {
    id: 'familias', nombre: 'Familias', peso: 0.30, poderAdquisitivo: 5, sensibilidadPrecio: 7, sensibilidadPublicidad: 6,
    preferenciaCalidad: 6, preferenciaPresentacion: 6, preferenciaSabores: 7, lealtad: 6, elasticidadIngreso: 0.8,
    precioIdeal: 22, ideal: [7, 6, 6, 8, 5, 6], pesoPrecio: 0.30, pesoAwareness: 0.24, pesoCanales: 0.24, pesoAjuste: 0.22,
  },
  {
    id: 'jovenes', nombre: 'Jóvenes', peso: 0.25, poderAdquisitivo: 5, sensibilidadPrecio: 6, sensibilidadPublicidad: 8,
    preferenciaCalidad: 6, preferenciaPresentacion: 7, preferenciaSabores: 8, lealtad: 4, elasticidadIngreso: 1.1,
    precioIdeal: 26, ideal: [8, 7, 5, 6, 7, 6], pesoPrecio: 0.18, pesoAwareness: 0.26, pesoCanales: 0.24, pesoAjuste: 0.32,
  },
  {
    id: 'ninos', nombre: 'Niños', peso: 0.20, poderAdquisitivo: 3, sensibilidadPrecio: 9, sensibilidadPublicidad: 9,
    preferenciaCalidad: 4, preferenciaPresentacion: 8, preferenciaSabores: 9, lealtad: 5, elasticidadIngreso: 0.6,
    precioIdeal: 18, ideal: [9, 5, 9, 4, 6, 3], pesoPrecio: 0.28, pesoAwareness: 0.30, pesoCanales: 0.20, pesoAjuste: 0.22,
  },
  {
    id: 'premium', nombre: 'Consumidores premium', peso: 0.15, poderAdquisitivo: 9, sensibilidadPrecio: 3, sensibilidadPublicidad: 5,
    preferenciaCalidad: 10, preferenciaPresentacion: 9, preferenciaSabores: 7, lealtad: 7, elasticidadIngreso: 1.4,
    precioIdeal: 40, ideal: [6, 9, 3, 8, 9, 9], pesoPrecio: 0.12, pesoAwareness: 0.22, pesoCanales: 0.24, pesoAjuste: 0.42,
  },
  {
    id: 'saludables', nombre: 'Consumidores saludables', peso: 0.10, poderAdquisitivo: 7, sensibilidadPrecio: 4, sensibilidadPublicidad: 4,
    preferenciaCalidad: 9, preferenciaPresentacion: 7, preferenciaSabores: 5, lealtad: 6, elasticidadIngreso: 1.2,
    precioIdeal: 34, ideal: [5, 7, 2, 7, 8, 10], pesoPrecio: 0.20, pesoAwareness: 0.22, pesoCanales: 0.22, pesoAjuste: 0.36,
  },
]

// ---------- 3. Canales ----------

export interface CanalDef {
  id: string
  nombre: string
  participacion: number // % de la demanda (suma 100)
  margen: number // sobre el precio de venta al consumidor sin IVA
  unidadesCobertura: number // "unidades de cobertura simuladas" (hipótesis)
  descripcion: string
}

export const CANALES_BOLIVIA: CanalDef[] = [
  {
    id: 'tradicional', nombre: 'Tradicional', participacion: 0.45, margen: 0.20, unidadesCobertura: 2500,
    descripcion: 'Tiendas de barrio, kioscos, micromercados y comercios pequeños.',
  },
  {
    id: 'supermercados', nombre: 'Supermercados', participacion: 0.35, margen: 0.25, unidadesCobertura: 250,
    descripcion: 'Supermercados, hipermercados, cadenas y autoservicios.',
  },
  {
    id: 'horeca', nombre: 'HORECA y Eventos', participacion: 0.20, margen: 0.30, unidadesCobertura: 350,
    descripcion: 'Hoteles, restaurantes, cafeterías, catering y eventos sociales (matrimonios, cumpleaños, quinceañeras, graduaciones, ferias).',
  },
]

// ---------- 4. Producto ----------

export const PRODUCTO = {
  grasaRango: [0, 16] as const, // % (helado de agua tope 4)
  cremosidadRango: [1, 10] as const,
  presentacionRango: [60, 2000] as const, // ml
  variedadRango: [1, 10] as const,
  calidadRango: [1, 10] as const,
  costoFabricacionRango: [8, 45] as const, // Bs por litro equivalente (hipótesis, escala Año 0)
  grasaMaximaAgua: { valor: 4, tipo: 'definicion', fuente: 'Validación de coherencia física (doc §4)', anio: 2026, fechaConsulta: '31-10-2026' } as Param,
}

// ---------- 5. Producción e inventarios ----------

export const PRODUCCION = {
  inventarioInicialPct: { valor: 0.10, tipo: 'definicion', fuente: F_DOC, anio: 2026, fechaConsulta: '31-10-2026' } as Param,
  inventarioSeguridadPct: { valor: 0.05, tipo: 'definicion', fuente: F_DOC, anio: 2026, fechaConsulta: '31-10-2026' } as Param,
  mermaProduccion: { valor: 0.02, tipo: 'definicion', fuente: F_DOC, anio: 2026, fechaConsulta: '31-10-2026' } as Param,
  costoAlmacenamiento: { valor: 0.02, tipo: 'definicion', fuente: F_DOC, anio: 2026, fechaConsulta: '31-10-2026' } as Param, // 2% del valor del inventario (anual)
  costoCapacidadLitro: { valor: 5, tipo: 'hipotesis', fuente: 'Equipo mayormente importado; hipótesis a calibrar (doc §5)', anio: 2026, fechaConsulta: '31-10-2026' } as Param, // Bs por litro en Año 0, indexado por inflación y TC
  pesoImportadoCapacidad: { valor: 0.7, tipo: 'hipotesis', fuente: F_DOC, anio: 2026, fechaConsulta: '31-10-2026' } as Param,
}

// ---------- 6. Estructura de costos ----------

export interface ComponenteCosto {
  id: string
  nombre: string
  peso: number // % del costo total (suma 100)
  importado: number // proporción importada (hipótesis)
  beta: number // sensibilidad a la inflación general (hipótesis doc §18.7)
  precioBase: number // Bs por litro equivalente en el Año 0 (hipótesis de escala)
}

export const COSTOS: ComponenteCosto[] = [
  { id: 'leche', nombre: 'Leche y derivados', peso: 0.35, importado: 0.10, beta: 1.0, precioBase: 4.5 },
  { id: 'azucar', nombre: 'Azúcar y endulzantes', peso: 0.12, importado: 0.05, beta: 0.9, precioBase: 1.2 },
  { id: 'frutas', nombre: 'Frutas y sabores', peso: 0.15, importado: 0.30, beta: 1.1, precioBase: 3.0 },
  { id: 'envases', nombre: 'Envases y embalajes', peso: 0.18, importado: 0.40, beta: 1.0, precioBase: 2.5 },
  { id: 'mano_obra', nombre: 'Mano de obra', peso: 0.12, importado: 0.00, beta: 0.8, precioBase: 1.8 },
  { id: 'energia', nombre: 'Energía y refrigeración', peso: 0.08, importado: 0.00, beta: 0.5, precioBase: 0.9 },
]
// Precio base ponderado ≈ Bs 2,91 por litro de insumos (los costos de fabricación
// completos añaden conversión y calidad: ver costoLitroDesdeAtributos).

// ---------- 7. Marketing ----------

export const MARKETING = {
  publicidadPct: { valor: 0.04, tipo: 'hipotesis', fuente: F_DOC, anio: 2026, fechaConsulta: '31-10-2026' } as Param,
  promocionPct: { valor: 0.03, tipo: 'hipotesis', fuente: F_DOC, anio: 2026, fechaConsulta: '31-10-2026' } as Param,
  investigacionPct: { valor: 0.05, tipo: 'hipotesis', fuente: F_DOC, anio: 2026, fechaConsulta: '31-10-2026' } as Param,
  comisionVendedoresPct: { valor: 0.03, tipo: 'hipotesis', fuente: F_DOC, anio: 2026, fechaConsulta: '31-10-2026' } as Param,
  descuentoMaximo: { valor: 0.15, tipo: 'hipotesis', fuente: F_DOC, anio: 2026, fechaConsulta: '31-10-2026' } as Param,
  presupuestoComercialMax: { valor: 0.20, tipo: 'hipotesis', fuente: F_DOC, anio: 2026, fechaConsulta: '31-10-2026' } as Param,
  relacionPrecioCostoMin: { valor: 2.5, tipo: 'hipotesis', fuente: F_DOC, anio: 2026, fechaConsulta: '31-10-2026' } as Param,
  relacionPrecioCostoMax: { valor: 3.0, tipo: 'hipotesis', fuente: F_DOC, anio: 2026, fechaConsulta: '31-10-2026' } as Param,
}

// ---------- 8. Distribución y logística ----------

export const DISTRIBUCION = {
  costoLogisticoPct: { valor: 0.06, tipo: 'hipotesis', fuente: F_DOC, anio: 2026, fechaConsulta: '31-10-2026' } as Param, // % de las ventas, variable por región
  perdidasCadenaFrio: { valor: 0.02, tipo: 'hipotesis', fuente: F_DOC, anio: 2026, fechaConsulta: '31-10-2026' } as Param,
  entregasATiempoMin: { valor: 0.90, tipo: 'hipotesis', fuente: F_DOC, anio: 2026, fechaConsulta: '31-10-2026' } as Param,
  coberturaBase: { valor: 3, tipo: 'hipotesis', fuente: F_DOC, anio: 2026, fechaConsulta: '31-10-2026' } as Param, // cobertura regional inicial 1..10
}

// ---------- 9. Finanzas, impuestos y macro ----------

export const FINANZAS = {
  tasaInteres: { valor: 0.12, tipo: 'referencia', fuente: 'Tasas activas empresariales en moneda nacional de los bancos grandes, aprox. 10-13% (BCB, ago-oct 2026)', anio: 2026, fechaConsulta: '31-10-2026' } as Param,
  endeudamientoMaximo: { valor: 0.60, tipo: 'hipotesis', fuente: F_DOC, anio: 2026, fechaConsulta: '31-10-2026' } as Param,
  reservaEfectivo: { valor: 0.05, tipo: 'hipotesis', fuente: F_DOC, anio: 2026, fechaConsulta: '31-10-2026' } as Param, // % de las ventas
  plazoCreditoComercialDias: { valor: 30, tipo: 'hipotesis', fuente: F_DOC, anio: 2026, fechaConsulta: '31-10-2026' } as Param,
}

export const IMPUESTOS = {
  iva: { valor: 0.13, tipo: 'referencia', fuente: 'IVA 13% incluido en el precio al consumidor (por confirmar en impuestos.gob.bo antes de fijar)', anio: 2026, fechaConsulta: '31-10-2026' } as Param,
  it: { valor: 0.03, tipo: 'referencia', fuente: 'Impuesto a las Transacciones, 3% sobre ingresos brutos (por confirmar en impuestos.gob.bo)', anio: 2026, fechaConsulta: '31-10-2026' } as Param,
  iue: { valor: 0.25, tipo: 'referencia', fuente: 'Impuesto sobre las Utilidades de las Empresas, 25% (por confirmar en impuestos.gob.bo)', anio: 2026, fechaConsulta: '31-10-2026' } as Param,
}

export const MACRO = {
  tipoCambioAnio0: { valor: 11.8, tipo: 'oficial', fuente: 'BCB, cotización oficial de octubre de 2026 (fin del tipo fijo de Bs 6,96 el 29-06-2026; Bs 11,84 el 23-10-2026)', anio: 2026, fechaConsulta: '31-10-2026' } as Param,
  depreciacionTCAnual: { valor: 0.05, tipo: 'hipotesis', fuente: 'Depreciación anual por escenario (doc §9.3, editable)', anio: 2026, fechaConsulta: '31-10-2026' } as Param,
  brechaParalelo: { valor: 0.08, tipo: 'hipotesis', fuente: 'Brecha entre oficial y paralelo (hipótesis editable)', anio: 2026, fechaConsulta: '31-10-2026' } as Param,
  inflacionAnio0: { valor: 0.057, tipo: 'oficial', fuente: 'INE, inflación interanual de septiembre de 2026 (referencia BCB; 2025: 20,40%; acumulada 2026: 3,88%)', anio: 2026, fechaConsulta: '31-10-2026' } as Param,
  inflacionMensual0: { valor: 0.0085, tipo: 'oficial', fuente: 'INE, septiembre de 2026', anio: 2026, fechaConsulta: '31-10-2026' } as Param,
  inflacionAcumulada0: { valor: 0.0388, tipo: 'oficial', fuente: 'INE, acumulada enero-septiembre 2026', anio: 2026, fechaConsulta: '31-10-2026' } as Param,
  crecimientoNominalIngreso: { valor: 0.06, tipo: 'hipotesis', fuente: 'g: crecimiento nominal del ingreso por segmento y escenario (doc §18.8)', anio: 2026, fechaConsulta: '31-10-2026' } as Param,
}

// ---------- 12. Estacionalidad ----------

export const ESTACIONALIDAD = {
  indices: [8, 10, 7, 6, 8, 9, 7, 10, 8, 7, 8, 10], // Ene..Dic (ilustrativos, hipótesis)
  kZona: { altiplano: 1.3, valles: 1.0, llanos: 0.6 } as Record<string, number>, // hipótesis editables
} as const

// ---------- 11. Parámetros de impacto de eventos ----------
// CORRECCIÓN: los eventos ocurren dentro de cada simulación, por años; el
// docente puede planificar un evento para un año determinado; cada año tiene
// de 1 a 3 eventos y nunca dos de la misma categoría en el mismo año.

export const EVENTOS_IMPACTO = {
  eventosPorAnio: { min: 1, max: 3 }, // corrección del docente (reemplaza 2-5 positivos / 1-3 negativos)
  incrementoMaxDemanda: { valor: 0.25, tipo: 'hipotesis', fuente: F_DOC, anio: 2026, fechaConsulta: '31-10-2026' } as Param,
  reduccionMaxDemanda: { valor: 0.20, tipo: 'hipotesis', fuente: F_DOC, anio: 2026, fechaConsulta: '31-10-2026' } as Param,
  incrementoMaxCostos: { valor: 0.30, tipo: 'hipotesis', fuente: F_DOC, anio: 2026, fechaConsulta: '31-10-2026' } as Param,
  reduccionMaxCostos: { valor: 0.10, tipo: 'hipotesis', fuente: F_DOC, anio: 2026, fechaConsulta: '31-10-2026' } as Param,
  duracionMeses: { min: 1, max: 3 },
  probEconomicoAdverso: { valor: 0.20, tipo: 'hipotesis', fuente: F_DOC, anio: 2026, fechaConsulta: '31-10-2026' } as Param,
  probClimaticoAdverso: { valor: 0.15, tipo: 'hipotesis', fuente: F_DOC, anio: 2026, fechaConsulta: '31-10-2026' } as Param,
  probLogisticoAdverso: { valor: 0.20, tipo: 'hipotesis', fuente: F_DOC, anio: 2026, fechaConsulta: '31-10-2026' } as Param,
  pesosSimultaneos: [1, 0.5, 0.25] as const, // 100% al mayor, 50% al segundo, 25% a los demás
}

// ---------- 18. Inflación ----------

export const INFLACION_CFG = {
  piso: { valor: 0.0, tipo: 'hipotesis', fuente: F_DOC, anio: 2026, fechaConsulta: '31-10-2026' } as Param,
  techo: { valor: 0.30, tipo: 'hipotesis', fuente: F_DOC, anio: 2026, fechaConsulta: '31-10-2026' } as Param,
  traspasoEventos: { valor: 0.20, tipo: 'hipotesis', fuente: 'Fracción del efecto del evento sobre costos que alimenta el factor de inflación (doc §18.6)', anio: 2026, fechaConsulta: '31-10-2026' } as Param,
  limiteFactores: { valor: 0.05, tipo: 'hipotesis', fuente: 'La suma de todos los factores se limita a ±5 pp por periodo (doc §18.5)', anio: 2026, fechaConsulta: '31-10-2026' } as Param,
  escenarios: {
    FAVORABLE: { probabilidad: 0.25, deltaMin: -0.02, deltaMax: -0.005 },
    ESTABLE: { probabilidad: 0.50, deltaMin: -0.005, deltaMax: 0.005 },
    DESFAVORABLE: { probabilidad: 0.25, deltaMin: 0.01, deltaMax: 0.04 },
  } as Record<string, { probabilidad: number; deltaMin: number; deltaMax: number }>,
  factoresMax: {
    combustibles: 0.010, tipo_cambio: 0.015, leche: 0.005, azucar_frutas: 0.005, envases: 0.003,
    transporte: 0.005, abastecimiento: 0.010, clima: 0.007, actividad: 0.010,
  } as Record<string, number>, // aporte máximo en pp por periodo (hipótesis)
}

// ---------- Resto del mercado (no jugable, doc §1.2) ----------

export const RESTO_MERCADO = {
  nombre: 'Resto del mercado',
  descripcion: 'Heladerías artesanales, producción informal, otras marcas e importados.',
  sensibilidadPrecio: 0.8, // responde al precio promedio del mercado y a la inflación
  coberturaBase: 0.75,
  awarenessBase: 0.55,
}

// ============================================================
// Validaciones (doc §1.1, §2, §3, §17)
// ============================================================

export function validarConfiguracion(): { ok: boolean; errores: string[] } {
  const errores: string[] = []
  const sumaPob = REGIONES.reduce((s, r) => s + r.habitantes, 0)
  if (sumaPob !== GENERAL.poblacionTotal.valor) {
    errores.push(`Población por región suma ${sumaPob} y debe ser exactamente ${GENERAL.poblacionTotal.valor}`)
  }
  const sumaSeg = SEGMENTOS_BOLIVIA.reduce((s, x) => s + x.peso, 0)
  if (Math.abs(sumaSeg - 1) > 1e-9) errores.push(`Pesos de segmentos suman ${sumaSeg} y deben ser 100%`)
  const sumaCan = CANALES_BOLIVIA.reduce((s, x) => s + x.participacion, 0)
  if (Math.abs(sumaCan - 1) > 1e-9) errores.push(`Participaciones de canales suman ${sumaCan} y deben ser 100%`)
  const sumaCostos = COSTOS.reduce((s, x) => s + x.peso, 0)
  if (Math.abs(sumaCostos - 1) > 1e-9) errores.push(`Pesos de estructura de costos suman ${sumaCostos} y deben ser 100%`)
  const sumaEst = ESTACIONALIDAD.indices.reduce((s, x) => s + x, 0)
  if (sumaEst !== 98) errores.push(`Índices de estacionalidad suman ${sumaEst} (esperado 98 según el documento)`)
  return { ok: errores.length === 0, errores }
}

// ============================================================
// Configuración por industria (congelada al crear; editable por el docente)
// ============================================================

export interface ConfigIndustria {
  mercadoTotalAnio0: number // en MILES de litros (unidades del motor)
  pesoRestoMercado: number // 0..1 (el docente puede modificarlo)
  regiones: { id: string; nombre: string; habitantes: number; peso: number; pesoEfectivo: number; zona: string; factorLogistico: number; poderAdquisitivo: number }[]
  segmentos: SegmentoDef[]
  canales: CanalDef[]
  costos: ComponenteCosto[]
  estacionalidad: { indices: number[]; factores: number[]; kZona: Record<string, number> }
  macro: { inflacionAnio0: number; tipoCambioAnio0: number; crecimientoBase: number; crecimientoNominalIngreso: number }
  impuestos: { iva: number; it: number; iue: number }
  finanzas: { tasaInteres: number; endeudamientoMaximo: number; reservaEfectivo: number }
  produccion: { capacidadInicialLitros: number; capacidadMaximaLitros: number; merma: number; almacenamiento: number; seguridad: number; costoCapacidadLitro: number }
  distribucion: { costoLogisticoPct: number; perdidasCadenaFrio: number; entregasATiempoMin: number }
  inflacion: typeof INFLACION_CFG
  eventos: typeof EVENTOS_IMPACTO
}

/** Crea la configuración congelada de una industria nueva (doc: separar
 * configuración, decisiones y resultados; compatible con simulaciones ya creadas). */
export function crearConfigIndustria(nEmpresas: number): ConfigIndustria {
  const total = mercadoTotalAnio0()
  const indices = ESTACIONALIDAD.indices as unknown as number[]
  const prom = indices.reduce((s, x) => s + x, 0) / 12
  const factores = indices.map((i) => i / prom)
  const oferta = ofertaEmpresasAnio0(nEmpresas)
  // peso efectivo: poblacional ajustado por poder adquisitivo regional, normalizado a 1
  const bruto = REGIONES.map((r) => ({
    ...r,
    bruto: (r.habitantes / GENERAL.poblacionTotal.valor) * (0.6 + 0.08 * (PODER_ADQUISITIVO_REGIONAL[r.id] ?? 5)),
  }))
  const sumaBruto = bruto.reduce((s, r) => s + r.bruto, 0)
  return {
    // el motor trabaja en miles de litros: 15.911.466 L → 15.911,466 kL
    mercadoTotalAnio0: total / 1000,
    pesoRestoMercado: Math.max(0, Math.min(0.95, 1 - oferta / total)),
    regiones: bruto.map((r) => ({
      id: r.id, nombre: r.nombre, habitantes: r.habitantes,
      peso: r.habitantes / GENERAL.poblacionTotal.valor,
      pesoEfectivo: r.bruto / sumaBruto,
      zona: r.zona, factorLogistico: r.factorLogistico, poderAdquisitivo: PODER_ADQUISITIVO_REGIONAL[r.id] ?? 5,
    })),
    segmentos: SEGMENTOS_BOLIVIA,
    canales: CANALES_BOLIVIA,
    costos: COSTOS,
    estacionalidad: { indices: [...indices], factores, kZona: { ...ESTACIONALIDAD.kZona } },
    macro: {
      inflacionAnio0: MACRO.inflacionAnio0.valor,
      tipoCambioAnio0: MACRO.tipoCambioAnio0.valor,
      crecimientoBase: GENERAL.crecimientoBaseMercado.valor,
      crecimientoNominalIngreso: MACRO.crecimientoNominalIngreso.valor,
    },
    impuestos: { iva: IMPUESTOS.iva.valor, it: IMPUESTOS.it.valor, iue: IMPUESTOS.iue.valor },
    finanzas: {
      tasaInteres: FINANZAS.tasaInteres.valor,
      endeudamientoMaximo: FINANZAS.endeudamientoMaximo.valor,
      reservaEfectivo: FINANZAS.reservaEfectivo.valor,
    },
    produccion: {
      capacidadInicialLitros: MERCADO.capacidadInicialLitros.valor,
      capacidadMaximaLitros: MERCADO.capacidadMaximaLitros.valor,
      merma: PRODUCCION.mermaProduccion.valor,
      almacenamiento: PRODUCCION.costoAlmacenamiento.valor,
      seguridad: PRODUCCION.inventarioSeguridadPct.valor,
      costoCapacidadLitro: PRODUCCION.costoCapacidadLitro.valor,
    },
    distribucion: {
      costoLogisticoPct: DISTRIBUCION.costoLogisticoPct.valor,
      perdidasCadenaFrio: DISTRIBUCION.perdidasCadenaFrio.valor,
      entregasATiempoMin: DISTRIBUCION.entregasATiempoMin.valor,
    },
    inflacion: INFLACION_CFG,
    eventos: EVENTOS_IMPACTO,
  }
}
