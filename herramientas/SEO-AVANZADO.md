# SEO avanzado del constructor de blogs: estado, pruebas y activación

Rama `feature/seo-intelligence` · PR #1 (borrador). **Nada de esto está en `main` ni desplegado.**
Última revisión: 26 de noviembre de 2026.

## 1. Qué hay y en qué estado está

«Probado» significa con pruebas que se pueden repetir (sección 3). «Simulado» significa que el servicio externo
(WordPress, Google, la IA) se imitó en la prueba: falta verlo contra el servicio real.

| Pieza | Código | Probado | Configurado | Desplegado | A la vista en la app |
|---|---|---|---|---|---|
| Frases clave, plurales y sinónimos | sí | sí (Node + navegador) | no requiere | no | sí |
| Legibilidad (Flesch, frases largas, transiciones, voz pasiva) | sí | sí (Node + navegador) | no requiere | no | sí |
| Enlaces internos con los artículos de la parrilla y misma palabra clave | sí | sí (navegador) | no requiere | no | sí |
| Vista previa en redes | sí | sí (navegador) | no requiere | no | sí |
| Schema JSON-LD (ver, copiar, descargar) | sí | sí (Node + navegador) | no requiere | no | sí |
| Historial de versiones del análisis | sí | sí (navegador) | no requiere | no | sí |
| Auditoría de enlaces del sitio publicado (`wp` → `auditoria_seo`) | sí | simulado | usa la conexión de WordPress | no | apagado (`auditoria`) |
| Enviar a WordPress redes, canónica y noindex (`wp` → `metaAvanzada`) | sí | simulado | el sitio hoy no deja escribir esos campos | no | apagado (`meta`) |
| Google Search Console (`gsc`) | sí | simulado (firma verificada) | falta cuenta de servicio y propiedad | no | apagado (`gsc`) |
| Asistente editorial (6 botones) | solo el lado de la app | simulado | falta clave de IA | falta la acción `seo` en `ia` | apagado (`ia`) |

No hay equivalencia con Yoast SEO Premium: no existen redirecciones reales, lematización completa, análisis
semántico, sitemap/robots/IndexNow, ni aprendizaje automático. El historial guarda indicadores editoriales del texto;
no mide posiciones ni conversiones.

## 2. Cómo está armado

- `seo-advanced.js` tiene dos mitades. El **motor** (`analyze`, `occurrences`, `articleSchema`, `metricDelta`, `stem`)
  no toca la página y se exporta para Node. El **panel** se inserta en `#seo-box`, después de la lista de revisión y
  antes de «Pasarlo a WordPress», plegado de inicio (recuerda en el navegador si se abrió).
- `app.js` es privado (todo va dentro de una función), así que el módulo **no puede** usar sus funciones directamente:
  así venía escrito y por eso fallaba al cargar con `seoLeer is not defined`. Ahora `app.js` publica un puente mínimo,
  `window.APPCONTYL_SEO`, y llama al módulo desde tres ganchos: `seoLeer` (qué guardar), `seoCargar` (al abrir un
  artículo) y `seoPintar` (al repintar). El módulo se registra con `APPCONTYL_SEO.registrar({ leer, cargar, pintar })`.
- Si `seo-advanced.js` no carga o lanza un error, el editor sigue funcionando y lo que hubiera en `posts.seo.advanced`
  se guarda tal cual (no se pierde). Probado en los dos casos.
- Datos: `posts.seo.advanced`, solo en posts de tipo Blog y solo con lo que tiene valor (un blog que no usa el panel
  no guarda nada extra). Claves: `lang`, `syn0`, `kw1..4`, `syn1..4`, `cornerstone`, `socialTitle`,
  `socialDescription`, `socialImage`, `schema`, `schemaImage`, `publishedDate`, `modifiedDate`, `canonical`,
  `oldSlug`, `applyMeta`, `noindex`, `experiments` (máx. 20). Las claves que el panel no conoce se conservan.
- Todo dato externo (títulos de WordPress, consultas de Google, respuestas de IA) se pinta como texto; las direcciones
  solo se usan si son `http(s)`. No se usa `innerHTML`.
- Interruptores en `config.js`: `window.APPCONTYL_SEO_ACTIVO = { ia, auditoria, gsc, meta }`, todos en `false`.
  Se encienden uno por uno cuando su parte del servidor esté desplegada y probada. `auditoria` y `gsc` además solo
  se muestran a quien administra (sus funciones rechazan a los demás).

## 3. Pruebas

```bash
node --test tests/seo.test.cjs        # 33 pruebas: motor, grafo, Schema, auditoría, metadatos y función gsc completa
```

- Motor: plurales en español e inglés, posesivos, raíces nunca vacías, frases por bloque, transiciones con acento,
  rango de Flesch, entradas incompletas. Con el motor original fallaban 7 de las 9 pruebas nuevas.
- `auditarSitio` y `metaAvanzada` con un WordPress simulado: lectura completa, fallo a media lectura, tiempo agotado,
  sin totales, tope de páginas, casilla sin marcar, borrador, entrada ya publicada, WordPress que no expone los
  campos (el caso del sitio hoy), direcciones inválidas.
- `gsc` completa con Supabase y Google simulados: el canje de token verifica la firma RS256 con la llave pública;
  permiso de solo lectura; página exacta; periodos iguales; sin filas no inventa ceros; sin sesión, sin administrar
  o con una URL de otra propiedad no llega a Google; los errores no dejan salir secretos. La firma también se
  comprobó corriendo la función en Deno.
- El envío normal a WordPress no cambió: las 17 situaciones del envío dan la misma salida que la función publicada.
- Navegador, con un simulador de Supabase: 40 comprobaciones en Chrome (carga sin errores, análisis, guardar y
  reabrir, otros tipos de post intactos, módulo ausente o roto, respuestas simuladas del servidor, respuesta tardía
  que no se pinta en otro artículo, celular) y los mismos recorridos en WebKit (motor de Safari), escritorio y
  celular, sin errores. Regresión general de la app (parrilla, feed, comentarios, editor y página del blog): misma
  salida que antes. Costo por repintado con 8 000 palabras y 80 blogs: 1 ms con el panel plegado, 15–17 ms abierto.
  El simulador y esos guiones no están en el repositorio (llevan datos de prueba del equipo).

**Sin probar:** nada se ha ejecutado contra el WordPress real, Google real, la IA real ni el proyecto de Supabase;
tampoco en los dispositivos del equipo ni con la PWA instalada y su caché anterior.

## 4. Límites conocidos

- El reconocimiento de plurales es aproximado (no hay lematizador): por ejemplo «bus/buses» o «taxi/taxis» no
  coinciden. La densidad usa el máximo entre la frase y sus sinónimos, no la suma.
- Flesch (inglés) y Fernández Huerta (español) se calculan sobre los párrafos con un conteo de sílabas aproximado.
  Los umbrales (25 % de frases largas, 30 % de transiciones, 10 % de voz pasiva, párrafos de 150 palabras) son guías
  editoriales públicas, no la puntuación de Yoast.
- La lista de revisión de arriba (la original) compara la palabra clave de forma literal; el panel acepta plurales y
  sinónimos. Pueden no coincidir. Unificarlas es un paso pendiente.
- Enlaces internos y «misma palabra clave» miran los artículos que hay en la parrilla, no lo publicado.
- Auditoría: hasta 300 entradas y 300 páginas publicadas, de 50 en 50, con tope de tiempo. Solo cuenta enlaces dentro
  del contenido (sin menús ni otros tipos de contenido). Un artículo «sin enlaces entrantes» es un candidato, no un
  diagnóstico. Falta medir cuánto tarda el sitio real en responder.
- Metadatos avanzados: el WordPress del sitio solo expone `footnotes` en `meta`, así que hoy **no** se pueden
  escribir los campos de Yoast (ni título SEO, descripción y palabra clave, ni redes, canónica o noindex). Para
  habilitarlo hace falta registrar esas claves para la API en WordPress (un plugin pequeño), con autorización.
  El envío no borra valores ni quita un noindex anterior.
- Schema: solo vista y exportación (`BlogPosting`, `Article` o `NewsArticle`) con el título, el autor, el idioma y
  lo que se haya escrito. Las fechas son manuales y opcionales: no se inventan. La dirección sale de la canónica, de
  la entrada ya publicada o, si no hay ninguna, del slug (provisional hasta publicar). La imagen debe ser pública, no
  un enlace temporal. Conviene revisar el JSON-LD exportado con Rich Results Test. En el sitio el Schema lo genera
  Yoast: no se inserta un segundo grafo; si se quiere usar estos valores, se integran al de Yoast tras revisar su
  salida.
- Asistente: la función `ia` desplegada solo conoce `caption`, `pulir_caption`, `pulir_idea`, `hooks` e `ideas`, con
  la voz de Instagram, y recorta el texto a 2 500 caracteres; además no hay clave de IA configurada. El panel ya no
  usa `pulir_caption`: pide `accion: "seo"` con `tarea` (`meta`, `mejoras`, `resumen`, `plan`, `inclusivo`, `alt`),
  `idioma`, `frases` y `post { tipo, copy, caption (hasta 24 000), alts }`, y espera `{ opciones: [texto, …] }`.
  Esa acción hay que escribirla en `ia` antes de encender el interruptor.

## 5. Activar cada parte (siempre con autorización; primero en un borrador o propiedad de prueba)

**Auditoría del sitio.** Desplegar `herramientas/funcion-wp.ts` como función `wp` (ver la nota de abajo sobre la
versión), consultar con sesión de quien administra y comparar totales y enlaces contra WordPress. Luego
`auditoria: true`.

**Metadatos avanzados.** Primero habilitar en WordPress la escritura de las claves `_yoast_wpseo_*` por la API.
Probar en un borrador desechable, con y sin la casilla; revisar la salida pública al publicar en pruebas. No usar
noindex en contenido real para probar. Luego `meta: true`.

**Google Search Console.**
1. En Google Cloud, habilitar Search Console API y crear una cuenta de servicio dedicada. En Search Console, el
   propietario la agrega como usuario con acceso de lectura a la propiedad.
2. Guardar solo en los secretos de las funciones de Supabase: `GSC_SERVICE_ACCOUNT_JSON` (el JSON de la cuenta) y
   `GSC_SITE_URL` (identificador exacto: `sc-domain:yucatanlove.com` si es propiedad de dominio, o el prefijo de URL
   verificado). Nunca en chats, en el navegador ni en Git; si se expone, revocar la clave.
3. Desplegar `supabase/functions/gsc/index.ts` como función `gsc`. Solo lee (permiso `webmasters.readonly`) y
   comprueba ella misma la sesión con `es_admin`. Sobre la verificación previa de Supabase (`verify_jwt`): según su
   documentación solo entiende las llaves anteriores, así que con las llaves nuevas del proyecto puede rechazar
   sesiones válidas. No se ha probado en este proyecto (ninguna función ha recibido llamadas todavía): probar primero
   con ella activa y, si rechaza a quien administra, desplegar sin ella, que la comprobación del código basta.
4. Probar con quien administra, con otra persona del equipo (debe rechazar), con una URL de otra propiedad (debe
   rechazar), con una URL válida y con una sin datos, en 7, 28 y 90 días. Comparar las cifras con Search Console para
   las mismas fechas. La ventana termina tres días antes de hoy (UTC) y pide datos finales.
5. Luego `gsc: true`. La serie diaria ya llega del servidor pero todavía no se grafica.

**Asistente.** Escribir y desplegar la acción `seo` en `ia`, configurar la clave de IA en los secretos y probar cada
botón con artículos largos. Luego `ia: true`.

## 6. Cruce con el botón «Enviar a WordPress» (v49, pendiente de publicar)

Existe una versión nueva de la función `wp` y del cuadro de WordPress, aún sin publicar, que cambia dos cosas que
esta rama usa:

- La función `wp` se reescribió (la conexión se guarda cifrada, envía cualquiera del equipo, puede publicar si se
  autoriza, y un artículo ya publicado no se modifica con un envío normal). `auditarSitio` y `metaAvanzada` están
  aquí como funciones sueltas y probadas justamente para llevarlas tal cual a esa versión.
- Dónde quedó cada artículo ya no vive en `posts.wp` sino en la tabla `wp_envios`. En esta rama, lo único que lo
  usa es `APPCONTYL_SEO.urlPublicada()` en `app.js` (una línea por adaptar).

Orden recomendado: publicar primero el botón de WordPress, traer `main` a esta rama y resolver esos dos puntos antes
de pensar en fusionarla.

## 7. Antes de fusionar

- [ ] Autorización para publicar el panel (lo que no depende del servidor) y decidir si entra plegado como está.
- [ ] Traer `main` con el botón de WordPress y adaptar los dos puntos de la sección 6.
- [ ] Probar en los dispositivos del equipo y con la PWA ya instalada (caché anterior → nueva).
- [ ] Decidir si la lista de revisión original debe aceptar plurales y sinónimos como el panel.
- [ ] Lo del servidor entra después, una pieza a la vez, siguiendo la sección 5.
