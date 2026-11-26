# SEO avanzado: revisión y despliegue

## Pruebas
- Ejecutar `node --test tests/seo.test.cjs` desde la raíz.
- En un entorno de pruebas de la app, abrir un blog, comprobar el análisis EN/ES, guardar y volver a abrir. Verificar que no se añaden campos avanzados a publicaciones de otros tipos.
- Registrar dos versiones de un artículo, guardar y reabrir para comprobar el historial.
- Probar la función existente `ia` con cada botón; revisar los textos antes de aplicar.
- Desplegar la versión de `herramientas/funcion-wp.ts` como función `wp` de Supabase en un entorno de pruebas. No copiar secretos al repositorio.
- Con sesión de administrador, consultar la auditoría y comprobar los totales, enlaces y cobertura contra WordPress. La función no modifica contenido en esta operación.
- Probar el envío de metadatos en un borrador desechable, con y sin la opción explícita de envío. Verificar los valores REST y la salida SEO al publicar únicamente en el entorno de pruebas. El endpoint de Yoast es de lectura; si el WordPress no expone los campos meta mediante REST, se reportarán como pendientes. No activar noindex en contenido real para probar.
- Verificar que la versión de la PWA carga el nuevo módulo y revisar el constructor en móvil y escritorio.

## Límites
El grafo consulta hasta 300 entradas y 300 páginas publicadas mediante REST. No incluye menú, otros tipos de contenido o contenido renderizado por JavaScript. Los enlaces entrantes ausentes son candidatos a contenido huérfano, no un diagnóstico definitivo.
Las métricas lingüísticas son heurísticas; no equivalen a las puntuaciones de Yoast ni a posiciones en Google. Las instantáneas guardan métricas editoriales, no aprendizaje autónomo ni datos de rendimiento real.
El envío avanzado es opt-in, solo para borradores, y no limpia valores vacíos ni elimina un noindex existente. Schema y redirecciones permanecen propuestas; no se emiten ni ejecutan. No hay integración de Search Console ni seguimiento de conversiones.
No fusionar ni desplegar en producción hasta completar estas pruebas.
