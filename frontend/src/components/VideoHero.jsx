import { useEffect, useRef, useState } from 'react'
import cartelVideo from '../assets/video/poster.avif'
import cartelRespaldo from '../assets/video/poster.webp'
import urlVideo from '../assets/video/inicio.mp4'

/*
 * Vídeo del inicio.
 *
 * El vídeo pesa unos 5 MB, así que no puede descargarse junto con la página:
 * si lo hiciera competiría con el contenido principal y la portada tardaría
 * más en verse. Por eso se hace en tres tiempos:
 *
 *   1. Se pinta primero el cartel (un AVIF de 16 KB, con un WebP de 27 KB
 *      de respaldo). Es lo que ve el visitante mientras tanto, y como es lo
 *      más grande de la portada, es también el elemento que marca el tiempo
 *      de carga perceptible.
 *   2. El vídeo solo se pide cuando el bloque está a la vista y el navegador
 *      ya está libre (`requestIdleCallback`), de modo que no retrasa ni el
 *      pintado ni la interacción con la página.
 *   3. Si el visitante ha pedido menos movimiento (`prefers-reduced-motion`),
 *      el vídeo no se descarga nunca y se queda el cartel.
 *
 * El vídeo va sin sonido: es un fondo en bucle y, además, los navegadores
 * solo lo reproducen en automático si está silenciado.
 *
 * Al terminar de cargar, el vídeo aparece encima del cartel con un
 * fundido. Las dos capas tienen el mismo tamaño, así que la página no da
 * ningún salto al aparecer.
 */
export default function VideoHero({ className = '' }) {
  const contenedor = useRef(null)
  const video = useRef(null)
  const [pedirVideo, setPedirVideo] = useState(false)
  const [reproduciendo, setReproduciendo] = useState(false)

  // Cuándo se decide descargar el vídeo.
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    // Sin IntersectionObserver no hay forma de saber si el bloque se ve:
    // se espera un momento y se carga igualmente.
    if (!('IntersectionObserver' in window)) {
      const temporizador = setTimeout(() => setPedirVideo(true), 800)
      return () => clearTimeout(temporizador)
    }

    const observador = new IntersectionObserver(
      (entradas) => {
        if (!entradas.some((entrada) => entrada.isIntersecting)) return
        observador.disconnect()
        // Se espera a que el navegador termine lo que esté haciendo.
        if ('requestIdleCallback' in window) {
          requestIdleCallback(() => setPedirVideo(true), { timeout: 2000 })
        } else {
          setTimeout(() => setPedirVideo(true), 400)
        }
      },
      { rootMargin: '300px' },
    )

    observador.observe(contenedor.current)
    return () => observador.disconnect()
  }, [])

  // Al pedir el vídeo se le da la URL y se arranca.
  useEffect(() => {
    if (!pedirVideo) return
    const v = video.current
    if (!v) return
    v.src = urlVideo
    const promesa = v.play()
    if (promesa) promesa.catch(() => {})
  }, [pedirVideo])

  return (
    <div ref={contenedor} className={`relative overflow-hidden ${className}`}>
      <picture className="block h-full w-full">
        {/* El cartel va en AVIF (16 KB) y, para los navegadores que no lo
            entendan, en WebP (27 KB). Los dos muestran el mismo fotograma. */}
        <source srcSet={cartelVideo} type="image/avif" />
        <img
          src={cartelRespaldo}
          alt="El taller de Spring Barber Shop"
          width="576"
          height="1024"
          fetchPriority="high"
          decoding="async"
          className="h-full w-full object-cover"
        />
      </picture>
      <video
        ref={video}
        muted
        loop
        playsInline
        preload="none"
        aria-hidden="true"
        onPlaying={() => setReproduciendo(true)}
        className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${
          reproduciendo ? 'opacity-100' : 'opacity-0'
        }`}
      />
    </div>
  )
}
