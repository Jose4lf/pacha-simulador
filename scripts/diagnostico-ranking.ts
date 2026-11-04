/**
 * DIAGNÓSTICO: ¿El motor diferencia empresas con decisiones distintas?
 *
 * Escenario: 4 empresas × 1 integrante (representante)
 *  · BUENA      → decisiones buenas + VISTO BUENO del docente
 *  · MALA       → decisiones malas  + VISTO BUENO del docente
 *  · SINAPROBAR → decisiones buenas enviadas pero SIN visto bueno
 *  · SINENVIAR  → sin decisión enviada
 * Si el motor funciona: BUENA ≫ MALA, y SINAPROBAR/SINENVIAR ≈ iguales entre sí.
 */
import { db } from '@/lib/db'
import { hashPassword } from '@/lib/pacha/auth'
import {
  crearIndustria, guardarBorradorArea, enviarDecision, aprobarDecision,
  procesarRonda, rankingIndustria, eliminarIndustria,
} from '@/lib/pacha/simulacion'

const SUF = Date.now().toString(36).slice(-5)
// Buena: precios sobre el costo (agua ~18, crema ~23 de costo), mucha publicidad,
// produce más y con fuerza de ventas amplia. Mala: precio absurdo, sin nada.
const buena = { precios: [20, 30], publicidad: 900, produccion: 1150, vendedores: [130, 28, 20] }
const mala = { precios: [55, 65], publicidad: 0, produccion: 100, vendedores: [0, 0, 0] }

async function main() {
  const profe = await db.usuario.create({
    data: { nombre: `profe_diag_${SUF}`, passwordHash: hashPassword('321'), rol: 'PROFESOR' },
  })

  const industria = await crearIndustria(`DIAG_${SUF}`, profe.id, {
    periodos: 3,
    empresas: [
      { nombre: 'Buena', integrantes: [{ usuario: `npc_buena_${SUF}` }] },
      { nombre: 'Mala', integrantes: [{ usuario: `npc_mala_${SUF}` }] },
      { nombre: 'SinAprobar', integrantes: [{ usuario: `npc_sinaprobar_${SUF}` }] },
      { nombre: 'SinEnviar', integrantes: [{ usuario: `npc_sinenviar_${SUF}` }] },
    ],
  })

  const equipos = await db.equipo.findMany({
    where: { industriaId: industria.id }, orderBy: { nombre: 'asc' },
  })

  async function decidir(nombreEquipo: string, d: typeof buena, enviar: boolean) {
    const eq = equipos.find((e) => e.nombre === nombreEquipo)!
    const memb = await db.membresia.findFirstOrThrow({ where: { equipoId: eq.id } })
    const anio = 1
    const marcas = await db.marca.findMany({ where: { equipoId: eq.id, activa: true }, orderBy: { anioLanzamiento: 'asc' } })
    await guardarBorradorArea(eq.id, memb.usuarioId, 'precios', {
      precios: marcas.map((m, i) => ({ marcaId: m.id, precio: d.precios[i] ?? d.precios[0] })),
    })
    await guardarBorradorArea(eq.id, memb.usuarioId, 'publicidad', {
      publicidades: marcas.map((m) => ({ marcaId: m.id, publicidad: d.publicidad })),
    })
    await guardarBorradorArea(eq.id, memb.usuarioId, 'produccion', {
      producciones: marcas.map((m) => ({ marcaId: m.id, produccion: d.produccion })),
    })
    await guardarBorradorArea(eq.id, memb.usuarioId, 'ventas', {
      ventas: marcas.map((m) => ({ marcaId: m.id, vendedores: d.vendedores })),
    })
    if (enviar) await enviarDecision(eq.id, memb.usuarioId)
  }

  await decidir('Buena', buena, true)
  await decidir('Mala', mala, true)
  await decidir('SinAprobar', buena, true)
  // SinEnviar: nada

  // Visto bueno SOLO a Buena y Mala
  for (const nombre of ['Buena', 'Mala']) {
    const eq = equipos.find((e) => e.nombre === nombre)!
    const dec = await db.decision.findUniqueOrThrow({ where: { equipoId_anio: { equipoId: eq.id, anio: 1 } } })
    await aprobarDecision(dec.id, profe.id, true)
  }

  const ronda = await procesarRonda(industria.id)
  console.log(`\nAño procesado: ${ronda.anioProcesado} · ventas mercado jugable: ${ronda.ventasTotales.toFixed(0)} mil L`)
  console.log(`Empresas SIN visto bueno (avisadas por el motor): ${ronda.equiposSinVistoBueno.join(', ') || 'ninguna'}\n`)

  const reportes = await db.reporte.findMany({ where: { anio: 1 } })
  const filas = equipos.map((e) => {
    const r = reportes.find((x) => x.equipoId === e.id)!
    return { nombre: e.nombre, ventas: r.ventas, ingresos: r.ingresos, contribucion: r.contribucion, participacion: r.participacion }
  }).sort((a, b) => b.contribucion - a.contribucion)

  console.log('EMPRESA        VENTAS(mL)   INGRESOS(mBs)  CONTRIB(mBs)  %PART')
  for (const f of filas) {
    console.log(
      `${f.nombre.padEnd(14)} ${f.ventas.toFixed(0).padStart(9)} ${f.ingresos.toFixed(0).padStart(14)} ${f.contribucion.toFixed(0).padStart(13)} ${((f.participacion || 0) * 100).toFixed(1).padStart(6)}%`
    )
  }

  const cBuena = filas.find((f) => f.nombre === 'Buena')!.contribucion
  const cMala = filas.find((f) => f.nombre === 'Mala')!.contribucion
  const cSinAprobar = filas.find((f) => f.nombre === 'SinAprobar')!.contribucion
  const cSinEnviar = filas.find((f) => f.nombre === 'SinEnviar')!.contribucion

  console.log('\n─── VEREDICTO ───')
  console.log(`Buena vs Mala (ambas aprobadas): ${cBuena.toFixed(0)} vs ${cMala.toFixed(0)} → diferencia ${(cBuena - cMala).toFixed(0)} (${((cBuena / (cMala || 1)) * 100).toFixed(0)}%) ${cBuena > cMala * 1.15 ? '✅ EL MOTOR SÍ DIFERENCIA' : '❌ EL MOTOR NO DIFERENCIA'}`)
  console.log(`SinAprobar vs SinEnviar: ${cSinAprobar.toFixed(0)} vs ${cSinEnviar.toFixed(0)} → ${Math.abs(cSinAprobar - cSinEnviar).toFixed(0)} de diferencia (esperado ≈ igual: decisiones NO aplicadas)`)

  const ranking = await rankingIndustria(industria.id)
  console.log('\nRANKING tras el Año 1:')
  for (const r of ranking) console.log(`  ${r.posicion}º ${r.nombre}: ${r.contribucionAcumulada.toFixed(0)} mil Bs`)

  // Limpieza
  await eliminarIndustria(industria.id, profe.id)
  await db.usuario.deleteMany({ where: { nombre: { in: [`profe_diag_${SUF}`, `npc_buena_${SUF}`, `npc_mala_${SUF}`, `npc_sinaprobar_${SUF}`, `npc_sinenviar_${SUF}`] } } })
  await db.$disconnect()
}

main().catch((e) => { console.error('💥', e); process.exit(1) })
