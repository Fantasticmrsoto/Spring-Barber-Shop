#!/usr/bin/env python3
"""
Añade a la colección de Postman los casos de la regla de días no laborables.

Los casos nuevos son:
  29 · Feriados publicados      -> GET /api/feriados y guarda una fecha
  30 · Cita en feriado          -> POST /api/citas en un feriado (400)
  31 · Cita en domingo          -> POST /api/citas en domingo (400)

El item 29 va antes que el 30 porque guarda en el entorno la fecha del primer
feriado: así el test no depende de una fecha escrita a mano que se quedaría
obsoleta cuando cambien los feriados.

Uso: node scripts/... o python3 scripts/anadir-casos-feriados.py
"""

import json
import os

RUTA = os.path.join(
    os.path.dirname(__file__), '..', '..', 'postman', 'My Collection.postman_collection.json'
)


def con_token():
    return {
        "type": "bearer",
        "bearer": [{"key": "token", "value": "{{token}}", "type": "string"}],
    }


def con_cuerpo(extra):
    cuerpo = {
        "clienteID": "{{usuarioClienteID}}",
        "barberoID": "{{barberoID}}",
        "servicioID": "{{servicioID}}",
    }
    cuerpo.update(extra)
    return json.dumps(cuerpo, indent=2, ensure_ascii=False)


def post_citas(fecha):
    return {
        "method": "POST",
        "auth": con_token(),
        "header": [{"key": "Content-Type", "value": "application/json"}],
        "body": {"mode": "raw", "raw": con_cuerpo({"fecha_hora": fecha})},
        "url": {
            "raw": "{{base_url}}/api/citas",
            "host": ["{{base_url}}"],
            "path": ["api", "citas"],
        },
    }


def test(ejecucion):
    return {
        "listen": "test",
        "script": {"type": "text/javascript", "exec": ejecucion},
    }


ITEM_FERIADOS = {
    "name": "29 · Feriados publicados",
    "request": {
        "method": "GET",
        "header": [],
        "url": {
            "raw": "{{base_url}}/api/feriados",
            "host": ["{{base_url}}"],
            "path": ["api", "feriados"],
        },
    },
    "event": [
        test([
            "pm.test('devuelve la lista de feriados con 200', () => { pm.response.to.have.status(200); });",
            "const json = pm.response.json();",
            "pm.test('incluye los días de descanso', () => {",
            "  pm.expect(json.dias_descanso).to.include('domingo');",
            "});",
            "pm.test('hay feriados publicados', () => {",
            "  pm.expect(json.feriados.length).to.be.above(0);",
            "});",
            "// Se guarda la fecha del primer feriado para el caso siguiente, en vez de",
            "// escribirla a mano: así el test no se queda obsoleto cuando cambien.",
            "pm.environment.set('fechaFeriado', json.feriados[0].fecha);",
        ])
    ],
}

ITEM_FERIADO = {
    "name": "30 · Cita en feriado rechazada",
    "request": post_citas("{{fechaFeriado}}T10:00:00"),
    "event": [
        test([
            "pm.test('una cita en un feriado devuelve 400', () => { pm.response.to.have.status(400); });",
            "pm.test('el mensaje menciona que no se puede reservar', () => {",
            "  pm.expect(pm.response.json().message).to.include('No se puede reservar');",
            "});",
        ])
    ],
}

ITEM_DOMINGO = {
    "name": "31 · Cita en domingo rechazada",
    "request": post_citas("{{fechaDomingo}}"),
    "event": [
        test([
            "pm.test('una cita en domingo devuelve 400', () => { pm.response.to.have.status(400); });",
            "pm.test('el mensaje dice que es día de descanso', () => {",
            "  pm.expect(pm.response.json().message).to.include('día de descanso');",
            "});",
        ])
    ],
}


def main():
    with open(RUTA, encoding='utf-8') as f:
        coleccion = json.load(f)

    nombres = {it['name'] for it in coleccion['item']}
    nuevos = [ITEM_FERIADOS, ITEM_FERIADO, ITEM_DOMINGO]
    if all(n['name'] in nombres for n in nuevos):
        print('Los casos ya estaban en la colección. No se toca nada.')
        return

    # El domingo se calcula en el prerequest de la colección, junto a las
    # demás fechas de prueba.
    prerequest = coleccion['event'][0]['script']['exec']
    if not any('fechaDomingo' in linea for linea in prerequest):
        prerequest.extend([
            "",
            "// El domingo siguiente al lunes de la semana de pruebas: la peluquería no",
            "// abre los domingos (día de descanso).",
            "const domingo = new Date(lunes);",
            "domingo.setDate(lunes.getDate() + 6);",
            "domingo.setHours(10, 0, 0, 0);",
            "pm.environment.set('fechaDomingo', iso(domingo));",
        ])

    for n in nuevos:
        if n['name'] not in nombres:
            coleccion['item'].append(n)
            print(f"  + {n['name']}")

    with open(RUTA, 'w', encoding='utf-8') as f:
        json.dump(coleccion, f, indent=2, ensure_ascii=False)
        f.write('\n')

    print(f"\nColección guardada: {len(coleccion['item'])} peticiones.")


if __name__ == '__main__':
    main()
