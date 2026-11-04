/**
 * PRUEBA E2E «NPC» — PACHA Simulador (modelo UN GERENTE por empresa)
 * ==================================================================
 * Juega una PARTIDA COMPLETA de principio a fin contra la API real,
 * como si el GERENTE (único jugador de cada empresa) usara el sistema:
 *
 *   🛡️ Fase 0  Rectorado da de alta al docente
 *   🎓 Fase 1  Docente crea la simulación (2 empresas × 1 GERENTE cada una)
 *   👑 Fase 1b Verifica el GERENTE único y rechaza empresas con 2 integrantes
 *   🌦️ Fase 2  Verifica el plan de eventos por año (1–3, categorías únicas)
 *   🧑‍🎓 Fase 3 Solo el GERENTE decide; un alumno sin empresa queda rechazado
 *   🔄 Fase 4  3 rondas completas: preparar → borradores → enviar → aprobar
 *              → ejecutar → reportes (con eventos trazados)
 *   🗑️ Fase 5  El docente ELIMINA la simulación y el gerente queda SIN DESIGNAR
 *
 * Uso:  bun tests/e2e-npc-partida.ts   (servidor dev en :3000)
 * Sale con código 0 si TODO pasa; imprime el registro completo.
 */

const BASE = process.env.PACHA_URL ?? 'http://localhost:3000'
const SUF = Math.random().toString(36).slice(2, 7)
const CLAVE = '321'

let paso = 0
let fallos = 0

function linea(emoji: string, actor: string, msg: string) {
  paso += 1
  console.log(`${String(paso).padStart(2, '0')}. ${emoji} [${actor}] ${msg}`)
}

function assert(cond: boolean, msg: string) {
  if (!cond) {
    fallos += 1
    console.log(`   ❌ FALLO: ${msg}`)
    throw new Error(msg)
  }
}

async function pedir<T = Record<string, unknown>>(
  metodo: 'GET' | 'POST' | 'DELETE',
  ruta: string,
  token?: string,
  cuerpo?: unknown
): Promise<T> {
  const res = await fetch(`${BASE}${ruta}`, {
    method: metodo,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'x-pacha-session': token } : {}),
    },
    body: cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined,
  })
  const data = (await res.json().catch(() => ({}))) as T & { error?: string }
  if (!res.ok) throw new Error(`HTTP ${res.status} en ${ruta}: ${data.error ?? 'sin detalle'}`)
  return data
}

async function login(nombre: string): Promise<string> {
  const d = await pedir<{ token: string }>('POST', '/api/auth/login', undefined, { nombre, password: CLAVE })
  assert(!!d.token, `login de ${nombre} devolvió token`)
  return d.token
}

interface EmpresaDatos { nombre: string; gerente: string; decisionId?: string }

async function main() {
  console.log('════════════════════════════════════════════════════════')
  console.log('  PACHA Simulador · Prueba NPC (1 GERENTE por empresa)')
  console.log(`  Servidor: ${BASE} · sufijo único: ${SUF}`)
  console.log('════════════════════════════════════════════════════════')

  // ── Fase 0 · Rectorado ──────────────────────────────────────────
  linea('🛡️', 'Rectorado', 'Verificando cuenta Admin en «Cuentas actuales»…')
  const cuentas = await pedir<{ cuentas: { nombre: string; rol: string }[] }>('GET', '/api/auth/cuentas')
  assert(cuentas.cuentas.some((c) => c.nombre === 'Admin' && c.rol === 'DECANO'), 'Admin aparece en cuentas actuales')

  const tokenAdmin = await login('Admin')
  linea('🛡️', 'Rectorado', 'Sesión iniciada como Admin (clave 321).')

  const docente = `npc_profe_${SUF}`
  await pedir('POST', '/api/decano/usuarios', tokenAdmin, { accion: 'crear', nombre: docente, password: CLAVE, rol: 'PROFESOR' })
  linea('🛡️', 'Rectorado', `Docente creado: ${docente} (rol PROFESOR).`)

  // ── Fase 1 · Docente crea la simulación (1 GERENTE por empresa) ──
  const tokenProfe = await login(docente)
  linea('🎓', 'Docente', 'Sesión iniciada como docente.')

  const wayra: EmpresaDatos = { nombre: `Wayra ${SUF}`, gerente: `gerente_wayra_${SUF}` }
  const illimani: EmpresaDatos = { nombre: `Illimani ${SUF}`, gerente: `gerente_illimani_${SUF}` }

  const industria = await pedir<{ id: string; anioMaximo: number }>('POST', '/api/profesor/industrias', tokenProfe, {
    nombre: `NPC Test ${SUF}`,
    periodos: 10,
    empresas: [
      { nombre: wayra.nombre, integrantes: [{ usuario: wayra.gerente }] },
      { nombre: illimani.nombre, integrantes: [{ usuario: illimani.gerente }] },
    ],
  })
  linea('🎓', 'Docente', `Simulación creada (id ${industria.id.slice(-6)}), ${industria.anioMaximo} años, 2 empresas × 1 GERENTE.`)

  // 1b. UN SOLO GERENTE por empresa: 2 integrantes deben ser rechazados
  let rechazoDos = ''
  try {
    await pedir('POST', '/api/profesor/industrias', tokenProfe, {
      nombre: `Doble ${SUF}`,
      periodos: 1,
      empresas: [
        { nombre: `Llena ${SUF}`, integrantes: [{ usuario: `npc_doble1_${SUF}` }, { usuario: `npc_doble2_${SUF}` }] },
        { nombre: `Rival ${SUF}`, integrantes: [{ usuario: `npc_doble3_${SUF}` }] },
      ],
    })
  } catch (e) { rechazoDos = (e as Error).message }
  assert(rechazoDos.includes('GERENTE'), `empresa con 2 integrantes rechazada (mensaje: ${rechazoDos.slice(0, 70)})`)
  linea('🎓', 'Docente', 'GERENTE único verificado: una empresa con 2 integrantes fue rechazada (un solo jugador).')

  let estado = await pedir<{ industrias: any[] }>('GET', '/api/profesor/estado', tokenProfe)
  const mia = estado.industrias.find((i) => i.id === industria.id)
  assert(!!mia, 'la simulación aparece en el estado del docente')
  assert(mia.equipos.length === 2, 'hay 2 empresas')
  for (const eq of mia.equipos) {
    assert(eq.integrantes.length === 1, `«${eq.nombre}» tiene exactamente 1 integrante (el GERENTE)`)
    const reps = eq.integrantes.filter((g: any) => g.representante)
    assert(reps.length === 1, `«${eq.nombre}» tiene 1 GERENTE (representante del equipo)`)
    assert(eq.marcas.length === 2, `«${eq.nombre}» arranca con 2 marcas iniciales`)
  }
  linea('🎓', 'Docente', 'Grupos verificados: cada empresa con su GERENTE 👑 y 2 marcas iniciales.')

  // ── Fase 2 · Plan de eventos ────────────────────────────────────
  const plan = await pedir<{ anios: { anio: number; eventos: { categoria: string }[] }[] }>(
    'GET', `/api/profesor/eventos?industriaId=${industria.id}`, tokenProfe
  )
  const totalEventos = plan.anios.reduce((s, a) => s + a.eventos.length, 0)
  assert(totalEventos > 0, 'el plan de eventos autocompletado trae eventos')
  for (const a of plan.anios) {
    const cats = a.eventos.map((e) => e.categoria)
    assert(cats.length <= 3, `Año ${a.anio}: máx 3 eventos`)
    assert(new Set(cats).size === cats.length, `Año ${a.anio}: sin categorías repetidas`)
  }
  linea('🌦️', 'Docente', `Plan verificado: ${totalEventos} eventos en ${plan.anios.length} años (1–3 por año, categorías únicas).`)

  // ── Fase 3 · Un alumno SIN empresa no puede decidir ─────────────
  const sinEmpresa = `npc_libre_${SUF}`
  await pedir('POST', '/api/decano/usuarios', tokenAdmin, { accion: 'crear', nombre: sinEmpresa, password: CLAVE, rol: 'ALUMNO' })
  let rechazoLibre = ''
  try {
    await pedir('POST', '/api/alumno/decisiones', await login(sinEmpresa), {
      accion: 'borrador-area', cargo: 'precios', contenido: { precios: [] },
    })
  } catch (e) { rechazoLibre = (e as Error).message }
  assert(rechazoLibre !== '', `alumno sin empresa rechazado (mensaje: ${rechazoLibre.slice(0, 70)})`)
  linea('🧑‍🎓', 'Modo un jugador', `Un alumno sin empresa NO puede decidir → «${rechazoLibre.slice(0, 60)}».`)

  // ── Fase 4 · NPCs juegan 3 rondas ───────────────────────────────
  const tokensNPC = new Map<string, string>()
  async function tokenDe(npc: string): Promise<string> {
    if (!tokensNPC.has(npc)) tokensNPC.set(npc, await login(npc))
    return tokensNPC.get(npc)!
  }

  let proyectoRegistrado = false

  for (const anio of [1, 2, 3]) {
    console.log(`\n────────── AÑO ${anio} ──────────`)

    // Docente prepara el período
    const escenario = anio === 1 ? 'ESTABLE' : undefined
    const vista = await pedir<any>('POST', '/api/profesor/preparar', tokenProfe, { industriaId: industria.id, escenario })
    const eventosVista: any[] = vista.eventos ?? vista.eventosPeriodo ?? []
    const inflacion = vista.inflacion?.inflacionAnual ?? vista.macro?.inflacionAnual
    linea('🎓', 'Docente', `Período preparado: ${eventosVista.length} evento(s) activo(s) del año${inflacion !== undefined ? `, inflación π = ${(inflacion * 100).toFixed(1)}%` : ''}.`)

    for (const eq of mia.equipos) {
      const nombreEquipo: string = eq.nombre
      const gerente = eq.integrantes.find((g: any) => g.representante)!
      const tkRep = await tokenDe(gerente.nombre)

      // Estado del GERENTE (para marcas)
      const primeros = await pedir<any>('GET', '/api/alumno/estado', tkRep)
      const marcaIds: string[] = primeros.marcas.map((m: any) => m.id)
      assert(marcaIds.length >= 2, `${nombreEquipo}: el GERENTE ve sus marcas`)
      assert(primeros.membresia?.esRepresentante === true, `${nombreEquipo}: el estado marca al alumno como GERENTE (único jugador)`)

      // Borradores de TODAS las áreas (los guarda el GERENTE)
      const variacion = 1 + (anio - 1) * 0.1
      await pedir('POST', '/api/alumno/decisiones', tkRep, {
        accion: 'borrador-area', cargo: 'precios',
        contenido: { precios: marcaIds.map((id, i) => ({ marcaId: id, precio: (i === 0 ? 12.5 : 15.5) * variacion })) },
      })
      await pedir('POST', '/api/alumno/decisiones', tkRep, {
        accion: 'borrador-area', cargo: 'publicidad',
        contenido: { publicidades: marcaIds.map((id) => ({ marcaId: id, publicidad: 250 + anio * 50 })) },
      })
      await pedir('POST', '/api/alumno/decisiones', tkRep, {
        accion: 'borrador-area', cargo: 'produccion',
        contenido: { producciones: marcaIds.map((id) => ({ marcaId: id, produccion: 850 + anio * 60 })), inversionCapacidad: anio === 3 ? 500 : 0 },
      })
      await pedir('POST', '/api/alumno/decisiones', tkRep, {
        accion: 'borrador-area', cargo: 'ventas',
        contenido: { ventas: marcaIds.map((id) => ({ marcaId: id, vendedores: [12 + anio, 6, 4] })) },
      })
      if (anio === 1 && !proyectoRegistrado) {
        await pedir('POST', '/api/alumno/proyectos', tkRep, {
          nombre: `Helado keto andino ${SUF}`, atributos: [7, 8, 5, 6, 7, 9], presupuesto: 300,
        })
        proyectoRegistrado = true
        linea('🧑‍🎓', `${nombreEquipo} · I+D`, 'Proyecto I+D registrado por el GERENTE: «Helado keto andino» (presupuesto 300 miles Bs).')
      }
      await pedir('POST', '/api/alumno/decisiones', tkRep, {
        accion: 'borrador-area', cargo: 'investigacion',
        contenido: { nuevas: [], estudios: anio === 1 ? [10] : [1] },
      })
      linea('🧑‍🎓', nombreEquipo, 'El GERENTE guardó los 5 borradores de área (precio, publicidad, producción, ventas, I+D).')

      // Envío de la decisión consolidada (solo el GERENTE puede)
      const envio = await pedir<{ areasSinTrabajar: string[]; estudiosComprados: number }>('POST', '/api/alumno/decisiones', tkRep, { accion: 'enviar' })
      assert(envio.areasSinTrabajar.length === 0, `${nombreEquipo}: las 5 áreas trabajadas`)
      linea('🧑‍🎓', nombreEquipo, `Decisión del año enviada por el GERENTE al docente (áreas sin trabajar: 0, estudios: ${envio.estudiosComprados}).`)

      // Doble envío debe ser rechazado
      let doble = ''
      try {
        await pedir('POST', '/api/alumno/decisiones', tkRep, { accion: 'enviar' })
      } catch (e) { doble = (e as Error).message }
      assert(doble.includes('ya fue enviada'), `${nombreEquipo}: doble envío rechazado`)
    }

    // Docente aprueba y ejecuta
    estado = await pedir<{ industrias: any[] }>('GET', '/api/profesor/estado', tokenProfe)
    const actual = estado.industrias.find((i) => i.id === industria.id)!
    for (const eq of actual.equipos) {
      assert(eq.decisionEstado === 'ENVIADA', `${eq.nombre}: decisión ENVIADA a la vista del docente`)
      const r = await pedir('POST', '/api/profesor/aprobar', tokenProfe, { decisionId: eq.decisionId, aprobada: true })
      assert((r as any).estado === 'APROBADA', `${eq.nombre}: visto bueno concedido`)
    }
    linea('🎓', 'Docente', 'Visto bueno otorgado a las 2 empresas.')

    const ronda = await pedir<{ anioProcesado: number; ventasTotales: number; finalizada: boolean }>('POST', '/api/profesor/procesar', tokenProfe, { industriaId: industria.id })
    assert(ronda.anioProcesado === anio, `ronda procesada = año ${anio}`)
    assert(ronda.ventasTotales > 0, `ventas del año ${anio} positivas (${ronda.ventasTotales.toFixed(0)} L)`)
    linea('⚙️', 'Motor', `Año ${anio} ejecutado: ventas del mercado jugable ${ronda.ventasTotales.toFixed(0)} miles de litros.`)

    // El GERENTE revisa reportes y eventos trazados
    for (const eq of mia.equipos) {
      const rep = await pedir<any>('GET', `/api/alumno/reportes?anio=${anio}`, await tokenDe(eq.integrantes[0].nombre))
      assert(rep.ventas > 0, `${eq.nombre}: reporte del año ${anio} con ventas > 0`)
      assert(Array.isArray(rep.marcas) && rep.marcas.length >= 2, `${eq.nombre}: historia por marca presente`)
      const detalleEventos = rep.detalle?.eventos
      if (anio === 1) {
        assert(detalleEventos !== undefined, `${eq.nombre}: eventos trazados en el detalle del año 1`)
        linea('📊', eq.nombre, `Reportes del año ${anio} (GERENTE): ventas ${rep.ventas.toFixed(0)} mil L, contribución ${rep.contribucion.toFixed(0)} mil Bs, eventos trazados: ${Array.isArray(detalleEventos) ? detalleEventos.length : 'sí'}.`)
      } else {
        linea('📊', eq.nombre, `Reportes del año ${anio} (GERENTE): ventas ${rep.ventas.toFixed(0)} mil L, contribución ${rep.contribucion.toFixed(0)} mil Bs.`)
      }
    }
  }

  // ── Fase 5 · Cierre: ranking y ELIMINACIÓN de la simulación ─────
  console.log('')
  estado = await pedir<{ industrias: any[] }>('GET', '/api/profesor/estado', tokenProfe)
  const final = estado.industrias.find((i) => i.id === industria.id)!
  const ranking = final.ranking as { nombre: string; contribucionAcumulada: number; posicion: number }[]
  assert(ranking.length === 2, 'ranking final con 2 empresas')
  for (const f of ranking) linea('🏁', 'Ranking', `${f.posicion}º ${f.nombre} — contribución acumulada ${f.contribucionAcumulada.toFixed(0)} mil Bs.`)

  // 🗑️ El docente ELIMINA la simulación completa
  const eliminacion = await pedir<{ ok: boolean; equiposEliminados: number }>('DELETE', `/api/profesor/industrias?id=${industria.id}`, tokenProfe)
  assert(eliminacion.ok && eliminacion.equiposEliminados === 2, 'simulación eliminada con sus 2 empresas')
  linea('🗑️', 'Docente', 'Simulación eliminada por completo (empresas, marcas, decisiones y reportes).')

  // El gerente queda SIN DESIGNAR (la cuenta sigue activa)
  // Nota: los usuarios alumno se guardan con slug (sin guiones bajos).
  const slug = (n: string) => n.toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 24)
  const estadoSinDesignar = await pedir<any>('GET', '/api/alumno/estado', await tokenDe(slug(wayra.gerente)))
  assert(estadoSinDesignar.designado === false, 'el gerente ve su estado SIN DESIGNAR')
  linea('🪑', 'Gerentes', 'Estado «Sin designar» verificado: la cuenta sigue activa y a la espera de una nueva asignación.')

  const estadoAdmin = await pedir<any>('GET', '/api/decano/estado', tokenAdmin)
  linea('🛡️', 'Rectorado', `Estado global: ${estadoAdmin.stats.totalUsuarios} usuarios (${estadoAdmin.stats.profesores} docentes, ${estadoAdmin.stats.alumnos} alumnos), ${estadoAdmin.stats.simulaciones} simulación(es).`)

  console.log('\n════════════════════════════════════════════════════════')
  if (fallos === 0) {
    console.log('  ✅ PARTIDA COMPLETA VALIDADA (1 GERENTE por empresa) — todos los pasos OK')
  } else {
    console.log(`  ❌ ${fallos} verificación(es) fallaron`)
  }
  console.log('════════════════════════════════════════════════════════')
  if (fallos > 0) process.exit(1)
}

main().catch((e) => {
  console.error(`\n💥 Prueba interrumpida: ${e.message}`)
  process.exit(1)
})
