/*
 * A dónde va cada rol después de iniciar sesión.
 *
 * Cada tipo de usuario entra a su panel: el administrador al de administración
 * (es donde trabaja) y el barbero a su agenda. El cliente va a la página que
 * intentaba abrir o, si no venía de ninguna, a la portada.
 *
 * Vive aparte del componente de login para que el archivo solo exporte
 * componentes y el recarga en caliente del navegador siga funcionando.
 */
export function destinoDe(perfil, desde) {
  if (perfil?.rol === 'administrador') return '/admin'
  if (perfil?.rol === 'barbero') return '/barbero'
  return desde || '/'
}
