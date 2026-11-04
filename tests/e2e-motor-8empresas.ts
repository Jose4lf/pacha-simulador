/**
 * PRUEBA E2E «MOTOR 8 EMPRESAS» — PACHA Simulador (1 GERENTE por empresa)
 * =======================================================================
 * Verifica el MOTOR con 8 empresas, cada una jugada por UN solo gerente
 * (el modelo nuevo del proyecto), y que TODOS LOS DATOS ESTÉN UNIDOS:
 *
 *   ✔ la decisión del gerente se aplica a las marcas (precio/publicidad/
 *     producción quedan en el estado tras ejecutar la ronda)
 *   ✔ el reporte del año es la SUMA de sus marcas (ventas y contribución)
 *   ✔ el ranking que ve el profesor es IDÉNTICO al que ve el gerente
 *   ✔ los datos por empresa son DIFERENTES (el motor emula cada empresa)
 *   ✔ las decisiones mueven el ranking (contribución acumulada cambia,
 *     posiciones suben/bajan al cambiar la estrategia)
 *   ✔ el inventario no vendido fluye al año siguiente
 *   ✔ los eventos del período que ve el gerente coinciden con los del docente
 *
 * Estrategias por año (económicamente correctas, IVA 13% incluido):
 *   Año 1: 8 estrategias distintas  → datos por empresa diferentes
 *   Año 2: la DESASTROSA pasa a ÓPTIMA y la ÓPTIMA pasa a DORMIDA
 *   Año 3: se restauran las estrategias originales
 *
 * Uso:  bun tests/e2e-motor-8empresas.ts   (servidor dev en :3000)
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

const rankingPrevio = new Map<string, number>() // empresaId → posición anterior
const acumuladaPrev = new Map<string, number>() // empresaId → contribución acumulada anterior

// ════════════════════════════════════════════════════════════════
// ESTRATEGIAS — precios Bs/L (IVA 13% incl.), publicidad miles Bs,
// producción miles L (capacidad instalada 1000k L por empresa).
// Costos año 1: agua ≈ Bs 14.14/L, crema ≈ Bs 19.24/L.
// ════════════════════════════════════════════════════════════════
interface Estrategia {
  nombre: string
  precioAgua: number
  precioCrema: number
  pubAgua: number
  pubCrema: number
  prodAgua: number
  prodCrema: number
  vendedores: [number, number, number]
}

const ESTRATEGIAS: Record<string, Estrategia> = {
  optima: { nombre: 'ÓPTIMA', precioAgua: 25.9, precioCrema: 36.9, pubAgua: 500, pubCrema: 600, prodAgua: 430, prodCrema: 380, vendedores: [70, 15, 10] },
  agresiva: { nombre: 'AGRESIVA', precioAgua: 16.9, precioCrema: 24.9, pubAgua: 1000, pubCrema: 1000, prodAgua: 550, prodCrema: 440, vendedores: [100, 40, 20] },
  premium: { nombre: 'PREMIUM', precioAgua: 33, precioCrema: 49, pubAgua: 700, pubCrema: 700, prodAgua: 320, prodCrema: 280, vendedores: [60, 20, 10] },
  dormida: { nombre: 'DORMIDA', precioAgua: 12, precioCrema: 12, pubAgua: 0, pubCrema: 0, prodAgua: 40, prodCrema: 40, vendedores: [2, 0, 0] },
  desastrosa: { nombre: 'DESASTROSA', precioAgua: 60, precioCrema: 60, pubAgua: 0, pubCrema: 0, prodAgua: 0, prodCrema: 0, vendedores: [0, 0, 0] },
  medio1: { nombre: 'MEDIA-A', precioAgua: 21, precioCrema: 32, pubAgua: 300, pubCrema: 380, prodAgua: 380, prodCrema: 320, vendedores: [90, 10, 8] },
  medio2: { nombre: 'MEDIA-B', precioAgua: 22, precioCrema: 34, pubAgua: 500, pubCrema: 550, prodAgua: 420, prodCrema: 390, vendedores: [80, 25, 12] },
  medio3: { nombre: 'MEDIA-C', precioAgua: 26, precioCrema: 38, pubAgua: 400, pubCrema: 480, prodAgua: 400, prodCrema: 360, vendedores: [75, 22, 11] },
}

/** Plan de estrategias por año, índice = empresa 0..7 */
const PLAN: string[][] = [
  ['optima', 'agresiva', 'premium', 'dormida', 'desastrosa', 'medio1', 'medio2', 'medio3'], // Año 1
  ['dormida', 'agresiva', 'premium', 'dormida', 'optima', 'medio1', 'medio2', 'medio3'],   // Año 2: 0↔4 cambian
  ['optima', 'agresiva', 'premium', 'dormida', 'desastrosa', 'medio1', 'medio2', 'medio3'], // Año 3: restaurar
]

const NOMBRES_EMPRESAS = ['Wayra', 'Illimani', 'Sajama', 'Titicaca', 'Tunari', 'Sama', 'Chalalan', 'Madidi']

interface ResumenEmpresa {
  empresaId: string
  nombre: string
  tokenRep: string
  ventas: Map<number, number>
  contribucion: Map<number, number>
}

interface FilaRanking {
  equipoId: string
  nombre: string
  contribucionAcumulada: number
  posicion: number
}

async function main() {
  console.log('════════════════════════════════════════════════════════')
  console.log('  PACHA Simulador · Motor 8 empresas · UN GERENTE por empresa')
  console.log(`  Servidor: ${BASE} · sufijo único: ${SUF}`)
  console.log('════════════════════════════════════════════════════════')

  // ── Fase 0 · Rectorado ──────────────────────────────────────────
  const tokenAdmin = await login('Admin')
  linea('🛡️', 'Rectorado', 'Sesión iniciada como Admin (clave 321).')

  const docente = `profe8e${SUF}`
  await pedir('POST', '/api/decano/usuarios', tokenAdmin, { accion: 'crear', nombre: docente, password: CLAVE, rol: 'PROFESOR' })
  const tokenProfe = await login(docente)
  linea('🛡️', 'Rectorado', `Docente creado y con sesión: ${docente}.`)

  // ── Fase 1 · 8 empresas × 1 GERENTE (8 jugadores en total) ──────
  const gerentes = NOMBRES_EMPRESAS.map((e, i) => `gerente${e.toLowerCase()}${SUF}${i}`)
  const industria = await pedir<{ id: string; anioMaximo: number }>('POST', '/api/profesor/industrias', tokenProfe, {
    nombre: `Motor 8E ${SUF}`,
    periodos: 10,
    empresas: NOMBRES_EMPRESAS.map((nombre, i) => ({
      nombre,
      integrantes: [{ usuario: gerentes[i] }],
    })),
  })
  linea('🎓', 'Docente', `Simulación creada (id …${industria.id.slice(-6)}): 8 EMPRESAS × 1 GERENTE = 8 jugadores.`)

  // La regla nueva: UNA empresa NO puede tener 2 integrantes
  let rechazoDos = ''
  try {
    await pedir('POST', '/api/profesor/industrias', tokenProfe, {
      nombre: `Doble ${SUF}`,
      periodos: 1,
      empresas: [
        { nombre: `DobleA ${SUF}`, integrantes: [{ usuario: `x1${SUF}` }, { usuario: `x2${SUF}` }] },
        { nombre: `DobleB ${SUF}`, integrantes: [{ usuario: `x3${SUF}` }] },
      ],
    })
  } catch (e) { rechazoDos = (e as Error).message }
  assert(rechazoDos.includes('GERENTE'), `empresa con 2 integrantes rechazada (mensaje: ${rechazoDos.slice(0, 60)})`)
  linea('🔒', 'Regla nueva', 'Un solo gerente verificado: una empresa con 2 integrantes fue RECHAZADA por la API.')

  let estado = await pedir<{ industrias: any[] }>('GET', '/api/profesor/estado', tokenProfe)
  const mia = estado.industrias.find((i) => i.id === industria.id)
  assert(!!mia, 'la simulación aparece en el estado del docente')
  assert(mia.equipos.length === 8, `hay 8 empresas (hay ${mia.equipos.length})`)

  const resumen: ResumenEmpresa[] = []
  for (const eq of mia.equipos) {
    assert(eq.integrantes.length === 1, `«${eq.nombre}» tiene exactamente 1 integrante (GERENTE)`)
    const reps = eq.integrantes.filter((g: any) => g.representante)
    assert(reps.length === 1, `«${eq.nombre}»: su único integrante es el GERENTE (representante)`)
    assert(eq.marcas.length === 2, `«${eq.nombre}» arranca con 2 marcas iniciales`)
    resumen.push({
      empresaId: eq.id,
      nombre: eq.nombre,
      tokenRep: await login(reps[0].nombre),
      ventas: new Map(),
      contribucion: new Map(),
    })
  }
  linea('👑', 'Modo un jugador', 'Cada empresa juega con UN GERENTE: él ve todo, decide las 5 áreas y envía.')

  // Línea base del ranking ANTES de jugar (todo en 0)
  const base0 = await pedir<{ industrias: any[] }>('GET', '/api/profesor/estado', tokenProfe)
    .then((e) => (e.industrias.find((i) => i.id === industria.id)!.ranking as FilaRanking[]))
  assert(base0.length === 8, 'ranking inicial con 8 empresas (todas en 0)')
  for (const f of base0) {
    acumuladaPrev.set(f.equipoId, f.contribucionAcumulada)
    rankingPrevio.set(f.equipoId, f.posicion)
  }
  linea('🏁', 'Ranking', 'Línea base capturada: 8 empresas con contribución acumulada 0 antes del Año 1.')

  // Un alumno SIN empresa no puede decidir (aislamiento del jugador único)
  const sinEmpresa = `libre${SUF}`
  await pedir('POST', '/api/decano/usuarios', tokenAdmin, { accion: 'crear', nombre: sinEmpresa, password: CLAVE, rol: 'ALUMNO' })
  let rechazoLibre = ''
  try {
    await pedir('POST', '/api/alumno/decisiones', await login(sinEmpresa), {
      accion: 'borrador-area', cargo: 'precios', contenido: { precios: [] },
    })
  } catch (e) { rechazoLibre = (e as Error).message }
  assert(rechazoLibre !== '', `alumno sin empresa rechazado (mensaje: ${rechazoLibre.slice(0, 60)})`)
  linea('🔒', 'Modo un jugador', 'Un alumno sin empresa NO puede tomar decisiones en ninguna de las 8.')

  // ── Fase 2 · Plan de eventos ────────────────────────────────────
  const plan = await pedir<{ anios: { anio: number; eventos: { categoria: string }[] }[] }>(
    'GET', `/api/profesor/eventos?industriaId=${industria.id}`, tokenProfe
  )
  const totalEventos = plan.anios.reduce((s, a) => s + a.eventos.length, 0)
  assert(totalEventos >= 8, `plan de eventos autocompletado con eventos (${totalEventos} en ${plan.anios.length} años)`)
  linea('🌦️', 'Docente', `Plan de eventos listo: ${totalEventos} eventos en ${plan.anios.length} años (1–3 por año).`)

  // ── Fase 3 · 3 rondas del motor ─────────────────────────────────
  let ordenCambioConfirmado = false
  let eventosDocenteAnio1 = 0

  for (const anio of [1, 2, 3]) {
    console.log(`\n────────── AÑO ${anio} ──────────`)

    // Docente prepara el período
    const escenario = anio === 1 ? 'ESTABLE' : undefined
    const vista = await pedir<any>('POST', '/api/profesor/preparar', tokenProfe, { industriaId: industria.id, escenario })
    const eventosVista: any[] = vista.eventos ?? vista.eventosPeriodo ?? []
    if (anio === 1) eventosDocenteAnio1 = eventosVista.length
    linea('🎓', 'Docente', `Período ${anio} preparado: ${eventosVista.length} evento(s) activo(s), escenario ${escenario ?? 'sorteado'}.`)

    // El GERENTE de cada empresa decide su estrategia del año
    for (let i = 0; i < resumen.length; i++) {
      const emp = resumen[i]
      const est = ESTRATEGIAS[PLAN[anio - 1][i]]
      const vistaAl = await pedir<any>('GET', '/api/alumno/estado', emp.tokenRep)
      const marcaAgua = vistaAl.marcas.find((m: any) => m.nombre.includes('Agua')) ?? vistaAl.marcas[0]
      const marcaCrema = vistaAl.marcas.find((m: any) => m.nombre.includes('Crema')) ?? vistaAl.marcas[1]
      const ids = [marcaAgua.id, marcaCrema.id]

      await pedir('POST', '/api/alumno/decisiones', emp.tokenRep, {
        accion: 'borrador-area', cargo: 'precios',
        contenido: { precios: [{ marcaId: ids[0], precio: est.precioAgua }, { marcaId: ids[1], precio: est.precioCrema }] },
      })
      await pedir('POST', '/api/alumno/decisiones', emp.tokenRep, {
        accion: 'borrador-area', cargo: 'publicidad',
        contenido: { publicidades: [{ marcaId: ids[0], publicidad: est.pubAgua }, { marcaId: ids[1], publicidad: est.pubCrema }] },
      })
      await pedir('POST', '/api/alumno/decisiones', emp.tokenRep, {
        accion: 'borrador-area', cargo: 'produccion',
        contenido: { producciones: [{ marcaId: ids[0], produccion: est.prodAgua }, { marcaId: ids[1], produccion: est.prodCrema }], inversionCapacidad: 0 },
      })
      await pedir('POST', '/api/alumno/decisiones', emp.tokenRep, {
        accion: 'borrador-area', cargo: 'ventas',
        contenido: { ventas: [{ marcaId: ids[0], vendedores: est.vendedores }, { marcaId: ids[1], vendedores: est.vendedores }] },
      })
      await pedir('POST', '/api/alumno/decisiones', emp.tokenRep, {
        accion: 'borrador-area', cargo: 'investigacion',
        contenido: { nuevas: [], estudios: [] },
      })
      const envio = await pedir<{ areasSinTrabajar: string[] }>('POST', '/api/alumno/decisiones', emp.tokenRep, { accion: 'enviar' })
      assert(envio.areasSinTrabajar.length === 0, `${emp.nombre}: las 5 áreas trabajadas por su GERENTE`)
      linea('🧑‍🎓', emp.nombre, `Decisión enviada por su GERENTE — estrategia ${est.nombre} (agua Bs ${est.precioAgua}/L, crema Bs ${est.precioCrema}/L).`)
    }

    // Docente aprueba las 8 decisiones
    estado = await pedir<{ industrias: any[] }>('GET', '/api/profesor/estado', tokenProfe)
    const actual = estado.industrias.find((i) => i.id === industria.id)!
    for (const eq of actual.equipos) {
      assert(eq.decisionEstado === 'ENVIADA', `${eq.nombre}: decisión ENVIADA`)
      const r = await pedir('POST', '/api/profesor/aprobar', tokenProfe, { decisionId: eq.decisionId, aprobada: true })
      assert((r as any).estado === 'APROBADA', `${eq.nombre}: visto bueno concedido`)
    }
    linea('🎓', 'Docente', 'Visto bueno otorgado a las 8 empresas.')

    // El motor ejecuta la ronda
    const ronda = await pedir<{ anioProcesado: number; ventasTotales: number; finalizada: boolean }>(
      'POST', '/api/profesor/procesar', tokenProfe, { industriaId: industria.id }
    )
    assert(ronda.anioProcesado === anio, `ronda procesada = año ${anio}`)
    assert(ronda.ventasTotales > 0, `ventas del mercado positivas (${ronda.ventasTotales.toFixed(0)} mil L)`)
    linea('⚙️', 'Motor', `Año ${anio} ejecutado: ${ronda.ventasTotales.toFixed(0)} mil L vendidos por las 8 empresas, π = ${(ronda.inflacion * 100).toFixed(1)}%, ${ronda.eventosAplicados} evento(s).`)

    // ── UNIDAD DE DATOS 1: la decisión del GERENTE quedó aplicada a sus marcas
    for (let i = 0; i < resumen.length; i++) {
      const emp = resumen[i]
      const est = ESTRATEGIAS[PLAN[anio - 1][i]]
      const vistaAl = await pedir<any>('GET', '/api/alumno/estado', emp.tokenRep)
      const agua = vistaAl.marcas.find((m: any) => m.nombre.includes('Agua'))
      const crema = vistaAl.marcas.find((m: any) => m.nombre.includes('Crema'))
      assert(Math.abs(agua.precio - est.precioAgua) < 0.01, `${emp.nombre}: precio del agua en el estado = decisión (${agua.precio} ≈ ${est.precioAgua})`)
      assert(Math.abs(crema.precio - est.precioCrema) < 0.01, `${emp.nombre}: precio de la crema en el estado = decisión (${crema.precio} ≈ ${est.precioCrema})`)
      assert(Math.abs(agua.produccion - est.prodAgua) < 0.01, `${emp.nombre}: producción del agua aplicada (${agua.produccion})`)
      // Los eventos que ve el GERENTE coinciden con los que preparó el docente (año 1)
      if (anio === 1) {
        const evAlumno = Array.isArray(vistaAl.eventos) ? vistaAl.eventos.length : 0
        assert(evAlumno === eventosDocenteAnio1, `${emp.nombre}: ve los mismos ${evAlumno} evento(s) que preparó el docente`)
      }
    }
    linea('🔗', 'Datos unidos', `Año ${anio}: las decisiones de los 8 gerentes quedaron APLICADAS en sus marcas (precio y producción) y los eventos coinciden docente↔gerente.`)

    // Reportes por empresa
    for (const emp of resumen) {
      const rep = await pedir<any>('GET', `/api/alumno/reportes?anio=${anio}`, emp.tokenRep)
      assert(rep.ventas >= 0 && rep.contribucion !== undefined, `${emp.nombre}: reporte del año ${anio} presente`)
      emp.ventas.set(anio, rep.ventas)
      emp.contribucion.set(anio, rep.contribucion)

      // ── UNIDAD DE DATOS 2: el reporte del año es la SUMA de sus marcas
      const sumaVentas = rep.marcas.reduce((s: number, m: any) => s + m.ventas, 0)
      const sumaContrib = rep.marcas.reduce((s: number, m: any) => s + m.contribucion, 0)
      assert(Math.abs(sumaVentas - rep.ventas) < 1, `${emp.nombre}: ventas del reporte (${rep.ventas.toFixed(1)}) = suma de marcas (${sumaVentas.toFixed(1)})`)
      assert(Math.abs(sumaContrib - rep.contribucion) < 2, `${emp.nombre}: contribución del reporte (${rep.contribucion.toFixed(1)}) = suma de marcas (${sumaContrib.toFixed(1)})`)
    }
    linea('🔗', 'Datos unidos', `Año ${anio}: los 8 reportes son la SUMA exacta de sus marcas (ventas y contribución).`)

    // ── VERIFICACIÓN: los datos NO son idénticos entre las 8 empresas
    const ventasSet = new Set(resumen.map((e) => Math.round(e.ventas.get(anio)!)))
    assert(ventasSet.size >= 4, `datos por empresa DIFERENTES: ${ventasSet.size} valores de ventas distintos entre 8 empresas`)
    const contribSet = new Set(resumen.map((e) => Math.round(e.contribucion.get(anio)!)))
    assert(contribSet.size >= 4, `contribuciones por empresa DIFERENTES: ${contribSet.size} valores distintos`)
    linea('📊', 'Motor', `Datos por empresa verificados: ${ventasSet.size} ventas y ${contribSet.size} contribuciones DISTINTAS (el motor emula cada empresa).`)

    // ── VERIFICACIÓN: la decisión produce el efecto esperado ese año
    const idxOptima = PLAN[anio - 1].indexOf('optima')
    const idxDesastrosa = PLAN[anio - 1].indexOf('desastrosa')
    const idxDormida = PLAN[anio - 1].indexOf('dormida')
    const idxMedia = PLAN[anio - 1].indexOf('medio1')
    if (idxDesastrosa >= 0) {
      const v = resumen[idxDesastrosa].ventas.get(anio)!
      if (anio === 1) {
        assert(v < 1, `${resumen[idxDesastrosa].nombre} (DESASTROSA): sin producción ni ventas (${v.toFixed(1)} mil L)`)
      } else {
        // Años 2-3: puede vender el INVENTARIO heredado de la ronda anterior
        assert(v < 120, `${resumen[idxDesastrosa].nombre} (DESASTROSA): solo vende inventario heredado (${v.toFixed(1)} < 120 mil L)`)
      }
    }
    const cDormida = resumen[idxDormida].contribucion.get(anio)!
    const cOptima = resumen[idxOptima].contribucion.get(anio)!
    const cMedia = resumen[idxMedia].contribucion.get(anio)!
    assert(cOptima > cMedia + 500, `ÓPTIMA (${resumen[idxOptima].nombre}) rinde más que MEDIA-A: ${cOptima.toFixed(0)} > ${cMedia.toFixed(0)}`)
    assert(cDormida < cMedia - 500, `DORMIDA (${resumen[idxDormida].nombre}) rinde menos que MEDIA-A: ${cDormida.toFixed(0)} < ${cMedia.toFixed(0)}`)
    linea('🎯', 'Motor', `Decisiones → resultados: ÓPTIMA ${cOptima.toFixed(0)} mil Bs ≫ MEDIA ${cMedia.toFixed(0)} ≫ DORMIDA ${cDormida.toFixed(0)}.`)

    // ── UNIDAD DE DATOS 3: ranking del profesor ≡ ranking del gerente
    const rankingProfe = await pedir<{ industrias: any[] }>('GET', '/api/profesor/estado', tokenProfe)
      .then((e) => (e.industrias.find((i) => i.id === industria.id)!.ranking as FilaRanking[]))
    const vistaAl0 = await pedir<any>('GET', '/api/alumno/estado', resumen[0].tokenRep)
    const rankingAlumno = vistaAl0.ranking as FilaRanking[]
    assert(rankingAlumno.length === 8, 'el gerente también ve 8 empresas en su ranking')
    for (let i = 0; i < rankingProfe.length; i++) {
      assert(rankingAlumno[i].equipoId === rankingProfe[i].equipoId, `ranking unido profesor↔gerente en posición ${i + 1} (${rankingProfe[i].nombre})`)
      assert(Math.abs(rankingAlumno[i].contribucionAcumulada - rankingProfe[i].contribucionAcumulada) < 0.1, `misma contribución acumulada en ambas vistas (${rankingProfe[i].nombre})`)
    }
    linea('🔗', 'Datos unidos', `Año ${anio}: el ranking del PROFESOR y del GERENTE son IDÉNTICOS (mismo orden y cifras).`)

    // ── VERIFICACIÓN: el ranking se mueve tras la ronda
    const ranking = rankingProfe
    for (let i = 0; i < ranking.length; i++) assert(ranking[i].posicion === i + 1, `posición ${i + 1} correcta (${ranking[i].nombre})`)
    for (let i = 1; i < ranking.length; i++)
      assert(ranking[i - 1].contribucionAcumulada >= ranking[i].contribucionAcumulada, `orden por contribución: ${ranking[i - 1].nombre} ≥ ${ranking[i].nombre}`)

    let cambiaron = 0
    for (const fila of ranking) {
      const prev = acumuladaPrev.get(fila.equipoId)
      if (prev !== undefined && Math.abs(prev - fila.contribucionAcumulada) > 0.1) cambiaron += 1
      acumuladaPrev.set(fila.equipoId, fila.contribucionAcumulada)
    }
    const minimoCambio = anio === 2 ? 8 : 7 // año 3: la DESASTROSA restaurada aporta ~0
    assert(cambiaron >= minimoCambio, `el ranking SE MUEVE: ${cambiaron}/8 contribuciones acumuladas cambiaron tras el año ${anio}`)
    linea('🏁', 'Ranking', `Año ${anio}: ${cambiaron}/8 contribuciones acumuladas cambiaron → el ranking SE MUEVE.`)

    // ── VERIFICACIÓN: la empresa que pasa de DESASTROSA a ÓPTIMA sube puestos
    if (anio === 2) {
      const posAntes = rankingPrevio.get(resumen[4].empresaId)!
      const posAhora = ranking.find((f) => f.equipoId === resumen[4].empresaId)!.posicion
      const c4antes = resumen[4].contribucion.get(1)!
      const c4ahora = resumen[4].contribucion.get(2)!
      const c0antes = resumen[0].contribucion.get(1)!
      const c0ahora = resumen[0].contribucion.get(2)!
      assert(c4ahora > c4antes + 1000, `${resumen[4].nombre} pasó de DESASTROSA a ÓPTIMA: contribución del año ${c4antes.toFixed(0)} → ${c4ahora.toFixed(0)}`)
      assert(c0ahora < c0antes - 1000, `${resumen[0].nombre} pasó de ÓPTIMA a DORMIDA: contribución del año ${c0antes.toFixed(0)} → ${c0ahora.toFixed(0)}`)
      assert(posAhora <= posAntes - 2, `${resumen[4].nombre} SUBE en el ranking: posición ${posAntes} → ${posAhora} (≥ 2 puestos)`)
      linea('📈', 'Ranking', `${resumen[4].nombre} mejoró sus decisiones y SUBIÓ del puesto ${posAntes} al ${posAhora}; ${resumen[0].nombre} empeoró y su resultado del año se hundió.`)

      // ── UNIDAD DE DATOS 4: el inventario no vendido fluye al año siguiente
      // Tunari (ÓPTIMA año 2) produce 810k L pero vende menos → el sobrante
      // queda en sus marcas y su DESASTROSA del año 3 lo liquidará
      const vistaInv = await pedir<any>('GET', '/api/alumno/estado', resumen[4].tokenRep)
      const invTotal = vistaInv.marcas.reduce((s: number, m: any) => s + (m.inventario ?? 0), 0)
      assert(invTotal > 0, `${resumen[4].nombre} (DESASTROSA→ÓPTIMA): su inventario no vendido del año 2 (${invTotal.toFixed(1)} mil L) sigue en sus marcas`)
      linea('📦', 'Datos unidos', `El inventario fluye: ${resumen[4].nombre} arrastró ${invTotal.toFixed(1)} mil L del año 2 al año 3.`)
    }
    if (anio === 3) {
      const c4 = resumen[4].contribucion.get(3)!
      const c0 = resumen[0].contribucion.get(3)!
      assert(c4 < c0 - 2000, `${resumen[4].nombre} volvió a DESASTROSA: contribución del año ${c4.toFixed(0)} ≪ ÓPTIMA ${c0.toFixed(0)}`)
      linea('🔁', 'Motor', `Año 3 con estrategias restauradas: ${resumen[0].nombre} vuelve a rendir (${c0.toFixed(0)}) y ${resumen[4].nombre} cae (${c4.toFixed(0)}, solo liquidó inventario).`)
    }

    for (const fila of ranking) {
      const prev = rankingPrevio.get(fila.equipoId)
      if (prev !== undefined && prev !== fila.posicion) ordenCambioConfirmado = true
      rankingPrevio.set(fila.equipoId, fila.posicion)
    }

    console.log(`   Ranking tras el año ${anio}:`)
    for (const f of ranking) {
      const emp = resumen.find((e) => e.empresaId === f.equipoId)!
      console.log(`     ${String(f.posicion).padStart(2, ' ')}. ${f.nombre.padEnd(10)} acumulado ${f.contribucionAcumulada.toFixed(0).padStart(8)} mil Bs · ventas del año ${emp.ventas.get(anio)!.toFixed(0).padStart(5)} mil L · contrib. del año ${emp.contribucion.get(anio)!.toFixed(0).padStart(8)}`)
    }
  }

  // ── VERIFICACIÓN final: las posiciones cambiaron en algún momento
  assert(ordenCambioConfirmado, 'las POSICIONES del ranking cambiaron entre rondas (no quedó congelado)')
  linea('✅', 'Ranking', 'Las posiciones del ranking cambiaron entre años — el ranking refleja las decisiones.')

  // ── Fase 4 · Limpieza ───────────────────────────────────────────
  const eliminacion = await pedir<{ ok: boolean; equiposEliminados: number }>('DELETE', `/api/profesor/industrias?id=${industria.id}`, tokenProfe)
  assert(eliminacion.ok && eliminacion.equiposEliminados === 8, 'simulación eliminada con sus 8 empresas')
  linea('🗑️', 'Docente', 'Simulación de prueba eliminada (8 empresas, marcas, decisiones y reportes).')

  const estadoSinDesignar = await pedir<any>('GET', '/api/alumno/estado', resumen[0].tokenRep)
  assert(estadoSinDesignar.designado === false, 'el gerente queda SIN DESIGNAR tras eliminar la simulación')
  linea('🪑', 'Gerentes', 'Estado «Sin designar» verificado para los gerentes de la partida de prueba.')

  console.log('\n════════════════════════════════════════════════════════')
  if (fallos === 0) {
    console.log('  ✅ MOTOR 8 EMPRESAS VALIDADO — 1 GERENTE por empresa; los datos')
    console.log('     están UNIDOS: decisión → marcas → reportes → ranking.')
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
