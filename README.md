# Parrilla de contenido YUC'ATÅLOVE

Página web (GitHub Pages) para planear el contenido de Instagram de YUC'ATÅLOVE:

- **Parrilla:** tabla con filtros por columna y listas de colores (Día, Semana, Mes, Tipo, Pilar, Status, ¿Cumplió?).
- **Feed:** vista previa de la cuadrícula de Instagram con las imágenes de cada post. Usa los mismos datos que la Parrilla.
- **Resumen:** conteos por semana, tipo, pilar, status y mes.
- **Ajustes:** opciones de las listas y correos del equipo.

Los datos y las imágenes viven en Supabase (proyecto `parrilla-yucatalove`). Solo los correos de la tabla `miembros` pueden ver y editar (políticas RLS).

## Archivos

- `index.html`, `styles.css`, `app.js`: la página.
- `config.js`: URL y clave publicable de Supabase (es pública por diseño; la seguridad está en RLS).
- `lib/supabase.js`: supabase-js 2.45.4 (UMD).
