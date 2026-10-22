-- Migración 010: forma de pago al reservar
--
-- Al reservar, el cliente elige cómo va a pagar:
--
--   - **Pago móvil**: sube un comprobante (una imagen) y el administrador lo
--     aprueba o lo rechaza. La cita queda esperando ese visto bueno.
--   - **Efectivo o tarjeta**: la cita se reserva normal, pero con la etiqueta
--     de "pago pendiente" hasta que se cobre en el local.
--
-- La cita guarda el método y el estado de su pago, para poder poner la
-- etiqueta sin depender de la tabla `transacciones` (que solo tiene fila
-- cuando hay un comprobante o un cobro registrado) y el motivo cuando el
-- administrador deniega la cita: ese motivo es el mensaje que ve el cliente.
--
-- Se añade también el estado "denegada" a la cita: es distinto de "cancelada"
-- (que es el cliente quien cancela). Con "denegada" el cliente ve de un vistazo
-- que su cita fue rechazada por el administrador y no perdida por su cuenta.

BEGIN;

-- 1. El estado "denegada" en la cita
-- ---------------------------------------------------------------------------
-- El CHECK se sustituye en vez de añadir otro: una fila solo puede tener un
-- CHECK de estados y el viejo no dejaría pasar "denegada".
--
-- Se busca el CHECK por su definición y no por su nombre, porque el nombre
-- puede haber cambiado (la migración 001 lo llamó `cita_estado_check`, pero
-- una base creada a mano puede tener otro). Se hace aquí, antes de crear los
-- CHECK del pago, para no confundirse con ellos.
DO
$$
    DECLARE
        constraint_estado text;
    BEGIN
        SELECT conname INTO constraint_estado
        FROM pg_constraint
        WHERE conrelid = 'public.cita'::regclass
          AND contype = 'c'
          AND pg_get_constraintdef(oid) ILIKE '%estado%'
        LIMIT 1;

        IF constraint_estado IS NOT NULL THEN
            EXECUTE format('ALTER TABLE public.cita DROP CONSTRAINT %I', constraint_estado);
        END IF;

        ALTER TABLE public.cita
            ADD CONSTRAINT cita_estado_check
                CHECK (estado IN ('pendiente', 'confirmada', 'completada', 'cancelada', 'denegada'));
    END
$$;

-- 2. El pago de la cita
DO
$$
    BEGIN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'cita' AND column_name = 'pago_metodo'
        ) THEN
            ALTER TABLE public.cita ADD COLUMN pago_metodo text;
            ALTER TABLE public.cita ADD COLUMN pago_estado text;
            ALTER TABLE public.cita ADD COLUMN motivo_pago text;
        END IF;

        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cita_pago_metodo_check') THEN
            ALTER TABLE public.cita
                ADD CONSTRAINT cita_pago_metodo_check
                    CHECK (pago_metodo IS NULL OR pago_metodo IN ('efectivo', 'tarjeta', 'pago_movil'));
        END IF;

        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cita_pago_estado_check') THEN
            ALTER TABLE public.cita
                ADD CONSTRAINT cita_pago_estado_check
                    CHECK (pago_estado IS NULL OR pago_estado IN ('pendiente', 'completado', 'rechazado'));
        END IF;
    END
$$;

COMMIT;
