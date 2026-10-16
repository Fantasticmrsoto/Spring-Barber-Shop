-- Migración 010: permitir medias estrellas en las reseñas
--
-- Antes `calificacion` era un entero 1-5. Ahora admite medias estrellas
-- (0.5, 1.0, 1.5, ... 5.0), así que pasa a numeric(2,1) y el CHECK se relaja a
-- "múltiplo de 0.5 dentro de 0.5 y 5". Idempotente.

BEGIN;

ALTER TABLE public.resena
    ALTER COLUMN calificacion TYPE numeric(2,1) USING calificacion::numeric(2,1);

ALTER TABLE public.resena
    DROP CONSTRAINT IF EXISTS resena_calificacion_check;

-- (calificacion * 10) es entero porque numeric(2,1) tiene un solo decimal; el
-- residuo módulo 5 distingue los múltiplos de 0.5 (5, 10, 15, ..., 50).
ALTER TABLE public.resena
    ADD CONSTRAINT resena_calificacion_check
    CHECK (calificacion >= 0.5 AND calificacion <= 5 AND (calificacion * 10)::int % 5 = 0);

COMMIT;
