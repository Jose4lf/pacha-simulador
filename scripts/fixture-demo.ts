/** Crea (o reutiliza) una simulación de demostración para verificación visual. Idempotente. */
const BASE = process.env.PACHA_URL ?? 'http://localhost:3000'
const CLAVE = '321'
const DOCENTE = 'npc_profe_ylfnn'
const SUF = 'demo'

async function pedir<T = Record<string, unknown>>(metodo: 'GET' | 'POST' | 'DELETE', ruta: string, token?: string, cuerpo?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${ruta}`, {
    method: metodo,
    headers: { 'Content-Type': 'application/json', ...(token ? { 'x-pacha-session': token } : {}) },
    body: cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined,
  })
  const data = (await res.json().catch(() => ({}))) as T & { error?: string }
  if (!res.ok) throw new Error(`HTTP ${res.status} en ${ruta}: ${data.error ?? 'sin detalle'}`)
  return data
}

async function login(nombre: string): Promise<string> {
  const d = await pedir<{ token: string }>('POST', '/api/auth/login', undefined, { nombre, password: CLAVE })
  return d.token
}

async function main() {
  const tokenProfe = await login(DOCENTE)
  const estado = await pedir<{ industrias: { id: string; nombre: string; estado: string }[] }>('GET', '/api/profesor/estado', tokenProfe)
  const existente = estado.industrias.find((i) => i.nombre === `Demo Sanciones ${SUF}`)
  if (existente) {
    console.log(`Ya existe: ${existente.nombre} (${existente.id}) — estado ${existente.estado}`)
    return
  }
  const industria = await pedir<{ id: string }>('POST', '/api/profesor/industrias', tokenProfe, {
    nombre: `Demo Sanciones ${SUF}`,
    periodos: 8,
    empresas: [
      { nombre: `Glaciar ${SUF}`, integrantes: [1, 2, 3].map((n) => ({ usuario: `npc_demo${n}_${SUF}` })) },
      { nombre: `Sajama ${SUF}`, integrantes: [4, 5].map((n) => ({ usuario: `npc_demo${n}_${SUF}` })) },
    ],
  })
  console.log(`Simulación creada: Demo Sanciones ${SUF} (${industria.id})`)
  console.log(`Alumnos: npc_demo1_${SUF}, npc_demo2_${SUF}, npc_demo3_${SUF} · clave ${CLAVE}`)
}

await main()
