// ============================================================
// PACHA Simulador · Catálogo del escenario (Markestrat Helados)
// 5 segmentos · 3 canales · 15 estudios de mercado · I+D
// ============================================================

export interface Segmento {
  id: string
  nombre: string
  emoji: string
  precioIdeal: number // Bs por unidad
  sensibilidadPrecio: number // exponente de caída al subir el precio
  demandaBase: number // miles de unidades en el año 1
  pesoPrecio: number
  pesoAwareness: number
  pesoCanales: number
  pesoAjuste: number
  ideal: number[] // 6 atributos ideales (1..10)
  descripcion: string
}

export const SEGMENTOS: Segmento[] = [
  {
    id: 'ninos',
    nombre: 'Niños',
    emoji: '🧒',
    precioIdeal: 5,
    sensibilidadPrecio: 1.5,
    demandaBase: 900,
    pesoPrecio: 0.28,
    pesoAwareness: 0.30,
    pesoCanales: 0.20,
    pesoAjuste: 0.22,
    ideal: [8, 5, 9, 4, 6, 3],
    descripcion: 'Buscan sabor frutal, mucho dulzor y presentaciones divertidas. Muy sensibles al precio.',
  },
  {
    id: 'adolescentes',
    nombre: 'Adolescentes',
    emoji: '🎧',
    precioIdeal: 7,
    sensibilidadPrecio: 1.1,
    demandaBase: 1100,
    pesoPrecio: 0.22,
    pesoAwareness: 0.32,
    pesoCanales: 0.22,
    pesoAjuste: 0.24,
    ideal: [7, 6, 7, 5, 7, 4],
    descripcion: 'Siguen modas y publicidad. Prefieren helados cremosos con buen envase para llevar.',
  },
  {
    id: 'jovenes',
    nombre: 'Jóvenes',
    emoji: '⚽',
    precioIdeal: 9,
    sensibilidadPrecio: 0.9,
    demandaBase: 1000,
    pesoPrecio: 0.18,
    pesoAwareness: 0.26,
    pesoCanales: 0.24,
    pesoAjuste: 0.32,
    ideal: [6, 8, 5, 6, 8, 6],
    descripcion: 'Valoran cremosidad y presentación premium. Aceptan precios medios-altos.',
  },
  {
    id: 'adultos',
    nombre: 'Adultos',
    emoji: '💼',
    precioIdeal: 14,
    sensibilidadPrecio: 0.7,
    demandaBase: 700,
    pesoPrecio: 0.12,
    pesoAwareness: 0.22,
    pesoCanales: 0.24,
    pesoAjuste: 0.42,
    ideal: [5, 9, 3, 7, 9, 9],
    descripcion: 'Segmento premium: ingredientes naturales, baja agresividad dulce y máxima calidad.',
  },
  {
    id: 'familias',
    nombre: 'Familias',
    emoji: '🏠',
    precioIdeal: 6.5,
    sensibilidadPrecio: 1.2,
    demandaBase: 1300,
    pesoPrecio: 0.30,
    pesoAwareness: 0.24,
    pesoCanales: 0.24,
    pesoAjuste: 0.22,
    ideal: [7, 6, 6, 8, 5, 6],
    descripcion: 'Compras familiares grandes: buen tamaño de porción a precio accesible.',
  },
]

export interface Canal {
  id: string
  nombre: string
  emoji: string
  pesoDemanda: number // participación del canal en el mercado
  vendedoresNecesarios: number // vendedores para cobertura 100%
  salario: number // miles Bs por vendedor por año
  descripcion: string
}

export const CANALES: Canal[] = [
  {
    id: 'tiendas',
    nombre: 'Tiendas de barrio',
    emoji: '🏪',
    pesoDemanda: 0.45,
    vendedoresNecesarios: 30,
    salario: 9,
    descripcion: 'El canal más grande de Bolivia. Requiere mucha fuerza de ventas puerta a puerta.',
  },
  {
    id: 'supermercados',
    nombre: 'Supermercados',
    emoji: '🛒',
    pesoDemanda: 0.35,
    vendedoresNecesarios: 20,
    salario: 9,
    descripcion: 'Canal moderno. Menos vendedores, pero negociación con cadenas.',
  },
  {
    id: 'kioscos',
    nombre: 'Kioscos y puestos',
    emoji: '🍭',
    pesoDemanda: 0.20,
    vendedoresNecesarios: 12,
    salario: 9,
    descripcion: 'Venta callejera e informal. Ideal para impulso de compra en verano.',
  },
]

export const ATRIBUTOS = [
  { id: 1, nombre: 'Sabor frutal', emoji: '🍓' },
  { id: 2, nombre: 'Cremosidad', emoji: '🍦' },
  { id: 3, nombre: 'Dulzor', emoji: '🍯' },
  { id: 4, nombre: 'Tamaño de porción', emoji: '📏' },
  { id: 5, nombre: 'Presentación / envase', emoji: '🎁' },
  { id: 6, nombre: 'Ingredientes naturales', emoji: '🌿' },
]

export interface EstudioDef {
  id: number
  nombre: string
  descripcion: string
  costo: number // miles Bs (se congela al enviar la decisión)
  icono: string
  categoria: string
}

export const ESTUDIOS: EstudioDef[] = [
  { id: 1, nombre: 'Awareness de marca', descripcion: 'Mide el conocimiento de marca de todas las firmas (propia y competencia).', costo: 60, icono: '📣', categoria: 'Marca' },
  { id: 2, nombre: 'Panel de consumidores', descripcion: 'Intención de compra por segmento y marca según hogares encuestados.', costo: 90, icono: '🛍️', categoria: 'Consumidores' },
  { id: 3, nombre: 'Panel de distribuidores', descripcion: 'Cobertura y exhibición de cada firma por canal de distribución.', costo: 80, icono: '🚚', categoria: 'Distribución' },
  { id: 4, nombre: 'Escala semántica · Niños', descripcion: 'Calificación de atributos de tus marcas vs. el ideal del segmento Niños.', costo: 40, icono: '🧒', categoria: 'Percepción' },
  { id: 5, nombre: 'Escala semántica · Adolescentes', descripcion: 'Calificación de atributos de tus marcas vs. el ideal del segmento Adolescentes.', costo: 40, icono: '🎧', categoria: 'Percepción' },
  { id: 6, nombre: 'Escala semántica · Jóvenes', descripcion: 'Calificación de atributos de tus marcas vs. el ideal del segmento Jóvenes.', costo: 40, icono: '⚽', categoria: 'Percepción' },
  { id: 7, nombre: 'Escala semántica · Adultos', descripcion: 'Calificación de atributos de tus marcas vs. el ideal del segmento Adultos.', costo: 40, icono: '💼', categoria: 'Percepción' },
  { id: 8, nombre: 'Escala semántica · Familias', descripcion: 'Calificación de atributos de tus marcas vs. el ideal del segmento Familias.', costo: 40, icono: '🏠', categoria: 'Percepción' },
  { id: 9, nombre: 'Mapa perceptual', descripcion: 'Posición de todas las marcas en el plano precio-calidad percibida.', costo: 100, icono: '🗺️', categoria: 'Percepción' },
  { id: 10, nombre: 'Pronóstico de demanda', descripcion: 'Estimación de la demanda del próximo año por segmento.', costo: 120, icono: '🔮', categoria: 'Mercado' },
  { id: 11, nombre: 'Publicidad de la competencia', descripcion: 'Presupuestos publicitarios aproximados de las otras firmas.', costo: 70, icono: '📺', categoria: 'Competencia' },
  { id: 12, nombre: 'Fuerza de ventas de la competencia', descripcion: 'Vendedores estimados de las otras firmas por canal.', costo: 70, icono: '🤝', categoria: 'Competencia' },
  { id: 13, nombre: 'Experimento de precio', descripcion: 'Sensibilidad al precio estimada por segmento y precio sugerido.', costo: 110, icono: '🧪', categoria: 'Experimentos' },
  { id: 14, nombre: 'Experimento de atributos', descripcion: 'Qué atributos pesan más en la preferencia de cada segmento.', costo: 110, icono: '⚖️', categoria: 'Experimentos' },
  { id: 15, nombre: 'Segmentación emergente', descripcion: 'Revela el perfil ideal de atributos de cada segmento del mercado.', costo: 150, icono: '💎', categoria: 'Mercado' },
]

// ===================== I+D =====================

export const ID_CONFIG = {
  maxProyectosPorAnio: 4,
  maxNombresPorSimulacion: 5,
  presupuestoMin: 100,
  presupuestoMax: 1000,
  costoBaseAtributo: 0.35, // Bs de costo unitario por punto promedio de atributos
  costoFijoUnitario: 2,
}

// Presupuesto "normal" del proyecto según la intensidad de los atributos objetivo
export function presupuestoNormal(atributos: number[]): number {
  const intensidad = atributos.reduce((s, a) => s + a, 0) // 6..60
  return 100 + 12 * intensidad
}

export function probabilidadExito(atributos: number[], presupuesto: number): number {
  const normal = presupuestoNormal(atributos)
  return Math.min(0.95, Math.max(0.2, 0.2 + (0.75 * presupuesto) / normal))
}

export function costoUnitarioDesdeAtributos(atributos: number[]): number {
  const prom = atributos.reduce((s, a) => s + a, 0) / atributos.length
  return Math.round((ID_CONFIG.costoFijoUnitario + ID_CONFIG.costoBaseAtributo * prom) * 100) / 100
}

// ===================== Utilidades del escenario =====================

export function demandaAnio(anio: number, seg: Segmento): number {
  const crecimientoBase = Math.pow(1.025, anio)
  return Math.round(seg.demandaBase * crecimientoBase * 10) / 10
}

export const EQUIPO_COLORES = ['#f472b6', '#4ade80', '#facc15', '#c084fc', '#fb923c', '#2dd4bf']
