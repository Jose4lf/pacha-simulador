/**
 * DIAGNÓSTICO MULTI-AÑO (3 años): ¿las buenas decisiones ganan ACUMULANDO?
 *  · BUENA      → precios sobre costo, publicidad alta, produce más, invierte capacidad cada año
 *  · MALA       → precio absurdo, sin publicidad, produce poco, sin vendedores
 *  · NORMAL     → valores iniciales (envía decisión sin cambios)
 * Veredicto esperado: al Año 3 BUENA lidera el ranking acumulado.
 */
import { db } from '@/lib/db'
import { hashPassword } from '@/lib/pacha/auth'
import {
  crearIndustria, enviarDecision, aprobarDecision,
  procesarRonda, rankingIndustria, eliminarIndustria,
} from '@/lib/pacha/simulacion'

const SUF = Date.now().toString(36).slice(-5)

async function main() {
  const profe = await db.usuario.create({
    data: { nombre: `profe_diag3_${SUF}`, passwordHash: hashPassword('321'), rol: 'PROFESOR' },
  })

  const industria = await crearIndustria(`DIAG3_${SUF}`, profe.id, {
    periodos: 3,
    empresas: [
      { nombre: 'Buena', integrantes: [{ usuario: `npc_buena_${SUF}` }] },
      { nombre: 'Mala', integrantes: [{ usuario: `npc_mala_${SUF}` }] },
      { nombre: 'Normal', integrantes: [{ usuario: `npc_normal_${SUF}` }] },
    ],
  })

  const equipos = await db.equipo.findMany({ where: { industriaId: industria.id }, orderBy: { nombre: 'asc' } })

  async function decidir(nombreEquipo: string, anio: number) {
    const eq = equipos.find((e) => e.nombre === nombreEquipo)!
    const memb = await db.membresia.findFirstOrThrow({ where: { equipoId: eq.id } })
    const marcas = await db.marca.findMany({ where: { equipoId: eq.id, activa: true }, orderBy: { anioLanzamiento: 'asc' } })

    // Envío DIRECTO: toda la decisión del año en una sola llamada (sin borradores)
    if (nombreEquipo === 'Buena') {
      await enviarDecision(eq.id, memb.usuarioId, {
        marcas: marcas.map((m, i) => ({
          marcaId: m.id,
          precio: i === 0 ? 20 : 30,
          publicidad: 700 + anio * 100,
          produccion: 900 + anio * 250,
          vendedores: [120, 26, 18],
        })),
        nuevas: [],
        estudios: [],
        inversionCapacidad: 600,
      })
    } else if (nombreEquipo === 'Mala') {
      await enviarDecision(eq.id, memb.usuarioId, {
        marcas: marcas.map((m, i) => ({
          marcaId: m.id,
          precio: i === 0 ? 55 : 65,
          publicidad: 0,
          produccion: 100,
          vendedores: [0, 0, 0],
        })),
        nuevas: [],
        estudios: [],
      })
    } else {
      // Normal: envía los valores vigentes sin cambios
      await enviarDecision(eq.id, memb.usuarioId, {
        marcas: marcas.map((m) => ({
          marcaId: m.id,
          precio: m.precio,
          publicidad: m.publicidad,
          produccion: m.produccion,
          vendedores: JSON.parse(m.vendedores) as number[],
        })),
        nuevas: [],
        estudios: [],
      })
    }
    const dec = await db.decision.findUniqueOrThrow({ where: { equipoId_anio: { equipoId: eq.id, anio } } })
    await aprobarDecision(dec.id, profe.id, true)
  }

  for (const anio of [1, 2, 3]) {
    for (const nombre of ['Buena', 'Mala', 'Normal']) await decidir(nombre, anio)
    const ronda = await procesarRonda(industria.id)
    const ranking = await rankingIndustria(industria.id)
    const rep = await db.reporte.findMany({ where: { anio } })
    console.log(`\n──── AÑO ${anio} (ventas mercado jugable ${ronda.ventasTotales.toFixed(0)} mil L) ────`)
    for (const e of equipos) {
      const r = rep.find((x) => x.equipoId === e.id)!
      console.log(
        `${e.nombre.padEnd(7)} ventas ${r.ventas.toFixed(0).padStart(5)} mil L · part ${(r.participacion ?? 0).toFixed(1).padStart(5)}% · contrib año ${r.contribucion.toFixed(0).padStart(6)} mil Bs`
      )
    }
    console.log('Ranking acumulado: ' + ranking.map((r) => `${r.posicion}º ${r.nombre} ${r.contribucionAcumulada.toFixed(0)}`).join(' | '))
  }

  const final = await rankingIndustria(industria.id)
  const cBuena = final.find((r) => r.nombre === 'Buena')!.contribucionAcumulada
  const cMala = final.find((r) => r.nombre === 'Mala')!.contribucionAcumulada
  const cNormal = final.find((r) => r.nombre === 'Normal')!.contribucionAcumulada
  console.log(`\n─── VEREDICTO A 3 AÑOS ───`)
  console.log(`Buena ${cBuena.toFixed(0)} · Normal ${cNormal.toFixed(0)} · Mala ${cMala.toFixed(0)}`)
  console.log(cBuena > cNormal && cNormal > cMala ? '✅ ORDEN CORRECTO: Buena > Normal > Mala' : '❌ AÚN NO ORDENA BIEN')

  await eliminarIndustria(industria.id, profe.id)
  await db.usuario.deleteMany({ where: { nombre: { in: [`profe_diag3_${SUF}`, `npc_buena_${SUF}`, `npc_mala_${SUF}`, `npc_normal_${SUF}`] } } })
  await db.$disconnect()
}

main().catch((e) => { console.error('💥', e); process.exit(1) })
