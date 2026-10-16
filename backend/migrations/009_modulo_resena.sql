-- Migración 009: reseñas de clientes sobre los barberos
--
-- Un cliente autenticado puede dejar una calificación (1-5 estrellas) y un
-- comentario sobre un barbero. Solo se permite si el cliente ya tuvo una cita
-- completada con ese barbero (la lógica vive en el controlador).
--
-- Una reseña por usuario y barbero: al reenviarla se actualiza la existente
-- (ON CONFLICT ... DO UPDATE). Idempotente.

BEGIN;

CREATE TABLE IF NOT EXISTS public.resena
(
    "resenaID"       serial                       NOT NULL,
    "barberoID"      integer                      NOT NULL,
    "usuarioID"      integer                      NOT NULL,
    calificacion     integer                      NOT NULL,
    comentario       text,
    fecha_creacion   timestamp(0) without time zone DEFAULT now() NOT NULL,
    CONSTRAINT resena_pkey PRIMARY KEY ("resenaID")
);

-- Comprobar que no haya datos huérfanos antes de crear las FKs (la tabla es nueva,
-- así que normalmente está vacía, pero deja la migración segura sobre una base
-- donde ya existiera `resena`).
DO
$$
    DECLARE
        huerfanos text;
    BEGIN
        SELECT string_agg(origen, ', ') INTO huerfanos
        FROM (
            SELECT 'resena.barberoID -> barbero' AS origen
            WHERE EXISTS (SELECT 1 FROM resena r LEFT JOIN barbero b ON r."barberoID" = b."barberoID" WHERE b."barberoID" IS NULL)
            UNION ALL
            SELECT 'resena.usuarioID -> usuario'
            WHERE EXISTS (SELECT 1 FROM resena r LEFT JOIN usuario u ON r."usuarioID" = u."usuarioID" WHERE u."usuarioID" IS NULL)
        ) h;

        IF huerfanos IS NOT NULL THEN
            RAISE EXCEPTION 'Datos huérfanos que impiden crear las FKs: %', huerfanos;
        END IF;
    END
$$;

DO
$$
    BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_resena_barbero') THEN
            ALTER TABLE public.resena
                ADD CONSTRAINT fk_resena_barbero FOREIGN KEY ("barberoID")
                    REFERENCES public.barbero ("barberoID") ON UPDATE CASCADE ON DELETE CASCADE;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_resena_usuario') THEN
            ALTER TABLE public.resena
                ADD CONSTRAINT fk_resena_usuario FOREIGN KEY ("usuarioID")
                    REFERENCES public.usuario ("usuarioID") ON UPDATE CASCADE ON DELETE CASCADE;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'resena_calificacion_check') THEN
            ALTER TABLE public.resena
                ADD CONSTRAINT resena_calificacion_check CHECK (calificacion BETWEEN 1 AND 5);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'resena_barbero_usuario_key') THEN
            ALTER TABLE public.resena
                ADD CONSTRAINT resena_barbero_usuario_key UNIQUE ("barberoID", "usuarioID");
        END IF;
    END
$$;

CREATE INDEX IF NOT EXISTS resena_barbero_idx ON public.resena ("barberoID");

COMMIT;
