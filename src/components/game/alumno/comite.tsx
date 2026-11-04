'use client'

import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { FlaskConical } from 'lucide-react'
import { type AlumnoEstado, type BorradorAreaFront, type CargoFront } from '@/lib/pacha/api-client'
import { CANALES } from '@/lib/pacha/catalogo'
import { Badge } from '@/components/ui/badge'

const fmtBs = (v: number) => 'Bs ' + Math.round(v).toLocaleString('es-BO') + ' mil'
const fmtU = (v: number) => v.toLocaleString('es-BO', { maximumFractionDigits: 1 }) + ' mil u'

/* ============ Líneas contables de cada área (contenido del borrador) ============ */

function LineasArea({ estado, borrador }: { estado: AlumnoEstado; borrador: BorradorAreaFront }) {
  const nombreMarca = useMemo(() => new Map(estado.marcas.map((m) => [m.id, m.nombre])), [estado.marcas])
  const c = borrador.contenido as Record<string, unknown>
  const filas: { etiqueta: string; valor: string }[] = []

  if (borrador.cargo === 'precios' && Array.isArray(c.precios)) {
    for (const p of c.precios as { marcaId: string; precio: number }[]) {
      filas.push({ etiqueta: `🍨 ${nombreMarca.get(p.marcaId) ?? 'Marca'}`, valor: `Bs ${Number(p.precio).toFixed(2)} / unidad` })
    }
  } else if (borrador.cargo === 'publicidad' && Array.isArray(c.publicidades)) {
    let total = 0
    for (const p of c.publicidades as { marcaId: string; publicidad: number }[]) {
      total += Number(p.publicidad)
      filas.push({ etiqueta: `🍨 ${nombreMarca.get(p.marcaId) ?? 'Marca'}`, valor: fmtBs(Number(p.publicidad)) })
    }
    filas.push({ etiqueta: 'Σ Total publicidad', valor: fmtBs(total) })
  } else if (borrador.cargo === 'produccion' && Array.isArray(c.producciones)) {
    let total = 0
    for (const p of c.producciones as { marcaId: string; produccion: number }[]) {
      total += Number(p.produccion)
      filas.push({ etiqueta: `🍨 ${nombreMarca.get(p.marcaId) ?? 'Marca'}`, valor: fmtU(Number(p.produccion)) })
    }
    filas.push({ etiqueta: 'Σ Producción total', valor: fmtU(total) })
    if (Number(c.inversionCapacidad) > 0) {
      filas.push({ etiqueta: '🏗️ Inversión en capacidad', valor: `${Number(c.inversionCapacidad).toLocaleString('es-BO')} mil L` })
    }
  } else if (borrador.cargo === 'ventas' && Array.isArray(c.ventas)) {
    let fuerza = 0
    for (const v of c.ventas as { marcaId: string; vendedores: number[] }[]) {
      const vs = v.vendedores ?? [0, 0, 0]
      const sueldos = CANALES.reduce((s, cn, i) => s + (vs[i] ?? 0) * cn.salario, 0)
      fuerza += sueldos
      filas.push({
        etiqueta: `🍨 ${nombreMarca.get(v.marcaId) ?? 'Marca'}`,
        valor: `${vs[0] ?? 0} T · ${vs[1] ?? 0} S · ${vs[2] ?? 0} K (vendedores)`,
      })
    }
    filas.push({ etiqueta: 'Σ Nómina de ventas', valor: fmtBs(fuerza) })
  } else if (borrador.cargo === 'investigacion') {
    const estudios = Array.isArray(c.estudios) ? (c.estudios as number[]) : []
    let costoEstudios = 0
    for (const id of estudios) {
      const est = estado.config.catalogoEstudios.find((e) => e.id === id)
      costoEstudios += est?.costo ?? 0
      filas.push({ etiqueta: `${est?.icono ?? '📄'} ${est?.nombre ?? `Estudio #${id}`}`, valor: fmtBs(est?.costo ?? 0) })
    }
    if (estudios.length === 0) filas.push({ etiqueta: '📄 Estudios de mercado', valor: 'ninguno seleccionado' })
    if (estudios.length > 0) filas.push({ etiqueta: 'Σ Costo de estudios', valor: fmtBs(costoEstudios) })
    const nuevas = Array.isArray(c.nuevas) ? (c.nuevas as { nombre: string; precio: number; publicidad: number; produccion: number; vendedores: number[] }[]) : []
    for (const n of nuevas) {
      filas.push({
        etiqueta: `🌟 Lanzar «${n.nombre || 'marca nueva'}»`,
        valor: `Bs ${Number(n.precio).toFixed(2)}/u · ${fmtBs(Number(n.publicidad))} · ${fmtU(Number(n.produccion))} · ${n.vendedores?.[0] ?? 0}T/${n.vendedores?.[1] ?? 0}S/${n.vendedores?.[2] ?? 0}K`,
      })
    }
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
  const bloqueada = decisionEstado === 'ENVIADA' || decisionEstado === 'APROBADA'

  const cargos: CargoFront[] = estado.cargos
  const borradorDe = new Map(estado.borradores.map((b) => [b.cargo, b]))

  return (
    <div className="space-y-5 pb-4">
      <div>
        <h2 className="text-xl font-black text-zinc-100 sm:text-2xl">
          👥 Grupo <span className="pacha-title-shine">de Dirección</span>
        </h2>
        <p className="mt-0.5 text-sm text-zinc-400">
          Los integrantes de la empresa (máximo 8). Todos pueden consultar los reportes, los datos financieros y lo
          decidido en cada área; solo el <b className="text-amber-300">👑 REPRESENTANTE</b> toma y envía las
          decisiones del año.
        </p>
      </div>

      {/* Estado de la decisión del año */}
      {decisionEstado === 'ENVIADA' && (
        <div role="status" className="rounded-xl border border-amber-400/40 bg-amber-400/10 px-4 py-3 text-sm font-bold text-amber-200">
          🔒 El comité ya envió la decisión del Año {anio} — esperando el visto bueno del docente.
        </div>
      )}
      {decisionEstado === 'APROBADA' && (
        <div role="status" className="rounded-xl border border-emerald-400/40 bg-emerald-400/10 px-4 py-3 text-sm font-bold text-emerald-200">
          ✅ El docente dio el visto bueno al Año {anio} — cuando corra la simulación llegarán los reportes.
        </div>
      )}

      {/* Integrantes del grupo */}
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
                      <span className="font-bold text-amber-300">Representante del grupo · toma las decisiones</span>
                    ) : (
                      'Integrante · consulta todos los reportes y datos'
                    )}
                  </p>
                </div>
              </div>

              {g.representante && (
                <p className="mt-2 rounded-lg border border-amber-400/25 bg-amber-400/10 px-2.5 py-1.5 text-[11px] leading-snug text-amber-200">
                  Responsable de guardar los borradores de las 5 áreas y de enviar la decisión del año al docente.
                </p>
              )}
            </motion.article>
          )
        })}
      </div>

      {/* Lo que decidió cada área, en números (comité) */}
      <div className="pacha-panel p-4">
        <h3 className="mb-1 text-sm font-black uppercase tracking-wide text-zinc-300">
          🧾 Lo que decidió cada área · Año {anio} (en números)
        </h3>
        <p className="mb-3 text-[11px] text-zinc-500">
          Resumen contable de los borradores guardados en cada área de la decisión. Todos los integrantes pueden
          consultarlos; solo el representante los edita y envía.
        </p>
        <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
          {cargos.map((c) => {
            const b = borradorDe.get(c.id)
            return (
              <div key={c.id} className="rounded-xl border border-white/10 bg-black/20 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-black text-zinc-100">
                    <span aria-hidden="true">{c.emoji}</span> {c.nombre}
                  </p>
                  {b && <span className="text-[10px] font-bold text-zinc-400">por {b.enviadoPor}</span>}
                </div>
                {b ? (
                  <LineasArea estado={estado} borrador={b} />
                ) : (
                  <p className="mt-2 text-[11px] italic text-zinc-500">
                    {bloqueada ? 'Sin borrador: se usaron valores predeterminados.' : 'Área sin trabajar todavía.'}
                  </p>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Proyectos I+D del equipo: los revisa todo el comité */}
      <div className="pacha-panel p-4">
        <h3 className="mb-1 flex items-center gap-2 text-sm font-black uppercase tracking-wide text-zinc-300">
          <FlaskConical className="h-4 w-4 text-purple-300" aria-hidden="true" /> Proyectos de I+D del equipo
        </h3>
        <p className="mb-3 text-[11px] text-zinc-500">
          Registrados por el REPRESENTANTE del grupo. Cuando uno se aprueba, el grupo puede lanzar la marca nueva
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
