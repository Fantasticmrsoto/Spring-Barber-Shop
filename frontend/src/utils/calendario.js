/*
 * Días en los que no se puede reservar.
 *
 * La peluquería no abre los domingos (día de descanso) ni en los feriados.
 *
 * La lista de feriados viene del backend (`GET /api/feriados`), que la tiene
 * en la tabla `feriado`: cambia cada año y los carnavales y la Semana Santa
 * se mueven con la Pascua. Los días de descanso también llegan del backend,
 * para que la regla no esté duplicada en dos sitios.
 *
 * Aquí solo está la lógica de mirar una fecha.
 */

import { DIAS_SEMANA } from './formato'

/**
 * ¿La fecha "YYYY-MM-DD" es un día de descanso?
 * @param {string} fechaYmd
 * @param {string[]} diasDescanso Nombres de día en minúsculas y sin tilde.
 * @returns {boolean}
 */
export function esDiaDeDescanso(fechaYmd, diasDescanso = []) {
  if (!fechaYmd || diasDescanso.length === 0) return false
  const dia = DIAS_SEMANA[(new Date(`${fechaYmd}T00:00:00`).getDay() + 6) % 7]
  return diasDescanso.includes(dia)
}

/**
 * Busca el feriado de una fecha.
 * @param {string} fechaYmd
 * @param {{fecha: string, nombre: string}[]} feriados
 * @returns {{fecha: string, nombre: string}|null}
 */
export function feriadoDe(fechaYmd, feriados = []) {
  if (!fechaYmd) return null
  return feriados.find((f) => f.fecha === fechaYmd) ?? null
}

/**
 * ¿Se puede reservar en esa fecha?
 * @param {string} fechaYmd
 * @param {{diasDescanso: string[], feriados: object[]}} calendario
 * @returns {{ bloqueado: boolean, motivo: string|null }}
 */
export function revisarFecha(fechaYmd, calendario) {
  const { diasDescanso = [], feriados = [] } = calendario ?? {}

  if (esDiaDeDescanso(fechaYmd, diasDescanso)) {
    const dia = DIAS_SEMANA[(new Date(`${fechaYmd}T00:00:00`).getDay() + 6) % 7]
    const nombre = {
      domingo: 'el domingo',
      lunes: 'el lunes',
      martes: 'el martes',
      miercoles: 'el miércoles',
      jueves: 'el jueves',
      viernes: 'el viernes',
      sabado: 'el sábado',
    }[dia]
    return { bloqueado: true, motivo: `No se puede reservar ${nombre}: es día de descanso.` }
  }

  const feriado = feriadoDe(fechaYmd, feriados)
  if (feriado) {
    return { bloqueado: true, motivo: `No se puede reservar: ${feriado.nombre}.` }
  }

  return { bloqueado: false, motivo: null }
}
