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
El envío avanzado es opt-in, solo para borradores, y no limpia valores vacíos ni elimina un noindex existente. Schema y redirecciones permanecen propuestas; no se emiten ni ejecutan. La integración de Search Console está preparada en código, pero requiere autorización y despliegue. No hay seguimiento de conversiones.
No fusionar ni desplegar en producción hasta completar estas pruebas.

## Activar Google Search Console y Schema
1. En Google Cloud, habilitar Search Console API y crear una cuenta de servicio dedicada. En Search Console, el propietario de la propiedad añade el correo de la cuenta de servicio como usuario con acceso de lectura suficiente. Usar el identificador exacto de la propiedad (por ejemplo, `sc-domain:yucatanlove.com` si existe una propiedad de dominio, o el prefijo URL verificado).
2. Guardar exclusivamente en Supabase Edge Function Secrets: `GSC_SERVICE_ACCOUNT_JSON` (JSON de la cuenta de servicio) y `GSC_SITE_URL` (propiedad). No pegar las claves en chats, archivos del frontend ni Git. Rotar/revocar la clave si se expone.
3. Desplegar `supabase/functions/gsc/index.ts` como Edge Function `gsc` en el proyecto de pruebas, con verificación JWT activa. La función verifica también el RPC existente `es_admin`. Usa OAuth 2.0 con scope webmasters.readonly. Nunca realiza modificaciones a Search Console.
4. Desde un artículo, introducir su URL pública exacta, consultar 7/28/90 días y comprobar contra Search Console. La ventana termina tres días antes del día UTC actual para reducir retrasos; se solicitan datos finales. Verificar también que una sesión no administradora es rechazada, y que URLs fuera de la propiedad son rechazadas.
5. El generador Schema crea Article, BlogPosting o NewsArticle con título real, autor seleccionado, idioma y campos aportados. Las fechas de publicación y modificación son manuales y opcionales; no se inventan. La URL de slug es provisional hasta verificar publicación. Usar imágenes públicas, no URLs firmadas temporales. Exportar JSON-LD y revisar con Rich Results Test. Si Yoast ya genera un grafo de Article, no insertar un segundo grafo automáticamente; integrar los valores con el grafo existente en WordPress después de revisar su salida.
6. Ejecutar `node --test tests/seo.test.cjs`; comprobar interfaz, exportación, permisos y respuestas reales de Google. No hay conexión de producción hasta completar estos pasos.
