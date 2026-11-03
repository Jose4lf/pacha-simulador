/** Prueba del generador de CSV: verifica cifras completas, español y estructura. */
import { construirCsvReporte } from '../src/lib/pacha/exportar-csv'
import type { AlumnoEstado, ReporteDetalle } from '../src/lib/pacha/api-client'

const estado = {
  usuario: { id: 'u1', nombre: 'anamamani', rol: 'ALUMNO' },
  designado: true,
  membresia: { cargo: 'representante', puntos: 5, esRepresentante: true },
  equipo: { id: 'e1', nombre: 'Empresa Glaciar', color: '#f472b6' },
  industria: { id: 'i1', nombre: 'Prueba Visual 2026', anioActual: 2, anioMaximo: 8, estado: 'ACTIVA' },
  marcas: [],
  decision: null,
  comite: [
    { usuarioId: 'u1', nombre: 'anamamani', cargo: 'representante', representante: true, puntos: 5 },
    { usuarioId: 'u2', nombre: 'carlaflores', cargo: 'colaborador', representante: false, puntos: 0 },
  ],
  borradores: [],
  penalizaciones: [],
  cargos: [],
  desempeno: { puntosIniciales: 0, premioTrabajar: 5, penalizacionSinTrabajar: -10, umbralPenalizable: -20, restaMaximaPenalizacion: 100 },
  proyectos: [],
  reportes: [
    { anio: 1, ventas: 199.4, ingresos: 3146.7, costos: 1893.2, publicidad: 680, fuerzaVentas: 402, investigacionMercado: 120, contribucion: 1253.5, participacion: 50.8, sinDecision: false },
  ],
  estudiosComprados: [{ anio: 1, estudioId: 1, costo: 60, tieneDatos: true }],
  costoEstudiosAnio: 60,
  ranking: [],
  config: { id: { presupuestoMin: 100, presupuestoMax: 1000, maxProyectosPorAnio: 4, maxNombresPorSimulacion: 5 }, catalogoEstudios: [{ id: 1, nombre: 'Conocimiento de marca (awareness)', descripcion: 'Mide cuánta gente conoce cada marca.', costo: 60, icono: '📣', categoria: 'Marca' }], maxIntegrantes: 8 },
  eventos: [],
  marcasHistoria: [],
} as unknown as AlumnoEstado

const reporte: ReporteDetalle = {
  anio: 1,
  ventas: 199.4,
  ingresos: 3146.7,
  costos: 1893.2,
  publicidad: 680,
  fuerzaVentas: 402,
  investigacionMercado: 120,
  contribucion: 1253.5,
  participacion: 50.8,
  sinDecision: false,
  detalle: {
    mercado: { demandaTotal: 4921.3, ventasEmpresas: 397.2, ventasResto: 4524.1, capturaEmpresas: 8.07 },
    detalleMensual: [{ mes: 1, demandaTotal: 350.2, ventasEmpresas: 28.3, ventasResto: 321.9 }],
    porRegion: [{ regionId: 'LA_PAZ', ventas: 88.2 }],
    finanzas: {
      ingresosBrutos: 3555.8, iva: 409.1, ingresosNetos: 3146.7, costoProductos: 1786.9, logistica: 188.8,
      perdidasCadenaFrio: 35.7, promocion: 94.4, investigacionMercado: 120, comisionVendedores: 94.4,
      publicidad: 680, fuerzaVentas: 402, costoCapacidad: 0, utilidadOperativa: 100.5, intereses: 0,
      it: 106.7, iue: 0, utilidadNeta: -6.2, margenBruto: 0.24, margenOperativo: 0.03, roi: -0.6,
      deudaFinal: 0, endeudamientoAviso: false,
    },
    produccionAnio: { capacidadInstalada: 1000, utilizacionPct: 37.7, merma: 14, quiebresStock: 0 },
    eventos: [{ variable: 'demanda', region: 'LA_PAZ', mes: 1, eventos: [{ nombre: 'Ola de calor (verano intenso)', efecto: 0.09, peso: 1 }], total: 0.09 }],
    inflacion: {
      anio: 1, escenario: 'ESTABLE', pi: 0.0584, factores: [{ factor: 'petroleo', senal: 0.4, aporte: 0.014 }],
      indicePreciosFin: 105.8, tipoCambioFinal: 12.39, tasasComponentes: {},
    },
  },
  macroHistoria: [{ anio: 1, escenario: 'ESTABLE', inflacionAnual: 0.0584, indicePreciosFin: 105.8, tipoCambioFinal: 12.39, factores: [] }],
  marcas: [{
    marcaNombre: 'Glaciar Agua', ventas: 120.5, produccion: 380, inventario: 260, ingresos: 2530.5, costos: 1386.2,
    contribucion: 1144.3, participacion: 60.5,
    porCanal: [{ canalId: 'tiendas', ventas: 60, ingresos: 1260 }],
    porSegmento: [{ segmentoId: 'ninos', ventas: 40, ingresos: 840 }],
  }],
}

const csv = construirCsvReporte(estado, reporte)
const lineas = csv.split('\n')

console.log('Líneas totales:', lineas.length)
console.log('--- Primeras 12 líneas ---')
for (const l of lineas.slice(0, 12)) console.log(l)

// Verificaciones
const todo = csv
const chequeos: [string, boolean][] = [
  ['cifras completas (no "k" suelta)', !/\b\d+[,.]?\d*k\b/.test(todo.replace(/kioscos/gi, '').replace(/Bs/g, ''))],
  ['ingles traducido: awareness', todo.includes('Conocimiento de marca (awareness)')],
  ['seccion de estudios comprados', todo.includes('ESTUDIOS DE MERCADO COMPRADOS')],
  ['ingles traducido: ROI', todo.includes('Rentabilidad de la inversión')],
  ['IVA con nombre completo', todo.includes('Impuesto al Valor Agregado')],
  ['IT con nombre completo', todo.includes('Impuesto a las Transacciones')],
  ['IUE con nombre completo', todo.includes('Impuesto sobre las Utilidades de las Empresas')],
  ['ventas en litros completos', todo.includes('199.400') || todo.includes('199,4') || todo.includes('199400')],
  ['secciones 1..14', todo.includes('14) RESUMEN CONTABLE')],
  ['meses completos', todo.includes('Enero')],
  ['representante en el encabezado', todo.includes('REPRESENTANTE')],
  ['separador ; para Excel', todo.includes(';')],
]
let fallos = 0
for (const [nombre, ok] of chequeos) {
  console.log(`${ok ? '✅' : '❌'} ${nombre}`)
  if (!ok) fallos++
}
process.exit(fallos > 0 ? 1 : 0)
