// ============================================================
// PACHA Simulador · Generador de datos de estudios de mercado
// Determinista: los datos dependen de (equipo, año, estudio, estado real)
// ============================================================

import { ATRIBUTOS, CANALES, SEGMENTOS, demandaAnio } from './catalogo'
import { clamp, round1, round2, ruido } from './hash'
import { atractivo, coberturaCanal, type MarcaSim } from './motor'

export interface MarcaContexto extends MarcaSim {
  firma: string
  esPropia: boolean
}

export interface ContextoEstudios {
  anio: number
  equipoId: string
  marcas: MarcaContexto[]
}

export function generarDatosEstudio(estudioId: number, ctx: ContextoEstudios): unknown {
  const { anio, equipoId, marcas } = ctx
  const seedBase = `${equipoId}|${anio}|${estudioId}`

  switch (estudioId) {
    case 1: {
      // Awareness de marca (propia y competencia) ±3%
      return {
        tipo: 'awareness',
        marcas: marcas.map((m) => ({
          marca: m.nombre,
          firma: m.firma,
          esPropia: m.esPropia,
          awareness: Math.round(clampPct(m.awareness * ruido(`${seedBase}|${m.marcaId}`, 0.03)) * 100),
        })),
      }
    }
    case 2: {
      // Panel de consumidores: preferencia por segmento (normalizada con ruido)
      return {
        tipo: 'panel-consumidores',
        segmentos: SEGMENTOS.map((seg) => {
          const vals = marcas.map((m) => ({
            marca: m.nombre,
            firma: m.firma,
            esPropia: m.esPropia,
            a: atractivo(m, seg, anio) * ruido(`${seedBase}|${seg.id}|${m.marcaId}`, 0.1),
          }))
          const suma = vals.reduce((s, v) => s + v.a, 0) || 1
          return {
            segmento: seg.nombre,
            preferencias: vals.map((v) => ({
              marca: v.marca,
              firma: v.firma,
              esPropia: v.esPropia,
              preferencia: Math.round((v.a / suma) * 1000) / 10,
            })),
          }
        }),
      }
    }
    case 3: {
      // Panel de distribuidores: cobertura por canal y firma
      const firmas = [...new Map(marcas.map((m) => [m.firma, m.esPropia])).entries()]
      return {
        tipo: 'panel-distribuidores',
        canales: CANALES.map((c, ci) => ({
          canal: c.nombre,
          firmas: firmas.map(([firma, esPropia]) => {
            const ms = marcas.filter((m) => m.firma === firma)
            const prom = ms.reduce((s, m) => s + coberturaCanal(m.vendedores[ci] ?? 0, ci), 0) / ms.length
            return {
              firma,
              esPropia,
              cobertura: Math.round(clampPct(prom * ruido(`${seedBase}|${c.id}|${firma}`, 0.08)) * 100),
            }
          }),
        })),
      }
    }
    case 4:
    case 5:
    case 6:
    case 7:
    case 8: {
      // Escalas semánticas 1..10 por atributo (marcas propias) ±0.4
      const seg = SEGMENTOS[estudioId - 4]
      const propias = marcas.filter((m) => m.esPropia)
      return {
        tipo: 'escala-semantica',
        segmento: seg.nombre,
        atributos: ATRIBUTOS.map((a, ai) => ({
          atributo: a.nombre,
          emoji: a.emoji,
          marcas: propias.map((m) => ({
            marca: m.nombre,
            calificacion: Math.round(clamp(m.atributos[ai] * ruido(`${seedBase}|${a.id}|${m.marcaId}`, 0.04), 1, 10) * 10) / 10,
          })),
        })),
        nota: `Calificación promedio (1-10) que los consumidores del segmento ${seg.nombre} asignan a tus marcas.`,
      }
    }
    case 9: {
      // Mapa perceptual: eje X precio, eje Y calidad percibida (promedio de atributos)
      return {
        tipo: 'mapa-perceptual',
        marcas: marcas.map((m) => ({
          marca: m.nombre,
          firma: m.firma,
          esPropia: m.esPropia,
          x: round1(clamp((m.precio / 20) * 100 * ruido(`${seedBase}|x|${m.marcaId}`, 0.03), 2, 98)),
          y: round1(clamp((m.atributos.reduce((s, a) => s + a, 0) / 6) * 10 * ruido(`${seedBase}|y|${m.marcaId}`, 0.03), 2, 98)),
        })),
        ejeX: 'Precio percibido (0 = económico · 100 = premium)',
        ejeY: 'Calidad percibida (0-100)',
      }
    }
    case 10: {
      // Pronóstico de demanda del próximo año ±4%
      return {
        tipo: 'pronostico',
        anioPronostico: anio + 1,
        segmentos: SEGMENTOS.map((seg) => ({
          segmento: seg.nombre,
          emoji: seg.emoji,
          demanda: Math.round(demandaAnio(anio + 1, seg) * ruido(`${seedBase}|${seg.id}`, 0.04)),
          unidad: 'miles de unidades',
        })),
      }
    }
    case 11: {
      // Publicidad de la competencia ±10%
      const otras = marcas.filter((m) => !m.esPropia)
      return {
        tipo: 'publicidad-competencia',
        unidad: 'miles de Bs',
        marcas: otras.map((m) => ({
          marca: m.nombre,
          firma: m.firma,
          publicidad: Math.round(m.publicidad * ruido(`${seedBase}|${m.marcaId}`, 0.1)),
        })),
      }
    }
    case 12: {
      // Fuerza de ventas de la competencia ±10%
      const otras = marcas.filter((m) => !m.esPropia)
      return {
        tipo: 'fuerza-ventas-competencia',
        marcas: otras.map((m) => ({
          marca: m.nombre,
          firma: m.firma,
          vendedores: m.vendedores.map((v, i) =>
            Math.max(0, Math.round(v * ruido(`${seedBase}|${m.marcaId}|${i}`, 0.1)))
          ),
          canales: CANALES.map((c) => c.nombre),
        })),
      }
    }
    case 13: {
      // Experimento de precio: sensibilidad y precio ideal por segmento ±15%
      return {
        tipo: 'experimento-precio',
        segmentos: SEGMENTOS.map((seg) => {
          const sens = seg.sensibilidadPrecio * ruido(`${seedBase}|s|${seg.id}`, 0.15)
          const ideal = seg.precioIdeal * ruido(`${seedBase}|p|${seg.id}`, 0.08)
          return {
            segmento: seg.nombre,
            sensibilidad: round2(sens),
            precioIdeal: round1(ideal),
            lectura:
              sens > 1.2
                ? 'Segmento muy sensible al precio: subirlo por encima del ideal castiga fuerte la demanda.'
                : 'Segmento moderadamente sensible: el producto y la marca pesan más que el precio.',
          }
        }),
      }
    }
    case 14: {
      // Experimento de atributos: importancia relativa por segmento (derivada del ideal)
      return {
        tipo: 'experimento-atributos',
        segmentos: SEGMENTOS.map((seg) => {
          const suma = seg.ideal.reduce((s, v) => s + v, 0)
          const pesos = seg.ideal.map((v, i) => ({
            atributo: ATRIBUTOS[i].nombre,
            emoji: ATRIBUTOS[i].emoji,
            importancia: Math.round(((v / suma) * 100 * ruido(`${seedBase}|${seg.id}|${i}`, 0.06)) * 10) / 10,
          }))
          pesos.sort((a, b) => b.importancia - a.importancia)
          return { segmento: seg.nombre, pesos }
        }),
      }
    }
    case 15: {
      // Segmentación emergente: revela los ideales exactos de cada segmento
      return {
        tipo: 'segmentacion-emergente',
        segmentos: SEGMENTOS.map((seg) => ({
          segmento: seg.nombre,
          emoji: seg.emoji,
          descripcion: seg.descripcion,
          precioIdeal: seg.precioIdeal,
          ideal: seg.ideal,
          atributos: ATRIBUTOS.map((a) => a.nombre),
        })),
      }
    }
    default:
      return { tipo: 'desconocido' }
  }
}

function clampPct(v: number): number {
  return Math.min(1, Math.max(0.01, v))
}
