-- Migración 008: cita de invitado (sin cuenta de usuario)
--
-- Permite agendar sin crear un `usuario`: `clienteID` pasa a ser opcional y el
-- contacto del invitado (nombre y teléfono) se guarda en la propia cita. Así el
-- barbero sabe quién reservó y el invitado no queda registrado.
--
-- Idempotente: DROP NOT NULL es repetible y las columnas usan IF NOT EXISTS.

BEGIN;

ALTER TABLE public.cita
    ALTER COLUMN "clienteID" DROP NOT NULL;

ALTER TABLE public.cita
    ADD COLUMN IF NOT EXISTS contacto_nombre   text,
    ADD COLUMN IF NOT EXISTS contacto_telefono text;

COMMIT;
