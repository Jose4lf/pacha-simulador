// Cliente API tipado del frontend PACHA
'use client'

export interface UsuarioSesion {
  id: string
  nombre: string
  rol: 'ALUMNO' | 'PROFESOR' | 'DECANO' | string
}

export interface MarcaEstado {
  id: string
  nombre: string
  precio: number
  publicidad: number
  produccion: number
  costoUnitario: number
  atributos: number[]
  vendedores: number[]
  inventario: number
  awareness: number
  anioLanzamiento: number
}

export interface DecisionMarcaPayload {
  marcaId: string
  precio: number
  publicidad: number
  produccion: number
  vendedores: number[]
}

export interface DecisionNuevaPayload {
  nombre: string
  proyectoId: string
  precio: number
  publicidad: number
  produccion: number
  vendedores: number[]
}

export interface DecisionContenidoPayload {
  marcas: DecisionMarcaPayload[]
  nuevas: DecisionNuevaPayload[]
  estudios: number[]
}

export interface CargoFront {
  id: string
  nombre: string
  corto: string
  emoji: string
  descripcion: string
}

export interface GerenteComite {
  usuarioId: string
  nombre: string
  /** 👑 Único integrante que toma las decisiones del grupo. */
  representante: boolean
}

export interface BorradorAreaFront {
  cargo: string
  contenido: Record<string, unknown>
  enviadoPor: string
  enviadoPorId: string | null
  enviadoAt: string | null
  updatedAt: string
}

export interface ProyectoEstado {
  id: string
  nombre: string
  atributos: number[]
  presupuesto: number
  estado: 'EN_DESARROLLO' | 'APROBADO' | 'FALLIDO' | 'APLICADO' | string
  anioInicio: number
  probabilidad: number
  presupuestoNormal: number
}

export interface ReporteResumen {
  anio: number
  ventas: number
  ingresos: number
  costos: number
  publicidad: number
  fuerzaVentas: number
  investigacionMercado: number
  contribucion: number
  participacion: number
  sinDecision: boolean
}

export interface RankingFila {
  equipoId: string
  nombre: string
  color: string
  contribucionAcumulada: number
  ingresosAcumulados: number
  ventasAcumuladas: number
  participacionUltima: number
  rondasJugadas: number
  posicion: number
}

export interface EstudioDefFront {
  id: number
  nombre: string
  descripcion: string
  costo: number
  icono: string
  categoria: string
}

export interface AlumnoEstado {
  usuario: UsuarioSesion
  /** false = SIN DESIGNAR: la cuenta existe pero el docente aún no lo asigna a una empresa. */
  designado: boolean
  membresia: { esRepresentante: boolean; esGerente: boolean } | null
  equipo: { id: string; nombre: string; color: string }
  industria: { id: string; nombre: string; anioActual: number; anioMaximo: number; estado: string }
  marcas: MarcaEstado[]
  decision: { estado: string; contenido: DecisionContenidoPayload } | null
  comite: GerenteComite[]
  borradores: BorradorAreaFront[]
  cargos: CargoFront[]
  proyectos: ProyectoEstado[]
  reportes: ReporteResumen[]
  estudiosComprados: { anio: number; estudioId: number; costo: number; tieneDatos: boolean }[]
  costoEstudiosAnio: number
  ranking: RankingFila[]
  config: { id: { presupuestoMin: number; presupuestoMax: number; maxProyectosPorAnio: number; maxNombresPorSimulacion: number }; catalogoEstudios: EstudioDefFront[]; maxIntegrantes: number }
  /** Eventos que ocurren/ocurrieron dentro de esta simulación, por año (doc §15). */
  eventos: EventoAlumno[]
  /** Historia contable por marca y año (reportes del equipo). */
  marcasHistoria: MarcaHistoriaFila[]
}

export interface EventoAlumno {
  anio: number
  nombre: string
  categoria: string
  region: string
  meses: number[]
  efectoDemanda: number
  efectoCosto: number
  efectoLogistica: number
  canal: string | null
  origen: string
  activo: boolean
}

export interface MarcaHistoriaFila {
  anio: number
  marcaNombre: string
  ventas: number
  produccion: number
  inventario: number
  ingresos: number
  costos: number
  contribucion: number
  participacion: number
  porCanal: { canalId: string; ventas: number }[]
}

export interface CuentaActiva {
  nombre: string
  rol: string
}

export interface EmpresaCrearPayload {
  nombre: string
  integrantes: { usuario: string; nombre?: string }[]
}

export interface ProfesorIndustria {
  id: string
  nombre: string
  anioActual: number
  anioMaximo: number
  estado: string
  equipos: {
    id: string
    nombre: string
    color: string
    numMarcas: number
    marcas: { id: string; nombre: string }[]
    integrantes: { usuarioId: string; nombre: string; representante: boolean }[]
    decisionEstado: string
    decisionId: string | null
    aprobada: boolean
    contenido: DecisionContenidoPayload | null
    areasSinBorrador: string[]
    areasTrabajadas: string[]
  }[]
  ranking: RankingFila[]
}

export interface DecanoEstado {
  usuarios: { id: string; nombre: string; rol: string; createdAt: string }[]
  industrias: {
    id: string
    nombre: string
    profesor: string
    anioActual: number
    anioMaximo: number
    estado: string
    numEquipos: number
    lider: string | null
  }[]
  stats: { totalUsuarios: number; profesores: number; alumnos: number; simulaciones: number }
}

// Gestión del token de sesión: se guarda en localStorage (con respaldo en memoria
// si el storage no está disponible, ej: iframes restringidos). Enviarlo por la
// cabecera `x-pacha-session` hace que la sesión funcione aunque el navegador
// bloquee cookies en contextos de iframe multi-sitio (panel de vista previa).
const TOKEN_KEY = 'pacha_session_token'
let tokenMemoria: string | null = null

function leerTokenGuardado(): string | null {
  if (tokenMemoria) return tokenMemoria
  try {
    tokenMemoria = localStorage.getItem(TOKEN_KEY)
  } catch {
    tokenMemoria = null
  }
  return tokenMemoria
}

function guardarToken(t: string): void {
  tokenMemoria = t
  try {
    localStorage.setItem(TOKEN_KEY, t)
  } catch {
    // storage no disponible: solo memoria
  }
}

function limpiarToken(): void {
  tokenMemoria = null
  try {
    localStorage.removeItem(TOKEN_KEY)
  } catch {
    // storage no disponible: solo memoria
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const token = leerTokenGuardado()
  const res = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'x-pacha-session': token } : {}),
      ...(init?.headers ?? {}),
    },
  })
  const data = (await res.json().catch(() => ({}))) as T & { error?: string }
  if (!res.ok) {
    // Token inválido o expirado: limpiar para permitir reingreso limpio
    if (res.status === 401) limpiarToken()
    throw new Error(data.error || `Error ${res.status}`)
  }
  return data
}

/**
 * Cabeceras de sesión para `fetch` directos fuera del cliente `api`.
 * Evita el error «No autenticado» cuando el navegador bloquea cookies
 * (app dentro del iframe del panel de vista previa): la identidad viaja
 * por la cabecera `x-pacha-session`.
 */
export function cabecerasSesion(): Record<string, string> {
  const token = leerTokenGuardado()
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'x-pacha-session': token } : {}),
  }
}

export const api = {
  login: async (nombre: string, password: string) => {
    const data = await request<UsuarioSesion & { token?: string }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ nombre, password }),
    })
    if (data.token) guardarToken(data.token)
    return data as UsuarioSesion
  },
  logout: async () => {
    const data = await request<{ ok: boolean }>('/api/auth/logout', { method: 'POST' })
    limpiarToken()
    return data
  },
  session: () => request<{ usuario: UsuarioSesion | null }>('/api/auth/session'),

  alumnoEstado: () => request<AlumnoEstado>('/api/alumno/estado'),

  /** Envía el borrador de UNA área del comité (queda visible para todo el equipo). */
  enviarBorradorArea: (cargo: string, contenido: unknown) =>
    request<{ ok: boolean }>('/api/alumno/decisiones', {
      method: 'POST',
      body: JSON.stringify({ accion: 'borrador-area', cargo, contenido }),
    }),
  /** Envía la decisión consolidada del año al docente. */
  enviarDecision: () =>
    request<{ ok: boolean; areasSinTrabajar: string[]; estudiosComprados: number }>('/api/alumno/decisiones', {
      method: 'POST',
      body: JSON.stringify({ accion: 'enviar' }),
    }),
  registrarProyecto: (nombre: string, atributos: number[], presupuesto: number) =>
    request<{ ok: boolean }>('/api/alumno/proyectos', {
      method: 'POST',
      body: JSON.stringify({ nombre, atributos, presupuesto }),
    }),

  profesorEstado: () => request<{ industrias: ProfesorIndustria[] }>('/api/profesor/estado'),
  crearIndustria: (nombre: string, periodos: number, empresas: EmpresaCrearPayload[]) =>
    request<{ id: string; nombre: string; anioMaximo: number }>('/api/profesor/industrias', {
      method: 'POST',
      body: JSON.stringify({ nombre, periodos, empresas }),
    }),
  /** 🗑️ Elimina una simulación completa; los estudiantes quedan SIN DESIGNAR. */
  eliminarIndustria: (industriaId: string) =>
    request<{ ok: boolean; equiposEliminados: number }>(`/api/profesor/industrias?id=${encodeURIComponent(industriaId)}`, {
      method: 'DELETE',
    }),
  /** 👑 Designa (o cambia) al GERENTE de una empresa. */
  definirRepresentante: (equipoId: string, usuarioId: string) =>
    request<{ ok: boolean; representante: string }>('/api/profesor/representante', {
      method: 'POST',
      body: JSON.stringify({ equipoId, usuarioId }),
    }),
  aprobarDecision: (decisionId: string, aprobada: boolean) =>
    request<{ ok: boolean; estado: string }>('/api/profesor/aprobar', {
      method: 'POST',
      body: JSON.stringify({ decisionId, aprobada }),
    }),
  procesarRonda: (industriaId: string) =>
    request<{
      anioProcesado: number
      anioNuevo: number
      finalizada: boolean
      equiposSinVistoBueno: string[]
      ventasTotales: number
    }>('/api/profesor/procesar', { method: 'POST', body: JSON.stringify({ industriaId }) }),

  decanoEstado: () => request<DecanoEstado>('/api/decano/estado'),
  crearUsuario: (nombre: string, password: string, rol: string) =>
    request<{ ok: boolean }>('/api/decano/usuarios', {
      method: 'POST',
      body: JSON.stringify({ accion: 'crear', nombre, password, rol }),
    }),
  resetPassword: (usuarioId: string, nueva?: string) =>
    request<{ ok: boolean; nueva: string }>('/api/decano/usuarios', {
      method: 'POST',
      body: JSON.stringify({ accion: 'reset', usuarioId, nueva }),
    }),
  eliminarUsuario: (usuarioId: string) =>
    request<{ ok: boolean; nombre: string }>('/api/decano/usuarios', {
      method: 'POST',
      body: JSON.stringify({ accion: 'eliminar', usuarioId }),
    }),
}

/** Cuentas reales del sistema (administrador + profesores) para el login. */
export async function fetchCuentas(): Promise<CuentaActiva[]> {
  try {
    const res = await fetch('/api/auth/cuentas', { cache: 'no-store' })
    if (!res.ok) return []
    const d = (await res.json()) as { cuentas: CuentaActiva[] }
    return d.cuentas ?? []
  } catch {
    return []
  }
}

export interface ReporteDetalle {
  anio: number
  ventas: number
  ingresos: number
  costos: number
  publicidad: number
  fuerzaVentas: number
  investigacionMercado: number
  contribucion: number
  participacion: number
  sinDecision: boolean
  historia?: {
    anio: number
    ventasMercado: number
    ventasEquipo: number
    participacion: number
    contribucion: number
  }[]
  detalle?: {
    mercado?: { demandaTotal: number; ventasEmpresas: number; ventasResto: number; capturaEmpresas: number }
    detalleMensual?: { mes: number; demandaTotal: number; ventasEmpresas: number; ventasResto: number }[]
    porRegion?: { regionId: string; ventas: number }[]
    finanzas?: Record<string, number | boolean> | null
    produccionAnio?: Record<string, number> | null
    marcasMensual?: Record<string, number[]>
    inflacion?: {
      anio: number
      escenario: string
      pi: number
      factores: { factor: string; senal: number; aporte: number }[]
      indicePreciosFin: number
      tipoCambioFinal: number
      tasasComponentes: Record<string, number>
    }
    eventos?: { variable: string; region: string; mes: number; eventos: { nombre: string; efecto: number; peso: number }[]; total: number }[]
  }
  macroHistoria?: {
    anio: number
    escenario: string
    inflacionAnual: number
    indicePreciosFin: number
    tipoCambioFinal: number
    factores: { factor: string; senal: number; aporte: number }[]
  }[]
  marcas: {
    marcaNombre: string
    ventas: number
    produccion: number
    inventario: number
    ingresos: number
    costos: number
    contribucion: number
    participacion: number
    porCanal: { canalId: string; ventas: number; ingresos: number }[]
    porSegmento: { segmentoId: string; ventas: number; ingresos: number }[]
  }[]
}

export async function fetchReporte(anio?: number): Promise<ReporteDetalle> {
  const q = anio !== undefined ? `?anio=${anio}` : ''
  return request<ReporteDetalle>(`/api/alumno/reportes${q}`)
}

export interface DatosEstudios {
  estudios: { anio: number; estudioId: number; costo: number; datos: unknown }[]
}

export async function fetchEstudios(): Promise<DatosEstudios> {
  return request<DatosEstudios>('/api/alumno/estudios')
}
