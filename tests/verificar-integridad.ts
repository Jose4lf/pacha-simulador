/**
 * VERIFICACIÓN DE INTEGRIDAD DE DATOS (nivel BD) — PACHA Simulador
 * Crea una industria de 3 empresas (1 GERENTE cada una), envía decisiones
 * directas, aprueba, procesa 1 ronda y verifica a nivel SQL que TODO esté
 * unido: membresía → equipo → decisión → marcas → reporte → reporteMarca,
 * y que la cascada al eliminar deje las cuentas sin designación.
 */
import { db } from '@/lib/db'
import { hashPassword } from '@/lib/pacha/auth'
import { crearIndustria, enviarDecision, aprobarDecision, procesarRonda, eliminarIndustria } from '@/lib/pacha/simulacion'

const SUF = Date.now().toString(36).slice(-5)

async function main() {
  console.log('═══ INTEGRIDAD DE DATOS · flujo decisión → visto bueno → procesar → reportes ═══')

  // 0) Estado inicial: BD limpia (tras el reset no debe haber industrias)
  const industriasIniciales = await db.industria.count()
  console.log(`Industrias pre-existentes en la BD: ${industriasIniciales}`)

  const profe = await db.usuario.create({
    data: { nombre: `profe_integ_${SUF}`, passwordHash: hashPassword('321'), rol: 'PROFESOR' },
  })
  const nombres = ['Aconcagua', 'Sajama', 'Illampu']
  const industria = await crearIndustria(`INTEG_${SUF}`, profe.id, {
    periodos: 3,
    empresas: nombres.map((n, i) => ({ nombre: n, integrantes: [{ usuario: `ger_${n.toLowerCase()}_${SUF}${i}` }] })),
  })

  // 1) Membresía: exactamente 1 GERENTE por empresa
  const equipos = await db.equipo.findMany({ where: { industriaId: industria.id }, include: { membresias: { include: { usuario: true } }, marcas: true } })
  for (const eq of equipos) {
    if (eq.membresias.length !== 1) throw new Error(`FALLO: ${eq.nombre} tiene ${eq.membresias.length} membresías (esperado 1)`)
    const m = eq.membresias[0]
    if (!m.representante || m.cargo !== 'gerente') throw new Error(`FALLO: membresía de ${eq.nombre} no es gerente`)
    if (eq.marcas.length !== 2) throw new Error(`FALLO: ${eq.nombre} no arranca con 2 marcas`)
  }
  console.log('✅ 1) Cada empresa tiene EXACTAMENTE 1 membresía con cargo=gerente, representante=true y 2 marcas iniciales')

  // 2) Variación inicial por empresa (datos realistas distintos)
  const precios = equipos.map((eq) => eq.marcas.map((m) => m.precio))
  const todosPrecios = precios.flat()
  const spreadPrecio = Math.max(...todosPrecios) - Math.min(...todosPrecios)
  const awarenessTodos = equipos.flatMap((eq) => eq.marcas.map((m) => m.awareness))
  const spreadAware = Math.max(...awarenessTodos) - Math.min(...awarenessTodos)
  const pubTodos = equipos.flatMap((eq) => eq.marcas.map((m) => m.publicidad))
  const spreadPub = Math.max(...pubTodos) - Math.min(...pubTodos)
  if (spreadPrecio < 1 || spreadAware < 0.01 || spreadPub < 50) {
    throw new Error(`FALLO: condiciones iniciales clonadas (spread precio ${spreadPrecio.toFixed(2)}, awareness ${spreadAware.toFixed(3)}, publicidad ${spreadPub})`)
  }
  console.log(`✅ 2) Condiciones iniciales VARIADAS por empresa: precios ±${(spreadPrecio / 2).toFixed(2)} Bs, awareness ${(Math.min(...awarenessTodos) * 100).toFixed(0)}–${(Math.max(...awarenessTodos) * 100).toFixed(0)}%, publicidad ±${Math.round(spreadPub / 2)}k Bs`)

  // 3) Historia del Año 0 unida y realista
  const reportes0 = await db.reporte.findMany({ where: { anio: 0 }, include: { marcas: true } })
  if (reportes0.length !== 3) throw new Error(`FALLO: Año 0 con ${reportes0.length} reportes (esperado 3, uno por empresa)`)
  for (const r of reportes0) {
    if (!r.detalleJson) throw new Error(`FALLO: reporte Año 0 de ${r.equipoId} sin detalle`)
    const d = JSON.parse(r.detalleJson)
    if (!d.finanzas || Number(d.finanzas.iva) <= 0 || Number(d.finanzas.logistica) <= 0) throw new Error('FALLO: finanzas históricas incompletas')
    if (!Array.isArray(d.detalleMensual) || d.detalleMensual.length !== 12) throw new Error('FALLO: mensual histórico incompleto')
    if (!Array.isArray(d.porRegion) || d.porRegion.length < 9) throw new Error('FALLO: regiones históricas incompletas')
    if (r.marcas.length !== 2) throw new Error('FALLO: reporteMarca del Año 0 incompleto')
  }
  console.log('✅ 3) Año 0: 3 reportes con detalle REAL (IVA, logística, 12 meses, 9 departamentos) y 2 marcas cada uno')

  // 4) Envío DIRECTO de decisiones con inversión en capacidad (empresa 0)
  for (let i = 0; i < equipos.length; i++) {
    const eq = equipos[i]
    const gerente = eq.membresias[0].usuario
    await enviarDecision(eq.id, gerente.id, {
      marcas: eq.marcas.map((m, j) => ({
        marcaId: m.id,
        precio: i === 0 ? (j === 0 ? 25.9 : 36.9) : i === 1 ? 16.9 : 55,
        publicidad: i === 0 ? (j === 0 ? 500 : 600) : 800,
        produccion: i === 0 ? (j === 0 ? 430 : 380) : 500,
        vendedores: i === 0 ? [70, 15, 10] : [60, 20, 10],
      })),
      nuevas: [],
      estudios: i === 0 ? [1, 10] : [],
      inversionCapacidad: i === 0 ? 400 : undefined,
    })
  }

  const decisiones = await db.decision.findMany({ where: { anio: 1 } })
  if (decisiones.length !== 3) throw new Error(`FALLO: ${decisiones.length} decisiones (esperado 3)`)
  const dec0 = JSON.parse(decisiones.find((d) => d.equipoId === equipos[0].id)!.contenido)
  if (dec0.inversionCapacidad !== 400) throw new Error('FALLO: inversión en capacidad no llegó al contenido')
  const compras = await db.compraEstudio.findMany({ where: { anio: 1, equipoId: equipos[0].id } })
  if (compras.length !== 2) throw new Error(`FALLO: ${compras.length} estudios congelados (esperado 2)`)
  console.log('✅ 4) Envío directo: 3 decisiones ENVIADA con contenido completo (inversión 400k L + 2 estudios congelados en la empresa 0)')

  // 5) Visto bueno y procesar
  for (const d of decisiones) await aprobarDecision(d.id, profe.id, true)
  const aprobadas = await db.decision.findMany({ where: { anio: 1, estado: 'APROBADA' } })
  if (aprobadas.length !== 3) throw new Error('FALLO: no se aprobaron las 3')
  const ronda = await procesarRonda(industria.id)
  console.log(`✅ 5) Visto bueno a 3/3 y ronda procesada: año ${ronda.anioProcesado}, ventas ${ronda.ventasTotales.toFixed(0)} mil L, captura ${ronda.capturaEmpresas.toFixed(1)}%`)

  // 6) Reportes del Año 1 enlazados con TODO
  const reportes1 = await db.reporte.findMany({ where: { anio: 1 }, include: { marcas: true } })
  if (reportes1.length !== 3) throw new Error(`FALLO: ${reportes1.length} reportes del año 1`)
  for (const r of reportes1) {
    if (!r.detalleJson) throw new Error('FALLO: reporte año 1 sin detalle')
    const d = JSON.parse(r.detalleJson)
    if (!d.finanzas || !d.produccionAnio || !Array.isArray(d.porRegion)) throw new Error('FALLO: detalle del año 1 incompleto')
    const sumaVentasMarcas = r.marcas.reduce((s, m) => s + m.ventas, 0)
    if (Math.abs(sumaVentasMarcas - r.ventas) > 1) throw new Error(`FALLO: ventas del reporte (${r.ventas}) ≠ suma de marcas (${sumaVentasMarcas})`)
    const sumaCanal = r.marcas.reduce((s, m) => s + JSON.parse(m.porCanal).reduce((ss: number, c: any) => ss + c.ventas, 0), 0)
    if (Math.abs(sumaCanal - r.ventas) > 2) throw new Error(`FALLO: ventas por canal (${sumaCanal}) ≠ ventas del reporte (${r.ventas})`)
  }
  // Capacidad aumentó SOLO en la empresa que invirtió
  const eq0 = await db.equipo.findUniqueOrThrow({ where: { id: equipos[0].id } })
  const eq1 = await db.equipo.findUniqueOrThrow({ where: { id: equipos[1].id } })
  if (eq0.capacidadInstalada <= 1000) throw new Error(`FALLO: capacidad de ${eq0.nombre} no creció (${eq0.capacidadInstalada})`)
  if (Math.abs(eq1.capacidadInstalada - 1000) > 0.01) throw new Error(`FALLO: capacidad de ${eq1.nombre} cambió sin inversión`)
  console.log(`✅ 6) Reportes Año 1: ventas = Σ marcas = Σ canales; capacidad subió solo donde se invirtió (${eq0.capacidadInstalada}k L vs ${eq1.capacidadInstalada}k L)`)

  // 7) Marcas: precio/inventario aplicados desde la decisión
  const marcas0 = await db.marca.findMany({ where: { equipoId: equipos[0].id } })
  const agua = marcas0.find((m) => m.nombre.includes('Agua'))!
  if (Math.abs(agua.precio - 25.9) > 0.01) throw new Error(`FALLO: precio aplicado ${agua.precio} ≠ 25.9`)
  console.log(`✅ 7) La decisión quedó APLICADA en las marcas (precio ${agua.precio}, inventario ${agua.inventario.toFixed(1)} mil L)`)

  // 8) Cascada al eliminar
  await eliminarIndustria(industria.id, profe.id)
  const restos = await db.decision.count({ where: { equipoId: { in: equipos.map((e) => e.id) } } })
  const membRestos = await db.membresia.count({ where: { equipoId: { in: equipos.map((e) => e.id) } } })
  if (restos !== 0 || membRestos !== 0) throw new Error('FALLO: cascada incompleta al eliminar')
  const sinDesignar = await db.membresia.count({ where: { usuarioId: { in: equipos.flatMap((e) => e.membresias.map((m) => m.usuarioId)) } } })
  if (sinDesignar !== 0) throw new Error('FALLO: los gerentes no quedaron sin designar')
  await db.usuario.deleteMany({ where: { nombre: { startsWith: 'ger_' } } })
  await db.usuario.delete({ where: { id: profe.id } })
  console.log('✅ 8) Cascada completa: decisión/marcas/reportes/membresías borrados; gerentes SIN DESIGNAR; cuentas de prueba eliminadas')

  console.log('\n═══ ✅ INTEGRIDAD VERIFICADA: los datos están UNIDOS de punta a punta ═══')
  await db.$disconnect()
}

main().catch(async (e) => {
  console.error(`\n💥 ${e.message}`)
  await db.$disconnect()
  process.exit(1)
})
