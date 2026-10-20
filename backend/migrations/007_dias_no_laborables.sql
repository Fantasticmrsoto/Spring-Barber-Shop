-- Migración 007: días no laborables (feriados)
--
-- La peluquería no abre los domingos (día de descanso) ni en los feriados.
-- Los domingos se deducen del día de la semana, pero los feriados hay que
-- guardarlos: cambian cada año y los carnavales y la Semana Santa se mueven
-- según la fecha de Pascua.
--
-- La tabla se rellena con los feriados de Venezuela de 2026 y 2027. Para
-- otros años, se añaden las filas a mano (en el SQL Editor de Neon o con un
-- INSERT). La web los lee de aquí, así que no hay nada más que tocar.
--
-- El campo `tipo` distingue los fijos de los que se mueven con la Pascua.

BEGIN;

-- 1. Tabla de feriados
CREATE TABLE IF NOT EXISTS public.feriado (
    fecha  date PRIMARY KEY,
    nombre text NOT NULL,
    tipo   text NOT NULL DEFAULT 'festivo'
);

-- 2. Restricción de los tipos admitidos
DO
$$
    BEGIN
        IF NOT EXISTS (
            SELECT 1 FROM pg_constraint WHERE conname = 'feriado_tipo_check'
        ) THEN
            ALTER TABLE public.feriado
                ADD CONSTRAINT feriado_tipo_check
                    CHECK (tipo IN ('festivo', 'religioso', 'carnaval'));
        END IF;
    END
$$;

-- 3. Feriados de Venezuela
--
-- 2026: Pascua el 5 de abril → Carnaval 16-17 de febrero, Jueves Santo
-- 2 de abril y Viernes Santo 3 de abril.
-- 2027: Pascua el 28 de marzo → Carnaval 8-9 de febrero, Jueves Santo
-- 25 de marzo y Viernes Santo 26 de marzo.
INSERT INTO public.feriado (fecha, nombre, tipo)
VALUES
    -- Feriados fijos
    ('2026-01-01', 'Año Nuevo', 'festivo'),
    ('2026-04-19', 'Declaración de la Independencia', 'festivo'),
    ('2026-05-01', 'Día del Trabajador', 'festivo'),
    ('2026-06-24', 'Batalla de Carabobo', 'festivo'),
    ('2026-07-05', 'Firma del Acta de Independencia', 'festivo'),
    ('2026-07-24', 'Natalicio de Simón Bolívar', 'festivo'),
    ('2026-10-12', 'Día de la Resistencia Indígena', 'festivo'),
    ('2026-12-25', 'Navidad', 'festivo'),
    ('2027-01-01', 'Año Nuevo', 'festivo'),
    ('2027-04-19', 'Declaración de la Independencia', 'festivo'),
    ('2027-05-01', 'Día del Trabajador', 'festivo'),
    ('2027-06-24', 'Batalla de Carabobo', 'festivo'),
    ('2027-07-05', 'Firma del Acta de Independencia', 'festivo'),
    ('2027-07-24', 'Natalicio de Simón Bolívar', 'festivo'),
    ('2027-10-12', 'Día de la Resistencia Indígena', 'festivo'),
    ('2027-12-25', 'Navidad', 'festivo'),
    -- Carnaval
    ('2026-02-16', 'Carnaval (lunes)', 'carnaval'),
    ('2026-02-17', 'Carnaval (martes)', 'carnaval'),
    ('2027-02-08', 'Carnaval (lunes)', 'carnaval'),
    ('2027-02-09', 'Carnaval (martes)', 'carnaval'),
    -- Semana Santa
    ('2026-04-02', 'Jueves Santo', 'religioso'),
    ('2026-04-03', 'Viernes Santo', 'religioso'),
    ('2027-03-25', 'Jueves Santo', 'religioso'),
    ('2027-03-26', 'Viernes Santo', 'religioso')
ON CONFLICT (fecha) DO NOTHING;

COMMIT;
