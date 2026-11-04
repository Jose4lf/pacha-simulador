/**
 * SONDEO DIRECTO DEL MOTOR: ¿cuánto mueve cada palanca de decisión?
 * Replica el escenario real: 4 empresas × 2 marcas (awareness inicial 0.05).
 */
import { simularAnioBolivia, type ContextoAnio, type MarcaSim } from '@/lib/pacha/motor'
import { crearConfigIndustria } from '@/lib/pacha/config-bolivia'

const AGUA = { precio: 21, publicidad: 300, produccion: 380, atributos: [8, 3, 1, 4, 5, 4], vendedores: [90, 10, 8] }
const CREMA = { precio: 32, publicidad: 380, produccion: 320, atributos: [6, 8, 10, 6, 6, 7], vendedores: [70, 15, 12] }

function marcasEscenario(mod: Record<string, Partial<typeof AGUA>>): MarcaSim[] {
  const equipos = ['e1', 'e2', 'e3', 'e4']
  const nombres = ['Buena', 'Mala', 'Normal1', 'Normal2']
  return equipos.flatMap((eq, i) => {
    const m = mod[nombres[i]] ?? {}
    const a = { ...AGUA, ...m }
    const c = { ...CREMA, ...m }
    const n = nombres[i]
    return [
      { marcaId: `${eq}-agua`, equipoId: eq, nombre: `${n} Agua`, ...a, costoUnitario: 11.5, inventario: 0, awareness: 0.05 },
      { marcaId: `${eq}-crema`, equipoId: eq, nombre: `${n} Crema`, ...c, costoUnitario: 15.5, inventario: 0, awareness: 0.05 },
    ]
  })
}

function ctxBase(): ContextoAnio {
  return {
    config: crearConfigIndustria(4),
    eventos: { demanda: {}, costo: Array(12).fill(1), logistica: {}, demandaHoreca: Array(12).fill(1), trazabilidad: [] },
    macro: {
      piAnual: 0.057, tasaMensual: 0.00463, indicePreciosInicio: 100,
      tipoCambioInicio: 11.8, tipoCambioFinal: 12.5, tasaInteres: 0.12,
      tasasComponentes: { leche: 0.06, azucar: 0.06, envases: 0.06, energia: 0.06, fruta: 0.06, manoObra: 0.06 },
    },
    capacidad: Object.fromEntries(['e1', 'e2', 'e3', 'e4'].map((e) => [e, { instalada: 1000, maxima: 3000 }])),
    inversionCapacidad: {},
    deuda: Object.fromEntries(['e1', 'e2', 'e3', 'e4'].map((e) => [e, 0])),
  }
}

function correr(titulo: string, mod: Record<string, Partial<typeof AGUA>>) {
  const r = simularAnioBolivia(1, marcasEscenario(mod), ctxBase())
  console.log(`\n── ${titulo} ──`)
  console.log('marca           ventas   demanda  perdida   prod   invFin  sinStock   contrib')
  for (const m of r.marcas) {
    console.log(
      `${m.nombre.padEnd(15)} ${m.ventas.toFixed(0).padStart(6)} ${m.demanda.toFixed(0).padStart(8)} ${m.ventaPerdida.toFixed(0).padStart(8)} ${m.produccion.toFixed(0).padStart(6)} ${m.inventarioFinal.toFixed(0).padStart(7)} ${m.sinStock ? 'SÍ' : 'no'}  ${m.contribucion.toFixed(0).padStart(8)}`
    )
  }
  for (const e of r.equipos) {
    console.log(`  → equipo ${e.equipoId}: part.jugable ${(e.participacion ?? 0).toFixed(1)}% · part.total ${(e.participacionTotal ?? 0).toFixed(1)}% · ventas ${e.ventas.toFixed(0)} · contrib ${e.contribucion.toFixed(0)}`)
  }
  console.log(`  mercado: demandaTotal ${r.demandaTotal.toFixed(0)} · demandaEmpresas ${r.demandaEmpresas.toFixed(0)} · ventasEmpresas ${r.ventasEmpresas.toFixed(0)} · resto ${r.ventasResto.toFixed(0)} · captura(ventas) ${r.capturaEmpresas.toFixed(1)}%`)
  return r
}

// 1) TODAS iguales (línea base)
correr('BASE: las 4 empresas con valores iniciales', {})

// 2) Buena decide: precio justo-alto, mucha publicidad, produce más, buena fuerza de ventas
correr('Buena decide: precio 18 / pub 900 / prod 1200 / vend [120,25,18]', {
  Buena: { precio: 18, publicidad: 900, produccion: 1200, vendedores: [120, 25, 18] },
})

// 3) Solo Mala decide: precio 55 / pub 0 / prod 100 / vend [0,0,0]
correr('Mala decide: precio 55 / pub 0 / prod 100 / vend [0,0,0]', {
  Mala: { precio: 55, publicidad: 0, produccion: 100, vendedores: [0, 0, 0] },
})

// 2b) Buena decide BARATO (por debajo del costo: estrategia perdedora esperada)
correr('Buena decide barato: precio 8 / pub 900 / prod 1200 / vend [120,25,18]', {
  Buena: { precio: 8, publicidad: 900, produccion: 1200, vendedores: [120, 25, 18] },
})

// 5) Efecto publicidad puro: Buena 2000, resto igual
correr('Solo publicidad: Buena 2000 vs resto 300/380', {
  Buena: { publicidad: 2000 },
})

// 6) Efecto vendedores puro: Buena 0 vendedores, Mala 300 vendedores
correr('Solo vendedores: Buena [0,0,0] vs Mala [300,150,80]', {
  Buena: { vendedores: [0, 0, 0] },
  Mala: { vendedores: [300, 150, 80] },
})
