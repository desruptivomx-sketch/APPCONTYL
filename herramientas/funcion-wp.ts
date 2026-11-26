// @ts-nocheck
// APPCONTYL → WordPress. Envía un artículo del blog como BORRADOR (o actualiza el que ya se había enviado).
// El artículo llega armado igual que los artículos actuales del sitio (revisados el 24 nov 2026): contenido clásico
// de WordPress, sin Elementor ni bloques. Párrafos, títulos, listas, citas y tablas simples; cada foto centrada en
// tamaño "large" (una por párrafo) y, si lleva pie, con [caption]. Así se edita en el sitio como cualquier otro.
// Además sube las fotos a la biblioteca y pone portada, URL, categoría, etiquetas y autor.
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
const sinAcentos = (s) => String(s || "").normalize("NFD").replace(/\p{M}/gu, "");
const slug = (s) => sinAcentos(s).toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 90);
// ¿Es el mismo nombre? Se comparan solo letras y números (sin acentos, mayúsculas, apóstrofos ni signos como &)
const llano = (s) => sinAcentos(sinEnt(s).replace(/&#x?[0-9a-f]+;|&[a-z]+;/gi, " ")).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const igual = (a, b) => llano(a) === llano(b);
// Texto que va dentro de un [caption]: sin corchetes que lo puedan cortar
const corch = (s) => esc(s).replace(/\[/g, "&#91;").replace(/\]/g, "&#93;");

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

// Una foto suelta: "Grande" es el tamaño large de WordPress tal cual (como en el sitio); las otras dos, en proporción
const ESCALA = { g: 1, m: 62 / 88, ch: 40 / 88 };
const BOTON = "display: inline-block; padding: 13px 26px; border: 1px solid #222222; color: #222222; font-family: Montserrat, sans-serif; font-size: 12px; font-weight: 500; letter-spacing: 0.14em; text-transform: uppercase; text-decoration: none;";
const centro = (h) => `<p style="text-align: center;">${h}</p>`;

// Bloques de la app → contenido clásico de WordPress. media: ruta de la foto → { id, url, ls, lu, lw, lh } ya subida
// (lu/lw/lh = dirección y medidas del tamaño "large"; si la foto es más chica que ese tamaño, las de la foto completa, ls "full").
// Cada pieza va separada por una línea en blanco y sin saltos por dentro, para que WordPress no le agregue párrafos.
export function aWordPress(cuerpo, media) {
  const out = [];
  for (const b of Array.isArray(cuerpo) ? cuerpo : []) {
    if (!b || typeof b !== "object") continue;
    if (b.t === "p") out.push(`<p>${limpio(b.x)}</p>`);
    else if (b.t === "h") { const n = Math.min(4, Math.max(1, parseInt(b.n, 10) || 2)); out.push(`<h${n}>${limpio(b.x)}</h${n}>`); }
    else if (b.t === "ul" || b.t === "ol") out.push(`<${b.t}>\n${(b.items || []).map((x) => `<li>${limpio(x)}</li>`).join("\n")}\n</${b.t}>`);
    else if (b.t === "cita") out.push(`<blockquote><p>${limpio(b.x)}</p></blockquote>`);
    else if (b.t === "hr") out.push(`<hr style="border: 0; border-top: 1px solid #d9d0cb; width: 60%; margin: 28px auto;" />`);
    else if (b.t === "btn" && String(b.x || "").trim()) { const h = URL_OK.test(b.href || "") ? b.href : ""; out.push(centro(h ? `<a href="${esc(h)}" style="${BOTON}">${esc(b.x)}</a>` : `<span style="${BOTON}">${esc(b.x)}</span>`)); }
    else if (b.t === "tabla") {
      const filas = (Array.isArray(b.f) ? b.f : []).filter((f) => Array.isArray(f) && f.length);
      if (filas.length) out.push(`<table>\n<tbody>\n${filas.map((f, n) => `<tr>${f.map((x) => `<td>${n === 0 ? `<b>${limpio(x)}</b>` : limpio(x)}</td>`).join("")}</tr>`).join("\n")}\n</tbody>\n</table>`);
    } else if (b.t === "img") {
      const imgs = (b.imgs || []).filter((i) => i && media[i.src]).map((i) => ({ ...media[i.src], alt: String(i.alt || "") })).slice(0, 3), pie = String(b.pie || "").trim();
      if (imgs.length === 1) {
        const i = imgs[0], f = ESCALA[b.w] || 1, W = +i.lw ? Math.round(i.lw * f) : 0, H = +i.lh ? Math.round(i.lh * f) : 0;
        const clase = `${f === 1 ? `size-${i.ls === "full" ? "full" : "large"} ` : ""}wp-image-${i.id}`;
        const foto = (c) => `<img class="${c}" src="${esc(i.lu || i.url)}" alt="${corch(i.alt)}"${W && H ? ` width="${W}" height="${H}"` : ""} />`;
        if (pie && W) out.push(`[caption id="attachment_${i.id}" align="aligncenter" width="${W}"]${foto(clase)} ${corch(pie)}[/caption]`);
        else { out.push(`<p>${foto("aligncenter " + clase)}</p>`); if (pie) out.push(centro(`<em>${esc(pie)}</em>`)); }
      } else if (imgs.length > 1) {
        // Varias fotos lado a lado: los artículos actuales del sitio no lo usan (apilan las fotos), así que lleva su propio acomodo
        out.push(`<div style="display: grid; grid-template-columns: repeat(${imgs.length}, 1fr); gap: 10px; margin: 0 0 1.5em;">${imgs.map((i) => `<img class="wp-image-${i.id}" style="display: block; width: 100%; height: auto; aspect-ratio: 4 / 5; object-fit: cover;" src="${esc(i.lu || i.url)}" alt="${esc(i.alt)}"${+i.lw && +i.lh ? ` width="${i.lw}" height="${i.lh}"` : ""} />`).join("")}</div>`);
        if (pie) out.push(centro(`<em>${esc(pie)}</em>`));
      }
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

// Auditoría acotada a entradas y páginas publicadas devueltas por la API REST.
export function grafoSEO(items, sitio) {
  const origen = new URL(sitio);
  const canon = (raw, base) => {
    try {
      const u = new URL(sinEnt(raw), base);
      if (!/^https?:$/.test(u.protocol) || u.hostname.replace(/^www\./i,"") !== origen.hostname.replace(/^www\./i,"")) return "";
      return u.pathname.replace(/\/+$/, "") || "/";
    } catch { return ""; }
  };
  const nodos = items.filter(x => x && x.link && canon(x.link, sitio)).map(x => ({
    id: x.id, tipo: x.type, url: x.link, key: canon(x.link, sitio), slug: x.slug,
    titulo: sinEnt(String(x.title?.rendered || "").replace(/<[^>]+>/g,"")).slice(0,250),
    html: String(x.content?.rendered || ""), fecha: x.modified || "",
  }));
  const byKey = new Map(nodos.map(n => [n.key,n]));
  const incoming = new Map(nodos.map(n=>[n.key,new Set()]));
  return nodos.map(n=>{
    const targets = new Set();
    for (const m of n.html.matchAll(/<a\b[^>]*\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi)) {
      const href=m[1]??m[2]??m[3]??"";
      if(!href || href.startsWith("#") || href.startsWith("?"))continue;
      const k=canon(href,n.url);
      if(k && k!==n.key && byKey.has(k)){targets.add(k);incoming.get(k).add(n.key);}
    }
    n.salientes=targets.size;
    return n;
  }).map(({html,key,...n})=>({...n,entrantes:incoming.get(key).size}));
}

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
      return json({ conectado: true, usuario: d.name || U, sitio: WP, puede: { borradores: !!c.edit_posts, fotos: !!c.upload_files, publicar: !!c.publish_posts, formato: !!c.unfiltered_html } });
    }
    if (b.accion === "auditoria_seo") {
      const items = [], cobertura = {};
      for (const tipo of ["posts","pages"]) {
        let total = null, totalPages = 1, leidos = 0, error = false;
        for (let page=1;page<=Math.min(totalPages,3);page++) {
          const r=await wp("/"+tipo+"?status=publish&per_page=100&page="+page+"&_fields=id,type,link,slug,title,content,modified",{signal:AbortSignal.timeout(12000)});
          if(!r.ok){error=true;break;}
          const arr=await r.json().catch(()=>null);
          if(!Array.isArray(arr)){error=true;break;}
          const rawTotal=r.headers.get("X-WP-Total"), rawPages=r.headers.get("X-WP-TotalPages");
          total=rawTotal!==null?Number(rawTotal):null;
          totalPages=rawPages!==null?Math.max(1,Number(rawPages)||1):1;
          items.push(...arr);leidos+=arr.length;
        }
        cobertura[tipo]={leidos,total,completa:!error&&total!==null&&leidos>=total,error};
      }
      return json({ok:true,cobertura,articulos:grafoSEO(items,WP),fecha:new Date().toISOString()});
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
      const md = du.media_details || {}, lg = (md.sizes && md.sizes.large) || {};   // "large" solo existe si la foto es más grande que ese tamaño
      media[f.src] = { id: du.id, url: du.source_url, ls: lg.source_url ? "large" : "full", lu: lg.source_url || du.source_url, lw: +lg.width || +md.width || 0, lh: +lg.height || +md.height || 0 }; subidas++;
      if (f.alt) await wpJson(`/media/${du.id}`, { alt_text: f.alt }).catch(() => null);
    }
    // 5) Categoría (una, como en el sitio), etiquetas y autor. La categoría debe existir ya en WordPress; las etiquetas que falten se crean
    // WordPress guarda «&» y los apóstrofos de otra forma, así que se busca por el tramo más largo de puras letras y luego se compara el nombre completo
    const buscar = async (tax, nombre) => { const tramo = String(nombre).split(/[^\p{L}\p{N} ]+/u).map((x) => x.trim()).sort((x, y) => y.length - x.length)[0] || nombre; const r = await wp(`/${tax}?search=${encodeURIComponent(tramo)}&per_page=100&_fields=id,name,count`); const l = r.ok ? await r.json().catch(() => []) : []; return (Array.isArray(l) ? l : []).filter((t) => igual(t.name, nombre)).sort((x, y) => (y.count || 0) - (x.count || 0) || y.id - x.id); };
    const categorias = []; const cat = String(seo.cat || "").trim(), catId = parseInt(seo.catId, 10) || 0;
    if (catId) { const r = await wp(`/categories/${catId}?_fields=id,name`); const d = r.ok ? await r.json().catch(() => null) : null; if (d && d.id === catId && (!cat || igual(d.name, cat))) categorias.push(catId); }
    if (!categorias.length && cat) { const c = (await buscar("categories", cat))[0]; if (c) categorias.push(c.id); else avisos.push(`La categoría “${cat}” no existe en WordPress; quedó sin categoría.`); }   // si hay dos con el mismo nombre, la más usada
    const etiquetas = [];
    for (const t of String(seo.tags || "").split(",").map((x) => x.trim()).filter(Boolean).slice(0, 15)) {
      let e = ((await buscar("tags", t))[0] || {}).id || 0;
      if (!e) { const r = await wpJson("/tags", { name: t }); const d = await r.json().catch(() => ({})); e = r.ok ? d.id : (d.data && d.data.term_id) || 0; }
      if (e) etiquetas.push(e); else avisos.push(`No se pudo poner la etiqueta “${t}”.`);
    }
    let autor = 0; const firma = String(seo.autor || "").trim();
    if (firma) { const r = await wp(`/users?search=${encodeURIComponent(firma)}&per_page=50&_fields=id,name`); const l = r.ok ? await r.json().catch(() => []) : []; autor = ((Array.isArray(l) ? l : []).find((u) => igual(u.name, firma)) || {}).id || 0; if (!autor) avisos.push(`“${firma}” no es un usuario de WordPress; el borrador quedó a nombre de quien conectó la app.`); }
    // 6) Crear el borrador o actualizar el que ya existe. El extracto se deja vacío: en el sitio lo saca WordPress del texto
    const datos = {
      title: titulo, content: aWordPress(cuerpo, media), slug: base,
      ...(post.imagen_path && media[post.imagen_path] ? { featured_media: media[post.imagen_path].id } : {}),
      ...(categorias.length ? { categories: categorias } : {}), ...(etiquetas.length ? { tags: etiquetas } : {}), ...(autor ? { author: autor } : {}),
      // Yoast SEO: se guardan solo si WordPress tiene habilitados estos campos para la API (si no, los ignora sin fallar)
      meta: { _yoast_wpseo_title: String(seo.titulo || ""), _yoast_wpseo_metadesc: String(seo.desc || ""), _yoast_wpseo_focuskw: String(seo.kw || "") },
    };
    const guardar = async () => {
      let r = null, d = null, nuevo = true;
      if (previo.id) { r = await wpJson(`/posts/${previo.id}`, datos); d = await r.json().catch(() => ({})); nuevo = false; if (r.status === 404 || r.status === 410 || (d && d.code === "rest_post_invalid_id")) { r = null; nuevo = true; if (!avisos.some((a) => a.includes("ya no existía"))) avisos.push("El borrador anterior ya no existía en WordPress; se creó uno nuevo."); } }
      if (!r) { r = await wpJson("/posts", { ...datos, status: "draft" }); d = await r.json().catch(() => ({})); }
      return { r, d, nuevo };
    };
    let { r, d, nuevo } = await guardar();
    if (!r.ok && datos.author && d && /author|others/i.test(String(d.code || ""))) {   // ese usuario no puede firmar por otra persona: se guarda a su nombre
      delete datos.author; avisos.push(`No se pudo poner a “${firma}” como autor; el borrador quedó a nombre de quien conectó la app.`); ({ r, d, nuevo } = await guardar());
    }
    if (!r.ok || !d.id) return json({ error: errWP(d, r), avisos }, 502);
    const yoast = !!(d.meta && Object.prototype.hasOwnProperty.call(d.meta, "_yoast_wpseo_metadesc"));
    if (!yoast && (seo.titulo || seo.desc || seo.kw)) avisos.push("El título SEO, la meta descripción y la palabra clave no se pudieron escribir en Yoast desde aquí; se copian a mano en el panel de Yoast del artículo.");
    // 6b) Enviar metadatos opcionales exclusivamente en borradores y si REST los expone.
    const adv = seo.advanced || {}, seoAvanzado = { guardados: [], pendientes: [] };
    if (adv.applyMeta === true) {
      const http = v => { try { const u = new URL(String(v || "")); return /^https?:$/.test(u.protocol) && !u.username && !u.password ? u.href : ""; } catch { return ""; } };
      const requested = {};
      for (const [key,val] of Object.entries({
        "_yoast_wpseo_opengraph-title":adv.socialTitle, "_yoast_wpseo_twitter-title":adv.socialTitle,
        "_yoast_wpseo_opengraph-description":adv.socialDescription, "_yoast_wpseo_twitter-description":adv.socialDescription,
        "_yoast_wpseo_opengraph-image":http(adv.socialImage), "_yoast_wpseo_twitter-image":http(adv.socialImage),
        "_yoast_wpseo_canonical":http(adv.canonical)
      })) if(typeof val==="string"&&val.trim())requested[key]=val.trim().slice(0,500);
      if (adv.noindex === true) requested["_yoast_wpseo_meta-robots-noindex"]="1";
      if (adv.canonical && !http(adv.canonical)) avisos.push("URL canónica inválida: no se envió.");
      if (adv.socialImage && !http(adv.socialImage)) avisos.push("URL de imagen social inválida: no se envió.");
      if (d.status !== "draft") {
        seoAvanzado.pendientes=Object.keys(requested);
        avisos.push("Los metadatos avanzados solo se envían a entradas en estado borrador.");
      } else if (Object.keys(requested).length) {
        const opt = await wp("/posts/"+d.id,{method:"OPTIONS"}).catch(()=>null);
        const spec = opt?.ok ? await opt.json().catch(()=>({})) : {};
        const props=spec.schema?.properties?.meta?.properties || {};
        const compatible={};
        for (const [k,v] of Object.entries(requested)) {
          if (props[k] && !props[k].readonly && (props[k].type==="string" || (Array.isArray(props[k].type)&&props[k].type.includes("string")))) compatible[k]=v;
          else seoAvanzado.pendientes.push(k);
        }
        if (Object.keys(compatible).length) {
          const rr=await wpJson("/posts/"+d.id,{meta:compatible}).catch(()=>null);
          const dd=rr?.ok?await rr.json().catch(()=>({})):{};
          for(const [k,v] of Object.entries(compatible)) {
            if(dd.meta && String(dd.meta[k])===v)seoAvanzado.guardados.push(k);
            else seoAvanzado.pendientes.push(k);
          }
        }
        if(seoAvanzado.pendientes.length)avisos.push("Ajustes avanzados no confirmados por WordPress: "+seoAvanzado.pendientes.join(", ")+".");
        if(seoAvanzado.guardados.length)avisos.push("Metadatos avanzados confirmados en REST: "+seoAvanzado.guardados.length+". Falta verificar la salida SEO pública cuando se publique.");
      }
    }
    // 7) Anotar en la app dónde quedó
    const yo = await sb("/auth/v1/user").then((x) => x.ok ? x.json() : {}).catch(() => ({}));
    const estado = { id: d.id, estado: d.status || "draft", enlace: d.link || "", editar: `${WP}/wp-admin/post.php?post=${d.id}&action=edit`, media, at: new Date().toISOString(), por: yo.email || "", yoast, seoAvanzado };
    const rg = await sb(`/rest/v1/posts?id=eq.${id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ wp: estado }) });
    if (!rg.ok) avisos.push("El artículo sí llegó a WordPress, pero no se pudo anotar en la parrilla.");
    return json({ ok: true, nuevo, subidas, wp: estado, avisos });
  } catch (e) {
    const m = String((e && e.message) || "");
    return json({ error: /fetch failed|error sending request|dns|connect|certificate|timed out/i.test(m) ? "No se pudo conectar con WordPress. Inténtalo de nuevo en un momento." : m || "No se pudo enviar a WordPress." }, 500);
  }
}

if (typeof Deno !== "undefined" && Deno.serve) Deno.serve((req) => manejar(req, (k) => Deno.env.get(k)));
