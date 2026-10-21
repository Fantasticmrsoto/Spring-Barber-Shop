-- Migración 009: código de gestión de las citas de invitado
--
-- Una cita hecha sin cuenta (alguien que reserva por la web sin registrarse)
-- se gestiona con un código: es el único dato que puede presentar el cliente
-- para ver o cancelar su cita, porque no tiene con qué iniciar sesión.
--
-- El código se guarda en la propia tabla `cita` para que el enlace
-- /cita/<codigo> funcione sin sesión y sin una tabla aparte.
--
-- Las citas de un cliente registrado lo dejan a NULL: se gestionan desde
-- "Mis citas", con su sesión.

BEGIN;

DO
$$
    BEGIN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'cita' AND column_name = 'codigo'
        ) THEN
            ALTER TABLE public.cita ADD COLUMN codigo text;
        END IF;
    END
$$;

-- El código es único entre las citas que lo tienen. El índice es parcial
-- porque las citas de cliente registrado no lo llevan y en PostgreSQL dos
-- NULL no chocan (son distintos), pero un índice único normal tampoco
-- toleraría varios NULLs igual de bien: el parcial lo deja explícito.
CREATE UNIQUE INDEX IF NOT EXISTS cita_codigo_uniq
    ON public.cita (codigo)
    WHERE codigo IS NOT NULL;

COMMIT;
