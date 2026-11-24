// @ts-nocheck
// APPCONTYL → WordPress. Envía un artículo del blog como BORRADOR (o actualiza el que ya se había enviado).
// Qué hace: sube las fotos del artículo a la biblioteca de WordPress, arma el texto con bloques estándar
// (títulos, párrafos, listas, citas, imágenes, galerías, botones, líneas), pone portada, URL, extracto,
// categoría y etiquetas, y deja el artículo como borrador para revisarlo y publicarlo desde WordPress.
// Nunca publica por su cuenta: al crear usa "draft"; al actualizar no toca el estado que tenga en WordPress.
// Secretos (Supabase → Edge Functions → Secrets): WP_USER y WP_APP_PASSWORD (la clave de aplicación de ese usuario).
// WP_URL es opcional: si no se guarda, se usa el sitio de la marca (SITIO).
// Solo quien administra la parrilla puede usarla (se comprueba con su sesión).

const SITIO = "https://www.yucatanlove.com";
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const sinEnt = (s) => String(s ?? "").replace(/&amp;/g, "&").replace(/&#0?38;/g, "&").replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
const URL_OK = /^(https?:\/\/|mailto:|tel:)[^\s"<>]*$/i;
const slug = (s) => String(s || "").normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 90);

// Texto dentro de un bloque: solo pasan <strong> <em> <br> y <a href="…"> con dirección válida.
// Cualquier otra cosa que parezca etiqueta se convierte en texto: nada guardado llega a WordPress como código.
export function limpio(x) {
  let abiertos = 0;
  return String(x ?? "").split(/(<\/?(?:strong|em)>|<br>|<\/a>|<a href="[^"<>]*">)/).map((t, i) => {
    if (i % 2 === 0) return t.replace(/</g, "&lt;").replace(/>/g, "&gt;");      // texto: lo que parezca etiqueta se queda como texto
    if (t.startsWith("<a ")) { const h = sinEnt(t.slice(9, -2)); if (!URL_OK.test(h)) return ""; abiertos++; return `<a href="${esc(h)}">`; }
    if (t === "</a>") { if (!abiertos) return ""; abiertos--; }                  // un cierre sin su enlace se descarta
    return t;
  }).join("");
}
const plano = (x) => sinEnt(String(x ?? "").replace(/<br>/g, " ").replace(/<[^>]*>/g, ""));

// Bloques de la app → marcado de bloques de WordPress. media: ruta de la foto → { id, url } ya subida.
export function aWordPress(cuerpo, media) {
  const out = [];
  const imagen = (i, extra, pie) => {
    const attrs = { id: i.id, ...(extra.width ? { width: extra.width } : {}), sizeSlug: "large", linkDestination: "none", ...(extra.align ? { align: extra.align } : {}) };
    return `<!-- wp:image ${JSON.stringify(attrs)} -->\n<figure class="wp-block-image${extra.align ? " align" + extra.align : ""} size-large${extra.width ? " is-resized" : ""}"><img src="${esc(i.url)}" alt="${esc(i.alt)}" class="wp-image-${i.id}"${extra.width ? ` style="width:${extra.width}"` : ""}/>${pie ? `<figcaption class="wp-element-caption">${esc(pie)}</figcaption>` : ""}</figure>\n<!-- /wp:image -->`;
  };
  for (const b of Array.isArray(cuerpo) ? cuerpo : []) {
    if (!b || typeof b !== "object") continue;
    if (b.t === "p") out.push(`<!-- wp:paragraph -->\n<p>${limpio(b.x)}</p>\n<!-- /wp:paragraph -->`);
    else if (b.t === "h") { const n = Math.min(4, Math.max(1, parseInt(b.n, 10) || 2)); out.push(`<!-- wp:heading${n === 2 ? "" : ` {"level":${n}}`} -->\n<h${n} class="wp-block-heading">${limpio(b.x)}</h${n}>\n<!-- /wp:heading -->`); }
    else if (b.t === "ul" || b.t === "ol") out.push(`<!-- wp:list${b.t === "ol" ? ' {"ordered":true}' : ""} -->\n<${b.t} class="wp-block-list">${(b.items || []).map((x) => `<!-- wp:list-item -->\n<li>${limpio(x)}</li>\n<!-- /wp:list-item -->`).join("\n\n")}</${b.t}>\n<!-- /wp:list -->`);
    else if (b.t === "cita") out.push(`<!-- wp:quote -->\n<blockquote class="wp-block-quote"><!-- wp:paragraph -->\n<p>${limpio(b.x)}</p>\n<!-- /wp:paragraph --></blockquote>\n<!-- /wp:quote -->`);
    else if (b.t === "hr") out.push(`<!-- wp:separator -->\n<hr class="wp-block-separator has-alpha-channel-opacity"/>\n<!-- /wp:separator -->`);
    else if (b.t === "btn" && String(b.x || "").trim()) { const h = URL_OK.test(b.href || "") ? b.href : ""; out.push(`<!-- wp:buttons {"layout":{"type":"flex","justifyContent":"center"}} -->\n<div class="wp-block-buttons"><!-- wp:button -->\n<div class="wp-block-button"><a class="wp-block-button__link wp-element-button"${h ? ` href="${esc(h)}"` : ""}>${esc(b.x)}</a></div>\n<!-- /wp:button --></div>\n<!-- /wp:buttons -->`); }
    else if (b.t === "img") {
      const imgs = (b.imgs || []).filter((i) => i && media[i.src]).map((i) => ({ ...media[i.src], alt: String(i.alt || "") })).slice(0, 3);
      if (imgs.length === 1) out.push(imagen(imgs[0], b.w === "m" ? { width: "560px", align: "center" } : b.w === "ch" ? { width: "340px", align: "center" } : {}, b.pie));
      else if (imgs.length > 1) out.push(`<!-- wp:gallery {"columns":${imgs.length},"linkTo":"none"} -->\n<figure class="wp-block-gallery has-nested-images columns-${imgs.length} is-cropped">${imgs.map((i) => imagen(i, {}, "")).join("\n\n")}${b.pie ? `<figcaption class="blocks-gallery-caption wp-element-caption">${esc(b.pie)}</figcaption>` : ""}</figure>\n<!-- /wp:gallery -->`);
    }
  }
  return out.join("\n\n");
}
const fotosDe = (cuerpo) => (Array.isArray(cuerpo) ? cuerpo : []).flatMap((b) => b && b.t === "img" ? (b.imgs || []).map((i) => ({ src: i && i.src, alt: String((i && i.alt) || "") })).filter((i) => typeof i.src === "string" && /^[\w./-]+$/.test(i.src) && !i.src.includes("..")) : []);
const TIPOS = { webp: "image/webp", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", gif: "image/gif", avif: "image/avif" };
const errWP = (d, r) => d && d.code === "incorrect_password" || r.status === 401 ? "WordPress no aceptó el usuario o la clave de aplicación. Revisa los datos guardados en Supabase."
  : r.status === 403 ? "Ese usuario de WordPress no tiene permiso para esto (necesita ser Editor o Administrador)."
  : r.status === 404 ? "WordPress no respondió en la dirección del sitio (puede que un plugin de seguridad esté bloqueando su API)."
  : `WordPress respondió con un error (${(d && d.message) || r.status}).`;

export async function manejar(req, env) {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Método no permitido" }, 405);
  try {
    const SB = String(env("SUPABASE_URL") || "").replace(/\/+$/, ""), ANON = env("SUPABASE_ANON_KEY") || "", auth = req.headers.get("Authorization") || "";
    const sb = (ruta, init = {}) => fetch(SB + ruta, { ...init, headers: { apikey: ANON, Authorization: auth, ...(init.body ? { "Content-Type": "application/json" } : {}), ...(init.headers || {}) } });
    // 1) Solo quien administra
    const ra = await sb("/rest/v1/rpc/es_admin", { method: "POST", body: "{}" });
    if (!ra.ok || (await ra.json().catch(() => false)) !== true) return json({ error: "Solo quien administra la parrilla puede enviar artículos a WordPress." }, 403);
    const b = await req.json().catch(() => ({}));
    // 2) Conexión con WordPress
    const WP = String(env("WP_URL") || SITIO).trim().replace(/\/+$/, ""), U = String(env("WP_USER") || "").trim(), P = String(env("WP_APP_PASSWORD") || "").trim();
    if (!U || !P) return json({ sin_conexion: true, error: "Falta conectar WordPress: guarda WP_USER y WP_APP_PASSWORD en los secretos de Supabase." }, 503);
    if (!/^https:\/\//i.test(WP)) return json({ error: "WP_URL debe empezar con https://" }, 400);
    const cred = "Basic " + btoa(unescape(encodeURIComponent(U + ":" + P)));
    const wp = (ruta, init = {}) => fetch(WP + "/wp-json/wp/v2" + ruta, { ...init, headers: { Authorization: cred, Accept: "application/json", ...(init.headers || {}) } });
    const wpJson = (ruta, cuerpo) => wp(ruta, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cuerpo) });
    if (b.accion === "estado") {
      const r = await wp("/users/me?context=edit"); const d = await r.json().catch(() => ({}));
      if (!r.ok) return json({ conectado: false, error: errWP(d, r) });
      const c = d.capabilities || {};
      return json({ conectado: true, usuario: d.name || U, sitio: WP, puede: { borradores: !!c.edit_posts, fotos: !!c.upload_files, publicar: !!c.publish_posts } });
    }
    if (b.accion !== "enviar") return json({ error: "Acción no válida" }, 400);
    // 3) El artículo
    const id = String(b.post_id || ""); if (!/^[0-9a-f-]{36}$/i.test(id)) return json({ error: "Falta el post" }, 400);
    const rp = await sb(`/rest/v1/posts?id=eq.${id}&select=id,tipo,copy,caption,fecha,imagen_path,cuerpo,seo,wp`);
    const post = rp.ok ? (await rp.json())[0] : null;
    if (!post) return json({ error: "No se encontró el post." }, 404);
    if (post.tipo !== "Blog") return json({ error: "Solo los posts de tipo Blog se envían a WordPress." }, 400);
    const seo = post.seo || {}, cuerpo = Array.isArray(post.cuerpo) ? post.cuerpo : [];
    const titulo = String(post.copy || seo.titulo || "").trim();
    if (!titulo) return json({ error: "Al artículo le falta el título." }, 400);
    if (!cuerpo.length) return json({ error: "El artículo todavía no tiene texto guardado." }, 400);
    const previo = post.wp && typeof post.wp === "object" ? post.wp : {}, media = { ...(previo.media || {}) }, avisos = [];
    const base = String(seo.slug || slug(titulo) || "articulo");
    // 4) Fotos: las que aún no están en WordPress se bajan del almacenamiento de la app y se suben a su biblioteca
    const fotos = fotosDe(cuerpo); if (post.imagen_path && /^[\w./-]+$/.test(post.imagen_path) && !post.imagen_path.includes("..")) fotos.unshift({ src: post.imagen_path, alt: String(seo.alt || ""), portada: true });
    let subidas = 0, n = 0;
    for (const f of fotos) {
      n++; if (media[f.src] && media[f.src].id && media[f.src].url) continue;
      const rf = await sb(`/storage/v1/object/authenticated/${env("BUCKET") || "imagenes"}/${f.src.split("/").map(encodeURIComponent).join("/")}`);
      if (!rf.ok) { avisos.push(`No se pudo leer una foto del artículo (${f.portada ? "portada" : "imagen " + (n - (post.imagen_path ? 1 : 0))}).`); continue; }
      const bytes = new Uint8Array(await rf.arrayBuffer()), ext = (f.src.split(".").pop() || "jpg").toLowerCase();
      const nombre = `${base}-${f.portada ? "portada" : String(n).padStart(2, "0")}.${ext}`;
      const ru = await wp("/media", { method: "POST", headers: { "Content-Type": TIPOS[ext] || rf.headers.get("Content-Type") || "image/jpeg", "Content-Disposition": `attachment; filename="${nombre}"` }, body: bytes });
      const du = await ru.json().catch(() => ({}));
      if (!ru.ok || !du.id) { if (ru.status === 401 || ru.status === 403) return json({ error: errWP(du, ru) }, 502); avisos.push(`WordPress no aceptó una foto (${du.message || ru.status}).`); continue; }
      media[f.src] = { id: du.id, url: du.source_url }; subidas++;
      if (f.alt) await wpJson(`/media/${du.id}`, { alt_text: f.alt }).catch(() => null);
    }
    // 5) Categoría y etiquetas (por nombre): la categoría debe existir ya en WordPress; las etiquetas que falten se crean
    const buscar = async (tax, nombre) => { const r = await wp(`/${tax}?search=${encodeURIComponent(nombre)}&per_page=100&_fields=id,name`); const l = r.ok ? await r.json().catch(() => []) : []; const x = (Array.isArray(l) ? l : []).find((t) => sinEnt(t.name).trim().toLowerCase() === nombre.toLowerCase()); return x ? x.id : 0; };
    const categorias = []; const cat = String(seo.cat || "").trim();
    if (cat) { const c = await buscar("categories", cat); if (c) categorias.push(c); else avisos.push(`La categoría “${cat}” no existe en WordPress; quedó sin categoría.`); }
    const etiquetas = [];
    for (const t of String(seo.tags || "").split(",").map((x) => x.trim()).filter(Boolean).slice(0, 15)) {
      let e = await buscar("tags", t);
      if (!e) { const r = await wpJson("/tags", { name: t }); const d = await r.json().catch(() => ({})); e = r.ok ? d.id : (d.data && d.data.term_id) || 0; }
      if (e) etiquetas.push(e); else avisos.push(`No se pudo poner la etiqueta “${t}”.`);
    }
    // 6) Crear el borrador o actualizar el que ya existe
    const datos = {
      title: titulo, content: aWordPress(cuerpo, media), slug: base, excerpt: String(seo.desc || ""),
      ...(post.imagen_path && media[post.imagen_path] ? { featured_media: media[post.imagen_path].id } : {}),
      ...(categorias.length ? { categories: categorias } : {}), ...(etiquetas.length ? { tags: etiquetas } : {}),
      // Yoast SEO: se guardan solo si WordPress tiene habilitados estos campos para la API (si no, los ignora sin fallar)
      meta: { _yoast_wpseo_title: String(seo.titulo || ""), _yoast_wpseo_metadesc: String(seo.desc || ""), _yoast_wpseo_focuskw: String(seo.kw || "") },
    };
    let r = null, d = null, nuevo = true;
    if (previo.id) { r = await wpJson(`/posts/${previo.id}`, datos); d = await r.json().catch(() => ({})); nuevo = false; if (r.status === 404 || r.status === 410 || (d && d.code === "rest_post_invalid_id")) { r = null; nuevo = true; avisos.push("El borrador anterior ya no existía en WordPress; se creó uno nuevo."); } }
    if (!r) { r = await wpJson("/posts", { ...datos, status: "draft" }); d = await r.json().catch(() => ({})); }
    if (!r.ok || !d.id) return json({ error: errWP(d, r), avisos }, 502);
    const yoast = !!(d.meta && Object.prototype.hasOwnProperty.call(d.meta, "_yoast_wpseo_metadesc"));
    if (!yoast && (seo.titulo || seo.desc || seo.kw)) avisos.push("El título SEO, la meta descripción y la palabra clave no se pudieron escribir en Yoast desde aquí; se copian a mano en el panel de Yoast del artículo.");
    // 7) Anotar en la app dónde quedó
    const yo = await sb("/auth/v1/user").then((x) => x.ok ? x.json() : {}).catch(() => ({}));
    const estado = { id: d.id, estado: d.status || "draft", enlace: d.link || "", editar: `${WP}/wp-admin/post.php?post=${d.id}&action=edit`, media, at: new Date().toISOString(), por: yo.email || "", yoast };
    const rg = await sb(`/rest/v1/posts?id=eq.${id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ wp: estado }) });
    if (!rg.ok) avisos.push("El artículo sí llegó a WordPress, pero no se pudo anotar en la parrilla.");
    return json({ ok: true, nuevo, subidas, wp: estado, avisos });
  } catch (e) {
    const m = String((e && e.message) || "");
    return json({ error: /fetch failed|error sending request|dns|connect|certificate|timed out/i.test(m) ? "No se pudo conectar con WordPress. Inténtalo de nuevo en un momento." : m || "No se pudo enviar a WordPress." }, 500);
  }
}

if (typeof Deno !== "undefined" && Deno.serve) Deno.serve((req) => manejar(req, (k) => Deno.env.get(k)));
