#!/usr/bin/env python3
"""
Genera los iconos PNG de la aplicación web (PWA) a partir de la forma del
favicon.svg, que es un rayo violeta.

Por qué hace falta: los navegadores no sirven el favicon.svg como icono de
instalación. Chrome exige un PNG de 192x192 y de 512x512 para ofrecer "Añadir
a la pantalla de inicio", y iOS necesita un `apple-touch-icon` de 180x180.
Sin esos ficheros, la web se abre en una pestaña del navegador y no como una
app con su propio icono y su nombre ("Spring Barber Shop") en el móvil.

Uso:  python3 scripts/generar-iconos.py
Salida: public/icono-192.png, public/icono-512.png,
        public/icono-maskable-512.png, public/apple-touch-icon.png
"""

import os
from PIL import Image, ImageDraw

# Colores de la marca (los mismos del favicon.svg y del theme-color).
FONDO = (11, 11, 13, 255)        # #0b0b0d
VIOLETA = (126, 20, 255, 255)    # #7e14ff
AZUL = (71, 191, 255, 255)       # #47bfff

# La forma del favicon, en su viewBox de 48x46.
FORMA = [
    (25.9, 44.9), (23.9, 44.2), (23.9, 33.9), (21.7, 31.6), (10.3, 31.6),
    (9.4, 29.8), (16.9, 19.4), (18.0, 17.9), (16.1, 14.3), (1.2, 14.3),
    (0.3, 12.5), (10.0, 0.5), (10.9, 0.0), (39.8, 0.0), (40.7, 1.8),
    (33.2, 12.3), (32.1, 13.8), (34.0, 17.4), (45.4, 17.4), (46.3, 19.2),
]


def dibujar(alto, margen, fondo=FONDO):
    """
    Dibuja el icono.

    `margen` es la proporción del lienzo que queda libre alrededor de la forma.
    Para los iconos "maskable" de Android el margen debe ser grande (la zona
    segura es el 80% central), porque el sistema recorta el icono en círculo o
    en cuadrado redondeado.
    """
    ancho = alto
    imagen = Image.new("RGBA", (ancho, alto), fondo)

    # Zona de dibujo: el viewBox de la forma es 48x46 (casi cuadrado).
    lado = min(ancho, alto) * (1 - margen)
    escala = lado / 48
    desplazamiento_x = (ancho - 48 * escala) / 2
    desplazamiento_y = (alto - 46 * escala) / 2
    puntos = [(x * escala + desplazamiento_x, y * escala + desplazamiento_y)
              for x, y in FORMA]

    # Degradado vertical violeta -> azul, recortado con la forma.
    degradado = Image.new("RGBA", (ancho, alto))
    pixeles = degradado.load()
    for y in range(alto):
        t = y / max(alto - 1, 1)
        color = tuple(round(VIOLETA[i] + (AZUL[i] - VIOLETA[i]) * t) for i in range(4))
        for x in range(ancho):
            pixeles[x, y] = color

    mascara = Image.new("L", (ancho, alto), 0)
    ImageDraw.Draw(mascara).polygon(puntos, fill=255)

    imagen.paste(degradado, (0, 0), mascara)
    return imagen


def main():
    destino = os.path.join(os.path.dirname(__file__), "..", "public")
    os.makedirs(destino, exist_ok=True)

    archivos = {
        "icono-192.png": dibujar(192, 0.18),
        "icono-512.png": dibujar(512, 0.18),
        # Maskable: margen amplio para que Android no recorte la forma.
        "icono-maskable-512.png": dibujar(512, 0.30),
        "apple-touch-icon.png": dibujar(180, 0.14, fondo=(11, 11, 13, 255)),
    }

    for nombre, imagen in archivos.items():
        ruta = os.path.join(destino, nombre)
        imagen.save(ruta, "PNG", optimize=True)
        print(f"  {nombre}  {imagen.size[0]}x{imagen.size[1]}")


if __name__ == "__main__":
    print("Generando iconos de la aplicación:")
    main()
