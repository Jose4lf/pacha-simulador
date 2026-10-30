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
  equipo: { id: string; nombre: string; color: string }
  industria: { id: string; nombre: string; anioActual: number; anioMaximo: number; estado: string }
  marcas: MarcaEstado[]
  decision: { estado: string; contenido: DecisionContenidoPayload } | null
  proyectos: ProyectoEstado[]
  reportes: ReporteResumen[]
  estudiosComprados: { anio: number; estudioId: number; costo: number; tieneDatos: boolean }[]
  costoEstudiosAnio: number
  ranking: RankingFila[]
  config: { id: { presupuestoMin: number; presupuestoMax: number; maxProyectosPorAnio: number; maxNombresPorSimulacion: number }; catalogoEstudios: EstudioDefFront[] }
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
    alumno: string | null
    numMarcas: number
    decisionEstado: string
    enviada: boolean
    sinBorrador: boolean
  }[]
  ranking: RankingFila[]
  alumnosDisponibles: { id: string; nombre: string }[]
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
  guardarBorrador: (contenido: DecisionContenidoPayload) =>
    request<{ ok: boolean }>('/api/alumno/decisiones', {
      method: 'POST',
      body: JSON.stringify({ accion: 'borrador', contenido }),
    }),
  enviarDecision: () =>
    request<{ ok: boolean; estudiosComprados: number }>('/api/alumno/decisiones', {
      method: 'POST',
      body: JSON.stringify({ accion: 'enviar' }),
    }),
  registrarProyecto: (nombre: string, atributos: number[], presupuesto: number) =>
    request<{ ok: boolean }>('/api/alumno/proyectos', {
      method: 'POST',
      body: JSON.stringify({ nombre, atributos, presupuesto }),
    }),

  profesorEstado: () => request<{ industrias: ProfesorIndustria[] }>('/api/profesor/estado'),
  crearIndustria: (nombre: string, equipos: string[]) =>
    request<{ id: string; nombre: string }>('/api/profesor/industrias', {
      method: 'POST',
      body: JSON.stringify({ nombre, equipos }),
    }),
  procesarRonda: (industriaId: string) =>
    request<{
      anioProcesado: number
      anioNuevo: number
      finalizada: boolean
      equiposSinDecision: string[]
      ventasTotales: number
    }>('/api/profesor/procesar', { method: 'POST', body: JSON.stringify({ industriaId }) }),
  asignarAlumno: (equipoId: string, alumnoId: string | null) =>
    request<{ ok: boolean }>('/api/profesor/asignar', {
      method: 'POST',
      body: JSON.stringify({ equipoId, alumnoId }),
    }),

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
