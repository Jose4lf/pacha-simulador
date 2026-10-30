'use client'

// ============================================================
// PACHA Simulador · Manual del Jugador
// Overlay estilo videojuego con capítulos, tablas del mercado
// real (importadas del catálogo) y ejemplos calculados con las
// mismas fórmulas del motor de simulación.
// ============================================================

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { BookOpen, ChevronLeft, ChevronRight, Lightbulb, TriangleAlert, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  ATRIBUTOS,
  CANALES,
  ESTUDIOS,
  ID_CONFIG,
  SEGMENTOS,
  presupuestoNormal,
  probabilidadExito,
} from '@/lib/pacha/catalogo'

interface Capitulo {
  id: string
  emoji: string
  titulo: string
}

const CAPITULOS: Capitulo[] = [
  { id: 'bienvenida', emoji: '🍦', titulo: 'Bienvenida' },
  { id: 'mercado', emoji: '🗺️', titulo: 'El mercado' },
  { id: 'decisiones', emoji: '🎛️', titulo: 'Tus decisiones' },
  { id: 'id', emoji: '🧪', titulo: 'Atributos e I+D' },
  { id: 'estudios', emoji: '🔍', titulo: 'Estudios de mercado' },
  { id: 'motor', emoji: '⚙️', titulo: 'Cómo se calculan tus ventas' },
  { id: 'reportes', emoji: '📊', titulo: 'Reportes y ranking' },
  { id: 'ejemplo', emoji: '🎬', titulo: 'Ejemplo de ronda' },
  { id: 'consejos', emoji: '🏆', titulo: 'Consejos para ganar' },
]

// ---------- Bloques visuales reutilizables ----------

function Titulo({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-3 text-lg font-black tracking-tight text-zinc-100 md:text-xl">{children}</h3>
  )
}

function Subtitulo({ children }: { children: React.ReactNode }) {
  return (
    <h4 className="mb-2 mt-5 text-sm font-bold uppercase tracking-widest text-pink-400">{children}</h4>
  )
}

function Parrafo({ children }: { children: React.ReactNode }) {
  return <p className="mb-3 text-sm leading-relaxed text-zinc-300">{children}</p>
}

function Lista({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="mb-3 space-y-1.5">
      {items.map((it, i) => (
        <li key={i} className="flex gap-2 text-sm leading-relaxed text-zinc-300">
          <span className="mt-1 text-pink-400" aria-hidden="true">
            ▸
          </span>
          <span>{it}</span>
        </li>
      ))}
    </ul>
  )
}

function Ejemplo({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="mb-4 rounded-xl border border-pink-500/30 bg-pink-500/10 p-4">
      <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-pink-300">
        <span aria-hidden="true">🎯</span> Ejemplo · {titulo}
      </p>
      <div className="text-sm leading-relaxed text-zinc-200">{children}</div>
    </div>
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

function Formula({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-4 overflow-x-auto rounded-lg border border-white/10 bg-black/40 px-4 py-3 text-center font-mono text-xs text-amber-300 md:text-sm">
      {children}
    </p>
  )
}

function Tabla({
  encabezados,
  filas,
  resaltarPrimera = true,
}: {
  encabezados: string[]
  filas: React.ReactNode[][]
  resaltarPrimera?: boolean
}) {
  return (
    <div className="pacha-scroll mb-4 overflow-x-auto rounded-xl border border-white/10">
      <table className="w-full min-w-[560px] text-left text-sm">
        <thead>
          <tr className="border-b border-white/10 bg-white/5">
            {encabezados.map((h, i) => (
              <th
                key={i}
                className="px-3 py-2.5 text-[10px] font-black uppercase tracking-widest text-zinc-400"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filas.map((f, i) => (
            <tr key={i} className="border-b border-white/5 last:border-0 hover:bg-white/[0.03]">
              {f.map((c, j) => (
                <td
                  key={j}
                  className={`px-3 py-2.5 align-top ${
                    j === 0 && resaltarPrimera ? 'font-bold text-zinc-100' : 'text-zinc-300'
                  }`}
                >
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Chip({ children, color = 'pink' }: { children: React.ReactNode; color?: string }) {
  const colores: Record<string, string> = {
    pink: 'border-pink-500/40 bg-pink-500/15 text-pink-300',
    amber: 'border-amber-500/40 bg-amber-500/15 text-amber-300',
    emerald: 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300',
    zinc: 'border-white/15 bg-white/5 text-zinc-300',
  }
  return (
    <span
      className={`inline-block rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${colores[color] ?? colores.zinc}`}
    >
      {children}
    </span>
  )
}

// ---------- Capítulos ----------

function CapBienvenida() {
  const pasos = [
    { n: 1, t: 'Decide', d: 'Ajusta precio, publicidad, producción y vendedores de cada marca. Guarda borradores cuantas veces quieras.' },
    { n: 2, t: 'Envía', d: 'Al enviar, tu decisión se bloquea: ya no se puede modificar ese año.' },
    { n: 3, t: 'El profesor procesa', d: 'El motor simula el año para todos los equipos: demanda, ventas, resultados e I+D.' },
    { n: 4, t: 'Analiza', d: 'Abre tus reportes por marca, canal y segmento, revisa los estudios comprados y prepárate para el próximo año.' },
  ]
  return (
    <div>
      <Titulo>🍦 Bienvenida a PACHA</Titulo>
      <Parrafo>
        <strong className="text-zinc-100">PACHA</strong> es un simulador de marketing estilo videojuego por
        equipos: dirigirás una firma de helados compitiendo en el mercado boliviano contra otras firmas de tu
        clase. Cada año tomarás decisiones de precios, publicidad, producción, fuerza de ventas, estudios de
        mercado e I+D. Después, el motor simula el mercado y te devuelve los resultados.
      </Parrafo>
      <Parrafo>
        La partida dura del <Chip>Año 0</Chip> (diagnóstico inicial, sin decisiones) hasta el{' '}
        <Chip>Año 10</Chip>. <strong className="text-zinc-100">Gana el equipo con mayor contribución
        acumulada</strong> (tu utilidad operativa), no necesariamente el que más vende.
      </Parrafo>

      <Subtitulo>El ciclo de cada año</Subtitulo>
      <div className="mb-4 grid gap-2.5 sm:grid-cols-2">
        {pasos.map((p) => (
          <div key={p.n} className="rounded-xl border border-white/10 bg-white/[0.04] p-3.5">
            <p className="mb-1 flex items-center gap-2 text-sm font-black text-zinc-100">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-pink-500 to-amber-500 text-[11px] text-white">
                {p.n}
              </span>
              {p.t}
            </p>
            <p className="text-xs leading-relaxed text-zinc-400">{p.d}</p>
          </div>
        ))}
      </div>

      <Tip>
        Tu profesor te dará usuario y contraseña (las cuentas demo usan la contraseña <strong>321</strong>). Si
        el botón de tu equipo no funciona, escríbela manualmente y pulsa <strong>▶ JUGAR</strong>.
      </Tip>

      <Subtitulo>Unidades del juego (¡importante!)</Subtitulo>
      <Tabla
        encabezados={['Concepto', 'Unidad']}
        filas={[
          ['Demanda y ventas del mercado', 'unidades físicas'],
          ['Producción, ventas e inventario de tu marca', 'miles de unidades'],
          ['Precio', 'Bs por unidad'],
          ['Publicidad, ingresos, costos y contribución', 'miles de Bs'],
        ]}
      />
      <Ejemplo titulo="cómo leer las cifras">
        Si el mercado pide <strong>5.000.000 de helados</strong> verás &ldquo;demanda 5.000&rdquo;. Si tu
        publicidad es <strong>&ldquo;350&rdquo;</strong> son <strong>Bs 350.000</strong>. Tu precio{' '}
        <strong>&ldquo;6.0&rdquo;</strong> significa <strong>Bs 6 por helado</strong>.
      </Ejemplo>
    </div>
  )
}

function CapMercado() {
  return (
    <div>
      <Titulo>🗺️ El mercado: 5 segmentos y 3 canales</Titulo>
      <Parrafo>
        El mercado se divide en <strong className="text-zinc-100">5 segmentos de consumidores</strong>. Cada uno
        tiene un <strong className="text-zinc-100">precio ideal</strong>, una demanda distinta y un perfil de
        producto preferido. La demanda total crece ~2.5% cada año.
      </Parrafo>
      <Tabla
        encabezados={['Segmento', 'Precio ideal', 'Demanda año 1', 'Qué valoran']}
        filas={SEGMENTOS.map((s) => [
          `${s.emoji} ${s.nombre}`,
          <>Bs {s.precioIdeal.toFixed(1)} / unidad</>,
          <>{s.demandaBase.toLocaleString('es-BO')} miles u.</>,
          s.descripcion,
        ])}
      />
      <Ejemplo titulo="segmento Niños">
        Su precio ideal es <strong>Bs 5</strong>. Si vendes a Bs 5 o menos, el precio juega a tu favor; si
        subes a Bs 8, tu atractivo en ese segmento cae drásticamente porque son muy sensibles al precio
        (peso del precio: {(SEGMENTOS[0].pesoPrecio * 100).toFixed(0)}%).
      </Ejemplo>

      <Subtitulo>Canales de distribución</Subtitulo>
      <Parrafo>
        Tus ventas llegan al consumidor a través de <strong className="text-zinc-100">3 canales</strong>. Cada
        canal tiene un peso en la demanda y exige vendedores para lograr cobertura:
      </Parrafo>
      <Tabla
        encabezados={['Canal', 'Peso del mercado', 'Vendedores para 100%', 'Salario anual']}
        filas={CANALES.map((c) => [
          `${c.emoji} ${c.nombre}`,
          `${(c.pesoDemanda * 100).toFixed(0)}%`,
          `${c.vendedoresNecesarios} vendedores`,
          <>Bs {c.salario}k por vendedor</>,
        ])}
      />
      <Formula>cobertura del canal = 15% base + 85% × (tus vendedores ÷ vendedores necesarios)</Formula>
      <Ejemplo titulo="cobertura parcial">
        Las tiendas de barrio son el 45% del mercado y piden 30 vendedores. Si solo asignas{' '}
        <strong>15 vendedores</strong> (la mitad), tu cobertura será 15% + 85%×0.5 ={' '}
        <strong>57.5%</strong>: más de la mitad de ese canal verá tu helado, pero el resto comprará a la
        competencia. Con <strong>0 vendedores</strong> solo te cubre el 15% base.
      </Ejemplo>
      <Tip>
        Sin vendedores no desapareces (el 15% base te salva), pero en el canal más grande del país eso significa
        perder casi la mitad de tu potencial. La fuerza de ventas se paga una vez por año: vendedores × salario.
      </Tip>
    </div>
  )
}

function CapDecisiones() {
  return (
    <div>
      <Titulo>🎛️ Tus decisiones cada año</Titulo>
      <Parrafo>
        Por cada marca activa decides 4 palancas. Además, puedes comprar estudios y registrar proyectos de I+D.
      </Parrafo>

      <Subtitulo>💰 Precio (Bs por unidad)</Subtitulo>
      <Parrafo>
        Se compara con el precio ideal de cada segmento. Por debajo del ideal, el precio juega a tu favor; por
        encima, el atractivo cae en forma exponencial según la sensibilidad del segmento.
      </Parrafo>
      <Ejemplo titulo="subir el precio">
        En <strong>Adolescentes</strong> (ideal Bs 7, sensibilidad 1.1): vendiendo a Bs 7 el precio no te
        resta nada. Si subes a Bs 9, el factor precio queda en e^(-1.1×0.29) ≈ <strong>0.73</strong>: pierdes
        ~27% de atractivo por precio, aunque otros factores puedan compensar.
      </Ejemplo>

      <Subtitulo>📺 Publicidad (miles de Bs)</Subtitulo>
      <Parrafo>
        Construye el <strong className="text-zinc-100">awareness</strong> (conocimiento de marca, de 2% a 95%).
        Es <strong className="text-zinc-100">acumulativa</strong>: cada año conserva parte de lo logrado y
        añade según tu inversión. Especialmente determinante en Niños y Adolescentes.
      </Parrafo>
      <Formula>awareness nueva = 65% × awareness anterior + 45% × √(publicidad ÷ 300)</Formula>
      <Ejemplo titulo="construir awareness">
        Tu awareness es <strong>40%</strong> y este año inviertes <strong>Bs 300k</strong> en publicidad:
        0.65×0.40 + 0.45×√(300/300) = 0.26 + 0.45 = <strong>71%</strong>. Si al año siguiente no inviertes
        nada, caerá a 65%×0.71 ≈ <strong>46%</strong>: el olvido es rápido.
      </Ejemplo>

      <Subtitulo>🏭 Producción (miles de unidades)</Subtitulo>
      <Parrafo>
        Lo que fabricas este año se suma al inventario disponible (con 5% de merma). Si la demanda supera tu
        oferta, <strong className="text-zinc-100">pierdes esas ventas</strong> y tu reporte lo marca como
        &ldquo;sin stock&rdquo;. Si produces de más, el sobrante se guarda pagando 1% de su costo.
      </Parrafo>
      <Alerta>
        Producir poco es el error más caro del juego: cada helado de demanda no atendida se va directo a la
        competencia. Usa el pronóstico de demanda (estudio #10) para calibrar.
      </Alerta>

      <Subtitulo>🤝 Fuerza de ventas (vendedores por canal)</Subtitulo>
      <Parrafo>
        Asignas vendedores a cada uno de los 3 canales. Ellos determinan tu{' '}
        <strong className="text-zinc-100">cobertura</strong> en cada canal y cuestan Bs 9k cada uno por año.
      </Parrafo>
      <Ejemplo titulo="cobertura total">
        Vendedores <strong>[30, 20, 12]</strong> (tiendas, supermercados, kioscos) = cobertura 100% en los 3
        canales. Costo: 62 × Bs 9k = <strong>Bs 558k</strong> al año. Con [15, 10, 6] la mitad, pagas Bs 279k
        y cubres ~57% en todos lados.
      </Ejemplo>

      <Subtitulo>Reglas de envío</Subtitulo>
      <Lista
        items={[
          <>
            <strong className="text-zinc-100">Borrador</strong>: guarda todas las veces que quieras, no tiene
            efecto hasta enviar.
          </>,
          <>
            <strong className="text-zinc-100">Enviar</strong>: bloquea tu decisión del año (estado{' '}
            <Chip color="emerald">enviada</Chip>). Ya no se puede cambiar.
          </>,
          <>
            Si tu equipo <strong className="text-zinc-100">no envía</strong>, el profesor procesa igual usando
            los valores actuales de tus marcas y tu reporte queda marcado &ldquo;sin decisión&rdquo;.
          </>,
          'El costo de los estudios que marcaste se cobra al enviar (aunque después ya no puedas editar).',
        ]}
      />
    </div>
  )
}

function CapID() {
  const ejemploAttrs = SEGMENTOS[0].ideal // [8, 5, 9, 4, 6, 3] · Niños
  const normal = presupuestoNormal(ejemploAttrs)
  const probFull = Math.round(probabilidadExito(ejemploAttrs, normal) * 100)
  const probMitad = Math.round(probabilidadExito(ejemploAttrs, normal / 2) * 100)
  return (
    <div>
      <Titulo>🧪 Los 6 atributos del producto</Titulo>
      <Parrafo>
        Cada marca se define por 6 atributos puntuados del <strong className="text-zinc-100">1 al 10</strong>.
        Cada segmento tiene un perfil ideal: cuanto más cerca esté tu marca de ese ideal, mayor el &ldquo;ajuste
        producto&rdquo;.
      </Parrafo>
      <Tabla
        encabezados={['Atributo', 'Ideal Niños 🧒', 'Ideal Adultos 💼']}
        filas={ATRIBUTOS.map((a, i) => [`${a.emoji} ${a.nombre}`, `${SEGMENTOS[0].ideal[i]}/10`, `${SEGMENTOS[3].ideal[i]}/10`])}
      />
      <Formula>ajuste = 1 − (distancia total a la ideal ÷ 54)</Formula>
      <Ejemplo titulo="ajuste producto">
        La ideal de <strong>Niños</strong> es [8, 5, 9, 4, 6, 3]. Tu marca exactamente igual → ajuste{' '}
        <strong>100%</strong>. Otra marca [4, 9, 5, 8, 2, 7] dista 24 puntos → 1 − 24/54 ≈{' '}
        <strong>56%</strong>: los niños la preferirán menos aun al mismo precio.
      </Ejemplo>

      <Subtitulo>Cómo cambias tus atributos: proyectos de I+D</Subtitulo>
      <Lista
        items={[
          <>
            Registras un proyecto: nombre, atributos objetivo (1–10) y presupuesto entre{' '}
            <Chip color="amber">Bs {ID_CONFIG.presupuestoMin}k</Chip> y{' '}
            <Chip color="amber">Bs {ID_CONFIG.presupuestoMax}k</Chip>.
          </>,
          <>
            El proyecto entra en estado <Chip color="zinc">en desarrollo</Chip> y se evalúa cuando el profesor
            procesa la ronda: aprueba o falla según tu presupuesto.
          </>,
          <>
            Si <Chip color="emerald">aprueba</Chip>, el próximo año puedes aplicarlo a una marca existente o
            usarlo para lanzar una <strong className="text-zinc-100">marca nueva</strong>.
          </>,
          <>
            Si <Chip color="pink">falla</Chip>, solo puedes reintentar con los mismos atributos y un
            presupuesto mayor.
          </>,
        ]}
      />
      <Subtitulo>Presupuesto y probabilidad de éxito</Subtitulo>
      <Formula>presupuesto normal = 100 + 12 × (suma de los 6 atributos)</Formula>
      <Formula>probabilidad = 20% + 75% × (tu presupuesto ÷ presupuesto normal) · máx 95%</Formula>
      <Ejemplo titulo="calcular tu probabilidad">
        Proyecto con atributos [8, 5, 9, 4, 6, 3] (suma 35) → presupuesto normal = 100 + 12×35 ={' '}
        <strong>Bs {normal}k</strong>.
        <br />• Inviertes Bs {normal}k → probabilidad <strong>{probFull}%</strong> (tope).
        <br />• Inviertes Bs {normal / 2}k → probabilidad ≈ <strong>{probMitad}%</strong>.
        <br />• El mínimo siempre es 20%: nunca es imposible, pero es una apuesta.
      </Ejemplo>
      <Alerta>
        Límites: máximo <strong>{ID_CONFIG.maxProyectosPorAnio} proyectos por año</strong> y máximo{' '}
        <strong>{ID_CONFIG.maxNombresPorSimulacion} nombres de marca nuevos</strong> en toda la simulación.
        Úsalos con sabiduría.
      </Alerta>
      <Tip>
        Un proyecto temprano bien financiado te permite lanzar una segunda marca enfocada a otro segmento (por
        ejemplo, una premium para Adultos) y duplicar tu presencia de mercado.
      </Tip>
    </div>
  )
}

function CapEstudios() {
  const categorias = [...new Set(ESTUDIOS.map((e) => e.categoria))]
  return (
    <div>
      <Titulo>🔍 Estudios de mercado</Titulo>
      <Parrafo>
        Son <strong className="text-zinc-100">15 estudios</strong> que revelan información del mercado. Los
        marcas en tu decisión del año, se pagan al enviar y sus datos aparecen en la pestaña{' '}
        <strong className="text-zinc-100">Estudios</strong> después de procesar la ronda.
      </Parrafo>
      {categorias.map((cat) => (
        <div key={cat}>
          <Subtitulo>{cat}</Subtitulo>
          <Tabla
            encabezados={['#', 'Estudio', 'Qué revela', 'Costo']}
            filas={ESTUDIOS.filter((e) => e.categoria === cat).map((e) => [
              `${e.icono} ${e.id}`,
              e.nombre,
              e.descripcion,
              <>Bs {e.costo}k</>,
            ])}
          />
        </div>
      ))}
      <Ejemplo titulo="comprar con criterio">
        Vas a decidir tu precio para el Año 5. Compras <strong>#13 Experimento de precio (Bs 110k)</strong> y{' '}
        <strong>#9 Mapa perceptual (Bs 100k)</strong>. Los datos te muestran que tu marca está Bs 2 por encima
        del ideal de Jóvenes y que tu competencia premium te supera en calidad percibida: bajas el precio y
        ajustas atributos con un proyecto I+D. Información que paga sola la decisión.
      </Ejemplo>
      <Tip>
        La <strong>Escala semántica</strong> de cada segmento cuesta solo Bs 40k y te dice exactamente qué
        atributos mejorar. Es el mejor estudio de arranque junto con #15 Segmentación emergente (el perfil
        ideal de todos los segmentos).
      </Tip>
    </div>
  )
}

function CapMotor() {
  return (
    <div>
      <Titulo>⚙️ Cómo se calculan tus ventas</Titulo>
      <Parrafo>
        El motor es <strong className="text-zinc-100">determinista</strong>: con las mismas decisiones siempre
        produce los mismos resultados (sin dados ocultos). Así funciona cada ronda:
      </Parrafo>
      <Lista
        items={[
          <>
            <strong className="text-zinc-100">1 · Demanda</strong>: cada segmento genera su demanda del año
            (base + crecimiento 2.5% anual, con leve variación).
          </>,
          <>
            <strong className="text-zinc-100">2 · Atractivo</strong>: tu marca recibe un puntaje en cada
            segmento que combina precio relativo, awareness, cobertura de canales y ajuste de producto (más un
            pequeño ruido determinista de ±4%).
          </>,
          <>
            <strong className="text-zinc-100">3 · Reparto</strong>: la demanda del segmento se reparte entre
            las marcas <strong className="text-zinc-100">proporcional al atractivo</strong>.
          </>,
          <>
            <strong className="text-zinc-100">4 · Stock</strong>: tus ventas quedan limitadas a producción +
            inventario×0.95 (merma del 5%). Si la demanda excede tu oferta, esas ventas se pierden.
          </>,
          <>
            <strong className="text-zinc-100">5 · Finanzas</strong>: ingresos − costo del producto vendido −
            costo de mantener inventario (1%) − publicidad − fuerza de ventas ={' '}
            <strong className="text-amber-300">contribución</strong>.
          </>,
        ]}
      />
      <Formula>
        contribución = ingresos − costos − publicidad − fuerza de ventas (miles de Bs)
      </Formula>
      <Ejemplo titulo="leer el atractivo">
        El atractivo es una <strong>media geométrica ponderada</strong>: si un factor queda en cero (por
        ejemplo, awareness mínimo), arrastras todo el puntaje hacia abajo aunque el precio sea perfecto. Por
        eso hay que atender los 4 factores, no solo uno.
      </Ejemplo>
      <Tip>
        Todos los factores son 0–1: puedes comparar tu marca contra la competencia factor por factor con los
        estudios (#1 awareness, #3 distribuidores, #4–8 escalas semánticas).
      </Tip>
    </div>
  )
}

function CapReportes() {
  return (
    <div>
      <Titulo>📊 Reportes y ranking</Titulo>
      <Subtitulo>Año 0 · diagnóstico inicial</Subtitulo>
      <Parrafo>
        El Año 0 no se decide: es tu punto de partida. Muestra las participaciones iniciales de cada firma
        (normalizadas a 100% del mercado), producción = ventas, inventario cero y un costo de transferencia del
        55% del precio. Úsalo para entender dónde estás parado antes de la primera decisión.
      </Parrafo>
      <Subtitulo>Después de cada ronda</Subtitulo>
      <Tabla
        encabezados={['Reporte', 'Qué contiene']}
        filas={[
          ['Reporte del equipo', 'Ventas, inventario, ingresos, costos, publicidad, fuerza de ventas, contribución y participación del año.'],
          ['Por marca', 'El mismo desglose para cada una de tus marcas.'],
          ['Por canal', 'Cómo se repartieron tus ventas entre tiendas, supermercados y kioscos.'],
          ['Por segmento', 'Cuánto vendiste a Niños, Adolescentes, Jóvenes, Adultos y Familias.'],
          ['Estudios', 'Los datos de cada estudio comprado ese año (awareness, paneles, mapas, pronósticos).'],
        ]}
      />
      <Subtitulo>Ranking</Subtitulo>
      <Parrafo>
        El ranking ordena a los equipos por <strong className="text-zinc-100">contribución acumulada</strong>{' '}
        (la suma de todos los años jugados) y muestra la participación del último año. El líder luce 🥇 y se
        actualiza cada vez que el profesor procesa una ronda.
      </Parrafo>
      <Ejemplo titulo="leer tu reporte">
        Año 3: ventas 612k u., ingresos Bs 3.672k, contribución Bs 645k, participación 22.8%. En el desglose
        por segmento descubres que Adultos solo te dio 3% de tus ventas → tu marca no encaja con ese ideal
        premium (revisa las escalas semánticas).
      </Ejemplo>
    </div>
  )
}

function CapEjemplo() {
  return (
    <div>
      <Titulo>🎬 Ejemplo de ronda completa</Titulo>
      <Parrafo>
        Sigamos al equipo <strong className="text-pink-300">Colibrí 🐦</strong> durante el Año 5 con su marca
        &ldquo;Colibrí Clásica&rdquo;.
      </Parrafo>

      <Subtitulo>1 · Las decisiones del equipo</Subtitulo>
      <Tabla
        encabezados={['Palanca', 'Decisión', 'Costo directo']}
        filas={[
          ['💰 Precio', 'Bs 6.00 / unidad', '—'],
          ['📺 Publicidad', 'Bs 350k', 'Bs 350k'],
          ['🏭 Producción', '660 miles u.', '—'],
          ['🤝 Vendedores', '[30, 20, 12] · cobertura 100%', 'Bs 558k'],
          ['🔍 Estudios', '#1 Awareness + #4 Escala Niños', 'Bs 100k'],
          ['🧪 I+D', <>Proyecto &ldquo;Tropical&rdquo; · presupuesto Bs 520k</>, 'se evalúa esta ronda'],
        ]}
      />

      <Subtitulo>2 · El motor simula el año</Subtitulo>
      <Parrafo>
        La demanda asignada a Colibrí Clásica (según su atractivo frente a la competencia) resulta{' '}
        <strong className="text-zinc-100">640 miles de unidades</strong>. Como produce 660, hay stock
        suficiente:
      </Parrafo>
      <Tabla
        encabezados={['Cálculo', 'Operación', 'Resultado']}
        filas={[
          ['Ventas', 'min(640 demanda, 660 producción)', '640 miles u.'],
          ['Ingresos', '640 × Bs 6.00', 'Bs 3.840k'],
          ['Costos de producto', '640 × Bs 3.50 (costo unitario)', 'Bs 2.240k'],
          ['Publicidad', '—', 'Bs 350k'],
          ['Fuerza de ventas', '62 vendedores × Bs 9k', 'Bs 558k'],
          ['Contribución', '3.840 − 2.240 − 350 − 558', 'Bs 692k'],
        ]}
      />
      <Parrafo>
        Participación del año: <Chip color="amber">~25%</Chip>. El proyecto I+D &ldquo;Tropical&rdquo; tiene
        presupuesto normal de Bs 520k y se financió exactamente ese monto → aprueba con 95% de probabilidad
        (este caso salió bien ✅).
      </Parrafo>

      <Subtitulo>3 · ¿Y si hubiera decidido mal?</Subtitulo>
      <Ejemplo titulo="escenario sin stock">
        Si Colibrí hubiera producido solo <strong>400 miles u.</strong>, sus ventas se limitan a ~402 (400 +
        inventario con merma): pierde <strong>~238 miles u.</strong> de demanda (≈ Bs 1.428k de ingresos) y el
        reporte marca <Chip color="pink">sin stock</Chip>. Esa demanda se la queda la competencia.
      </Ejemplo>
      <Ejemplo titulo="escenario sin vendedores">
        Con <strong>[0, 0, 0]</strong> vendedores, la cobertura cae al 15% en los 3 canales: su atractivo se
        hunde en todos los segmentos y aunque el precio sea ideal, vendería una fracción mínima. Ahorro de Bs
        558k ← mucho menor que la pérdida de contribución.
      </Ejemplo>
      <Tip>
        Después de la ronda, Colibrí abre <strong>Reportes · Año 5</strong>, revisa el desglose por segmento,
        lee su estudio de awareness (subió a 71%) y decide la estrategia del Año 6.
      </Tip>
    </div>
  )
}

function CapConsejos() {
  return (
    <div>
      <Titulo>🏆 Consejos para ganar</Titulo>
      <Lista
        items={[
          <>
            <strong className="text-zinc-100">Publicidad temprana</strong>: el awareness es acumulativo;
            invertir en los primeros años rinde durante toda la partida. Niños y Adolescentes lo ponderan
            fuerte.
          </>,
          <>
            <strong className="text-zinc-100">Cubre los canales</strong>: tiendas de barrio concentra el 45%
            del mercado. Sin vendedores ahí, tu helado prácticamente no existe.
          </>,
          <>
            <strong className="text-zinc-100">Produce a la demanda</strong>: revisa el pronóstico (#10) y deja
            un margen pequeño. El faltante se pierde y el sobrante se paga.
          </>,
          <>
            <strong className="text-zinc-100">Segmenta tu portafolio</strong>: no intentes ganar todos los
            segmentos con una marca. Una marca &ldquo;popular&rdquo; (Niños/Familias) + una &ldquo;premium&rdquo;
            (Adultos/Jóvenes) vía I+D es una jugada clásica.
          </>,
          <>
            <strong className="text-zinc-100">Compra estudios que respalden la decisión</strong> que vas a
            tomar: precio → #13; atributos → #14 y #15; competencia → #11 y #12.
          </>,
          <>
            <strong className="text-zinc-100">Financia el I+D al 100%</strong> del presupuesto normal: pasar
            de 58% a 95% de probabilidad vale mucho más que el dinero ahorrado.
          </>,
          <>
            <strong className="text-zinc-100">Vigila el ranking</strong>: gana la contribución acumulada, no
            las ventas. Vender mucho con márgenes mínimos no te hace campeón.
          </>,
          <>
            <strong className="text-zinc-100">Si no envías, decides igual</strong>: el profesor procesa con tus
            valores actuales. Nunca dejes la ronda pasar por accidente.
          </>,
        ]}
      />
      <div className="mt-6 rounded-xl border border-amber-500/30 bg-gradient-to-r from-amber-500/10 to-pink-500/10 p-4 text-center">
        <p className="text-sm font-black uppercase tracking-widest text-amber-300">🥇 ¡Buena suerte, equipo!</p>
        <p className="mt-1 text-xs text-zinc-400">
          El mercado perdona poco y premia la estrategia. Nos vemos en el Año 10.
        </p>
      </div>
    </div>
  )
}

const CONTENIDOS: Record<string, () => React.ReactNode> = {
  bienvenida: CapBienvenida,
  mercado: CapMercado,
  decisiones: CapDecisiones,
  id: CapID,
  estudios: CapEstudios,
  motor: CapMotor,
  reportes: CapReportes,
  ejemplo: CapEjemplo,
  consejos: CapConsejos,
}

// ---------- Overlay principal ----------
// Nota: el componente se monta/desmonta desde el padre (condicional dentro de
// <AnimatePresence>), por lo que el capítulo vuelve a "Bienvenida" en cada apertura.

export function ManualJugador({ onCerrar }: { onCerrar: () => void }) {
  const [cap, setCap] = useState('bienvenida')
  const idx = CAPITULOS.findIndex((c) => c.id === cap)
  const Contenido = CONTENIDOS[cap] ?? CapBienvenida

  // Cerrar con Escape + bloquear scroll de fondo
  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCerrar()
    }
    window.addEventListener('keydown', fn)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', fn)
      document.body.style.overflow = prev
    }
  }, [onCerrar])

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="pacha-bg fixed inset-0 z-50 flex flex-col text-white"
      role="dialog"
      aria-modal="true"
      aria-label="Manual del jugador"
    >
          {/* Cabecera */}
          <header className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 px-4 py-3 md:px-6">
            <div className="flex items-center gap-2.5">
              <BookOpen className="h-6 w-6 text-amber-400" aria-hidden="true" />
              <div>
                <h2 className="text-base font-black tracking-tight md:text-lg">
                  Manual del <span className="pacha-title-shine">Jugador</span>
                </h2>
                <p className="hidden text-[11px] text-zinc-500 sm:block">
                  PACHA Simulador · todo lo que necesitas para conquistar el mercado de helados
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={onCerrar}
              aria-label="Cerrar manual"
              className="h-10 w-10 shrink-0 border-white/15 bg-white/5 text-zinc-300 hover:bg-white/10"
            >
              <X className="h-5 w-5" />
            </Button>
          </header>

          <div className="flex min-h-0 flex-1 flex-col md:flex-row">
            {/* Navegación lateral (desktop) */}
            <nav
              aria-label="Capítulos del manual"
              className="hidden w-60 shrink-0 flex-col gap-1 overflow-y-auto border-r border-white/10 p-3 md:flex"
            >
              {CAPITULOS.map((c, i) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCap(c.id)}
                  aria-current={cap === c.id ? 'true' : undefined}
                  className={`pacha-btn-game flex min-h-[44px] items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm font-bold transition ${
                    cap === c.id
                      ? 'border border-pink-500/40 bg-pink-500/15 text-zinc-100'
                      : 'border border-transparent text-zinc-400 hover:bg-white/5 hover:text-zinc-200'
                  }`}
                >
                  <span className="text-lg" aria-hidden="true">
                    {c.emoji}
                  </span>
                  <span className="flex-1">
                    {i + 1}. {c.titulo}
                  </span>
                </button>
              ))}
            </nav>

            {/* Navegación en chips (móvil) */}
            <nav
              aria-label="Capítulos del manual"
              className="pacha-scroll flex shrink-0 gap-2 overflow-x-auto border-b border-white/10 p-3 md:hidden"
            >
              {CAPITULOS.map((c, i) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCap(c.id)}
                  aria-current={cap === c.id ? 'true' : undefined}
                  className={`pacha-btn-game flex min-h-[36px] shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold ${
                    cap === c.id
                      ? 'border-pink-500/50 bg-pink-500/20 text-zinc-100'
                      : 'border-white/10 bg-white/5 text-zinc-400'
                  }`}
                >
                  <span aria-hidden="true">{c.emoji}</span>
                  {c.titulo}
                </button>
              ))}
            </nav>

            {/* Contenido del capítulo */}
            <main className="pacha-scroll min-h-0 flex-1 overflow-y-auto px-4 py-6 md:px-8">
              <div className="mx-auto max-w-3xl">
                <p className="mb-1 text-[11px] font-black uppercase tracking-[0.3em] text-zinc-600">
                  Capítulo {idx + 1} de {CAPITULOS.length}
                </p>
                <div className="pacha-pop">
                  <Contenido />
                </div>

                {/* Anterior / Siguiente */}
                <div className="mt-8 flex items-center justify-between gap-3 border-t border-white/10 pt-5">
                  <Button
                    variant="outline"
                    onClick={() => setCap(CAPITULOS[Math.max(0, idx - 1)].id)}
                    disabled={idx <= 0}
                    className="h-11 border-white/15 bg-white/5 px-4 text-zinc-300 hover:bg-white/10"
                  >
                    <ChevronLeft className="mr-1 h-4 w-4" /> Anterior
                  </Button>
                  {idx < CAPITULOS.length - 1 ? (
                    <Button
                      onClick={() => setCap(CAPITULOS[idx + 1].id)}
                      className="pacha-btn-game h-11 bg-gradient-to-r from-pink-500 to-amber-500 px-5 font-black uppercase tracking-wide text-white hover:from-pink-400 hover:to-amber-400"
                    >
                      Siguiente <ChevronRight className="ml-1 h-4 w-4" />
                    </Button>
                  ) : (
                    <Button
                      onClick={onCerrar}
                      className="pacha-btn-game h-11 bg-gradient-to-r from-emerald-500 to-teal-500 px-5 font-black uppercase tracking-wide text-white hover:from-emerald-400 hover:to-teal-400"
                    >
                      ✓ ¡A jugar!
                    </Button>
                  )}
                </div>
              </div>
            </main>
          </div>
    </motion.div>
  )
}

/** Botón de acceso al manual (para la pantalla de login). */
export function BotonManual({ onClick }: { onClick: () => void }) {
  return (
    <Button
      type="button"
      variant="outline"
      onClick={onClick}
      className="pacha-btn-game h-11 w-full border-amber-500/40 bg-amber-500/10 text-sm font-bold text-amber-300 hover:bg-amber-500/20"
    >
      <BookOpen className="mr-2 h-4 w-4" aria-hidden="true" />
      📖 Manual del jugador · cómo se juega
    </Button>
  )
}
