-- Campo opcional para el enlace o referencia de la publicación final.
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS publicacion text;
NOTIFY pgrst, 'reload schema';
