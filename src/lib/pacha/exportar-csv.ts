'use client'

// ============================================================
// PACHA Simulador · Exportación de reportes a CSV (Excel)
// · Cifras COMPLETAS (sin abreviaturas «k»): litros y bolivianos enteros
// · Encabezados con nombres completos en español; cuando un término
//   técnico viene del inglés se escribe su significado al lado
// · Separador «;» y BOM UTF-8 para que Excel lo abra bien en Bolivia
// ============================================================

import type { AlumnoEstado, ReporteDetalle } from '@/lib/pacha/api-client'

/** Formato contable completo: 12345.678 → "12.345,68" (sin abreviar). */
function num(v: number | null | undefined, decimales = 2): string {
  const n = Number(v ?? 0)
  if (!Number.isFinite(n)) return '0'
  return n.toLocaleString('es-BO', { minimumFractionDigits: decimales, maximumFractionDigits: decimales })
}
/** Entero contable: 12345.6 → "12.346". */
function entero(v: number | null | undefined): string {
  return Math.round(Number(v ?? 0)).toLocaleString('es-BO')
}
function pct(v: number | null | undefined, decimales = 1): string {
  return num((Number(v ?? 0)) * 100, decimales) + ' %'
}

function escapar(valor: string | number): string {
  const s = String(valor)
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** Descarga el texto como archivo .csv (Excel-compatible). */
export function descargarArchivo(nombre: string, contenido: string) {
  const blob = new Blob(['\ufeff' + contenido], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nombre
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
const ESCENARIOS: Record<string, string> = { FAVORABLE: 'Favorable', ESTABLE: 'Estable', DESFAVORABLE: 'Desfavorable' }

/** Nombres completos de los canales y segmentos de Bolivia. */
const NOMBRE_VARIABLE_EVENTO: Record<string, string> = {
  demanda: 'Demanda (unidades vendidas)',
  costo: 'Costos (costo unitario)',
  logistica: 'Logística (disponibilidad de transporte)',
}

/**
 * Genera el CSV del reporte de UN año con TODAS las secciones contables.
 * Unidades completas: las cifras internas están en «miles» (miles de Bs,
 * miles de litros, miles de unidades) y aquí se multiplican por 1.000.
 */
export function construirCsvReporte(estado: AlumnoEstado, r: ReporteDetalle): string {
  const L: string[] = []
  const titulo: string[] = []
  const hoy = new Date().toLocaleString('es-BO', { dateStyle: 'long', timeStyle: 'short' })

  titulo.push(`REPORTE CONTABLE · PACHA Simulador (simulador educativo de marketing — industria de helados de Bolivia)`)
  titulo.push(`Simulación: ${estado.industria.nombre}`)
  titulo.push(`Empresa: ${estado.equipo.nombre}`)
  titulo.push(`Año del reporte: ${r.anio === 0 ? 'Año 0 (historia del mercado: 3 años anteriores a la gestión)' : `Año ${r.anio}`}`)
  titulo.push(`Grupo: ${estado.comite.map((g) => `${g.nombre}${g.representante ? ' (REPRESENTANTE)' : ''}`).join(', ')}`)
  titulo.push(`Generado el: ${hoy}`)
  titulo.push('')
  titulo.push('NOTA DE UNIDADES: las cifras están en unidades completas. Los importes en bolivianos (Bs) son netos de IVA (Impuesto al Valor Agregado) salvo que se indique lo contrario; los volúmenes están en litros y unidades.')
  titulo.push('')

  // ── 1) Resumen ejecutivo del año ──
  L.push('1) RESUMEN DEL AÑO')
  L.push('Concepto;Valor;Unidad')
  L.push(`Ventas del año (litros vendidos);${num(r.ventas * 1000, 0)};litros`)
  L.push(`Ingresos netos (sin IVA — Impuesto al Valor Agregado);${num(r.ingresos * 1000, 0)};Bs (bolivianos)`)
  L.push(`Costos totales del año;${num(r.costos * 1000, 0)};Bs (bolivianos)`)
  L.push(`Gasto en publicidad;${num(r.publicidad * 1000, 0)};Bs (bolivianos)`)
  L.push(`Gasto en fuerza de ventas (sueldos y comisiones de vendedores);${num(r.fuerzaVentas * 1000, 0)};Bs (bolivianos)`)
  L.push(`Gasto en investigación de mercado (estudios);${num(r.investigacionMercado * 1000, 0)};Bs (bolivianos)`)
  L.push(`Contribución (ingresos − costos de marketing: resultado del año);${num(r.contribucion * 1000, 0)};Bs (bolivianos)`)
  L.push(`Cuota de mercado (participación sobre las empresas jugables);${pct(r.participacion)};porcentaje`)
  L.push('')

  // ── 2) Historia del mercado (Año 0) ──
  if (r.historia && r.historia.length > 0) {
    L.push('2) HISTORIA DEL MERCADO (3 años anteriores a la gestión)')
    L.push('Año;Ventas del mercado total (litros);Ventas de esta empresa (litros);Cuota de mercado (%);Contribución (Bs)')
    for (const h of r.historia) {
      L.push([`Año ${h.anio}`, num(h.ventasMercado * 1000, 0), num(h.ventasEquipo * 1000, 0), pct(h.participacion), num(h.contribucion * 1000, 0)].join(';'))
    }
    L.push('')
  }

  // ── 3) Desempeño por marca ──
  if (r.marcas.length > 0) {
    L.push('3) DESEMPEÑO POR MARCA')
    L.push('Marca;Ventas (litros);Producción (litros);Inventario final (litros);Ingresos (Bs);Costos (Bs);Contribución (Bs);Cuota de la marca dentro del equipo (%)')
    for (const m of r.marcas) {
      L.push([m.marcaNombre, num(m.ventas * 1000, 0), num(m.produccion * 1000, 0), num(m.inventario * 1000, 0), num(m.ingresos * 1000, 0), num(m.costos * 1000, 0), num(m.contribucion * 1000, 0), pct(m.participacion)].join(';'))
    }
    L.push('')
  }

  // ── 4) Ventas por canal y por segmento (por marca) ──
  if (r.marcas.length > 0) {
    L.push('4) VENTAS POR CANAL DE DISTRIBUCIÓN Y POR SEGMENTO DE CONSUMIDORES')
    L.push('Marca;Canal o segmento;Tipo;Ventas (litros);Ingresos (Bs)')
    const canalNombre: Record<string, string> = {
      tiendas: 'Tiendas de barrio',
      supermercados: 'Supermercados',
      kioscos: 'Kioscos y puestos de venta',
    }
    const segmentoNombre: Record<string, string> = {
      ninos: 'Niños',
      adolescentes: 'Adolescentes',
      jovenes: 'Jóvenes',
      adultos: 'Adultos',
      familias: 'Familias',
    }
    for (const m of r.marcas) {
      for (const c of m.porCanal) {
        L.push([m.marcaNombre, canalNombre[c.canalId] ?? c.canalId, 'Canal de distribución', num(c.ventas * 1000, 0), num((c.ingresos ?? 0) * 1000, 0)].join(';'))
      }
      for (const s of m.porSegmento) {
        L.push([m.marcaNombre, segmentoNombre[s.segmentoId] ?? s.segmentoId, 'Segmento de consumidores', num(s.ventas * 1000, 0), num((s.ingresos ?? 0) * 1000, 0)].join(';'))
      }
    }
    L.push('')
  }

  // ── 5) Mercado total de Bolivia ──
  if (r.detalle?.mercado) {
    L.push('5) MERCADO TOTAL DE BOLIVIA')
    L.push('Concepto;Valor;Unidad')
    L.push(`Demanda total del mercado;${num(r.detalle.mercado.demandaTotal * 1000, 0)};litros`)
    L.push(`Vendido por las empresas del juego;${num(r.detalle.mercado.ventasEmpresas * 1000, 0)};litros`)
    L.push(`Resto del mercado (heladerías artesanales, mercado informal e importados);${num(r.detalle.mercado.ventasResto * 1000, 0)};litros`)
    L.push(`Captura de las empresas del juego (participación sobre el mercado total);${pct(r.detalle.mercado.capturaEmpresas)};porcentaje`)
    L.push('')
  }

  // ── 6) Detalle mensual ──
  if (r.detalle?.detalleMensual && r.detalle.detalleMensual.length > 0) {
    L.push('6) DETALLE MENSUAL DEL PERIODO (estacionalidad por zona climática y eventos)')
    L.push('Mes;Demanda total (litros);Ventas de las empresas (litros);Resto del mercado (litros)')
    for (const d of r.detalle.detalleMensual) {
      L.push([`${MESES[d.mes - 1] ?? `Mes ${d.mes}`}`, num(d.demandaTotal * 1000, 0), num(d.ventasEmpresas * 1000, 0), num(d.ventasResto * 1000, 0)].join(';'))
    }
    L.push('')
  }

  // ── 7) Ventas por departamento ──
  if (r.detalle?.porRegion && r.detalle.porRegion.length > 0) {
    L.push('7) VENTAS POR DEPARTAMENTO DE BOLIVIA')
    L.push('Departamento;Ventas (litros)')
    for (const x of [...r.detalle.porRegion].sort((a, b) => b.ventas - a.ventas)) {
      const nombre = REGIONES_BOLIVIA[x.regionId] ?? x.regionId
      L.push([nombre, num(x.ventas * 1000, 0)].join(';'))
    }
    L.push('')
  }

  // ── 8) Resultados financieros completos ──
  if (r.detalle?.finanzas) {
    const f = r.detalle.finanzas as Record<string, number | boolean>
    L.push('8) RESULTADOS FINANCIEROS DEL AÑO (cifras completas en bolivianos)')
    L.push('Concepto;Valor (Bs)')
    L.push(`Ingresos brutos (antes de restar el IVA — Impuesto al Valor Agregado);${num(Number(f.ingresosBrutos) * 1000, 0)}`)
    L.push(`IVA — Impuesto al Valor Agregado (13 %);${num(Number(f.iva) * 1000, 0)}`)
    L.push(`Ingresos netos (después de restar el IVA);${num(Number(f.ingresosNetos) * 1000, 0)}`)
    L.push(`Costo de productos vendidos;${num(Number(f.costoProductos) * 1000, 0)}`)
    L.push(`Logística (transporte y distribución por región, 6 %);${num(Number(f.logistica) * 1000, 0)}`)
    L.push(`Pérdidas de la cadena de frío (producto dañado, 2 %);${num(Number(f.perdidasCadenaFrio) * 1000, 0)}`)
    L.push(`Promoción de ventas (3 %);${num(Number(f.promocion) * 1000, 0)}`)
    L.push(`Investigación de mercado (estudios comprados, 5 %);${num(Number(f.investigacionMercado) * 1000, 0)}`)
    L.push(`Comisión de vendedores (3 %);${num(Number(f.comisionVendedores) * 1000, 0)}`)
    L.push(`Publicidad;${num(Number(f.publicidad) * 1000, 0)}`)
    L.push(`Fuerza de ventas (sueldos de vendedores);${num(Number(f.fuerzaVentas) * 1000, 0)}`)
    L.push(`Inversión en capacidad de producción (ampliación de planta);${num(Number(f.costoCapacidad) * 1000, 0)}`)
    L.push(`Utilidad operativa (antes de intereses e impuestos);${num(Number(f.utilidadOperativa) * 1000, 0)}`)
    L.push(`Intereses por la deuda bancaria;${num(Number(f.intereses) * 1000, 0)}`)
    L.push(`IT — Impuesto a las Transacciones (3 % de los ingresos brutos);${num(Number(f.it) * 1000, 0)}`)
    L.push(`IUE — Impuesto sobre las Utilidades de las Empresas (25 % de la utilidad);${num(Number(f.iue) * 1000, 0)}`)
    L.push(`Utilidad neta del año;${num(Number(f.utilidadNeta) * 1000, 0)}`)
    L.push(`Margen bruto (utilidad bruta / ingresos);${pct(Number(f.margenBruto ?? 0))}`)
    L.push(`Margen operativo (utilidad operativa / ingresos);${pct(Number(f.margenOperativo ?? 0))}`)
    L.push(`ROI — Rentabilidad de la inversión (retorno sobre la inversión);${num(Number(f.roi ?? 0), 1)} %`)
    L.push(`Deuda al cierre del año (tope permitido: 60 % de las ventas);${num(Number(f.deudaFinal ?? 0) * 1000, 0)}`)
    L.push(`Aviso de endeudamiento (¿se alcanzó el tope de deuda?);${f.endeudamientoAviso ? 'SÍ — tope alcanzado' : 'No'};`)
    L.push('')
  }

  // ── 9) Producción e inventarios ──
  if (r.detalle?.produccionAnio) {
    const p = r.detalle.produccionAnio as Record<string, number>
    L.push('9) PRODUCCIÓN E INVENTARIOS DEL AÑO')
    L.push('Concepto;Valor;Unidad')
    L.push(`Capacidad instalada de la planta;${num(Number(p.capacidadInstalada ?? 0) * 1000, 0)};litros por año`)
    L.push(`Utilización de la capacidad instalada;${num(Number(p.utilizacionPct ?? 0), 1)};porcentaje`)
    L.push(`Merma de producción (producto dañado en la planta, 2 %);${num(Number(p.merma ?? 0) * 1000, 0)};litros`)
    L.push(`Quiebres de stock (veces que faltó producto para vender);${entero(Number(p.quiebresStock ?? 0))};ocasiones`)
    L.push('')
  }

  // ── 10) Eventos del periodo ──
  if (r.detalle?.eventos && r.detalle.eventos.length > 0) {
    L.push('10) ACONTECIMIENTOS DEL PERIODO (eventos de la economía boliviana)')
    L.push('Variable afectada;Departamento o alcance;Mes;Eventos ocurridos (efecto × peso);Efecto total sobre la variable')
    for (const e of r.detalle.eventos) {
      const detalle = e.eventos.map((x) => `${x.nombre} (efecto ${pct(x.efecto, 0)} × peso ${pct(x.peso, 0)})`).join(' + ')
      L.push([NOMBRE_VARIABLE_EVENTO[e.variable] ?? e.variable, e.region === 'NACIONAL' ? 'Nacional (todo el país)' : REGIONES_BOLIVIA[e.region] ?? e.region, MESES[e.mes - 1] ?? `Mes ${e.mes}`, detalle, pct(e.total)].join(';'))
    }
    L.push('')
  }

  // ── 11) Inflación del periodo ──
  if (r.detalle?.inflacion) {
    const inf = r.detalle.inflacion
    L.push('11) INFLACIÓN DEL PERIODO (variación de precios de la economía boliviana)')
    L.push('Concepto;Valor')
    L.push(`Escenario macroeconómico;${ESCENARIOS[inf.escenario] ?? inf.escenario}`)
    L.push(`Inflación anual del periodo (aumento general de precios);${pct(inf.pi, 2)}`)
    L.push(`Índice de precios al consumidor al cierre (base 100);${num(inf.indicePreciosFin, 1)}`)
    L.push(`Tipo de cambio al cierre (bolivianos por dólar);Bs ${num(inf.tipoCambioFinal, 2)} por US$ 1`)
    if (inf.factores.length > 0) {
      L.push('')
      L.push('Factores que explican la inflación (aporte a la inflación anual);Aporte (puntos porcentuales)')
      for (const f of inf.factores) {
        const nombreFactor: Record<string, string> = {
          petroleo: 'Precio internacional del petróleo',
          dolar: 'Tipo de cambio del dólar',
          salarios: 'Salarios (reajuste salarial)',
          politica: 'Política económica (medidas del gobierno)',
          eventos: 'Eventos del calendario boliviano (festividades, clima, etc.)',
        }
        L.push([nombreFactor[f.factor] ?? f.factor.replace(/_/g, ' '), `${num(f.aporte * 100, 2)} puntos porcentuales`].join(';'))
      }
    }
    L.push('')
  }

  // ── 12) Historial de inflación ejecutada ──
  if (r.macroHistoria && r.macroHistoria.length > 0) {
    L.push('12) HISTORIAL DE INFLACIÓN EJECUTADA AÑO POR AÑO')
    L.push('Año;Escenario macroeconómico;Inflación anual (%);Índice de precios al cierre;Tipo de cambio (Bs por US$)')
    for (const m of r.macroHistoria) {
      L.push([`Año ${m.anio}`, ESCENARIOS[m.escenario] ?? m.escenario, num(m.inflacionAnual * 100, 2), num(m.indicePreciosFin, 1), num(m.tipoCambioFinal, 2)].join(';'))
    }
    L.push('')
  }

  // ── 13) Estudios de mercado comprados por el equipo ──
  if (estado.estudiosComprados.length > 0) {
    L.push('13) ESTUDIOS DE MERCADO COMPRADOS POR EL EQUIPO')
    L.push('Año;Estudio;Costo (Bs)')
    for (const c of estado.estudiosComprados) {
      const est = estado.config.catalogoEstudios.find((e) => e.id === c.estudioId)
      L.push([`Año ${c.anio}`, est?.nombre ?? `Estudio #${c.estudioId}`, num(c.costo * 1000, 0)].join(';'))
    }
    L.push('')
  }

  // ── 14) Resumen de todos los años del equipo ──
  L.push('14) RESUMEN CONTABLE DE TODOS LOS AÑOS DEL EQUIPO')
  L.push('Año;Ventas (litros);Ingresos netos (Bs);Costos (Bs);Publicidad (Bs);Fuerza de ventas (Bs);Investigación de mercado (Bs);Contribución (Bs);Cuota de mercado (%);¿Año sin decisión enviada?')
  for (const x of estado.reportes) {
    L.push([
      x.anio === 0 ? 'Año 0 (historia)' : `Año ${x.anio}`,
      num(x.ventas * 1000, 0),
      num(x.ingresos * 1000, 0),
      num(x.costos * 1000, 0),
      num(x.publicidad * 1000, 0),
      num(x.fuerzaVentas * 1000, 0),
      num(x.investigacionMercado * 1000, 0),
      num(x.contribucion * 1000, 0),
      pct(x.participacion),
      x.sinDecision ? 'Sí — el motor usó valores vigentes' : 'No',
    ].join(';'))
  }

  const secciones = titulo.concat(L)
  return secciones.join('\n')
}

/** Nombres de los 9 departamentos de Bolivia (más el alcance nacional). */
const REGIONES_BOLIVIA: Record<string, string> = {
  NACIONAL: 'Nacional (todo el país)',
  LA_PAZ: 'La Paz',
  SANTA_CRUZ: 'Santa Cruz',
  COCHABAMBA: 'Cochabamba',
  ORURO: 'Oruro',
  POTOSI: 'Potosí',
  CHUQUISACA: 'Chuquisaca',
  TARIJA: 'Tarija',
  BENI: 'Beni',
  PANDO: 'Pando',
}

/** Nombre de archivo seguro con la empresa y el año. */
export function nombreArchivoReporte(estado: AlumnoEstado, anio: number): string {
  const limpiar = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase()
  return `reporte-${limpiar(estado.equipo.nombre)}-anio-${anio}.csv`
}

/** Descarga el reporte del año indicado. */
export function descargarReporteCsv(estado: AlumnoEstado, reporte: ReporteDetalle) {
  descargarArchivo(nombreArchivoReporte(estado, reporte.anio), construirCsvReporte(estado, reporte))
}
