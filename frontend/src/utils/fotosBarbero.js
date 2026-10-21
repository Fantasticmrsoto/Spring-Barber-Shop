import foto1 from '../assets/barberos/barb1.webp'
import foto1pequena from '../assets/barberos/barb1-96.webp'
import foto2 from '../assets/barberos/barb2.webp'
import foto2pequena from '../assets/barberos/barb2-96.webp'
import foto3 from '../assets/barberos/barb3.webp'
import foto3pequena from '../assets/barberos/barb3-96.webp'

/*
 * Fotos de referencia de los barberos.
 *
 * Se usan cuando un barbero no tiene foto subida: mejor una foto que unas
 * iniciales. Cada barbero recibe siempre la misma (se elige por su
 * identificador y no por su posición en la lista, que puede cambiar según
 * cómo se filtre), así que la web no muestra una foto distinta cada vez que
 * se recarga.
 *
 * Van en dos tamaños: 96 px para las pantallas normales y 192 px para las de
 * doble resolución. Pesar 1-8 KB en lugar de los 127 KB del JPEG original
 * es lo que hace que la página siga siendo igual de ligera, y con `srcset`
 * cada navegador descarga solo el que le hace falta.
 */
const FOTOS = [
  { src: foto1, srcSet: `${foto1pequena} 96w, ${foto1} 192w` },
  { src: foto2, srcSet: `${foto2pequena} 96w, ${foto2} 192w` },
  { src: foto3, srcSet: `${foto3pequena} 96w, ${foto3} 192w` },
]

/**
 * Foto de referencia de un barbero.
 *
 * @param {number} barberoID
 * @returns {{src: string, srcSet: string}} URL de la imagen y variantes
 */
export function fotoBarbero(barberoID) {
  const id = Number(barberoID)
  if (!Number.isInteger(id) || id <= 0) return FOTOS[0]
  return FOTOS[(id - 1) % FOTOS.length]
}
