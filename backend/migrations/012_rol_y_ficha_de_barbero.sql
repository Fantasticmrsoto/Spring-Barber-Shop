-- Migración 012: el rol de barbero y su ficha van juntos
--
-- Antes, dar de alta a alguien desde la pestaña Barberos creaba su ficha pero
-- no tocaba `usuario.rol`: la persona aparecía en la agenda pública y en el
-- panel de administración, pero al iniciar sesión entraba como cliente y no
-- tenía acceso a su panel de barbero.
--
-- Esta migración pone al día las cuentas que ya quedaron descuadradas. A partir
-- de ahora el backend mantiene los dos lados sincronizados (ver
-- barberoController y usuarioController).

BEGIN;

UPDATE public.usuario u
SET rol = 'barbero'
WHERE u.rol = 'cliente'
  AND EXISTS (
    SELECT 1 FROM public.barbero b WHERE b."usuarioID" = u."usuarioID"
  );

COMMIT;
