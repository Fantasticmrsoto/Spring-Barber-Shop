-- Migración 008: los datos que el panel de administración necesita poder registrar
--
-- Hasta aquí el panel de administración se apoyaba en endpoints que la API no
-- tenía (editar servicios, editar un barbero, registrar un pago de una cita,
-- reseñas, feriados, resumen de métricas) y en columnas que tampoco existían
-- (citas de invitado, ficha del barbero). Esta migración deja el sitio
-- preparado para que todo eso se pueda guardar.
--
-- Todo es idempotente: se puede aplicar sobre una base ya migrada sin que
-- cambie nada.

BEGIN;

-- 1. Citas de invitado (walk-in)
-- ---------------------------------------------------------------------------
-- El panel de administración agenda citas "de invitado" para gente que llega
-- sin cuenta: no hay `usuario` al que apuntar el `clienteID`. Antes la columna
-- era NOT NULL, así que esa cita no se podía guardar.
DO
$$
    BEGIN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'cita' AND column_name = 'es_invitado'
        ) THEN
            ALTER TABLE public.cita
                ADD COLUMN es_invitado boolean NOT NULL DEFAULT false;
            ALTER TABLE public.cita
                ADD COLUMN contacto_nombre text;
            ALTER TABLE public.cita
                ADD COLUMN contacto_telefono text;
            ALTER TABLE public.cita
                ALTER COLUMN "clienteID" DROP NOT NULL;
        END IF;
    END
$$;

-- 2. Ficha pública del barbero
-- ---------------------------------------------------------------------------
-- Descripción, especialidad, Instagram, teléfono de contacto y foto: son los
-- datos que el barbero edita en su panel y que el administrador necesita
-- corregir cuando alguien se equivoca al darlos de alta.
DO
$$
    BEGIN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'barbero' AND column_name = 'descripcion'
        ) THEN
            ALTER TABLE public.barbero ADD COLUMN descripcion text;
            ALTER TABLE public.barbero ADD COLUMN especialidad text;
            ALTER TABLE public.barbero ADD COLUMN instagram text;
            ALTER TABLE public.barbero ADD COLUMN telefono_contacto text;
            ALTER TABLE public.barbero ADD COLUMN foto_url text;
        END IF;
    END
$$;

-- 3. Reseñas
-- ---------------------------------------------------------------------------
-- Una reseña por cliente y barbero: si el mismo cliente vuelve a opinar, se
-- actualiza la que ya dejó en vez de acumular duplicados.
CREATE TABLE IF NOT EXISTS public.resena
(
    "resenaID"      serial                   NOT NULL,
    "barberoID"     integer                  NOT NULL,
    "autorID"       integer                  NOT NULL,
    calificacion    integer                  NOT NULL,
    comentario      text,
    fecha_creacion  timestamp(0) without time zone DEFAULT now() NOT NULL,
    CONSTRAINT resena_pkey PRIMARY KEY ("resenaID"),
    CONSTRAINT resena_calificacion_check CHECK (calificacion BETWEEN 1 AND 5)
);

DO
$$
    BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'resena_barbero_usuario_key') THEN
            ALTER TABLE public.resena
                ADD CONSTRAINT resena_barbero_usuario_key UNIQUE ("barberoID", "autorID");
        END IF;

        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_resena_barbero') THEN
            ALTER TABLE public.resena
                ADD CONSTRAINT fk_resena_barbero FOREIGN KEY ("barberoID")
                    REFERENCES public.barbero ("barberoID") ON UPDATE CASCADE ON DELETE CASCADE;
        END IF;

        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_resena_autor') THEN
            ALTER TABLE public.resena
                ADD CONSTRAINT fk_resena_autor FOREIGN KEY ("autorID")
                    REFERENCES public.usuario ("usuarioID") ON UPDATE CASCADE ON DELETE CASCADE;
        END IF;
    END
$$;

-- 4. Pagos de cita
-- ---------------------------------------------------------------------------
-- La tabla `transacciones` nació como libro de saldo (usuarioID, tipo_movimiento,
-- saldo_restante) y ahí se queda: esos movimientos siguen siendo válidos y la
-- colección de pruebas E2E los usa.
--
-- A la vez, ahora una transacción puede ser el **pago de una cita**: el
-- administrador cobra en el local (efectivo o tarjeta) o el cliente sube un
-- comprobante de pago móvil y el administrador lo aprueba o lo rechaza. De ahí
-- las columnas nuevas. Las del libro de saldo pasan a admitir NULL, porque un
-- pago de cita no tiene saldo ni tipo de movimiento.
DO
$$
    BEGIN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'transacciones' AND column_name = 'citaID'
        ) THEN
            ALTER TABLE public.transacciones ADD COLUMN "citaID" integer;
            ALTER TABLE public.transacciones ADD COLUMN metodo_pago text;
            ALTER TABLE public.transacciones ADD COLUMN estado text NOT NULL DEFAULT 'completado';
            ALTER TABLE public.transacciones ADD COLUMN comprobante_url text;
            ALTER TABLE public.transacciones ADD COLUMN motivo_rechazo text;

            ALTER TABLE public.transacciones ALTER COLUMN "usuarioID" DROP NOT NULL;
            ALTER TABLE public.transacciones ALTER COLUMN tipo_movimiento DROP NOT NULL;
            ALTER TABLE public.transacciones ALTER COLUMN saldo_restante DROP NOT NULL;
        END IF;

        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_transaccion_cita') THEN
            ALTER TABLE public.transacciones
                ADD CONSTRAINT fk_transaccion_cita FOREIGN KEY ("citaID")
                    REFERENCES public.cita ("citaID") ON UPDATE CASCADE ON DELETE CASCADE;
        END IF;

        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'transacciones_estado_check') THEN
            ALTER TABLE public.transacciones
                ADD CONSTRAINT transacciones_estado_check
                    CHECK (estado IN ('pendiente', 'completado', 'rechazado'));
        END IF;

        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'transacciones_metodo_check') THEN
            ALTER TABLE public.transacciones
                ADD CONSTRAINT transacciones_metodo_check
                    CHECK (metodo_pago IS NULL OR metodo_pago IN ('efectivo', 'tarjeta', 'pago_movil'));
        END IF;
    END
$$;

COMMIT;
