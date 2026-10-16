const db = require('../config/db');

// ---------------------------------------------------------------------------
// Resumen de negocio para el dashboard del administrador. Se calculan varios
// conjuntos en paralelo y se devuelven listos para pintar.
//
// Notas sobre fechas: `cita.fecha_inicio` es `timestamp without time zone` (hora
// de pared del negocio). Por eso se compara contra `localtimestamp` / `CURRENT_DATE`
// y nunca contra `now()` (que devuelve `timestamptz` y arrastraría zona horaria).
// ---------------------------------------------------------------------------

const CONSULTA_RESUMEN = `
  SELECT
    (SELECT count(*)::int FROM cita) AS citas_totales,
    (SELECT count(*)::int FROM cita
       WHERE estado <> 'cancelada' AND fecha_inicio::date = CURRENT_DATE) AS citas_hoy,
    (SELECT count(*)::int FROM cita
       WHERE estado IN ('pendiente', 'confirmada')
         AND fecha_inicio >= localtimestamp) AS citas_proximas,
    (SELECT count(*)::int FROM cita WHERE estado = 'completada') AS citas_completadas,
    (SELECT count(*)::int FROM cita WHERE estado = 'cancelada') AS citas_canceladas,
    (SELECT COALESCE(sum(s.precio), 0)
       FROM cita c JOIN servicios s ON c."servicioID" = s."serviciosID"
       WHERE c.estado = 'completada') AS ingresos_completadas,
    (SELECT COALESCE(sum(s.precio), 0)
       FROM cita c JOIN servicios s ON c."servicioID" = s."serviciosID"
       WHERE c.estado = 'completada'
         AND c.fecha_inicio >= date_trunc('month', localtimestamp)) AS ingresos_mes,
    (SELECT COALESCE(avg(s.precio), 0)
       FROM cita c JOIN servicios s ON c."servicioID" = s."serviciosID"
       WHERE c.estado = 'completada') AS ticket_promedio,
    (SELECT count(*)::int FROM usuario WHERE rol = 'cliente') AS clientes_totales,
    (SELECT count(*)::int FROM barbero WHERE estado) AS barberos_activos,
    (SELECT count(*)::int FROM servicios) AS servicios_totales;
`;

const CONSULTA_POR_ESTADO = `
  SELECT estado, count(*)::int AS total
  FROM cita
  GROUP BY estado;
`;

const CONSULTA_ULTIMOS_DIAS = `
  SELECT to_char(gs::date, 'YYYY-MM-DD') AS fecha,
         count(c."citaID")::int AS total
  FROM generate_series(CURRENT_DATE - INTERVAL '13 days', CURRENT_DATE, INTERVAL '1 day') gs
  LEFT JOIN cita c
    ON c.fecha_inicio::date = gs::date AND c.estado <> 'cancelada'
  GROUP BY gs
  ORDER BY gs;
`;

const CONSULTA_TOP_SERVICIOS = `
  SELECT s."serviciosID" AS "servicioID",
         s.nombre,
         count(c."citaID")::int AS total,
         COALESCE(sum(s.precio) FILTER (WHERE c.estado = 'completada'), 0) AS ingresos
  FROM servicios s
  LEFT JOIN cita c
    ON c."servicioID" = s."serviciosID" AND c.estado <> 'cancelada'
  GROUP BY s."serviciosID", s.nombre
  ORDER BY total DESC, ingresos DESC
  LIMIT 5;
`;

const CONSULTA_RANKING_BARBEROS = `
  SELECT b."barberoID",
         ub.nombre,
         ub.apellido,
         b.comision,
         b.estado,
         count(c."citaID") FILTER (WHERE c.estado <> 'cancelada')::int AS citas,
         COALESCE(sum(s.precio) FILTER (WHERE c.estado = 'completada'), 0) AS ingresos
  FROM barbero b
  JOIN usuario ub ON b."usuarioID" = ub."usuarioID"
  LEFT JOIN cita c ON c."barberoID" = b."barberoID"
  LEFT JOIN servicios s ON c."servicioID" = s."serviciosID"
  GROUP BY b."barberoID", ub.nombre, ub.apellido, b.comision, b.estado
  ORDER BY citas DESC, ingresos DESC;
`;

const CONSULTA_INGRESOS_MES = `
  SELECT to_char(gs, 'YYYY-MM') AS mes,
         COALESCE(sum(s.precio) FILTER (WHERE c.estado = 'completada'), 0) AS ingresos,
         count(c."citaID") FILTER (WHERE c.estado <> 'cancelada')::int AS citas
  FROM generate_series(
         date_trunc('month', localtimestamp) - INTERVAL '5 months',
         date_trunc('month', localtimestamp),
         INTERVAL '1 month'
       ) gs
  LEFT JOIN cita c ON date_trunc('month', c.fecha_inicio) = gs
  LEFT JOIN servicios s ON c."servicioID" = s."serviciosID"
  GROUP BY gs
  ORDER BY gs;
`;

// GET /api/estadisticas/resumen  (solo administrador)
const obtenerResumen = async (req, res) => {
  try {
    const [resumen, porEstado, porDia, topServicios, ranking, porMes] = await Promise.all([
      db.query(CONSULTA_RESUMEN),
      db.query(CONSULTA_POR_ESTADO),
      db.query(CONSULTA_ULTIMOS_DIAS),
      db.query(CONSULTA_TOP_SERVICIOS),
      db.query(CONSULTA_RANKING_BARBEROS),
      db.query(CONSULTA_INGRESOS_MES)
    ]);

    const r = resumen.rows[0];

    // La comisión del barbero se aplica sobre lo efectivamente completado.
    const rankingBarberos = ranking.rows.map((b) => ({
      ...b,
      comisionEstimada: (Number(b.ingresos) * Number(b.comision)) / 100
    }));

    res.json({
      ok: true,
      generadoEn: new Date().toISOString(),
      resumen: {
        citasTotales: r.citas_totales,
        citasHoy: r.citas_hoy,
        citasProximas: r.citas_proximas,
        citasCompletadas: r.citas_completadas,
        citasCanceladas: r.citas_canceladas,
        ingresosCompletadas: r.ingresos_completadas,
        ingresosMes: r.ingresos_mes,
        ticketPromedio: r.ticket_promedio,
        clientesTotales: r.clientes_totales,
        barberosActivos: r.barberos_activos,
        serviciosTotales: r.servicios_totales
      },
      citasPorEstado: porEstado.rows,
      citasUltimos14Dias: porDia.rows,
      topServicios: topServicios.rows,
      rankingBarberos,
      ingresosPorMes: porMes.rows
    });
  } catch (error) {
    console.error('Error al obtener estadísticas:', error.message);
    res.status(500).json({ ok: false, error: 'Error interno del servidor' });
  }
};

module.exports = { obtenerResumen };
