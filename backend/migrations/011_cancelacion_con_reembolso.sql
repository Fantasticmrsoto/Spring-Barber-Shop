-- Migración 011: cancelación de cita con reembolso
--
-- El cliente ya no cancela la cita directamente: solicita la cancelación y la
-- peluquería revisa el reembolso.
--
--   - Al solicitarlo, la cita pasa a "cancelacion_solicitada" y **el espacio
--     queda libre** (no bloquea la agenda del barbero).
--   - El administrador confirma el reembolso -> la cita queda "cancelada".
--   - El administrador rechaza la solicitud -> la cita vuelve a estar en pie.
--
-- Se guardan el motivo que puso el cliente, la fecha de la solicitud y la del
-- reembolso, para que el panel pueda mostrar de qué se trata.

BEGIN;

-- 1. El estado "cancelacion_solicitada" en la cita
-- ---------------------------------------------------------------------------
-- Como en la migración 010, el CHECK viejo se sustituye en vez de añadir otro
-- más: una fila solo puede tener un CHECK de estados.
--
-- Se busca por su definición y no por su nombre, porque el nombre puede haber
-- cambiado (la migración 001 lo llamó `cita_estado_check`, pero una base creada
-- a mano puede tener otro).
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
                CHECK (estado IN ('pendiente', 'confirmada', 'completada', 'cancelada',
                                  'denegada', 'cancelacion_solicitada'));
    END
$$;

-- 2. Los datos de la solicitud
DO
$$
    BEGIN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'cita' AND column_name = 'cancelacion_motivo'
        ) THEN
            ALTER TABLE public.cita ADD COLUMN cancelacion_motivo text;
            ALTER TABLE public.cita ADD COLUMN cancelacion_solicitada_en timestamp without time zone;
            ALTER TABLE public.cita ADD COLUMN cancelacion_reembolsada boolean DEFAULT false;
            ALTER TABLE public.cita ADD COLUMN cancelacion_reembolsada_en timestamp without time zone;
            ALTER TABLE public.cita ADD COLUMN cancelacion_rechazada_motivo text;
        END IF;
    END
$$;

COMMIT;
