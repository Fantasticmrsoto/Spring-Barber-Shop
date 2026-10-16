-- Migración 007: perfil público del barbero
--
-- Amplía `barbero` con los datos que el barbero muestra en su perfil y en la
-- landing: una descripción corta, su especialidad, su Instagram, un teléfono de
-- contacto público y la ruta de su foto. Son columnas opcionales (NULL) para no
-- romper los barberos ya existentes.
--
-- Idempotente: usa ADD COLUMN IF NOT EXISTS, así que se puede reaplicar sin
-- efectos duplicados (el runner además solo la ejecuta una vez).

BEGIN;

ALTER TABLE public.barbero
    ADD COLUMN IF NOT EXISTS descripcion  text,
    ADD COLUMN IF NOT EXISTS especialidad text,
    ADD COLUMN IF NOT EXISTS instagram    text,
    ADD COLUMN IF NOT EXISTS telefono     text,
    ADD COLUMN IF NOT EXISTS foto_url     text;

COMMIT;
