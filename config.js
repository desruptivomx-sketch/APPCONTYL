// Datos públicos del proyecto de Supabase (la clave publicable es segura en el navegador;
// la seguridad la dan las políticas RLS: solo los correos de la tabla "miembros" ven y editan).
window.PARRILLA_CONFIG = {
  supabaseUrl: "https://pgqwzusyrsjjdofucrkr.supabase.co",
  supabaseKey: "sb_publishable_-DW2d3pas3Defvbf9hdTWw_rshEqe6i",
  bucket: "imagenes"
};

// SEO avanzado del blog (seo-advanced.js). Lo que depende del servidor viene apagado y se enciende aquí, una por una,
// cuando su parte ya esté desplegada y probada (ver herramientas/SEO-AVANZADO.md):
//   ia        → asistente editorial (función "ia" con su acción "seo" y una clave de IA)
//   auditoria → enlaces del sitio publicado (función "wp" con "auditoria_seo")
//   gsc       → Google Search Console (función "gsc" con su cuenta de servicio)
//   meta      → enviar a WordPress redes, canónica y noindex (el sitio debe permitir escribir esos campos de Yoast)
window.APPCONTYL_SEO_ACTIVO = { ia: false, auditoria: false, gsc: false, meta: false };
