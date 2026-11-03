'use client'

// ============================================================
// PACHA Simulador · Guía paso a paso de una partida completa
// Recorrido de principio a fin (Rectorado → Docente → Alumnos →
// rondas → cierre) pensado para quien juega por primera vez.
// Los pasos describen los botones y pestañas reales del sistema.
// ============================================================

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { BookOpen, ChevronLeft, ChevronRight, Compass, Download, Lightbulb, Route, TriangleAlert, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Fase {
  id: string
  emoji: string
  titulo: string
}

const FASES: Fase[] = [
  { id: 'rectorado', emoji: '🛡️', titulo: 'Rectorado: dar de alta al docente' },
  { id: 'docente', emoji: '🎓', titulo: 'Docente: crear la simulación' },
  { id: 'eventos', emoji: '🌦️', titulo: 'Docente: el plan de eventos' },
  { id: 'alumnos', emoji: '🧑‍🎓', titulo: 'Alumnos: primer ingreso y áreas' },
  { id: 'ronda', emoji: '🔄', titulo: 'La ronda de un año, paso a paso' },
  { id: 'cierre', emoji: '🏁', titulo: 'Cierre: ranking final y descargas' },
]

// ---------- Bloques visuales reutilizables ----------

function Titulo({ children }: { children: React.ReactNode }) {
  return <h3 className="mb-3 text-lg font-black tracking-tight text-zinc-100 md:text-xl">{children}</h3>
}

function Parrafo({ children }: { children: React.ReactNode }) {
  return <p className="mb-3 text-sm leading-relaxed text-zinc-300">{children}</p>
}

function Paso({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span
        className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-pink-500 to-amber-500 text-[11px] font-black text-white"
        aria-hidden="true"
      >
        {n}
      </span>
      <div className="text-sm leading-relaxed text-zinc-300">{children}</div>
    </li>
  )
}

function Tip({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-4 flex gap-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3.5">
      <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" aria-hidden="true" />
      <div className="text-sm leading-relaxed text-zinc-200">{children}</div>
    </div>
  )
}

function Alerta({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-4 flex gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5">
      <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" aria-hidden="true" />
      <div className="text-sm leading-relaxed text-zinc-200">{children}</div>
    </div>
  )
}

function Rol({ emoji, children }: { emoji: string; children: React.ReactNode }) {
  return (
    <p className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-black uppercase tracking-widest text-zinc-400">
      <span aria-hidden="true">{emoji}</span> {children}
    </p>
  )
}

function BotonDescarga({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      download
      className="pacha-btn-game flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-sm font-bold text-emerald-300 hover:bg-emerald-500/20"
    >
      <Download className="h-4 w-4" aria-hidden="true" />
      {children}
    </a>
  )
}

// ---------- Contenido de cada fase ----------

function FaseRectorado() {
  return (
    <>
      <Rol emoji="🛡️">Administrador · Rectorado</Rol>
      <Titulo>Fase 0 · Dar de alta al docente</Titulo>
      <Parrafo>
        El sistema arranca limpio: la única cuenta que existe es la del Administrador (Rectorado). El
        docente no puede registrarse por su cuenta: lo crea el Rectorado en un minuto.
      </Parrafo>
      <ol className="mb-4 space-y-3">
        <Paso n={1}>
          En el login, pulsa la cuenta <b className="text-zinc-100">Admin</b> (o escribe <b>Admin</b> y su
          clave inicial <b>321</b>) y entra con «▶ Jugar». La sección «Cuentas actuales» del login muestra
          únicamente al administrador y a los docentes registrados en el sistema.
        </Paso>
        <Paso n={2}>
          En el panel del Rectorado abre la sección <b className="text-zinc-100">Usuarios</b> y pulsa «Crear
          usuario». Escribe el usuario del docente (ejemplo: <b>profe</b>), una contraseña (mínimo 3
          caracteres) y el rol <b>Profesor</b>. Guarda.
        </Paso>
        <Paso n={3}>
          Entrega al docente su usuario y contraseña. Desde ese momento su cuenta aparece sola en la
          sección «Cuentas actuales» del login. Los alumnos no se crean aquí: nacen cuando el docente arma
          sus empresas.
        </Paso>
      </ol>
      <Tip>
        El Rectorado también puede <b>restablecer la clave</b> de cualquier usuario y{' '}
        <b>eliminar</b> alumnos o profesores con el botón 🗑️ (no puede eliminar administradores ni usuarios con auditoría
        de sanciones o simulaciones a su cargo).
      </Tip>
    </>
  )
}

function FaseDocente() {
  return (
    <>
      <Rol emoji="🎓">Docente</Rol>
      <Titulo>Fase 1 · Crear la simulación</Titulo>
      <Parrafo>
        El docente arma el mercado: cuántos años dura la partida y qué empresas (comités de alumnos)
        compiten en la industria de helados de Bolivia.
      </Parrafo>
      <ol className="mb-4 space-y-3">
        <Paso n={1}>
          Entra con tu cuenta de docente y pulsa <b className="text-zinc-100">Nueva simulación</b>. Elige
          nombre (ejemplo: «Práctica Mercado A»), la cantidad de años (1 a 10) y las empresas: cada una con
          su nombre y la lista de usuarios de sus integrantes (de 1 a 8 integrantes por empresa; el
          <b> REPRESENTANTE</b> —el primero de la lista— será quien tome las decisiones).
        </Paso>
        <Paso n={2}>
          Al guardar, el sistema crea a los <b>alumnos automáticamente</b> (clave inicial <b>321</b>) y a
          cada empresa le da 2 marcas iniciales (una de agua y una de crema) con capacidad de 1.000.000 de
          litros. El primer integrante de cada empresa queda como <b>REPRESENTANTE 👑</b>: puedes cambiarlo
          cuando quieras desde la tabla de empresas (lista «👑 Cambiar representante»).
        </Paso>
        <Paso n={3}>
          Pasa la lista: cada alumno necesita su <b>usuario</b> (la clave es 321 hasta que el Rectorado o el
          docente la cambien). En «Mis simulaciones» verás el estado de cada empresa: si ya envió su
          decisión, qué áreas trabajaron y si tú ya aprobaste. También puedes <b>eliminar una simulación</b>
          completa con «🗑️ Eliminar simulación»: los estudiantes quedan SIN DESIGNAR hasta que los asignes a
          una nueva partida.
        </Paso>
      </ol>
      <Alerta>
        Un mismo usuario no puede pertenecer a dos empresas a la vez. Si un alumno se retira, el Rectorado
        puede eliminarlo y el docente designa a otro REPRESENTANTE desde la tabla de empresas.
      </Alerta>
    </>
  )
}

function FaseEventos() {
  return (
    <>
      <Rol emoji="🌦️">Docente</Rol>
      <Titulo>Fase 2 · Revisar el plan de eventos</Titulo>
      <Parrafo>
        Cada simulación arranca con un <b>plan de eventos por año</b> (1 a 3 eventos por año, nunca dos de
        la misma categoría en el mismo año). Los eventos ocurren DENTRO de la partida y afectan demanda,
        costos y logística: Navidad, Escasez de combustible, Crisis económica, Inundaciones, etc.
      </Parrafo>
      <ol className="mb-4 space-y-3">
        <Paso n={1}>
          Abre la pestaña <b className="text-zinc-100">Eventos por año</b> de tu simulación. Verás el plan
          año por año: cada evento con su categoría, región, meses de duración e intensidad.
        </Paso>
        <Paso n={2}>
          Ajusta a tu criterio: <b>Fijar en el Año N</b> agrega un evento del catálogo a ese año, «Quitar»
          lo retira y <b>Autocompletar</b> rellena los años vacíos sorteando con la semilla de la
          simulación (queda registrada, es reproducible).
        </Paso>
        <Paso n={3}>
          Antes de ejecutar cada año podrás ver la <b>vista previa</b> del período: los eventos resueltos
          con sus efectos (demanda ±%, costos ±%, logística) y la inflación π proyectada con sus factores.
          Puedes desactivar un evento puntual si no quieres que afecte esa ronda.
        </Paso>
      </ol>
      <Tip>
        Los eventos quedan <b>trazados en los reportes</b> de cada año: los alumnos verán qué ocurrió, en
        qué meses y cuánto movió la demanda o los costos (origen: planificado por el docente o automático).
      </Tip>
    </>
  )
}

function FaseAlumnos() {
  return (
    <>
      <Rol emoji="🧑‍🎓">Alumnos · Grupo de Dirección</Rol>
      <Titulo>Fase 3 · Primer ingreso y roles del grupo</Titulo>
      <Parrafo>
        Todos los integrantes del grupo <b>ven y analizan todo</b>: reportes, cifras financieras y las
        decisiones de las 5 áreas. Solo <b>UNO</b> — el <b className="text-amber-300">REPRESENTANTE 👑</b> —
        edita y envía las decisiones del año (el docente puede cambiar quién es el representante en
        cualquier momento).
      </Parrafo>
      <ol className="mb-4 space-y-3">
        <Paso n={1}>
          El alumno entra al login con su usuario (ejemplo: <b>colibri</b>) y la clave <b>321</b>. Ve su
          empresa, si es REPRESENTANTE o integrante, sus puntos de desempeño y el entorno del año actual
          (eventos anunciados e inflación). Si aún no fue asignado a ninguna empresa verá su estado
          «Sin designar» y deberá esperar al docente.
        </Paso>
        <Paso n={2}>
          En <b className="text-zinc-100">Decisiones</b> el grupo debate las 5 áreas: precios por marca,
          presupuesto de publicidad, producción e inversión en capacidad, vendedores por canal, y estudios
          + proyectos de I+D. Todos consultan; solo el REPRESENTANTE guarda los borradores y envía la
          decisión. Los números de cada área están en «Reportes → Reportes por área».
        </Paso>
        <Paso n={3}>
          En <b className="text-zinc-100">Reportes</b> todo el grupo analiza los resultados: resumen del
          año, detalle mensual, ventas por departamento, resultados financieros (IVA, IT, IUE) e inflación.
          Con el botón <b>«⬇️ Descargar reporte (Excel/CSV)»</b> obtienen el reporte con cifras completas y
          nombres completos para el análisis contable del grupo.
        </Paso>
        <Paso n={4}>
          El REPRESENTANTE registra proyectos de I+D (nombre, atributos objetivo 1-10, presupuesto
          100-1000 miles Bs) y, cuando un proyecto se aprueba, puede lanzar la marca nueva desde el área de
          Investigación y Desarrollo.
        </Paso>
      </ol>
      <Alerta>
        Los puntos de desempeño son responsabilidad del REPRESENTANTE: por cada área con borrador guardado
        suma; por cada área sin borrador resta. Además, el grupo (a través del representante) puede sancionar
        a un integrante con desempeño muy negativo (amonestación, resta de puntos o expulsión).
      </Alerta>
    </>
  )
}

function FaseRonda() {
  return (
    <>
      <Rol emoji="🔄">Todo el grupo · se repite cada año</Rol>
      <Titulo>Fase 4 · La ronda de un año, paso a paso</Titulo>
      <Parrafo>
        Este es el latido del juego: la ronda se repite una vez por año hasta terminar la simulación.
      </Parrafo>
      <ol className="mb-4 space-y-3">
        <Paso n={1}>
          <b className="text-zinc-100">Docente — Preparar período:</b> en «Entorno del período» consulta la
          vista previa (eventos resueltos + inflación π con factores). Puede fijar el escenario
          (FAVORABLE / ESTABLE / DESFAVORABLE) o dejar el sorteo con semilla. Los alumnos ven el entorno
          anunciado.
        </Paso>
        <Paso n={2}>
          <b className="text-zinc-100">Alumnos — Borradores por área:</b> el REPRESENTANTE define las
          decisiones de cada área junto a su grupo (ej.: precio Bs 12-18 por litro, publicidad en miles de
          Bs, producción según capacidad, vendedores en tiendas/supermercados/kioscos) y pulsa «Guardar
          borrador del área». El I+D además compra estudios de mercado y registra proyectos.
        </Paso>
        <Paso n={3}>
          <b className="text-zinc-100">Alumnos — Grupo:</b> la pestaña de grupo muestra las decisiones de
          cada área <b>en cifras</b> (precio, presupuesto, producción, vendedores). Todo el grupo analiza,
          discute y ajusta; el representante aplica las sanciones que el grupo acuerde a un integrante con
          desempeño muy negativo.
        </Paso>
        <Paso n={4}>
          <b className="text-zinc-100">Alumnos — Enviar decisión:</b> el REPRESENTANTE pulsa «Enviar
          decisión al docente». El sistema consolida los 5 borradores; un área sin borrador usa los
          valores vigentes y queda marcada «sin trabajar» (penalización de puntos).
        </Paso>
        <Paso n={5}>
          <b className="text-zinc-100">Docente — Aprobar y ejecutar:</b> revisa la decisión de cada empresa
          y le da el visto bueno. Con todas aprobadas, pulsa «Ejecutar ronda»: el motor calcula el año mes
          a mes (demanda por segmento y región, eventos, inflación, capacidad, inventario, impuestos IT e
          IUE).
        </Paso>
        <Paso n={6}>
          <b className="text-zinc-100">Todos — Reportes del año:</b> cada área revisa sus números (ventas,
          ingresos, costos, contribución, participación), el detalle mensual y regional, los eventos que
          ocurrieron con su efecto trazado y el ranking acumulado. Luego se repite la ronda para el
          siguiente año.
        </Paso>
      </ol>
      <Tip>
        Ejemplo real validado: con 2 empresas de 5 integrantes (1 representante por grupo), el Año 1 se
        completa en 6 pasos y el motor reporta ventas en litros, contribución en miles de Bs y participación %
        por empresa.
      </Tip>
    </>
  )
}

function FaseCierre() {
  return (
    <>
      <Rol emoji="🏁">Docente + Rectorado</Rol>
      <Titulo>Fase 5 · Cierre de la partida</Titulo>
      <Parrafo>
        Al ejecutar el último año, la simulación pasa a estado <b>FINALIZADA</b>: nadie puede enviar más
        decisiones y el histórico queda congelado para análisis.
      </Parrafo>
      <ol className="mb-4 space-y-3">
        <Paso n={1}>
          El docente revisa con la clase el <b className="text-zinc-100">ranking final</b>: contribución
          acumulada, ingresos, ventas y participación de la última ronda. La historia de cada marca (año a
          año, canal y segmento) está en los reportes generales.
        </Paso>
        <Paso n={2}>
          Exporta los resultados a <b>CSV</b> para el informe de la materia (pantalla de reportes del
          docente). La trazabilidad de eventos e inflación permite discutir POR QUÉ ganó cada empresa.
        </Paso>
        <Paso n={3}>
          El Rectorado cierra el ciclo: elimina cuentas temporalmente creadas o las conserva para la
          siguiente gestión. El docente puede crear una nueva simulación y volver a empezar.
        </Paso>
      </ol>
      <div className="mb-3 grid gap-2 sm:grid-cols-2">
        <BotonDescarga href="/docs/manual-usuario.pdf">⬇️ Manual del jugador (PDF)</BotonDescarga>
        <BotonDescarga href="/docs/guia-partida-paso-a-paso.pdf">⬇️ Esta guía en PDF</BotonDescarga>
      </div>
      <Tip>
        Esta guía fue validada de principio a fin con una <b>prueba automática «NPC»</b>: un docente y 10
        alumnos virtuales juegan una partida completa (alta de docente, simulación, 3 rondas, eventos,
        I+D y cierre). El registro completo acompaña a la guía descargable.
      </Tip>
    </>
  )
}

const CONTENIDOS: Record<string, () => React.JSX.Element> = {
  rectorado: FaseRectorado,
  docente: FaseDocente,
  eventos: FaseEventos,
  alumnos: FaseAlumnos,
  ronda: FaseRonda,
  cierre: FaseCierre,
}

// ---------- Overlay ----------

export function GuiaPartida({ onCerrar }: { onCerrar: () => void }) {
  const [fase, setFase] = useState('rectorado')
  const idx = Math.max(0, FASES.findIndex((f) => f.id === fase))

  // Cerrar con Escape como en el manual
  useEffect(() => {
    function tecla(e: KeyboardEvent) {
      if (e.key === 'Escape') onCerrar()
    }
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  }, [onCerrar])

  const Contenido = CONTENIDOS[fase] ?? FaseRectorado

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="pacha-bg fixed inset-0 z-50 flex flex-col text-white"
      role="dialog"
      aria-modal="true"
      aria-label="Guía paso a paso de una partida completa"
    >
      {/* Cabecera */}
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 px-4 py-3 md:px-6">
        <div className="flex items-center gap-2.5">
          <Route className="h-6 w-6 text-emerald-400" aria-hidden="true" />
          <div>
            <h2 className="text-base font-black tracking-tight md:text-lg">
              Guía paso a paso · <span className="pacha-title-shine">Partida completa</span>
            </h2>
            <p className="hidden text-[11px] text-zinc-500 sm:block">
              Del alta del docente al ranking final · PACHA Simulador
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="icon"
          onClick={onCerrar}
          aria-label="Cerrar guía"
          className="h-10 w-10 shrink-0 border-white/15 bg-white/5 text-zinc-300 hover:bg-white/10"
        >
          <X className="h-5 w-5" />
        </Button>
      </header>

      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        {/* Navegación lateral (desktop) */}
        <nav
          aria-label="Fases de la guía"
          className="hidden w-64 shrink-0 flex-col gap-1 overflow-y-auto border-r border-white/10 p-3 md:flex"
        >
          {FASES.map((f, i) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFase(f.id)}
              aria-current={fase === f.id ? 'true' : undefined}
              className={`pacha-btn-game flex min-h-[44px] items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm font-bold transition ${
                fase === f.id
                  ? 'border border-emerald-500/40 bg-emerald-500/15 text-zinc-100'
                  : 'border border-transparent text-zinc-400 hover:bg-white/5 hover:text-zinc-200'
              }`}
            >
              <span className="text-lg" aria-hidden="true">
                {f.emoji}
              </span>
              <span className="flex-1">
                {i}. {f.titulo}
              </span>
            </button>
          ))}
          <div className="mt-2 border-t border-white/10 pt-2">
            <a
              href="/docs/guia-partida-paso-a-paso.pdf"
              download
              className="pacha-btn-game flex min-h-[44px] items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-bold text-emerald-300 hover:bg-emerald-500/20"
            >
              <Download className="h-4 w-4" aria-hidden="true" /> Descargar guía (PDF)
            </a>
            <a
              href="/docs/manual-usuario.pdf"
              download
              className="pacha-btn-game mt-1.5 flex min-h-[44px] items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs font-bold text-amber-300 hover:bg-amber-500/20"
            >
              <BookOpen className="h-4 w-4" aria-hidden="true" /> Descargar manual (PDF)
            </a>
          </div>
        </nav>

        {/* Navegación en chips (móvil) */}
        <nav
          aria-label="Fases de la guía"
          className="pacha-scroll flex shrink-0 gap-2 overflow-x-auto border-b border-white/10 p-3 md:hidden"
        >
          {FASES.map((f, i) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFase(f.id)}
              aria-current={fase === f.id ? 'true' : undefined}
              className={`pacha-btn-game flex min-h-[36px] shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold ${
                fase === f.id
                  ? 'border-emerald-500/50 bg-emerald-500/20 text-zinc-100'
                  : 'border-white/10 bg-white/5 text-zinc-400'
              }`}
            >
              <span aria-hidden="true">{f.emoji}</span> {i}
            </button>
          ))}
        </nav>

        {/* Contenido de la fase */}
        <main className="pacha-scroll min-h-0 flex-1 overflow-y-auto px-4 py-6 md:px-8">
          <div className="mx-auto max-w-3xl">
            <p className="mb-1 text-[11px] font-black uppercase tracking-[0.3em] text-zinc-600">
              Fase {idx} de {FASES.length - 1}
            </p>
            <div className="pacha-pop">
              <Contenido />
            </div>

            {/* Anterior / Siguiente */}
            <div className="mt-8 flex items-center justify-between gap-3 border-t border-white/10 pt-5">
              <Button
                variant="outline"
                onClick={() => setFase(FASES[Math.max(0, idx - 1)].id)}
                disabled={idx <= 0}
                className="h-11 border-white/15 bg-white/5 px-4 text-zinc-300 hover:bg-white/10"
              >
                <ChevronLeft className="mr-1 h-4 w-4" /> Anterior
              </Button>
              {idx < FASES.length - 1 ? (
                <Button
                  onClick={() => setFase(FASES[idx + 1].id)}
                  className="pacha-btn-game h-11 bg-gradient-to-r from-emerald-500 to-teal-500 px-5 font-black uppercase tracking-wide text-white hover:from-emerald-400 hover:to-teal-400"
                >
                  Siguiente <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              ) : (
                <Button
                  onClick={onCerrar}
                  className="pacha-btn-game h-11 bg-gradient-to-r from-pink-500 to-amber-500 px-5 font-black uppercase tracking-wide text-white hover:from-pink-400 hover:to-amber-400"
                >
                  <Compass className="mr-1 h-4 w-4" /> ¡Listo, a jugar!
                </Button>
              )}
            </div>
          </div>
        </main>
      </div>
    </motion.div>
  )
}

/** Botón de acceso a la guía (para la pantalla de login). */
export function BotonGuia({ onClick }: { onClick: () => void }) {
  return (
    <Button
      type="button"
      variant="outline"
      onClick={onClick}
      className="pacha-btn-game h-11 w-full border-emerald-500/40 bg-emerald-500/10 text-sm font-bold text-emerald-300 hover:bg-emerald-500/20"
    >
      <Route className="mr-2 h-4 w-4" aria-hidden="true" />
      🧭 Guía paso a paso · partida completa
    </Button>
  )
}
