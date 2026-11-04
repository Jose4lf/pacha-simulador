'use client'

import { motion } from 'framer-motion'
import { FlaskConical } from 'lucide-react'
import { type AlumnoEstado, type DecisionContenidoPayload } from '@/lib/pacha/api-client'
import { CANALES } from '@/lib/pacha/catalogo'
import { Badge } from '@/components/ui/badge'

const fmtBs = (v: number) => 'Bs ' + Math.round(v).toLocaleString('es-BO') + ' mil'
const fmtU = (v: number) => v.toLocaleString('es-BO', { maximumFractionDigits: 1 }) + ' mil u'

/* ============ Resumen contable de la decisión del año ============ */

function LineasDecision({
  estado,
  contenido,
}: {
  estado: AlumnoEstado
  contenido: DecisionContenidoPayload | null
}) {
  const nombreMarca = new Map(estado.marcas.map((m) => [m.id, m.nombre]))
  const filas: { etiqueta: string; valor: string }[] = []

  // Precios, publicidad, producción y ventas de cada marca (decisión enviada o valores vigentes)
  for (const m of estado.marcas) {
    const d = contenido?.marcas.find((x) => x.marcaId === m.id)
    filas.push({ etiqueta: `🍨 ${m.nombre} · precio`, valor: `Bs ${Number(d?.precio ?? m.precio).toFixed(2)} / unidad` })
    filas.push({ etiqueta: `🍨 ${m.nombre} · publicidad`, valor: fmtBs(Number(d?.publicidad ?? m.publicidad)) })
    filas.push({ etiqueta: `🍨 ${m.nombre} · producción`, valor: fmtU(Number(d?.produccion ?? m.produccion)) })
    const vs = d?.vendedores ?? m.vendedores
    const fuerza = CANALES.reduce((s, c, i) => s + (vs[i] ?? 0) * c.salario, 0)
    filas.push({
      etiqueta: `🍨 ${m.nombre} · vendedores`,
      valor: `${vs[0] ?? 0} T · ${vs[1] ?? 0} S · ${vs[2] ?? 0} K (${fmtBs(fuerza)})`,
    })
  }

  if (Number(contenido?.inversionCapacidad) > 0) {
    filas.push({
      etiqueta: '🏗️ Inversión en capacidad',
      valor: `${Number(contenido?.inversionCapacidad).toLocaleString('es-BO')} mil L`,
    })
  }

  const estudios = Array.isArray(contenido?.estudios) ? contenido.estudios : []
  if (estudios.length > 0) {
    let costoEstudios = 0
    for (const id of estudios) {
      const est = estado.config.catalogoEstudios.find((e) => e.id === id)
      costoEstudios += est?.costo ?? 0
      filas.push({ etiqueta: `${est?.icono ?? '📄'} ${est?.nombre ?? `Estudio #${id}`}`, valor: fmtBs(est?.costo ?? 0) })
    }
    filas.push({ etiqueta: 'Σ Costo de estudios', valor: fmtBs(costoEstudios) })
  }

  for (const n of contenido?.nuevas ?? []) {
    filas.push({
      etiqueta: `🌟 Lanzar «${n.nombre || 'marca nueva'}»`,
      valor: `Bs ${Number(n.precio).toFixed(2)}/u · ${fmtBs(Number(n.publicidad))} · ${fmtU(Number(n.produccion))} · ${n.vendedores?.[0] ?? 0}T/${n.vendedores?.[1] ?? 0}S/${n.vendedores?.[2] ?? 0}K`,
    })
  }

  return (
    <ul className="mt-2 space-y-1">
      {filas.map((f, i) => (
        <li key={i} className="flex flex-wrap items-baseline justify-between gap-2 rounded-lg bg-black/20 px-2.5 py-1 text-[11px]">
          <span className="text-zinc-300">{f.etiqueta}</span>
          <span className="font-bold text-zinc-100">{f.valor}</span>
        </li>
      ))}
    </ul>
  )
}

export function AlumnoComite({ estado }: { estado: AlumnoEstado; refresh?: () => Promise<void> | void }) {
  const anio = estado.industria.anioActual
  const decisionEstado = estado.decision?.estado ?? null

  return (
    <div className="space-y-5 pb-4">
      <div>
        <h2 className="text-xl font-black text-zinc-100 sm:text-2xl">
          👑 <span className="pacha-title-shine">Gerencia</span> de la empresa
        </h2>
        <p className="mt-0.5 text-sm text-zinc-400">
          Cada empresa la juega <b>UN solo jugador: el GERENTE 👑</b>. Decide las 5 áreas, envía la decisión del año
          en un solo envío (sin borradores) y consulta todos los reportes y datos financieros.
        </p>
      </div>

      {/* Estado de la decisión del año */}
      {decisionEstado === 'ENVIADA' && (
        <div role="status" className="rounded-xl border border-amber-400/40 bg-amber-400/10 px-4 py-3 text-sm font-bold text-amber-200">
          📨 La decisión del Año {anio} ya fue enviada — esperando el visto bueno del docente (se puede corregir y reenviar).
        </div>
      )}
      {decisionEstado === 'APROBADA' && (
        <div role="status" className="rounded-xl border border-emerald-400/40 bg-emerald-400/10 px-4 py-3 text-sm font-bold text-emerald-200">
          ✅ El docente dio el visto bueno al Año {anio} — cuando corra la simulación llegarán los reportes.
        </div>
      )}

      {/* Integrantes de la empresa */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {estado.comite.map((g, i) => {
          const esYo = g.usuarioId === estado.usuario.id
          return (
            <motion.article
              key={g.usuarioId}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: i * 0.04 }}
              className={`pacha-panel p-4 ${esYo ? 'ring-1 ring-pink-400/40' : ''} ${g.representante ? 'ring-1 ring-amber-400/40' : ''}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="truncate text-base font-black text-zinc-100">
                    {g.representante ? '👑' : '👤'} {g.nombre}
                    {esYo && <span className="ml-1.5 text-[10px] font-bold uppercase text-pink-300">(tú)</span>}
                  </h3>
                  <p className="text-[11px] font-semibold text-zinc-400">
                    {g.representante ? (
                      <span className="font-bold text-amber-300">GERENTE de la empresa · toma todas las decisiones</span>
                    ) : (
                      'Integrante · consulta todos los reportes y datos'
                    )}
                  </p>
                </div>
              </div>

              {g.representante && (
                <p className="mt-2 rounded-lg border border-amber-400/25 bg-amber-400/10 px-2.5 py-1.5 text-[11px] leading-snug text-amber-200">
                  Único jugador de la empresa: decide las 5 áreas y envía la decisión del año al docente en un solo envío directo.
                </p>
              )}
            </motion.article>
          )
        })}
      </div>

      {/* La decisión del año, en números (enviada o valores vigentes) */}
      <div className="pacha-panel p-4">
        <h3 className="mb-1 text-sm font-black uppercase tracking-wide text-zinc-300">
          🧾 La decisión del Año {anio} (en números)
        </h3>
        <p className="mb-3 text-[11px] text-zinc-500">
          {decisionEstado
            ? 'Contenido que el GERENTE envió al docente. Todos los integrantes de la empresa pueden consultarlo.'
            : 'Aún no se envía la decisión: estos son los valores vigentes de las marcas.'}
        </p>
        <div className="rounded-xl border border-white/10 bg-black/20 p-3">
          <p className="text-xs font-black text-zinc-100">
            <span aria-hidden="true">🎯</span> Decisión del Año {anio}
          </p>
          <LineasDecision estado={estado} contenido={estado.decision?.contenido ?? null} />
        </div>
      </div>

      {/* Proyectos I+D de la empresa */}
      <div className="pacha-panel p-4">
        <h3 className="mb-1 flex items-center gap-2 text-sm font-black uppercase tracking-wide text-zinc-300">
          <FlaskConical className="h-4 w-4 text-purple-300" aria-hidden="true" /> Proyectos de I+D de la empresa
        </h3>
        <p className="mb-3 text-[11px] text-zinc-500">
          Registrados por el GERENTE. Cuando uno se aprueba, se puede lanzar la marca nueva
          desde el área de Investigación y Desarrollo.
        </p>
        {estado.proyectos.length === 0 ? (
          <p className="text-xs text-zinc-500">Todavía no hay proyectos registrados.</p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {estado.proyectos.map((p) => (
              <div key={p.id} className="rounded-xl border border-white/10 bg-black/20 p-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-xs font-black text-zinc-100">⚗️ {p.nombre}</p>
                  <Badge
                    className={`shrink-0 border text-[9px] ${
                      p.estado === 'APROBADO'
                        ? 'border-emerald-400/40 bg-emerald-400/10 text-emerald-300'
                        : p.estado === 'FALLIDO'
                          ? 'border-red-400/40 bg-red-400/10 text-red-300'
                          : p.estado === 'APLICADO'
                            ? 'border-zinc-400/30 bg-zinc-400/10 text-zinc-300'
                            : 'border-amber-400/40 bg-amber-400/10 text-amber-300'
                    }`}
                  >
                    {p.estado.replace('_', ' ')}
                  </Badge>
                </div>
                <p className="mt-1.5 text-[11px] text-zinc-400">
                  💵 {fmtBs(p.presupuesto)} · 🎲 {Math.round(p.probabilidad * 100)}% · 📅 Año {p.anioInicio}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
