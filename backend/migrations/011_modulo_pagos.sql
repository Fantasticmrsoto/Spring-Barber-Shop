-- Migración 011: módulo de pagos con comprobante
--
-- `transacciones` pasa de ser un libro manual de saldo a registrar PAGOS ligados a
-- una cita, con estado y método:
--   - metodo_pago: 'pago_movil' (lo sube el cliente con comprobante, queda
--     'pendiente' hasta que el admin aprueba/rechaza), 'efectivo' o 'tarjeta'
--     (el admin los registra en el local y quedan 'completado').
--   - comprobante_url: ruta de la imagen subida a /uploads (solo pago móvil).
--   - citaID: la cita que se está pagando.
--   - motivo_rechazo: texto que deja el admin al rechazar.
--
-- Se relajan los NOT NULL que no aplican a un pago (saldo_restante, referencia_pago
-- y el antiguo tipo_movimiento). Idempotente.

BEGIN;

ALTER TABLE public.transacciones
    ADD COLUMN IF NOT EXISTS estado          text    NOT NULL DEFAULT 'pendiente',
    ADD COLUMN IF NOT EXISTS metodo_pago     text,
    ADD COLUMN IF NOT EXISTS comprobante_url text,
    ADD COLUMN IF NOT EXISTS "citaID"        integer,
    ADD COLUMN IF NOT EXISTS motivo_rechazo  text;

-- Los movimientos antiguos (sin método) eran un libro manual ya aplicado: se marcan
-- como completados para que no aparezcan como pagos pendientes de aprobar.
UPDATE public.transacciones
SET estado = 'completado'
WHERE metodo_pago IS NULL AND estado = 'pendiente';

ALTER TABLE public.transacciones ALTER COLUMN saldo_restante  DROP NOT NULL;
ALTER TABLE public.transacciones ALTER COLUMN referencia_pago DROP NOT NULL;
ALTER TABLE public.transacciones ALTER COLUMN tipo_movimiento DROP NOT NULL;

DO
$$
    BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'transaccion_estado_check') THEN
            ALTER TABLE public.transacciones
                ADD CONSTRAINT transaccion_estado_check
                CHECK (estado IN ('pendiente', 'completado', 'rechazado'));
        END IF;

        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'transaccion_metodo_check') THEN
            ALTER TABLE public.transacciones
                ADD CONSTRAINT transaccion_metodo_check
                CHECK (metodo_pago IS NULL OR metodo_pago IN ('pago_movil', 'efectivo', 'tarjeta'));
        END IF;

        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_transaccion_cita') THEN
            ALTER TABLE public.transacciones
                ADD CONSTRAINT fk_transaccion_cita FOREIGN KEY ("citaID")
                    REFERENCES public.cita ("citaID") ON UPDATE CASCADE ON DELETE SET NULL;
        END IF;
    END
$$;

CREATE INDEX IF NOT EXISTS transaccion_estado_idx ON public.transacciones (estado);
CREATE INDEX IF NOT EXISTS transaccion_cita_idx   ON public.transacciones ("citaID");

COMMIT;
