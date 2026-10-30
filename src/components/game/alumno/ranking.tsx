'use client'

import { Trophy } from 'lucide-react'
import type { AlumnoEstado, RankingFila } from '@/lib/pacha/api-client'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

const fmtBs = (v: number) => 'Bs ' + Math.round(v).toLocaleString('es-BO') + 'k'
const fmtU = (v: number) => v.toLocaleString('es-BO', { maximumFractionDigits: 1 }) + 'k u'

const MEDALLAS = ['🥇', '🥈', '🥉']

function colorContribucion(v: number): string {
  return v >= 0 ? 'text-emerald-300' : 'text-red-300'
}

/* ============ Podio ============ */

function TarjetaPodio({ fila, lugar }: { fila: RankingFila; lugar: number }) {
  const bordes = ['border-amber-300/60', 'border-zinc-300/30', 'border-orange-400/40']
  const tamanos = ['text-3xl', 'text-2xl', 'text-2xl']
  return (
    <div
      className={`pacha-panel p-5 text-center ${bordes[lugar - 1] ?? 'border-white/10'} ${lugar === 1 ? 'pacha-glow bg-pink-500/5' : ''}`}
    >
      <p className={`${tamanos[lugar - 1] ?? 'text-xl'}`} aria-hidden="true">
        {MEDALLAS[lugar - 1] ?? `#${lugar}`}
      </p>
      <div className="mt-1.5 flex items-center justify-center gap-2">
        <span className="h-3 w-3 rounded-full" style={{ backgroundColor: fila.color }} aria-hidden="true" />
        <p className="truncate text-base font-black text-zinc-100">{fila.nombre}</p>
      </div>
      <p className={`mt-2 font-black text-zinc-50 ${lugar === 1 ? 'text-3xl' : 'text-2xl'} ${colorContribucion(fila.contribucionAcumulada)}`}>
        {fmtBs(fila.contribucionAcumulada)}
      </p>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">contribución acumulada</p>
      <p className="mt-1 text-xs text-amber-300">📊 Cuota última: {fila.participacionUltima.toFixed(1)}%</p>
    </div>
  )
}

/* ============ Componente principal ============ */

export function AlumnoRanking({ estado }: { estado: AlumnoEstado }) {
  const ordenado = [...estado.ranking].sort((a, b) => a.posicion - b.posicion)
  const top3 = ordenado.slice(0, 3)
  const propioId = estado.equipo.id

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-black text-zinc-100 sm:text-2xl">🏆 Ranking de la industria</h2>
        <p className="mt-0.5 text-sm text-zinc-400">
          {ordenado.find((f) => f.equipoId === propioId)?.posicion === 1
            ? '¡Estás en lo más alto! Defiende el trono 🍦👑'
            : '¡A por el liderazgo! Cada decisión cuenta para escalar posiciones.'}
        </p>
      </div>

      {top3.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-3">
          {top3.map((f) => (
            <TarjetaPodio key={f.equipoId} fila={f} lugar={f.posicion} />
          ))}
        </div>
      )}

      <div className="pacha-panel overflow-x-auto p-4">
        <h3 className="mb-2 flex items-center gap-1.5 text-sm font-black uppercase tracking-wide text-zinc-300">
          <Trophy className="h-4 w-4 text-amber-300" aria-hidden="true" /> Tabla general
        </h3>
        <Table>
          <TableHeader>
            <TableRow className="border-white/10">
              <TableHead className="text-zinc-400">#</TableHead>
              <TableHead className="text-zinc-400">Equipo</TableHead>
              <TableHead className="text-right text-zinc-400">Contribución acumulada</TableHead>
              <TableHead className="text-right text-zinc-400">Ingresos</TableHead>
              <TableHead className="text-right text-zinc-400">Ventas</TableHead>
              <TableHead className="text-right text-zinc-400">Cuota última</TableHead>
              <TableHead className="text-right text-zinc-400">Rondas</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {ordenado.map((f) => {
              const propio = f.equipoId === propioId
              return (
                <TableRow
                  key={f.equipoId}
                  className={`border-white/5 ${propio ? 'ring-1 ring-pink-400/50 bg-pink-400/5' : ''}`}
                >
                  <TableCell className="text-sm font-black text-zinc-300">
                    {MEDALLAS[f.posicion - 1] ?? f.posicion}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <span className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: f.color }} aria-hidden="true" />
                      <span className="text-xs font-bold text-zinc-100">
                        {f.nombre}
                        {propio && <span className="ml-1.5 rounded bg-pink-500/20 px-1.5 py-0.5 text-[9px] font-black uppercase text-pink-300">Tú</span>}
                      </span>
                    </span>
                  </TableCell>
                  <TableCell className={`text-right text-xs font-black ${colorContribucion(f.contribucionAcumulada)}`}>
                    {fmtBs(f.contribucionAcumulada)}
                  </TableCell>
                  <TableCell className="text-right text-xs text-amber-300">{fmtBs(f.ingresosAcumulados)}</TableCell>
                  <TableCell className="text-right text-xs text-zinc-300">{fmtU(f.ventasAcumuladas)}</TableCell>
                  <TableCell className="text-right text-xs font-bold text-pink-300">
                    {f.participacionUltima.toFixed(1)}%
                  </TableCell>
                  <TableCell className="text-right text-xs text-zinc-400">{f.rondasJugadas}</TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
