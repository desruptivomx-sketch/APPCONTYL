/* Parrilla YUC'ATÅLOVE — tabla + feed + resumen sobre Supabase (v2: móvil, app instalable, imágenes optimizadas) */
(function(){
"use strict";
/* ---------- Pantalla de carga y reparación ---------- */
const bootEl = document.getElementById("boot");
function hideBoot(){ if (bootEl) bootEl.classList.add("hidden"); }
async function repararApp(){
  try { Object.keys(localStorage).filter(k => k.startsWith("sb-")).forEach(k => localStorage.removeItem(k)); } catch (_) {}
  try { sessionStorage.clear(); } catch (_) {}
  try { if (window.caches) for (const k of await caches.keys()) await caches.delete(k); } catch (_) {}
  try { if (navigator.serviceWorker) for (const r of await navigator.serviceWorker.getRegistrations()) await r.unregister(); } catch (_) {}
  location.replace(location.pathname + "?r=" + Date.now() + location.hash);
}
document.getElementById("boot-fix").addEventListener("click", repararApp);
const bootTimer = setTimeout(() => { if (bootEl && !bootEl.classList.contains("hidden")) { document.getElementById("boot-msg").textContent = "Está tardando más de lo normal."; document.getElementById("boot-fix").classList.remove("hidden"); } }, 7000);
window.addEventListener("error", e => { if (bootEl && !bootEl.classList.contains("hidden")) { document.getElementById("boot-msg").textContent = "Hubo un error al abrir la app (" + (e.message || "desconocido") + ")."; document.getElementById("boot-fix").classList.remove("hidden"); } });
const CFG = window.PARRILLA_CONFIG;
const $ = id => document.getElementById(id);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

if (!window.supabase || !CFG) { document.body.innerHTML = '<p style="padding:24px;font-family:sans-serif">No se pudo cargar la página. Revisa tu conexión y recarga.</p>'; return; }
const sb = window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseKey, { auth: { persistSession: true, detectSessionInUrl: true } });

/* ---------- App instalable ---------- */
// Actualización automática: cuando se publica una versión nueva, la app la toma sola
// (si hay un post abierto en el editor, espera y muestra un aviso para no perder cambios)
if ("serviceWorker" in navigator) {
  const habiaControl = !!navigator.serviceWorker.controller;
  window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").then(reg => {
    const revisar = () => reg.update().catch(() => {});
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") revisar(); });
    setInterval(revisar, 5 * 60 * 1000);
  }).catch(() => {}));
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!habiaControl) return;
    const ocupado = document.getElementById("editor") && !document.getElementById("editor").classList.contains("hidden");
    if (!ocupado) { location.reload(); return; }
    if (document.getElementById("upd-bar")) return;
    const b = document.createElement("div"); b.id = "upd-bar"; b.className = "upd-bar";
    b.innerHTML = 'Hay una versión nueva de la app. <button type="button" class="btn small">Actualizar</button>';
    b.querySelector("button").onclick = () => location.reload();
    document.body.appendChild(b);
  });
}
let installEvt = null;
window.addEventListener("beforeinstallprompt", e => { e.preventDefault(); installEvt = e; $("btn-install").classList.remove("hidden"); });
$("btn-install").addEventListener("click", async () => { if (!installEvt) return; installEvt.prompt(); await installEvt.userChoice; installEvt = null; $("btn-install").classList.add("hidden"); });
function netState(){ $("offline").classList.toggle("hidden", navigator.onLine); }
window.addEventListener("online", () => { netState(); if (user) loadPosts(); });
window.addEventListener("offline", netState);

/* ---------- Listas ---------- */
const MESES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const DIAS = ["Lunes","Martes","Miércoles","Jueves","Viernes","Sábado","Domingo"];
const PALETA = [["#AB391B","Terracota"],["#674E4A","Chocolate"],["#95827E","Taupe"],["#C3ACA9","Rosa palo"],["#E8D9D3","Rosa claro"],["#D9C3B8","Arena oscura"],["#FAF4EE","Arena"],["#F6F6F4","Marfil"]];
const STATIC = {
  dia: DIAS.map(v => ({valor:v, color:null})),
  mes: MESES.map(v => ({valor:v, color:null})),
  cumplio: [{valor:"✔", color:"#674E4A"}, {valor:"✖", color:"#AB391B"}]
};
let opciones = { tipo:[], pilar:[], status:[], semana:[] };
const lista = name => STATIC[name] || opciones[name] || [];
const colorDe = (name, v) => (lista(name).find(o => o.valor === v) || {}).color || null;
function textOn(hex){ if(!hex) return "#303030"; const n=parseInt(hex.slice(1),16); const r=n>>16,g=(n>>8)&255,b=n&255; return (0.299*r+0.587*g+0.114*b) > 150 ? "#303030" : "#FAF4EE"; }
const chip = (name, v) => { if (!v) return ""; const c = colorDe(name, v) || "#F6F6F4"; return `<span class="chip" style="background:${c};color:${textOn(c)}">${esc(v)}</span>`; };

const COLS = [
  {k:"fecha", label:"Fecha", type:"date", w:140, sticky:true},
  {k:"dia", label:"Día", type:"list", list:"dia", w:110},
  {k:"semana", label:"Semana", type:"list", list:"semana", w:110},
  {k:"mes", label:"Mes", type:"list", list:"mes", w:120},
  {k:"tipo", label:"Tipo de post", type:"list", list:"tipo", w:140},
  {k:"pilar", label:"Pilar / Categoría", type:"list", list:"pilar", w:190},
  {k:"status", label:"Status", type:"list", list:"status", w:140},
  {k:"imagen_path", label:"Imagen", type:"thumb", w:64},
  {k:"publicacion", label:"Publicación", type:"long", w:220},
  {k:"copy", label:"Copy", type:"long", w:220},
  {k:"caption", label:"Caption", type:"long", w:340},
  {k:"inspo", label:"Inspo / Referencia", type:"long", w:220},
  {k:"comentarios", label:"Comentarios", type:"long", w:220},
  {k:"contenido", label:"Contenido", type:"long", w:200},
  {k:"cumplio", label:"¿Cumplió?", type:"list", list:"cumplio", w:96}
];
const isMobile = () => window.matchMedia("(max-width:760px)").matches;

/* ---------- Estado ---------- */
let user = null, posts = [], filters = {}, sortKey = "fecha", sortDir = 1, view = "parrilla";
let comentarios = [], pendingRender = false, current = null, pendingFile = null, pendingUrl = null, channel = null;

/* ---------- Imágenes: URLs firmadas con caché y miniaturas ---------- */
const URL_KEY = "parrilla-urls-v1";
const urlCache = new Map((() => { try { return JSON.parse(sessionStorage.getItem(URL_KEY) || "[]"); } catch (_) { return []; } })());
function persistUrls(){ try { sessionStorage.setItem(URL_KEY, JSON.stringify([...urlCache].slice(-400))); } catch (_) {} }
const thumbOf = p => p ? p.replace(/(\.[a-z0-9]+)$/i, "_t$1") : p;
async function signedUrls(paths){
  const now = Date.now();
  const need = [...new Set(paths.filter(p => p && !(urlCache.get(p) && urlCache.get(p).exp > now + 120000)))];
  if (!need.length) return;
  for (let i = 0; i < need.length; i += 100) {
    const { data, error } = await sb.storage.from(CFG.bucket).createSignedUrls(need.slice(i, i + 100), 3600);
    if (error) return;
    (data || []).forEach(r => urlCache.set(r.path, { url: r.signedUrl || "", exp: now + 3500000 }));
  }
  persistUrls();
}
const urlOf = p => (p && urlCache.get(p)) ? urlCache.get(p).url : "";
const thumbUrl = p => urlOf(thumbOf(p)) || urlOf(p); // miniatura si existe; si no, la imagen completa
const slidesOf = p => [p.imagen_path, ...((p && p.imagenes) || [])].filter(Boolean); // portada + resto del carrusel
const allImagePaths = list => list.flatMap(p => slidesOf(p).flatMap(x => [x, thumbOf(x)]));

// Reduce la imagen antes de subirla: Instagram la muestra a 1080 px, así que 1440 px basta y pesa mucho menos.
async function compress(file, maxSide, quality, onlyType){
  try {
    const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
    const w = Math.round(bmp.width * scale), h = Math.round(bmp.height * scale);
    const cv = document.createElement("canvas"); cv.width = w; cv.height = h;
    cv.getContext("2d").drawImage(bmp, 0, 0, w, h); bmp.close && bmp.close();
    const tryType = t => new Promise(r => cv.toBlob(b => r(b && b.type === t ? b : null), t, quality));
    const blob = onlyType ? await tryType(onlyType) : ((await tryType("image/webp")) || (await tryType("image/jpeg")));
    return blob ? { blob, ext: blob.type === "image/webp" ? "webp" : "jpg" } : null;
  } catch (_) { return null; }
}

/* ---------- Utilidades ---------- */
function banner(t){ const b=$("banner"); b.textContent=t||""; b.classList.toggle("hidden", !t); }
let saveTimer=null;
function saved(t, warn){ const m=$("save-msg"); m.textContent=t||""; m.classList.toggle("warn",!!warn); clearTimeout(saveTimer); if(t && !warn) saveTimer=setTimeout(()=>{m.textContent=""},2500); }
function errMsg(e){
  const m = (e && (e.message || e.error_description)) || "";
  if (!navigator.onLine || /Failed to fetch|NetworkError|network|Load failed/i.test(m)) return "Sin conexión. Revisa tu internet e intenta de nuevo.";
  if (/row-level security|permission|not allowed|401|403|Unauthorized/i.test(m)) return "Tu correo no tiene permiso. Pide que te agreguen en Ajustes → Equipo.";
  if (/exceeded the maximum|too large|413/i.test(m)) return "La imagen es demasiado pesada. Usa una de menos de 20 MB.";
  if (/rate limit|rate exceeded|too many/i.test(m)) return "Se enviaron demasiados correos en poco tiempo. Espera un rato e intenta de nuevo, o pide al administrador que revise la configuración de correo.";
  if (/Database error saving new user|correo_no_autorizado/i.test(m)) return "Ese correo no está en la lista del equipo. Pide que lo agreguen en Ajustes → Equipo.";
  return m || "Algo falló. Intenta de nuevo.";
}
const fmtCorto = f => { if(!f) return "Sin fecha"; const [y,m,d]=f.split("-"); return `${+d} ${MESES[+m-1].slice(0,3).toLowerCase()}`; };
function diaDe(f){ if(!f) return null; const d=new Date(f+"T12:00:00"); return DIAS[(d.getDay()+6)%7]; }
function mesDe(f){ return f ? MESES[+f.split("-")[1]-1] : null; }


/* ---------- Enlaces ---------- */
const URL_RE = /\bhttps?:\/\/[^\s<>"']+/gi;
const LINK_FIELDS = ["inspo", "contenido"];
function etiquetaLink(u){
  try {
    const x = new URL(u), h = x.hostname.replace(/^www\./, "");
    if (/drive\.google|docs\.google/.test(h)) return /folders/.test(x.pathname) ? "Carpeta de Drive" : "Archivo de Drive";
    if (/instagram\.com/.test(h)) return /\/reel/.test(x.pathname) ? "Reel de Instagram" : "Post de Instagram";
    if (/pinterest\./.test(h)) return "Pinterest";
    if (/tiktok\.com/.test(h)) return "TikTok";
    if (/canva\.com/.test(h)) return "Canva";
    if (/dropbox\.com/.test(h)) return "Dropbox";
    return h;
  } catch (_) { return "Enlace"; }
}
const limpiaUrl = u => u.replace(/[.,;:)\]]+$/, "");
function linksDe(text){ return [...String(text || "").matchAll(URL_RE)].map(m => limpiaUrl(m[0])); }
// Texto con los enlaces convertidos en hipervínculos (para leer completo)
function linkify(text){
  let out = "", last = 0; const t = String(text || "");
  for (const m of t.matchAll(URL_RE)) { const u = limpiaUrl(m[0]); out += esc(t.slice(last, m.index)) + `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(etiquetaLink(u))} ↗</a>`; last = m.index + u.length; }
  return out + esc(t.slice(last));
}
// Chips cortos de enlaces (para tablas y tarjetas)
function chipsLinks(text){
  const ls = linksDe(text); if (!ls.length) return "";
  return `<span class="lnks">${ls.map(u => `<a class="lnk" href="${esc(u)}" target="_blank" rel="noopener" title="${esc(u)}">${esc(etiquetaLink(u))} ↗</a>`).join("")}</span>`;
}

/* ---------- Acceso ---------- */
let signupMode = false;
function showAuth(){ hideBoot(); clearTimeout(bootTimer); $("app").classList.add("hidden"); $("recover").classList.add("hidden"); closeEditor(); const yaVisible = !$("auth").classList.contains("hidden"); $("auth").classList.remove("hidden"); if (!yaVisible || !$("auth-art").firstChild) montarArte(); }

/* ---------- Composición de marca animada en la entrada (motion graphics) ----------
   El SVG trae su propia animación: se dibuja siguiendo las líneas y luego queda con movimiento suave.
   Volver a insertarlo la reinicia (por eso al tocarla se dibuja de nuevo). */
let arteTxt = null;
async function montarArte(){
  const box = $("auth-art"); if (!box) return;
  try {
    if (arteTxt === null) { const r = await fetch("icons/composicion-motion.svg"); if (!r.ok) throw new Error("sin arte"); arteTxt = await r.text(); }
    if (!arteTxt.trim().startsWith("<svg")) throw new Error("arte inválido");
    if ($("auth").classList.contains("hidden")) return;
    box.innerHTML = arteTxt;
    const svg = box.querySelector("svg");
    try { svg.setCurrentTime(0); if (matchMedia("(prefers-reduced-motion: reduce)").matches) svg.pauseAnimations(); } catch (_) {}
  } catch (_) { box.innerHTML = '<img src="icons/composicion.svg" alt="" width="1000" height="1000">'; }   // sin animación: la versión fija
}
function desmontarArte(){ const box = $("auth-art"); if (box) box.textContent = ""; }
$("auth-art").addEventListener("click", montarArte);
$("a-toggle").addEventListener("click", () => {
  signupMode = !signupMode;
  $("a-submit").textContent = signupMode ? "Crear mi acceso" : "Entrar";
  $("a-toggle").textContent = signupMode ? "Ya tengo acceso, entrar" : "¿Primera vez? Crear mi acceso";
  $("a-pass").autocomplete = signupMode ? "new-password" : "current-password";
  $("a-msg").textContent = signupMode ? "Usa el correo que te registraron en el equipo y elige una contraseña de al menos 6 caracteres." : "";
});
$("auth-form").addEventListener("submit", async e => {
  e.preventDefault();
  const email = $("a-email").value.trim(), password = $("a-pass").value, msg = $("a-msg");
  if (!email || password.length < 6) { msg.textContent = "Escribe tu correo y una contraseña de al menos 6 caracteres."; msg.classList.add("warn"); return; }
  $("a-submit").disabled = true; msg.classList.remove("warn"); msg.textContent = signupMode ? "Creando tu acceso…" : "Entrando…";
  try {
    if (signupMode) {
      const { data, error } = await sb.auth.signUp({ email, password, options: { emailRedirectTo: location.origin + location.pathname } });
      if (error) throw error;
      msg.textContent = data.session ? "Acceso creado. Entrando…" : "Te enviamos un correo para confirmar tu cuenta. Ábrelo y después entra aquí.";
    } else {
      const { error } = await sb.auth.signInWithPassword({ email, password });
      if (error) throw error;
      msg.textContent = "";
    }
  } catch (err) {
    msg.classList.add("warn");
    msg.textContent = /Invalid login/i.test(err.message) ? "Correo o contraseña incorrectos." : /confirm/i.test(err.message) ? "Primero confirma tu correo con el enlace que te enviamos." : errMsg(err);
  } finally { $("a-submit").disabled = false; }
});
$("a-reset").addEventListener("click", async () => {
  const email = $("a-email").value.trim(), msg = $("a-msg");
  if (!email) { msg.textContent = "Escribe tu correo arriba y vuelve a tocar aquí."; msg.classList.add("warn"); return; }
  const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
  msg.classList.toggle("warn", !!error);
  msg.textContent = error ? errMsg(error) : "Te enviamos un correo para crear una contraseña nueva.";
});
$("rec-form").addEventListener("submit", async e => {
  e.preventDefault();
  const p = $("r-pass").value, msg = $("r-msg");
  if (p.length < 6) { msg.textContent = "Usa al menos 6 caracteres."; msg.classList.add("warn"); return; }
  const { error } = await sb.auth.updateUser({ password: p });
  if (error) { msg.textContent = errMsg(error); msg.classList.add("warn"); return; }
  $("recover").classList.add("hidden"); start();
});
$("btn-logout").addEventListener("click", async () => { await sb.auth.signOut(); });

sb.auth.onAuthStateChange((event, session) => {
  if (event === "PASSWORD_RECOVERY") { hideBoot(); $("auth").classList.add("hidden"); $("app").classList.add("hidden"); $("recover").classList.remove("hidden"); return; }
  const u = session ? session.user : null;
  if (u && (!user || user.id !== u.id)) { user = u; start(); }
  else if (!u) { user = null; if (channel) { sb.removeChannel(channel); channel = null; } showAuth(); }
});

/* ---------- Arranque ---------- */
async function start(){
  if (!$("recover").classList.contains("hidden")) return;
  hideBoot(); clearTimeout(bootTimer);
  $("auth").classList.add("hidden"); $("app").classList.remove("hidden"); desmontarArte();
  $("who-email").textContent = user.email; $("pw-user").value = user.email;
  banner(""); netState();
  setView(location.hash.replace("#","") || "parrilla");
  const { data: yo, error: e1 } = await sb.from("miembros").select("email").limit(1);
  if (e1 || !yo || !yo.length) banner("Tu correo (" + user.email + ") todavía no está en el equipo. Pide a alguien del equipo que lo agregue en Ajustes → Equipo y vuelve a abrir la app.");
  await Promise.all([loadOpciones(), loadPosts(), loadTeam(), loadComentarios(), loadPerfiles()]);
  subscribe();
}
async function loadOpciones(){
  const { data, error } = await sb.from("opciones").select("*").order("orden");
  if (error) return;
  opciones = { tipo:[], pilar:[], status:[], semana:[] };
  (data||[]).forEach(o => { (opciones[o.lista] = opciones[o.lista] || []).push(o); });
  fillSelects(); renderAll();
}
/* ---------- Perfiles de cada red (foto, nombre, bio, link, seguidores…) ---------- */
let perfiles = {};
async function loadPerfiles(){
  const { data, error } = await sb.from("perfiles").select("*");
  if (error) return;
  perfiles = {}; (data || []).forEach(r => perfiles[r.plataforma] = r);
  await signedUrls((data || []).flatMap(r => [r.foto_path, r.portada_path]).filter(Boolean));
  if (view === "feed") renderFeed();
}
const pf = k => perfiles[k] || {};
const pfFoto = k => urlOf(pf(k).foto_path) || "";
const pfDato = (k, campo, def = "—") => (pf(k)[campo] || "").toString().trim() || def;
async function loadPosts(){
  const { data, error } = await sb.from("posts").select("*").order("fecha", { ascending: true, nullsFirst: false });
  if (error) { saved(errMsg(error), true); return; }
  posts = data || [];
  renderAll();                       // pinta de inmediato
  await signedUrls(allImagePaths(posts));
  renderAll();                       // y luego con imágenes
}
function subscribe(){
  if (channel) sb.removeChannel(channel);
  channel = sb.channel("parrilla")
    .on("postgres_changes", { event: "*", schema: "public", table: "posts" }, async payload => {
      if (payload.eventType === "DELETE") posts = posts.filter(p => p.id !== payload.old.id);
      else {
        // El aviso de un cambio no trae los textos largos que no se tocaron (el artículo de un blog, por ejemplo):
        // se conserva lo que ya se tenía y encima se pone lo que sí llegó; si el post no estaba aquí, se pide completo.
        let n = payload.new; const i = posts.findIndex(p => p.id === n.id);
        if (i >= 0) n = Object.assign({}, posts[i], n);
        else if (payload.eventType === "UPDATE") { try { const { data: fila } = await sb.from("posts").select("*").eq("id", n.id).maybeSingle(); if (fila) n = fila; } catch (_) {} }
        const j = posts.findIndex(p => p.id === n.id); if (j >= 0) posts[j] = n; else posts.push(n);
        if (slidesOf(n).length) await signedUrls(allImagePaths([n]));
      }
      if (current && !editorDirty) { const c = posts.find(p => p.id === current.id); if (c) current = c; }
      if (cdPost && !posts.find(p => p.id === cdPost.id)) $("cdlg").close();
      renderAll(true);
    })
    .on("postgres_changes", { event: "*", schema: "public", table: "opciones" }, () => loadOpciones())
    .on("postgres_changes", { event: "*", schema: "public", table: "perfiles" }, () => loadPerfiles())
    .on("postgres_changes", { event: "*", schema: "public", table: "comentarios" }, payload => {
      if (payload.eventType === "DELETE") comentarios = comentarios.filter(c => c.id !== payload.old.id);
      else if (!comentarios.find(c => c.id === payload.new.id)) comentarios.push(payload.new);
      renderComentarios();
      renderAll(true);
    })
    .subscribe();
}
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && user) loadPosts(); });

/* ---------- Vistas ---------- */
const VIEWS = ["parrilla","feed","resumen","ajustes"];
function setView(v){
  if (!VIEWS.includes(v)) v = "parrilla";
  view = v;
  VIEWS.forEach(x => { $("view-"+x).classList.toggle("hidden", x !== v); $("tab-"+x).setAttribute("aria-selected", String(x === v)); });
  if (location.hash !== "#"+v) history.replaceState(null, "", "#"+v);
  renderAll(); window.scrollTo(0, 0);
  montarLados();
}

/* ---------- Laterales del Feed: la composición de marca a cada lado (la derecha, en espejo) ----------
   Solo en pantallas anchas, donde la columna del Feed deja hueco. El archivo trae una base fija y unas
   pocas piezas sueltas ya colocadas. El movimiento es por "actos": cada tanto una sola pieza hace algo
   breve (late el corazón, se mece el péndulo…) en ambos lados a la vez; entre un acto y otro no queda
   nada animándose. Los actos son de CSS (styles.css, clase .act) y mueven capas, no redibujan. */
const LADOS_MQ = window.matchMedia("(min-width:1252px)");
const QUIETO_MQ = window.matchMedia("(prefers-reduced-motion: reduce)");
const LADOS_ACTOS = ["corazon","pendulo","destello","rayos","corazon","nota","greca","fuente","rosa"];
let ladosEstado = 0;   // 0 sin montar · 1 cargando · 2 listo
let ladosT = 0, ladosI = 0;
const ladosActivo = () => ladosEstado === 2 && view === "feed" && LADOS_MQ.matches && !QUIETO_MQ.matches && !document.hidden && document.hasFocus();
async function montarLados(){
  const box = $("lados");
  if (!box || view !== "feed" || !LADOS_MQ.matches) return;
  if (ladosEstado === 2) { box.querySelectorAll(".act").forEach(el => el.classList.remove("act")); ladosRitmo(1600); return; }   // al volver al Feed, empieza limpio
  if (ladosEstado) return;
  ladosEstado = 1;
  try {
    const r = await fetch("icons/composicion-lados.html"); if (!r.ok) throw new Error("sin laterales");
    const t = await r.text(); if (!t.startsWith('<div class="arte">')) throw new Error("laterales inválidos");
    box.innerHTML = '<div class="lado lado-izq">' + t + '</div><div class="lado lado-der">' + t + '</div>';
    box.querySelectorAll(".arte").forEach(a => a.classList.add("entra"));
    box.addEventListener("animationend", e => {
      const el = e.target;
      if (el.classList.contains("arte")) el.classList.remove("entra");
      else if (el.classList.contains("act")) { el.classList.remove("act"); ladosRitmo(6000 + (ladosI % 3) * 1500); }   // descanso de 6 a 9 s antes del siguiente
    });
    ladosEstado = 2; ladosRitmo(1600);
  } catch (_) { ladosEstado = 0; }   // sin conexión: se intenta de nuevo al volver al Feed
}
function ladosRitmo(espera){ clearTimeout(ladosT); ladosT = setTimeout(ladosActo, espera); }
function ladosActo(){
  ladosT = 0;
  if (!ladosActivo()) return;   // se reanuda al volver al Feed o a la ventana
  const piezas = $("lados").querySelectorAll(".pz-" + LADOS_ACTOS[ladosI++ % LADOS_ACTOS.length]);
  piezas.forEach(el => el.classList.add("act"));
  ladosRitmo(16000);            // por si el aviso de "terminó" no llega, el ritmo no se queda detenido
}
const ladosVuelve = () => { if (!ladosT && ladosActivo()) ladosRitmo(1200); };   // solo si el ritmo estaba detenido
if (LADOS_MQ.addEventListener) LADOS_MQ.addEventListener("change", montarLados); else if (LADOS_MQ.addListener) LADOS_MQ.addListener(montarLados);
window.addEventListener("focus", ladosVuelve);
document.addEventListener("visibilitychange", ladosVuelve);
document.querySelectorAll(".tabs button").forEach(b => b.addEventListener("click", () => {
  // Estando en Feed, tocar Feed otra vez abre el menú de plataformas
  if (b.dataset.view === "feed" && view === "feed") { abrirMenuPlat(b); return; }
  setView(b.dataset.view);
}));
window.addEventListener("hashchange", () => setView(location.hash.replace("#","")));

function renderAll(fromRemote){
  if (fromRemote && $("tbody").contains(document.activeElement)) { pendingRender = true; return; }
  pendingRender = false;
  if (view === "parrilla") renderTable();
  if (view === "feed") renderFeed();
  if (view === "resumen") renderResumen();
  if (view === "ajustes") { renderOpts(); renderTeam(); if (esAdmin) loadUso(); }
}
document.addEventListener("focusout", () => setTimeout(() => { if (pendingRender && !$("tbody").contains(document.activeElement)) renderAll(); }, 0));
let rz; window.addEventListener("resize", () => { clearTimeout(rz); rz = setTimeout(() => { if (view === "parrilla") renderTable(); }, 200); });

/* ---------- Parrilla ---------- */
function optionsHtml(name, value, withBlank){
  const opts = lista(name).map(o => o.valor);
  if (value && !opts.includes(value)) opts.push(value);
  return (withBlank ? '<option value=""></option>' : "") + opts.map(v => `<option value="${esc(v)}"${v === value ? " selected" : ""}>${esc(v)}</option>`).join("");
}
function renderHead(){
  const h1 = COLS.map(c => `<th class="${c.sticky ? "sticky" : ""}" style="min-width:${c.w}px" data-sort="${c.k}" title="Ordenar">${esc(c.label)}${sortKey === c.k ? (sortDir > 0 ? " ↑" : " ↓") : ""}</th>`).join("") + '<th style="min-width:44px"></th>';
  const h2 = COLS.map(c => {
    let inner = "";
    if (c.type === "list") inner = `<select data-f="${c.k}" aria-label="Filtrar ${esc(c.label)}"><option value="">Todos</option>${lista(c.list).map(o => `<option value="${esc(o.valor)}"${filters[c.k] === o.valor ? " selected" : ""}>${esc(o.valor)}</option>`).join("")}<option value="__vacio"${filters[c.k] === "__vacio" ? " selected" : ""}>(vacío)</option></select>`;
    else if (c.type === "long") inner = `<input data-f="${c.k}" type="search" placeholder="Buscar" value="${esc(filters[c.k] || "")}" aria-label="Buscar en ${esc(c.label)}">`;
    else if (c.type === "date") inner = `<select data-f="fecha" aria-label="Filtrar fecha"><option value="">Todas</option><option value="__futuro"${filters.fecha === "__futuro" ? " selected" : ""}>De hoy en adelante</option><option value="__pasado"${filters.fecha === "__pasado" ? " selected" : ""}>Ya pasaron</option><option value="__vacio"${filters.fecha === "__vacio" ? " selected" : ""}>Sin fecha</option></select>`;
    else if (c.type === "thumb") inner = `<select data-f="imagen_path" aria-label="Filtrar imagen"><option value="">Todas</option><option value="__con"${filters.imagen_path === "__con" ? " selected" : ""}>Con imagen</option><option value="__vacio"${filters.imagen_path === "__vacio" ? " selected" : ""}>Sin imagen</option></select>`;
    return `<th class="${c.sticky ? "sticky" : ""}">${inner}</th>`;
  }).join("") + "<th></th>";
  $("thead").innerHTML = `<tr class="h1">${h1}</tr><tr class="h2">${h2}</tr>`;
  $("thead").querySelectorAll("[data-sort]").forEach(th => th.addEventListener("click", () => { const k = th.dataset.sort; if (sortKey === k) sortDir = -sortDir; else { sortKey = k; sortDir = 1; } renderTable(); }));
  $("thead").querySelectorAll("[data-f]").forEach(el => el.addEventListener(el.tagName === "INPUT" ? "input" : "change", () => { filters[el.dataset.f] = el.value; renderBody(); }));
}
function renderMobileFilters(){
  const defs = [["mes","Mes","mes"],["semana","Semana","semana"],["status","Status","status"],["tipo","Tipo","tipo"],["pilar","Pilar","pilar"],["cumplio","¿Cumplió?","cumplio"]];
  $("mf-row").innerHTML = defs.map(([k, label, l]) => `<select data-mf="${k}" class="${filters[k] ? "on" : ""}" aria-label="Filtrar ${label}"><option value="">${label}: todos</option>${lista(l).map(o => `<option value="${esc(o.valor)}"${filters[k] === o.valor ? " selected" : ""}>${esc(o.valor)}</option>`).join("")}<option value="__vacio"${filters[k] === "__vacio" ? " selected" : ""}>${label}: vacío</option></select>`).join("");
  if (document.activeElement !== $("mf-q")) $("mf-q").value = filters.__q || "";
}
$("mf-row").addEventListener("change", e => { const s = e.target.closest("[data-mf]"); if (!s) return; filters[s.dataset.mf] = s.value; s.classList.toggle("on", !!s.value); renderBody(); });
let qT; $("mf-q").addEventListener("input", () => { clearTimeout(qT); qT = setTimeout(() => { filters.__q = $("mf-q").value; renderBody(); }, 150); });
function pass(p){
  const hoy = new Date().toISOString().slice(0,10);
  for (const [k, v] of Object.entries(filters)) {
    if (!v) continue;
    if (k === "__q") { const q = v.toLowerCase(); if (!["publicacion","copy","caption","inspo","contenido","pilar","tipo"].some(f => String(p[f] || "").toLowerCase().includes(q)) && !textoComentarios(p.id).toLowerCase().includes(q)) return false; continue; }
    const val = k === "comentarios" ? textoComentarios(p.id) : p[k];
    if (v === "__vacio") { if (val) return false; continue; }
    if (k === "fecha") { if (v === "__futuro" && !(val && val >= hoy)) return false; if (v === "__pasado" && !(val && val < hoy)) return false; continue; }
    if (k === "imagen_path") { if (v === "__con" && !val) return false; continue; }
    const col = COLS.find(c => c.k === k);
    if (col && col.type === "long") { if (!String(val || "").toLowerCase().includes(v.toLowerCase())) return false; }
    else if (val !== v) return false;
  }
  return true;
}
function sortedRows(){
  const rows = posts.filter(pass);
  const k = sortKey;
  rows.sort((a, b) => {
    let x = a[k] ?? "", y = b[k] ?? "";
    if (k === "comentarios") { x = ultimoComentario(a.id); y = ultimoComentario(b.id); }
    if (k === "mes") { x = MESES.indexOf(x); y = MESES.indexOf(y); }
    if (k === "dia") { x = DIAS.indexOf(x); y = DIAS.indexOf(y); }
    if (x === "" || x === -1) return 1; if (y === "" || y === -1) return -1;
    return (x > y ? 1 : x < y ? -1 : 0) * sortDir || String(a.created_at).localeCompare(String(b.created_at));
  });
  return rows;
}
function renderTable(){ if (isMobile()) renderMobileFilters(); else renderHead(); renderBody(); }
/* ---------- Quién tomó cada post: al sacarlo de "Pendiente" queda su bolita con iniciales ---------- */
const iniciales = n => String(n || "").trim().split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join("").toUpperCase() || "?";
const BOLITA_COL = ["#AB391B","#674E4A","#303030","#8C5A3C","#7A2A14","#5C4A46"];
function colorPersona(email){ let h = 0; for (const ch of String(email || "")) h = (h * 31 + ch.charCodeAt(0)) % 9973; return BOLITA_COL[h % BOLITA_COL.length]; }
function tomadoBolita(p, grande){
  if (!p.tomado_por || !p.status || p.status === "Pendiente") return "";
  const n = nombreDe(p.tomado_por), c = colorPersona(p.tomado_por);
  const t = `Lo tomó ${n}${p.tomado_at ? " · " + cuando(p.tomado_at) : ""}`;
  return `<span class="bolita${grande ? " g" : ""}" style="background:${c};color:${textOn(c)}" title="${esc(t)}" aria-label="${esc(t)}">${esc(iniciales(n))}</span>`;
}
function pintarTomado(){ const p = current; $("e-tomado").innerHTML = p && tomadoBolita(p) ? `${tomadoBolita(p)}<span>Lo tomó ${esc(nombreDe(p.tomado_por))}</span>` : ""; }
const publicacionDisponible = p => !!p && Object.prototype.hasOwnProperty.call(p,"publicacion");
function cellHtml(p, c){
  if (c.k === "publicacion" && !publicacionDisponible(p)) return '<span class="note" title="Pendiente de activar el campo en Supabase">Pendiente de activar</span>';
  const v = p[c.k];
  if (c.type === "date") return `<div class="f-cell"><span class="mover" data-mover title="Mantén presionado y arrastra para cambiar el orden" aria-hidden="true">⠿</span><input type="date" data-k="fecha" value="${esc(v || "")}" aria-label="Fecha"></div>`;
  if (c.type === "list") {
    const col = colorDe(c.list, v);
    const style = col ? `background:${col};color:${textOn(col)}` : "";
    const sel = `<select data-k="${c.k}" class="${v && col ? "chip-sel" : ""}" style="${style}" aria-label="${esc(c.label)}">${optionsHtml(c.list, v, true)}</select>`;
    return c.k === "status" ? `<div class="st-cell">${sel}${tomadoBolita(p)}</div>` : sel;
  }
  if (c.type === "thumb") { const u = thumbUrl(v); return v && u ? `<button class="icon-btn" data-img="${p.id}" title="Ver o cambiar imagen"><img class="thumb" src="${esc(u)}" alt="" loading="lazy" decoding="async"></button>` : `<button class="icon-btn" data-img="${p.id}" title="Subir imagen" aria-label="Subir imagen">＋</button>`; }
  if (c.k === "comentarios") return comentCelda(p);
  if (c.type === "long" && LINK_FIELDS.includes(c.k) && linksDe(v).length) {
    const resto = String(v).replace(URL_RE, "").trim();
    return `<div class="lcell">${chipsLinks(v)}${resto ? `<span class="lnote">${esc(resto)}</span>` : ""}<button class="icon-btn ledit" data-long="${c.k}" title="Editar enlaces" aria-label="Editar ${esc(c.label)}">✎</button></div>`;
  }
  if (c.type === "long") {
    const isLink = /^https?:\/\/\S+$/.test(String(v || "").trim());
    if (isLink) return `<div style="display:flex;align-items:flex-start"><button class="txt" data-long="${c.k}" title="Ver completo y editar"><span class="clamp">${esc(v)}</span></button><a class="icon-btn" href="${esc(String(v).trim())}" target="_blank" rel="noopener" title="Abrir enlace" aria-label="Abrir enlace">↗</a></div>`;
    return `<button class="txt${v ? "" : " empty"}" data-long="${c.k}" title="Ver completo y editar"><span class="clamp">${v ? esc(String(v).replace(/\s*\n+\s*/g, " ")) : "—"}</span></button>`;
  }
  return "";
}
/* ---------- Mover posts arrastrando desde la fecha ----------
   Las fechas se quedan en su lugar (como casillas del calendario) y los posts cambian de casilla:
   si mueves el del día 5 arriba del día 1, toma el día 1 y los demás recorren su fecha (y su día, mes y semana). */
const reordenando = { activo: false, bloquearClick: false };
function iniciarReorden(){
  const holdMs = 380;
  let timer = null, startY = 0, startX = 0, srcEl = null, contenedor = null, items = [], ids = [], from = -1, to = -1, linea = null, autoScroll = null, pointerY = 0;
  const filas = () => isMobile() ? [...$("cards").querySelectorAll(".pcard[data-open]")] : [...$("tbody").querySelectorAll("tr[data-id]")];
  const idDe = el => el.dataset.id || el.dataset.open;
  function cancelarEspera(){ clearTimeout(timer); timer = null; }
  function comenzar(el){
    if (!(sortKey === "fecha" && sortDir === 1)) { sortKey = "fecha"; sortDir = 1; renderTable(); saved("Ordené la tabla por fecha. Ahora mantén presionado para mover.", false); return; }
    const p = posts.find(x => x.id === idDe(el)); if (!p || !p.fecha) { saved("Ese post no tiene fecha. Ponle una para poder moverlo.", true); return; }
    items = filas(); ids = items.map(idDe); from = to = items.indexOf(el); if (from < 0) return;
    reordenando.activo = true; srcEl = el; el.classList.add("arrastrando"); document.body.classList.add("reordenando");
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    linea = document.createElement("div"); linea.className = "reorden-linea"; document.body.appendChild(linea);
    if (navigator.vibrate) navigator.vibrate(15);
    mover(pointerY);
    autoScroll = setInterval(() => { const m = 70; if (pointerY < m) scrollBy(0, -12); else if (pointerY > innerHeight - m) scrollBy(0, 12); }, 16);
  }
  function mover(y){
    if (!reordenando.activo) return;
    let idx = items.length;
    for (let i = 0; i < items.length; i++) { const r = items[i].getBoundingClientRect(); if (y < r.top + r.height / 2) { idx = i; break; } }
    to = idx > from ? idx - 1 : idx;
    const ref = items[Math.min(idx, items.length - 1)].getBoundingClientRect(), base = srcEl.closest("table, ul, ol") || srcEl.parentElement, br = base.getBoundingClientRect();
    const top = idx >= items.length ? ref.bottom : ref.top;
    Object.assign(linea.style, { top: (top - 2) + "px", left: br.left + "px", width: br.width + "px" });
  }
  async function terminar(){
    clearInterval(autoScroll); if (linea) linea.remove(); linea = null;
    document.body.classList.remove("reordenando"); if (srcEl) srcEl.classList.remove("arrastrando");
    const ok = reordenando.activo; reordenando.activo = false;
    if (!ok || from === to || to < 0) return;
    reordenando.bloquearClick = true; setTimeout(() => reordenando.bloquearClick = false, 400);
    const nuevo = ids.slice(); const [id] = nuevo.splice(from, 1); nuevo.splice(to, 0, id);
    await aplicarOrden(ids, nuevo);
  }
  function abajo(e){
    if (e.button && e.button !== 0) return;
    const enLista = isMobile() ? e.target.closest("#cards .pcard[data-open]") : e.target.closest("#tbody tr[data-id]");
    if (!enLista) return;
    const handle = e.target.closest("[data-mover]"), enFecha = isMobile() ? true : !!e.target.closest(".c-fecha");
    if (!enFecha) return;
    pointerY = e.clientY; startY = e.clientY; startX = e.clientX;
    if (handle && !isMobile()) { e.preventDefault(); comenzar(enLista); return; }
    timer = setTimeout(() => { timer = null; comenzar(enLista); }, holdMs);
  }
  document.addEventListener("pointerdown", abajo);
  document.addEventListener("pointermove", e => {
    pointerY = e.clientY;
    if (timer && (Math.abs(e.clientY - startY) > 8 || Math.abs(e.clientX - startX) > 8)) cancelarEspera();
    if (reordenando.activo) { e.preventDefault(); mover(e.clientY); }
  });
  document.addEventListener("pointerup", () => { cancelarEspera(); terminar(); });
  document.addEventListener("pointercancel", () => { cancelarEspera(); if (reordenando.activo) terminar(); });
  document.addEventListener("touchmove", e => { if (reordenando.activo) e.preventDefault(); }, { passive: false });
  document.addEventListener("contextmenu", e => { if (reordenando.activo || timer) e.preventDefault(); });
}
async function aplicarOrden(antes, despues){
  const byId = id => posts.find(p => p.id === id);
  // Solo los posts con fecha participan; sus casillas (fecha, día, mes, semana) se conservan en el mismo orden
  const conFecha = antes.filter(id => byId(id) && byId(id).fecha);
  const slots = conFecha.map(id => { const p = byId(id); return { fecha: p.fecha, dia: p.dia, mes: p.mes, semana: p.semana }; });
  const orden = despues.filter(id => conFecha.includes(id));
  const previos = {}, cambios = [];
  orden.forEach((id, i) => { const p = byId(id), s = slots[i];
    if (p.fecha !== s.fecha) { previos[id] = { fecha: p.fecha, dia: p.dia, mes: p.mes, semana: p.semana };
      cambios.push([id, { fecha: s.fecha, dia: diaDe(s.fecha) || s.dia, mes: mesDe(s.fecha) || s.mes, semana: s.semana || null }]); } });
  if (!cambios.length) return;
  await guardarCambiosFecha(cambios, previos, true);
}
async function guardarCambiosFecha(cambios, previos, conDeshacer){
  cambios.forEach(([id, patch]) => { const p = posts.find(x => x.id === id); if (p) Object.assign(p, patch); });
  renderBody(); saved("Moviendo…");
  const res = await Promise.all(cambios.map(([id, patch]) => sb.from("posts").update(patch).eq("id", id)));
  const err = res.find(r => r.error);
  if (err) { saved(errMsg(err.error), true); return; }
  saved(`${cambios.length === 1 ? "1 post cambió" : cambios.length + " posts cambiaron"} de fecha.`);
  if (conDeshacer) avisoDeshacer(`Orden cambiado: ${cambios.length} ${cambios.length === 1 ? "fecha ajustada" : "fechas ajustadas"}.`, () => guardarCambiosFecha(Object.entries(previos).map(([id, p]) => [id, p]), null, false));
}
function avisoDeshacer(texto, fn){
  let t = $("toast"); if (!t) { t = document.createElement("div"); t.id = "toast"; t.className = "toast"; document.body.appendChild(t); }
  t.innerHTML = `<span>${esc(texto)}</span><button type="button" class="btn small">Deshacer</button>`;
  t.classList.add("on"); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove("on"), 7000);
  t.querySelector("button").onclick = () => { t.classList.remove("on"); fn(); };
}
iniciarReorden();
function renderBody(){
  const rows = sortedRows();
  $("count").textContent = `${rows.length} de ${posts.length} posts`;
  const emptyMsg = posts.length ? "Ningún post coincide con los filtros." : "Todavía no hay posts. Toca “+ Agregar post”.";
  if (isMobile()) {
    $("cards").innerHTML = rows.length ? rows.map(p => {
      const u = thumbUrl(p.imagen_path);
      return `<li><div class="pcard" data-open="${p.id}" role="button" tabindex="0" aria-label="Abrir post del ${fmtCorto(p.fecha)}">
        <span class="pthumb${u ? " has" : ""}" style="${u ? `background-image:url('${esc(u)}')` : ""}">${u ? "" : "＋"}</span>
        <span class="pbody">
          <span class="pdate">${esc(p.dia ? p.dia + " · " : "")}${fmtCorto(p.fecha)}${p.semana ? " · " + esc(p.semana) : ""}</span>
          ${p.publicacion ? `<span class="pdate">Publicación: ${esc(p.publicacion)}</span>` : ""}
          <span class="pcopy${p.copy ? "" : " empty"}">${esc(p.copy || "Sin copy")}</span>
          ${(linksDe(p.contenido).length || linksDe(p.inspo).length) ? `<span class="lnks">${chipsLinks(p.contenido)}${chipsLinks(p.inspo)}</span>` : ""}
          ${comentTarjeta(p)}
          <span class="pchips">${chip("tipo", p.tipo)}${chip("pilar", p.pilar)}${chip("status", p.status)}${tomadoBolita(p)}${chip("cumplio", p.cumplio)}<button type="button" class="cbadge cb-btn${nComent(p.id) ? "" : " vacio"}" data-coment aria-label="${nComent(p.id) ? "Ver " + nComent(p.id) + " comentarios" : "Escribir un comentario"}">💬${nComent(p.id) ? " " + nComent(p.id) : ""}</button></span>
        </span></div></li>`;
    }).join("") : `<li class="empty-state">${emptyMsg}</li>`;
    return;
  }
  $("tbody").innerHTML = rows.length ? rows.map(p => `<tr data-id="${p.id}">${COLS.map(c => `<td class="c-${c.k}${c.sticky ? " sticky" : ""}">${cellHtml(p, c)}</td>`).join("")}<td class="c-acc"><button class="icon-btn" data-edit="${p.id}" title="Abrir editor" aria-label="Abrir editor">✎</button><button class="icon-btn" data-del="${p.id}" title="Eliminar post" aria-label="Eliminar post">🗑</button></td></tr>`).join("")
    : `<tr><td colspan="${COLS.length + 1}" class="td-vacio"><div class="vacio"><img src="icons/motivo-flor.svg" alt="" width="132" height="120"><p>${emptyMsg}</p></div></td></tr>`;
}
$("cards").addEventListener("keydown", e => { if ((e.key === "Enter" || e.key === " ") && e.target.matches(".pcard")) { e.preventDefault(); e.target.click(); } });
$("cards").addEventListener("click", e => { if (reordenando.bloquearClick) { reordenando.bloquearClick = false; return; } if (e.target.closest("a")) return; const b = e.target.closest("[data-open]"); if (!b) return; const p = posts.find(x => x.id === b.dataset.open); if (!p) return; if (e.target.closest("[data-coment]")) abrirComentarios(p); else openEditor(p); });
$("tbody").addEventListener("change", e => {
  const el = e.target, tr = el.closest("tr"); if (!tr || !el.dataset.k) return;
  const id = tr.dataset.id, k = el.dataset.k, v = el.value || null;
  const patch = { [k]: v };
  const p = posts.find(x => x.id === id);
  if (k === "fecha" && v && p) { if (!p.dia) patch.dia = diaDe(v); if (!p.mes) patch.mes = mesDe(v); }
  if (el.tagName === "SELECT") { const c = COLS.find(x => x.k === k); const col = colorDe(c.list, v); el.className = v && col ? "chip-sel" : ""; el.style.cssText = col ? `background:${col};color:${textOn(col)}` : ""; }
  savePatch(id, patch, k === "fecha" && (patch.dia || patch.mes));
});
$("tbody").addEventListener("click", e => {
  const long = e.target.closest("[data-long]"), del = e.target.closest("[data-del]"), img = e.target.closest("[data-img]"), ed = e.target.closest("[data-edit]"), com = e.target.closest("[data-coment]");
  const tr = e.target.closest("tr"); if (!tr) return;
  const p = posts.find(x => x.id === tr.dataset.id); if (!p) return;
  if (com) abrirComentarios(p);
  else if (long) editLong(p, long.dataset.long);
  else if (del) confirmDelete(p);
  else if (img || ed) openEditor(p);
});
async function savePatch(id, patch, rerender){
  const p = posts.find(x => x.id === id); if (p) Object.assign(p, patch);
  saved("Guardando…");
  const { data, error } = await sb.from("posts").update(patch).eq("id", id).select("tomado_por,tomado_at,updated_at,updated_by");
  if (error) saved(errMsg(error), true); else { saved("Guardado"); const r = Array.isArray(data) ? data[0] : data; if (p && r) Object.assign(p, r); }
  if (rerender || "status" in patch) renderBody();
}
function editLong(p, k){
  if (k === "publicacion" && !publicacionDisponible(p)) { saved("Publicación todavía no está habilitada en la base de datos.", true); return; }
  const c = COLS.find(x => x.k === k), d = $("dlg");
  $("dlg-title").textContent = `${c.label}${p.fecha ? " · " + fmtCorto(p.fecha) : ""}`;
  $("dlg-text").value = p[k] || "";
  d.onclose = () => { if (d.returnValue === "ok") { const v = $("dlg-text").value; if (v !== (p[k] || "")) savePatch(p.id, { [k]: v || null }, true); } };
  d.returnValue = ""; d.showModal(); $("dlg-text").focus();
}
function confirmDelete(p){
  const d = $("confirm");
  $("cf-text").textContent = `Se eliminará el post${p.fecha ? " del " + fmtCorto(p.fecha) : ""}${p.copy ? " (“" + p.copy.slice(0,60) + "”)" : ""} con su imagen. No se puede deshacer.`;
  d.onclose = async () => {
    if (d.returnValue !== "ok") return;
    const { error } = await sb.from("posts").delete().eq("id", p.id);
    if (error) { saved(errMsg(error), true); return; }
    const imgs = [...slidesOf(p), ...blImgs(p.cuerpo)]; if (imgs.length) sb.storage.from(CFG.bucket).remove(imgs.flatMap(x => [x, thumbOf(x)]));
    posts = posts.filter(x => x.id !== p.id); if (current && current.id === p.id) closeEditor(true); renderAll(); saved("Post eliminado");
  };
  d.returnValue = ""; d.showModal();
}
async function addPost(){
  const minOrden = posts.reduce((m, p) => Math.min(m, p.orden ?? 0), 0);
  const row = { status: (opciones.status[0] || {}).valor || "Pendiente", orden: minOrden - 1 };
  saved("Creando…");
  const { data, error } = await sb.from("posts").insert(row).select().single();
  if (error) { saved(errMsg(error), true); banner(errMsg(error)); return null; }
  if (!posts.find(p => p.id === data.id)) posts.push(data);
  saved("Post creado"); return data;
}
$("btn-add").addEventListener("click", async () => {
  const p = await addPost(); if (!p) return;
  if (isMobile()) { renderBody(); openEditor(p); return; }
  filters = {}; sortKey = "created_at"; sortDir = -1; renderTable();
  const f = $("tbody").querySelector(`tr[data-id="${p.id}"] input[type=date]`); if (f) f.focus();
});
$("btn-clear").addEventListener("click", () => { filters = {}; sortKey = "fecha"; sortDir = 1; $("mf-q").value = ""; renderTable(); });

/* ---------- Feed ---------- */
function fillSelects(){
  const keep = id => $(id).value;
  const fm = keep("ff-mes"), fs = keep("ff-status"), rm = keep("rs-mes");
  $("ff-mes").innerHTML = '<option value="">Todos</option>' + MESES.map(m => `<option>${m}</option>`).join("");
  $("rs-mes").innerHTML = '<option value="">Todos</option>' + MESES.map(m => `<option>${m}</option>`).join("");
  $("ff-status").innerHTML = '<option value="">Todos</option>' + lista("status").map(o => `<option>${esc(o.valor)}</option>`).join("");
  $("ff-mes").value = fm; $("ff-status").value = fs; $("rs-mes").value = rm;
  $("op-color").innerHTML = PALETA.map(([h, n]) => `<option value="${h}">${n}</option>`).join("");
}
$("ff-mes").addEventListener("change", renderFeed); $("ff-status").addEventListener("change", renderFeed);
const ICON = {
  Reel: c => `<svg class="type" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="4"/><path d="M3 8h18M8 3l3 5M14 3l3 5"/><path d="M10 11.5v5l4.5-2.5z" fill="${c}" stroke="none"/></svg>`,
  Carrusel: c => `<svg class="type" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2" aria-hidden="true"><rect x="7" y="7" width="14" height="14" rx="2"/><path d="M17 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h2"/></svg>`
};
// Pilares internos: se planean en la Parrilla pero nunca se muestran en el Feed (ni cuadrícula ni historias)
const esInterno = p => /^contenidos?\s+bodas$/i.test(String(p.pilar || "").trim());
function feedListTodo(){
  const m = $("ff-mes").value, s = $("ff-status").value;
  return posts.filter(p => (!m || p.mes === m || (!p.mes && mesDe(p.fecha) === m)) && (!s || p.status === s));
}
function feedList(){ return feedListTodo().filter(p => !esInterno(p)); }
// Solo lo que aparece en la cuadrícula de Instagram: historias y otras plataformas quedan fuera
const FUERA_DEL_FEED = ["Historia", "Pin", "TikTok", "Video YT", "Blog"];
// La pauta (categoría "Pauta") es publicidad: no aparece en el feed orgánico (cuadrícula, historias ni Facebook)
const enFeed = p => !FUERA_DEL_FEED.includes(p.tipo) && !esPauta(p);
const feedOrder = list => list.filter(enFeed).sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0) || String(b.fecha || "").localeCompare(String(a.fecha || "")));
const IG_I = {
  dots: '<svg viewBox="0 0 24 24"><circle cx="5" cy="12" r="1.4" fill="currentColor"/><circle cx="12" cy="12" r="1.4" fill="currentColor"/><circle cx="19" cy="12" r="1.4" fill="currentColor"/></svg>',
  addp: '<svg viewBox="0 0 24 24"><circle cx="13" cy="8" r="4"/><path d="M6 20c.8-3.5 3.6-5.5 7-5.5s6.2 2 7 5.5M5 6v6M2 9h6"/></svg>',
  link: '<svg viewBox="0 0 24 24"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/></svg>',
};
function avatarHtml(k, cls){ const f = pfFoto(k); return `<span class="pf-av ${cls}${f ? " foto" : ""}"><img src="${esc(f || "icons/simbolo-arena.png")}" alt=""></span>`; }
function linkTxt(l){ return String(l || "").replace(/^https?:\/\//, "").replace(/\/$/, ""); }
let igBioAbierta = false;
function renderIgHeader(nPosts, historias){
  const k = "instagram", P = pf(k), hay = historias.length > 0;
  const lineas = String(P.bio || "").split("\n"), corta = lineas.length > 3 && !igBioAbierta;
  const bio = esc((corta ? lineas.slice(0, 3) : lineas).join("\n")) + (corta ? `… <button type="button" class="igp-mas" data-bio-mas>más</button>` : "");
  const pubs = (P.extra || "").trim() || String(nPosts);
  $("ig-profile").innerHTML = `
    <div class="igp-main">
      <button type="button" class="igp-av${hay ? " ring" : ""}" id="igp-av" aria-label="${hay ? "Ver historias" : "Foto de perfil"}">${avatarHtml(k, "igp-foto")}</button>
      <div class="igp-info">
        <div class="igp-row1"><h2>${esc(pfDato(k, "usuario", "yucatalove"))}</h2><span class="igp-dots">${IG_I.dots}</span></div>
        ${P.nombre ? `<div class="igp-name">${esc(P.nombre)}</div>` : ""}
        <div class="igp-stats"><span><b>${esc(pubs)}</b> publicaciones</span><span><b>${esc(pfDato(k, "seguidores"))}</b> seguidores</span><span><b>${esc(pfDato(k, "seguidos"))}</b> seguidos</span></div>
        <div class="igp-bio">${P.categoria ? `<span class="igp-cat">${esc(P.categoria)}</span>` : ""}${P.bio ? `<span class="igp-txt">${bio}</span>` : ""}${P.link ? `<a class="igp-link" href="${esc(/^https?:/.test(P.link) ? P.link : "https://" + P.link)}" target="_blank" rel="noopener">${IG_I.link}${esc(linkTxt(P.link))}</a>` : ""}</div>
      </div>
    </div>
    <div class="igp-btns"><span class="igp-btn" data-editar-perfil>Editar perfil</span><span class="igp-btn" data-compartir-perfil>Compartir perfil</span><span class="igp-btn igp-ico" aria-hidden="true">${IG_I.addp}</span></div>`;
}
$("ig-profile").addEventListener("click", async e => {
  if (e.target.closest("[data-bio-mas]")) { igBioAbierta = true; renderFeed(); return; }
  if (e.target.closest("[data-editar-perfil]")) { abrirEditorPerfil("instagram"); return; }
  if (e.target.closest("[data-compartir-perfil]")) { const u = "https://instagram.com/" + pfDato("instagram", "usuario", "yucatalove"); const ok = await copiarTexto(u); const b = e.target.closest("[data-compartir-perfil]"); b.textContent = ok ? "Link copiado ✓" : u; setTimeout(() => renderFeed(), 1500); return; }
  if (e.target.closest("#igp-av")) { const h = historiasVisibles(); if (h.length) abrirHistorias(h[0].id); else abrirEditorPerfil("instagram"); }
});

/* ---------- Plataformas del Feed (Instagram, TikTok, Pinterest, Facebook, Pauta, Blog) ---------- */
const PLATS = {
  instagram: { n: "Instagram", bio: "Destination weddings in Yucatán · Together as one", filtro: null },
  tiktok:    { n: "TikTok", bio: "Videos de TikTok del mes", filtro: p => p.tipo === "TikTok", vacio: "No hay TikToks para este filtro. En la Parrilla, ponles tipo “TikTok”." },
  pinterest: { n: "Pinterest", bio: "Pines del mes", filtro: p => p.tipo === "Pin", vacio: "No hay pines para este filtro. En la Parrilla, ponles tipo “Pin”." },
  facebook:  { n: "Facebook", bio: "Así se verán en Facebook los posts del feed de Instagram", filtro: p => !FUERA_DEL_FEED.includes(p.tipo) && !esPauta(p), vacio: "No hay posts del feed para este filtro." },
  pauta:     { n: "Pauta", bio: "Anuncios del mes", filtro: p => esPauta(p), vacio: "No hay pauta para este filtro. En la Parrilla, ponles la categoría (pilar) “Pauta”." },
  blog:      { n: "Blog", bio: "Artículos del blog", filtro: p => p.tipo === "Blog", vacio: "No hay artículos para este filtro. En la Parrilla, ponles tipo “Blog”." },
};
// Pauta es una categoría (pilar): el post puede ser Reel, Carrusel o Post estático, pero no va al feed orgánico
function esPauta(p){ return String(p.pilar || "").trim().toLowerCase() === "pauta"; }
let plat = "instagram"; try { plat = sessionStorage.getItem("plat") || "instagram"; } catch (_) {}
if (!PLATS[plat]) plat = "instagram";
function abrirMenuPlat(anchor){
  const m = $("plat-menu"), base = feedListTodo().filter(p => !esInterno(p));
  m.innerHTML = Object.entries(PLATS).map(([k, v]) => {
    const n = k === "instagram" ? feedOrder(base).length : base.filter(v.filtro).length;
    return `<button type="button" role="menuitemradio" aria-checked="${k === plat}" data-plat="${k}" class="${k === plat ? "on" : ""}"><span class="pm-ic pm-${k}">${PLAT_IC[k]}</span><span class="pm-n">${v.n}</span><span class="pm-c">${n}</span></button>`;
  }).join("");
  m.classList.remove("hidden");
  const r = anchor.getBoundingClientRect(), mw = m.offsetWidth, mh = m.offsetHeight;
  let left = Math.min(Math.max(8, r.left + r.width / 2 - mw / 2), innerWidth - mw - 8);
  let top = r.bottom + 6; if (top + mh > innerHeight - 8) top = Math.max(8, r.top - mh - 6);
  m.style.left = left + "px"; m.style.top = top + "px";
  $("plat-btn").setAttribute("aria-expanded", "true");
  const f = m.querySelector(".on") || m.querySelector("button"); f && f.focus();
}
function cerrarMenuPlat(){ $("plat-menu").classList.add("hidden"); $("plat-btn").setAttribute("aria-expanded", "false"); }
const PLAT_IC = {
  instagram: '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor"/></svg>',
  tiktok: '<svg viewBox="0 0 24 24"><path d="M14 3v11.5a3.5 3.5 0 1 1-3.5-3.5"/><path d="M14 3c.5 2.6 2.4 4.4 5 4.6"/></svg>',
  pinterest: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M11 8.5c3-1.2 5.5.6 4.6 3.4-.6 2-2.6 2.6-3.8 1.4M11.6 10l-2 9"/></svg>',
  facebook: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M13.5 21v-7.5h2.5M13.5 21v-9.5c0-1.4.8-2.5 2.5-2.5h1M11 13.5h2.5"/></svg>',
  pauta: '<svg viewBox="0 0 24 24"><path d="M4 10v4h3l6 4V6L7 10H4z"/><path d="M16.5 9a4 4 0 0 1 0 6"/></svg>',
  blog: '<svg viewBox="0 0 24 24"><path d="M6 3h9l4 4v14H6z"/><path d="M9 11h7M9 15h7M9 7h4"/></svg>',
};
$("plat-btn").addEventListener("click", e => { e.stopPropagation(); $("plat-menu").classList.contains("hidden") ? abrirMenuPlat($("plat-btn")) : cerrarMenuPlat(); });
$("plat-menu").addEventListener("click", e => {
  const b = e.target.closest("[data-plat]"); if (!b) return;
  plat = b.dataset.plat; try { sessionStorage.setItem("plat", plat); } catch (_) {}
  cerrarMenuPlat(); renderFeed(); window.scrollTo(0, 0);
});
document.addEventListener("click", e => { if (!$("plat-menu").classList.contains("hidden") && !e.target.closest("#plat-menu, #plat-btn, #tab-feed")) cerrarMenuPlat(); });
document.addEventListener("keydown", e => { if (e.key === "Escape" && !$("plat-menu").classList.contains("hidden")) cerrarMenuPlat(); });
let pnCols = 0;
window.addEventListener("resize", () => { cerrarMenuPlat(); const c = innerWidth >= 1000 ? 5 : innerWidth >= 700 ? 4 : 2; if (view === "feed" && plat === "pinterest" && c !== pnCols) renderFeed(); pnCols = c; });

function renderPlataforma(){
  const P = PLATS[plat], list = feedList().filter(P.filtro).sort((a, b) => String(a.fecha || "9999").localeCompare(String(b.fecha || "9999")));
  const v = $("plat-view"); v.className = "plat-view pv-" + plat;
  const img = p => thumbUrl(p.imagen_path);
  const full = p => urlOf(p.imagen_path) || thumbUrl(p.imagen_path);
  const chipSt = p => { const st = p.status || ""; if (!st) return ""; const sc = colorDe("status", st) || "#F6F6F4"; return `<span class="chip st" style="background:${sc};color:${textOn(sc)}">${esc(st)}</span>`; };
  const ph = p => `<div class="ph"><div class="label-sm">${esc(p.pilar || "")}</div><div class="t">${esc(p.copy || p.tipo || "Post")}</div><div class="u">Sin imagen</div></div>`;
  const media = (p, cls = "") => img(p) ? `<img class="${cls}" src="${esc(img(p))}" alt="" loading="lazy">` : ph(p);
  const titulo = p => p.copy || String(p.caption || "").split("\n")[0] || "Sin título";
  const av = (cls = "") => avatarHtml(plat === "pauta" ? "instagram" : plat, cls);
  const D = (campo, def) => esc(pfDato(plat, campo, def));
  const Pp = pf(plat);
  const editar = `<button type="button" class="pf-edit" data-editar-perfil>✎ Editar perfil de ${esc(P.n)}</button>`;
  const vacio = `<div class="empty-state">${esc(P.vacio)}</div>`;
  const I = {
    grid: '<svg viewBox="0 0 24 24"><path d="M4 4h16v16H4zM4 9.3h16M4 14.6h16M9.3 4v16M14.6 4v16"/></svg>',
    lock: '<svg viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>',
    heart: '<svg viewBox="0 0 24 24"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/></svg>',
    com: '<svg viewBox="0 0 24 24"><path d="M20 12a8 8 0 0 1-11.6 7.1L4 20l1-4.2A8 8 0 1 1 20 12z"/></svg>',
    send: '<svg viewBox="0 0 24 24"><path d="M21 3 10 14M21 3l-7 18-4-7-7-4z"/></svg>',
    save: '<svg viewBox="0 0 24 24"><path d="M6 3h12v18l-6-5-6 5z"/></svg>',
    like: '<svg viewBox="0 0 24 24"><path d="M7 21H4V10h3zM7 10l4-7c1.7 0 2.5 1 2.2 2.6L12.6 9H19a2 2 0 0 1 2 2.3l-1.2 7.4A2.6 2.6 0 0 1 17.2 21H7"/></svg>',
    share: '<svg viewBox="0 0 24 24"><path d="M14 5l7 7-7 7v-4c-5 0-8 1.5-11 5 1-5.5 4-10 11-11z"/></svg>',
    dots: '<svg viewBox="0 0 24 24"><circle cx="5" cy="12" r="1.3" fill="currentColor"/><circle cx="12" cy="12" r="1.3" fill="currentColor"/><circle cx="19" cy="12" r="1.3" fill="currentColor"/></svg>',
    play: '<svg viewBox="0 0 24 24"><path d="M7 4v16l13-8z"/></svg>',
  };
  let html = "";

  if (plat === "tiktok") html = `<div class="tt">
      ${editar}<div class="tt-prof">${av("tt-av")}<h3>${D("usuario", "yucatalove")}</h3><div class="tt-user">${D("nombre", "YUC'ATÅLOVE")}</div>
        <div class="tt-stats"><span><b>${D("seguidos")}</b> Siguiendo</span><span><b>${D("seguidores")}</b> Seguidores</span><span><b>${D("extra")}</b> Me gusta</span></div>
        <div class="tt-btns"><span class="tt-follow">Seguir</span><span class="tt-msg">Mensaje</span></div>
        ${Pp.bio ? `<p class="tt-bio">${esc(Pp.bio)}</p>` : ""}${Pp.link ? `<span class="tt-link">🔗 ${esc(linkTxt(Pp.link))}</span>` : ""}</div>
      <div class="tt-tabs"><span class="on">${I.grid}</span><span>${I.lock}</span><span>${I.heart}</span></div>
      ${list.length ? `<div class="tt-grid">${list.map(p => `<button type="button" class="tt-tile" data-id="${p.id}">${media(p)}${chipSt(p)}<span class="tt-views">${I.play}${esc(fmtCorto(p.fecha) || "sin fecha")}</span></button>`).join("")}</div>` : vacio}</div>`;

  if (plat === "pinterest") html = `<div class="pn">
      ${editar}<div class="pn-prof">${av("pn-av")}<h3>${D("nombre", "YUC'ATÅLOVE")}</h3>
        <div class="pn-user"><span class="pn-p">P</span> ${D("usuario", "yucatalove")}${Pp.link ? ` · <u>${esc(linkTxt(Pp.link))}</u>` : ""}</div>
        ${Pp.bio ? `<p class="pn-bio">${esc(Pp.bio)}</p>` : ""}
        <div class="pn-stats">${Pp.extra ? `<b>${esc(Pp.extra)}</b> visualizaciones mensuales · ` : ""}<b>${D("seguidores")}</b> seguidores · <b>${D("seguidos")}</b> seguidos</div>
        <div class="pn-btns"><span class="pn-share">Compartir</span><span class="pn-follow">Seguir</span></div></div>
      <div class="pn-tabs"><span class="on">Creados</span><span>Guardados</span></div>
      ${list.length ? (() => { const cols = innerWidth >= 1000 ? 5 : innerWidth >= 700 ? 4 : 2, C = Array.from({ length: cols }, () => []);
        list.forEach((p, i) => C[i % cols].push(`<button type="button" class="pn-pin" data-id="${p.id}" title="${esc(titulo(p))}"><div class="pn-img" style="--pn-r:${["2/3","1/1","3/4","9/16","4/5"][(parseInt(String(p.id).replace(/[^0-9a-f]/gi, "").slice(-4), 16) || i) % 5]}">${media(p)}<span class="pn-ov"></span><span class="pn-save">Guardar</span><span class="pn-dom">↗ yucatalove.com</span><span class="pn-ics"><i>${I.share}</i><i>${I.dots}</i></span></div><div class="pn-t">${chipSt(p)}<span>${I.dots}</span></div></button>`));
        return `<div class="pn-grid">${C.map(c => `<div class="pn-col">${c.join("")}</div>`).join("")}</div>`; })() : vacio}</div>`;

  if (plat === "facebook") {
    const portada = list.find(p => p.imagen_path), cover = urlOf(Pp.portada_path);
    const MESES_L = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
    const fechaFb = f => { if (!f) return "sin fecha"; const [y, m, d] = f.split("-").map(Number); return `${d} de ${MESES_L[m - 1]}${y !== new Date().getFullYear() ? " de " + y : ""}`; };
    const im = x => `<img src="${esc(thumbUrl(x))}" alt="" loading="lazy">`;
    // Mosaico como Facebook: 2 = lado a lado · 3 = una arriba y dos abajo · 4 = 2×2 · 5+ = dos arriba, tres abajo y "+N"
    const fotos = p => { const s = slidesOf(p), n = s.length;
      if (n < 2) return `<div class="fb-media">${img(p) ? `<img src="${esc(full(p))}" alt="" loading="lazy">` : ph(p)}</div>`;
      if (n === 2) return `<div class="fb-mos fb-n2">${s.map(x => `<div>${im(x)}</div>`).join("")}</div>`;
      if (n === 3) return `<div class="fb-mos fb-n3">${s.map(x => `<div>${im(x)}</div>`).join("")}</div>`;
      if (n === 4) return `<div class="fb-mos fb-n4">${s.map(x => `<div>${im(x)}</div>`).join("")}</div>`;
      return `<div class="fb-mos fb-n5"><div class="fb-r2">${s.slice(0, 2).map(x => `<div>${im(x)}</div>`).join("")}</div><div class="fb-r3">${s.slice(2, 5).map((x, i) => `<div>${im(x)}${i === 2 && n > 5 ? `<span class="fb-more">+${n - 5}</span>` : ""}</div>`).join("")}</div></div>`; };
    const sub = [Pp.categoria ? `💼 ${esc(Pp.categoria)}` : "", Pp.precio ? esc(Pp.precio) : "", Pp.telefono ? `📞 ${esc(Pp.telefono)}` : ""].filter(Boolean).join(" · ");
    const avFb = cls => `<span class="fb-ring ${cls}">${av("")}<i class="fb-on"></i></span>`;
    html = `${editar}<div class="fb">
      <div class="fb-top"><div class="fb-cover">${cover ? `<img src="${esc(cover)}" alt="">` : portada ? `<img src="${esc(full(portada))}" alt="">` : `<div class="fb-cover-ph"><img src="icons/logo-arena-texto.png" alt=""></div>`}</div>
        <div class="fb-id">${avFb("fb-av")}
          <div class="fb-name"><h3>${D("nombre", "YucataLove")}</h3><div class="fb-cnt"><b>${D("seguidores")} seguidores</b> · <b>${D("extra")} reacciones</b></div>
            ${Pp.bio ? `<p class="fb-bio">${esc(Pp.bio)}</p>` : ""}${sub ? `<div class="fb-sub">${sub}</div>` : ""}</div>
          <div class="fb-btns"><span class="fb-like">${I.com} Mensaje</span><span class="fb-msg">${I.save} Seguir</span><span class="fb-msg">🔍 Buscar</span></div></div>
        <div class="fb-tabs"><span class="on">Todo</span><span>Información</span><span>Reels</span><span>Fotos</span><span>Seguidores</span><span>Más ▾</span><i class="fb-tdots">${I.dots}</i></div></div>
      <div class="fb-body"><aside class="fb-intro"><h4>Detalles</h4>${Pp.bio ? `<p>${esc(Pp.bio)}</p>` : ""}<ul>${Pp.categoria ? `<li>💼 Página · ${esc(Pp.categoria)}</li>` : ""}${Pp.telefono ? `<li>📞 ${esc(Pp.telefono)}</li>` : ""}${Pp.ubicacion ? `<li>📍 ${esc(Pp.ubicacion)}</li>` : ""}${Pp.link ? `<li>🔗 ${esc(linkTxt(Pp.link))}</li>` : ""}${Pp.precio ? `<li>💲 Rango de precios · ${esc(Pp.precio)}</li>` : ""}</ul></aside>
        <div class="fb-feed">${list.length ? list.map(p => { const txt = p.caption || p.copy || ""; const largo = txt.length > 220 || txt.split("\n").length > 3;
          return `<button type="button" class="fb-post" data-id="${p.id}">
          <div class="fb-ph">${avFb("fb-av-s")}<div><b>${D("nombre", "YucataLove")}</b><span>${esc(fechaFb(p.fecha))} · 🌐</span></div>${chipSt(p)}<i>${I.dots}</i></div>
          ${txt ? `<div class="fb-text"><p>${esc(largo ? txt.slice(0, 200).replace(/\s+\S*$/, "") : txt)}${largo ? ` … <b>Ver más</b>` : ""}</p></div>` : ""}${fotos(p)}
          <div class="fb-promo"><span>📣 Promociona esta publicación para aumentar el alcance de tu página</span><span class="fb-pbtn">Promocionar publicación</span></div>
          <div class="fb-acts"><span>${I.like} Me gusta</span><span>${I.com} Comentar</span><span>${I.share} Compartir</span></div></button>`; }).join("") : vacio}</div></div></div>`;
  }

  if (plat === "pauta") html = `${editar}<div class="ad-feed">${list.length ? list.map(p => { const n = slidesOf(p).length; return `<button type="button" class="ig-ad" data-id="${p.id}">
      <div class="ig-h">${av("ig-av")}<div><b>${esc(pfDato("instagram", "usuario", "yucatalove"))}</b><span>Publicidad${p.tipo ? " · " + esc(p.tipo) : ""}</span></div>${chipSt(p)}<i>${I.dots}</i></div>
      <div class="ig-media">${img(p) ? `<img src="${esc(full(p))}" alt="" loading="lazy">` : ph(p)}${n > 1 ? `<span class="tile-n">1/${n}</span>` : ""}</div>
      <div class="ig-cta"><span>${D("extra", "Más información")}</span><span>›</span></div>
      <div class="ig-icons"><span>${I.heart}${I.com}${I.send}</span><span>${I.save}</span></div>
      <p class="ig-cap"><b>${esc(pfDato("instagram", "usuario", "yucatalove"))}</b> ${esc(p.caption || p.copy || "")}</p>
      <span class="ig-date">${esc(fmtCorto(p.fecha) || "sin fecha")}</span></button>`; }).join("") : vacio}</div>`;

  if (plat === "blog") {
    const ext = p => { const c = String(p.caption || "").replace(/\*\*/g, "").replace(/^#+\s*/gm, "").replace(/\s+/g, " ").trim(); return esc(c.slice(0, 190)) + (c.length > 190 ? "" : ""); };
    const h1 = p => p.copy || ((p.seo || {}).titulo || "").split("|")[0].trim() || "Sin título";
    html = `${editar}<div class="yl">
      ${ylArriba()}
      <header class="yl-head"><div class="yl-logo">${Pp.foto_path ? `<img src="${esc(pfFoto("blog"))}" alt="">` : `<img src="icons/logo-color-texto.png" alt="YUC'ATÅLOVE">`}<span>TOGETHER AS ONE</span></div>
        <nav><span>Home</span><span>Services</span><span>About</span><span>Real Weddings</span><span class="on">Journal</span><span>Media</span><span>Contact</span></nav></header>
      <div class="yl-sec"><h2>${D("bio", "Start your wedding planning")}</h2><p>${esc(Pp.categoria || "Enjoy planning your wedding in Mexico. Get expert advice, timelines and resources to make sure your big day is better than you imagined.")}</p></div>
      ${list.length ? `<div class="yl-grid">${list.map(p => `<button type="button" class="yl-card" data-blog="${p.id}">
          <div class="yl-img">${img(p) ? `<img src="${esc(full(p))}" alt="${esc((p.seo || {}).alt || "")}" loading="lazy">` : ph(p)}</div>
          <h3>${esc(h1(p))}</h3><p>${ext(p)}</p><span class="yl-more">Discover this wedding »</span>
          <span class="yl-meta">${esc(fmtCorto(p.fecha) || "sin fecha")}${(p.seo || {}).cat ? " · " + esc(p.seo.cat) : ""} ${chipSt(p)}</span></button>`).join("")}</div>` : vacio}
      ${ylPie()}
    </div>`;
  }
  v.innerHTML = html;
}
$("plat-view").addEventListener("click", e => { if (e.target.closest("[data-editar-perfil]")) { abrirEditorPerfil(plat); return; }
  const b = e.target.closest("[data-blog]"); if (b) { const p = posts.find(x => x.id === b.dataset.blog); if (p) abrirArticulo(p); return; }
  const t = e.target.closest("[data-id]"); if (!t) return; const p = posts.find(x => x.id === t.dataset.id); if (p) abrirPublicar(p); });

function renderFeed(){
  const P = PLATS[plat], esIG = plat === "instagram";
  $("plat-name").textContent = P.n;
  $("ig-view").classList.toggle("hidden", !esIG); $("btn-sort").classList.toggle("hidden", !esIG);
  $("plat-view").classList.toggle("hidden", esIG);
  if (!esIG) { renderPlataforma(); return; }
  const list = feedList();
  const feed = feedOrder(list);
  const st = list.filter(p => p.tipo === "Historia" && !esPauta(p)).sort((a, b) => String(a.fecha || "").localeCompare(String(b.fecha || "")));
  renderIgHeader(feed.length, st);
  $("ig-plan").textContent = `Plan de este filtro: ${feed.length} en el feed · ${feed.filter(p => p.imagen_path).length} con imagen · ${st.length} historias`;
  const otras = list.filter(p => (FUERA_DEL_FEED.includes(p.tipo) && p.tipo !== "Historia") || esPauta(p)).length;
  const internos = feedListTodo().filter(esInterno).length;
  $("st-otras").textContent = [otras ? `${otras} de otras plataformas o de pauta (TikTok, Pin, Blog, YouTube, Pauta) no se muestran aquí; búscalos con el menú de plataformas.` : "", internos ? `${internos} de “Contenidos bodas” son internos y no aparecen en el Feed.` : ""].filter(Boolean).join(" ") + (otras || internos ? " Están en la Parrilla y el Calendario." : "");
  const g = $("feed-grid"); g.innerHTML = "";
  if (!feed.length) g.innerHTML = '<div class="empty-state">No hay posts para este filtro. Agrégalos en la pestaña Parrilla.</div>';
  const frag = document.createDocumentFragment();
  feed.forEach(p => {
    const b = document.createElement("button"); b.type = "button"; b.dataset.id = p.id;
    b.draggable = !isMobile();
    const src = thumbUrl(p.imagen_path);
    b.className = "tile" + (src ? "" : " empty") + (current && current.id === p.id ? " sel" : "");
    b.setAttribute("aria-label", `${p.tipo || "Post"} del ${fmtCorto(p.fecha)}: ${p.copy || "sin copy"}`);
    const st = p.status || "", sc = colorDe("status", st) || "#F6F6F4";
    b.innerHTML = (src ? `<img src="${esc(src)}" alt="" loading="lazy" decoding="async">` : `<div class="ph"><div class="label-sm">${esc(p.pilar || "")}</div><div class="t">${esc(p.copy || p.tipo || "Post")}</div><div class="u">Sin imagen</div></div>`)
      + (ICON[p.tipo] ? ICON[p.tipo](src ? "#fff" : "#674E4A") : "")
      + (slidesOf(p).length > 1 ? `<span class="tile-n">${slidesOf(p).length}</span>` : "")
      + `<div class="meta"><span class="chip date">${fmtCorto(p.fecha)}</span>${st ? `<span class="chip" style="background:${sc};color:${textOn(sc)}">${esc(st)}</span>` : ""}</div>`;
    frag.appendChild(b);
  });
  g.appendChild(frag);
  const s = $("stories");
  s.innerHTML = st.map(p => { const src = thumbUrl(p.imagen_path); return `<button type="button" class="story" data-id="${p.id}"><div class="ring"><span style="${src ? `background-image:url('${esc(src)}')` : ""}"></span></div>${esc(fmtCorto(p.fecha))}</button>`; }).join("")
    + `<button type="button" class="story story-add" id="story-add"><div class="ring"><span>＋</span></div>Nueva</button>`;
}
$("feed-grid").addEventListener("click", e => { const t = e.target.closest(".tile"); if (!t) return; const p = posts.find(x => x.id === t.dataset.id); if (p) abrirPublicar(p); });

/* ---------- Editor del artículo de Blog ----------
   El artículo se escribe sobre la página, como se verá en la web, con una barra para dar formato.
   Se guarda por bloques en posts.cuerpo:
     p (párrafo) · h (título 1–4) · img (una imagen o hasta 3 en fila) · ul / ol (listas) · cita · btn (botón) · hr (línea)
   Dentro de un bloque el texto solo admite negritas, cursivas, enlaces y saltos de línea. Todo lo demás se limpia
   al leerlo y también al pintarlo: lo pegado desde Docs o Word entra limpio y nada guardado se muestra sin limpiar. */
const blDoc = $("bl-doc"), blTools = $("bl-tools"), blCtx = $("bl-ctx");
const BL_ANCHO = window.matchMedia("(min-width:900px)");
const BL_URL_OK = /^(https?:\/\/|mailto:|tel:)/i;
const BL_BLOQUE = "p,div,h1,h2,h3,h4,h5,h6,ul,ol,blockquote,hr,figure,table,[data-b]";
const BL_W = { g: 1, m: 1, ch: 1 };
const BL_INERTE = document.implementation.createHTMLDocument("");   // para manipular HTML ajeno sin que nada cargue ni se ejecute
let blIsla = null, blRango = null, blSubiendo = 0, blDestino = null, blT = 0;
try { document.execCommand("defaultParagraphSeparator", false, "p"); document.execCommand("styleWithCSS", false, false); } catch (_) {}
const esBlogEd = () => $("e-tipo").value === "Blog";
const blUrl = h => { h = String(h || "").trim(); return !h ? "" : BL_URL_OK.test(h) ? h : /^[\w-]+(\.[\w-]+)+(\/|$|\?|#)/.test(h) ? "https://" + h : ""; };

// ---- Texto dentro de un bloque: de cualquier HTML a solo <strong> <em> <a href> <br>
function blInline(n){
  let out = "";
  n.childNodes.forEach(c => {
    if (c.nodeType === 3) { out += esc(c.nodeValue.replace(/ /g, " ")); return; }
    if (c.nodeType !== 1) return;
    const tag = c.tagName;
    if (tag === "BR") { out += "<br>"; return; }
    if ((c.dataset && c.dataset.b) || /^(SCRIPT|STYLE|TITLE|META|LINK|HEAD|IMG|HR|FIGURE|SVG|IFRAME|OBJECT|TEMPLATE|BUTTON|INPUT|SELECT|TEXTAREA)$/.test(tag)) return;
    let inner = blInline(c); if (!inner) return;
    const st = c.getAttribute("style") || "";
    const negr = /^(B|STRONG)$/.test(tag) ? !/font-weight:\s*(normal|[1-4]00)/i.test(st) : /font-weight:\s*(bold|[6-9]00)/i.test(st);
    const curs = /^(I|EM)$/.test(tag) ? !/font-style:\s*normal/i.test(st) : /font-style:\s*italic/i.test(st);
    if (tag === "A") { const h = blUrl(c.getAttribute("href")); if (h) inner = `<a href="${esc(h)}">${inner}</a>`; }
    if (curs) inner = `<em>${inner}</em>`;
    if (negr) inner = `<strong>${inner}</strong>`;
    if (/^(P|DIV|LI|BLOCKQUOTE|H[1-6]|TR)$/.test(tag) && out && !out.endsWith("<br>")) out += "<br>";
    out += inner;
  });
  return out;
}
const blInerte = h => { const d = BL_INERTE.createElement("div"); d.innerHTML = String(h || ""); return d; };
const blSan = h => blInline(blInerte(h));
const blRecorta = h => String(h).replace(/^(?:\s|<br>)+|(?:\s|<br>)+$/g, "");
const blPlano = h => blInerte(String(h || "").replace(/<br>/g, "\n")).textContent;

// ---- De la hoja (o de algo pegado) a bloques
function blLeer(root){
  const out = [];
  const texto = (t, x, extra) => { x = blRecorta(x); if (x.replace(/<br>/g, "").trim()) out.push(Object.assign({ t, x }, extra)); };
  const contenedor = n => {            // junta el texto suelto en párrafos y visita los bloques que traiga dentro
    let run = BL_INERTE.createElement("div");
    const cierra = () => { if (run.childNodes.length) { texto("p", blInline(run)); run = BL_INERTE.createElement("div"); } };
    [...n.childNodes].forEach(c => { if (c.nodeType === 1 && (c.matches(BL_BLOQUE) || c.querySelector(BL_BLOQUE))) { cierra(); visita(c); } else run.appendChild(BL_INERTE.importNode(c, true)); });
    cierra();
  };
  const visita = n => {
    const tag = n.tagName, b = n.dataset ? n.dataset.b : "";
    if (b === "img") { const imgs = [...n.querySelectorAll("img[data-src]")].slice(0, 3).map(i => ({ src: i.dataset.src, alt: (i.getAttribute("alt") || "").trim() })); if (imgs.length) out.push({ t: "img", imgs, pie: (n.dataset.pie || "").trim(), w: BL_W[n.dataset.w] ? n.dataset.w : "g" }); return; }
    if (b === "btn") { const x = (n.dataset.x || "").trim(); if (x) out.push({ t: "btn", x, href: blUrl(n.dataset.href) }); return; }
    if (b === "hr" || tag === "HR") { out.push({ t: "hr" }); return; }
    if (/^H[1-6]$/.test(tag)) { texto("h", blInline(n), { n: Math.min(4, +tag[1]) }); return; }
    if (tag === "UL" || tag === "OL") {
      const items = []; n.querySelectorAll("li").forEach(li => { const c = BL_INERTE.importNode(li, true); c.querySelectorAll("ul,ol").forEach(x => x.remove()); const x = blRecorta(blInline(c)); if (x) items.push(x); });
      if (items.length) out.push({ t: tag === "UL" ? "ul" : "ol", items }); return;
    }
    if (tag === "BLOCKQUOTE") { texto("cita", blInline(n)); return; }
    if (b === "tabla" || tag === "TABLE") {
      const tb = tag === "TABLE" ? n : n.querySelector("table"), filas = tb ? [...tb.rows] : [];
      const f = filas.slice(0, 40).map(tr => [...tr.cells].slice(0, 8).map(c => blRecorta(blInline(c)))).filter(r => r.length), cols = Math.max(0, ...f.map(r => r.length));
      if (cols >= 2 && (b === "tabla" || f.length >= 2)) { f.forEach(r => { while (r.length < cols) r.push(""); }); const llenas = f.filter(r => r.some(x => x)); if (llenas.length) out.push({ t: "tabla", f: llenas }); return; }   // las filas vacías no se guardan
      if (b === "tabla") return;
      // una sola columna o una sola fila: suele ser acomodo y no una tabla de datos; su contenido entra como texto normal
      filas.forEach(tr => [...tr.cells].forEach(c => { if (c.querySelector(BL_BLOQUE)) contenedor(c); else texto("p", blInline(c)); })); return;
    }
    if (tag === "FIGURE") { const x = blRecorta(blInline(n)); if (x) texto("p", x); return; }
    if (n.querySelector(BL_BLOQUE)) contenedor(n); else texto("p", blInline(n));
  };
  contenedor(root);
  return out;
}
// ---- De bloques a HTML (edit = hoja donde se escribe; si no, vista como en la web)
function blHtml(c, edit){
  const ce = edit ? ' contenteditable="false"' : "";
  return (Array.isArray(c) ? c : []).map(b => {
    if (!b || typeof b !== "object") return "";
    if (b.t === "p") return `<p>${blSan(b.x)}</p>`;
    if (b.t === "h") { const n = Math.min(4, Math.max(1, parseInt(b.n, 10) || 2)); return `<h${n}>${blSan(b.x)}</h${n}>`; }
    if (b.t === "ul" || b.t === "ol") return `<${b.t}>${(b.items || []).map(x => `<li>${blSan(x)}</li>`).join("")}</${b.t}>`;
    if (b.t === "cita") return `<blockquote>${blSan(b.x)}</blockquote>`;
    if (b.t === "hr") return edit ? `<div class="b-hr"${ce} data-b="hr"><hr></div>` : "<hr>";
    if (b.t === "btn") { const h = blUrl(b.href); return edit ? `<div class="b-btn"${ce} data-b="btn" data-x="${esc(b.x)}" data-href="${esc(h)}"><span>${esc(b.x)}</span></div>` : `<p class="b-btn"><a${h ? ` href="${esc(h)}"` : ""}>${esc(b.x)}</a></p>`; }
    if (b.t === "tabla") {   // la primera fila es el encabezado (en negritas, como las tablas del sitio); en la hoja cada celda se escribe aparte
      const f = (Array.isArray(b.f) ? b.f : []).filter(r => Array.isArray(r) && r.length); if (!f.length) return "";
      return `<div class="b-tabla"${edit ? `${ce} data-b="tabla"` : ""}><table><tbody>${f.map(r => `<tr>${r.map(x => `<td${edit ? ' contenteditable="true"' : ""}>${blSan(x) || (edit ? "<br>" : "")}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
    }
    if (b.t === "img") {
      const imgs = (b.imgs || []).filter(i => i && i.src).slice(0, 3), w = BL_W[b.w] ? b.w : "g"; if (!imgs.length) return "";
      return `<figure class="b-img b-${w}${imgs.length > 1 ? " b-fila" : ""}"${imgs.length > 1 ? ` style="--n:${imgs.length}"` : ""}${edit ? `${ce} data-b="img" data-w="${w}" data-pie="${esc(b.pie || "")}"` : ""}>${imgs.map(i => `<img src="${esc(urlOf(i.src))}" alt="${esc(i.alt || "")}"${edit ? ` data-src="${esc(i.src)}" draggable="false"` : ' loading="lazy"'}>`).join("")}${b.pie ? `<figcaption>${esc(b.pie)}</figcaption>` : ""}</figure>`;
    }
    return "";
  }).join("");
}
const blImgs = c => (Array.isArray(c) ? c : []).flatMap(b => b && b.t === "img" ? (b.imgs || []).map(i => i && i.src).filter(Boolean) : []);
const blTexto = c => (Array.isArray(c) ? c : []).map(b => !b ? "" : (b.t === "ul" || b.t === "ol") ? (b.items || []).map(x => "• " + blPlano(x)).join("\n") : (b.t === "p" || b.t === "h" || b.t === "cita") ? blPlano(b.x) : b.t === "tabla" ? (b.f || []).map(r => (r || []).map(blPlano).join(" | ")).join("\n") : "").filter(Boolean).join("\n\n");
// Texto de antes (escrito en el Caption, con ## para subtítulos y **negritas**) → bloques
function blDesdeTexto(txt){
  return String(txt || "").split(/\n{2,}/).map(b => b.trim()).filter(Boolean).map(b => {
    const m = b.match(/^(#{1,4})\s+([\s\S]*)$/);
    const x = esc(m ? m[2] : b).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/\n/g, "<br>");
    return m ? { t: "h", n: m[1].length, x } : { t: "p", x };
  });
}
const bloquesDe = p => (p && Array.isArray(p.cuerpo) && p.cuerpo.length) ? p.cuerpo : blDesdeTexto(p && p.caption);

// ---- Abrir y colocar la hoja
async function blPintarHoja(p){
  const c = bloquesDe(p);
  await signedUrls(blImgs(c));                         // las fotos del texto necesitan su dirección antes de pintarse
  if (!current || current.id !== p.id) return false;   // se cerró o se abrió otro mientras tanto
  blDoc.innerHTML = blHtml(c, true);
  blColocar(); blEstado(); seoPintar(); blMin();
  return true;
}
// ¿Es el mismo texto? (la base devuelve las propiedades de cada bloque en otro orden, por eso se comparan ordenadas)
const blIgual = (a, b) => { const k = v => JSON.stringify(v == null ? null : v, (_, x) => x && typeof x === "object" && !Array.isArray(x) ? Object.keys(x).sort().reduce((o, c) => (o[c] = x[c], o), {}) : x); return k(a) === k(b); };
async function blCargar(p){
  blQuitarSel(); blRango = null; blDoc.innerHTML = "";
  if (p.tipo !== "Blog") return;
  if (!(await blPintarHoja(p))) return;
  // Un artículo es largo y lo escriben varias personas: por si esta pantalla traía una versión vieja, se compara con lo guardado
  // y, si cambió y todavía no se ha escrito nada aquí, se pinta la más nueva. No frena la apertura: la hoja ya está pintada.
  try {
    const { data: f } = await sb.from("posts").select("cuerpo,caption").eq("id", p.id).maybeSingle();
    if (!f || !current || current.id !== p.id || current.tipo !== "Blog" || editorDirty) return;
    const sinCuerpo = !(Array.isArray(f.cuerpo) && f.cuerpo.length);
    if (blIgual(f.cuerpo, current.cuerpo) && !(sinCuerpo && (f.caption || "") !== (current.caption || ""))) return;
    current.cuerpo = f.cuerpo; current.caption = f.caption; await blPintarHoja(current);
  } catch (_) {}
}
// Escritorio: la hoja va dentro de la página (panel derecho) y la barra queda fija arriba. Celular: todo dentro del formulario.
function blColocar(){
  if (!esBlogEd()) return;
  const slot = $("bl-slot");
  if (BL_ANCHO.matches && slot) {
    const prev = $("ed-prev"), pag = $("ed-prev-page");
    if (blTools.parentNode !== prev) { prev.insertBefore(blTools, pag); prev.insertBefore(blCtx, pag); }
    if (blDoc.parentNode !== slot) slot.appendChild(blDoc);
  } else if (!BL_ANCHO.matches) {
    const m = $("bl-movil");
    if (blDoc.parentNode !== m) { m.appendChild(blTools); m.appendChild(blCtx); m.appendChild(blDoc); }
  }
}
const blCambiaAncho = () => { if (current && esBlogEd()) blPintarPagina(); };
if (BL_ANCHO.addEventListener) BL_ANCHO.addEventListener("change", blCambiaAncho); else if (BL_ANCHO.addListener) BL_ANCHO.addListener(blCambiaAncho);
const blAviso = t => { $("bl-aviso").textContent = t || ""; };
const blMin = () => { const e = $("ylp-min"); if (e) e.textContent = minLectura(blTexto(blLeer(blDoc))); };
function blCambio(){ editorDirty = true; clearTimeout(blT); blT = setTimeout(() => { seoPintar(); blMin(); }, 350); }

// ---- Selección y barra
function blBloque(n){ while (n && n !== blDoc && n.parentNode !== blDoc) n = n.parentNode; return n && n !== blDoc ? n : null; }
function blCursorEn(el){ const r = document.createRange(); r.selectNodeContents(el); r.collapse(true); blDoc.focus({ preventScroll: true }); const s = getSelection(); s.removeAllRanges(); s.addRange(r); blRango = r.cloneRange(); }
function blFoco(){ blDoc.focus({ preventScroll: true }); if (blRango) { const s = getSelection(); s.removeAllRanges(); s.addRange(blRango); } }
function blEstado(){
  const q = (f, c) => { try { return document[f](c); } catch (_) { return f === "queryCommandValue" ? "" : false; } };
  const dentro = document.activeElement === blDoc, tag = dentro ? String(q("queryCommandValue", "formatBlock") || "").toLowerCase() : "";
  const act = dentro ? { p: tag === "p", h1: tag === "h1", h2: tag === "h2", h3: tag === "h3", h4: tag === "h4", cita: tag === "blockquote", b: q("queryCommandState", "bold"), i: q("queryCommandState", "italic"), ul: q("queryCommandState", "insertUnorderedList"), ol: q("queryCommandState", "insertOrderedList") } : {};
  blTools.querySelectorAll("[data-bl]").forEach(b => b.classList.toggle("on", !!act[b.dataset.bl]));
}
document.addEventListener("selectionchange", () => {
  const s = getSelection(); if (!s.rangeCount) return;
  const r = s.getRangeAt(0);
  if (blDoc.contains(r.commonAncestorContainer)) { blRango = r.cloneRange(); blEstado(); blAviso(""); }
});
blDoc.addEventListener("blur", blEstado);
blDoc.addEventListener("focus", () => { if (!blDoc.firstChild) { blDoc.innerHTML = "<p><br></p>"; blCursorEn(blDoc.firstChild); } });
blDoc.addEventListener("input", () => { blOrdenar(); blCambio(); });
// El navegador a veces mete una lista, cita o título dentro de un párrafo: aquí se dejan como bloques sueltos de la hoja
// (así Enter, los estilos y el guardado se comportan siempre igual). No toca el texto, solo lo saca de su envoltura.
const BL_SUELTOS = "ul,ol,blockquote,h1,h2,h3,h4,p,div,[data-b]";
const blCursor = () => { const s = getSelection(); return s.rangeCount && blDoc.contains(s.anchorNode) ? [s.anchorNode, s.anchorOffset, s.focusNode, s.focusOffset] : null; };
function blPonCursor(c){   // repone el cursor en los mismos nodos de texto donde estaba (si siguen en la hoja)
  if (!c || !c[0].isConnected || !c[2].isConnected || !blDoc.contains(c[0]) || !blDoc.contains(c[2]) || c[0] === blDoc) return false;
  const tope = (n, o) => Math.min(o, n.nodeType === 3 ? n.nodeValue.length : n.childNodes.length);
  try { const s = getSelection(); s.setBaseAndExtent(c[0], tope(c[0], c[1]), c[2], tope(c[2], c[3])); blRango = s.getRangeAt(0).cloneRange(); return true; } catch (_) { return false; }
}
// Posición del cursor contada en letras desde el inicio de la hoja: sobrevive aunque el navegador rehaga los nodos (al hacer listas lo hace)
function blPos(){
  const s = getSelection(); if (!s.rangeCount || !blDoc.contains(s.focusNode)) return null;
  const b = blBloque(s.focusNode); if (!b || !b.textContent) return null;      // bloque vacío: el navegador ya deja bien el cursor
  const r = document.createRange(); r.selectNodeContents(blDoc); r.setEnd(s.focusNode, s.focusOffset); const pos = r.toString().length;
  r.selectNodeContents(b); r.setEnd(s.focusNode, s.focusOffset); return { pos, inicio: r.toString().length === 0 };
}
function blIrA(p){
  const w = document.createTreeWalker(blDoc, NodeFilter.SHOW_TEXT); let n, acc = 0;
  while ((n = w.nextNode())) {
    const fin = acc + n.nodeValue.length;
    if (fin > p.pos || (fin === p.pos && !p.inicio)) { const s = getSelection(); s.collapse(n, p.pos - acc); blRango = s.getRangeAt(0).cloneRange(); return true; }
    acc = fin;
  }
  return false;
}
function blOrdenar(){
  if (!blDoc.querySelector(":scope > p [data-b], :scope > p ul, :scope > p ol, :scope > p blockquote, :scope > p h1, :scope > p h2, :scope > p h3, :scope > p h4, :scope > div, :scope > blockquote p, :scope > h1 ul, :scope > h2 ul, :scope > h3 ul, :scope > h4 ul")) return;
  // mover nodos descoloca el cursor: se anota dónde estaba (los nodos son los mismos, solo cambian de lugar) y se repone al final
  const cur = blCursor();
  [...blDoc.children].forEach(n => {
    if (n.dataset.b) return;
    if (/^(P|DIV)$/.test(n.tagName) && n.querySelector(BL_SUELTOS)) {
      const frag = document.createDocumentFragment(); let run = null;
      [...n.childNodes].forEach(c => {
        if (c.nodeType === 1 && c.matches(BL_SUELTOS)) { run = null; frag.appendChild(c); return; }
        if (!run) { if (c.nodeType === 3 && !c.nodeValue.trim()) return; run = document.createElement("p"); frag.appendChild(run); }
        run.appendChild(c);
      });
      n.replaceWith(frag);
    } else if (n.tagName === "DIV") { const p = document.createElement("p"); while (n.firstChild) p.appendChild(n.firstChild); n.replaceWith(p); }
    else if (n.tagName === "BLOCKQUOTE" && n.querySelector("p")) n.querySelectorAll("p").forEach(x => { const br = x.nextSibling ? document.createElement("br") : null; while (x.firstChild) x.before(x.firstChild); if (br) x.before(br); x.remove(); });
    else if (/^H[1-4]$/.test(n.tagName) && n.querySelector("ul,ol")) { const p = document.createElement(n.tagName); p.textContent = n.textContent; n.replaceWith(p); }
  });
  blPonCursor(cur);
}
blTools.addEventListener("mousedown", e => { if (e.target.closest("button")) e.preventDefault(); });   // no perder la selección del texto
blTools.addEventListener("click", e => { const b = e.target.closest("[data-bl]"); if (b && current) blCmd(b.dataset.bl); });
function blCmd(k){
  if (k === "img") { blDestino = null; $("bl-file").click(); return; }
  if (k === "btn") { blSeleccionar(blInsertar(blHtml([{ t: "btn", x: "Texto del botón", href: "" }], true))); blCambio(); const i = blCtx.querySelector('[data-cx="btn-x"]'); if (i) { i.focus(); i.select(); } return; }
  if (k === "hr") { blInsertar(blHtml([{ t: "hr" }], true)); blCambio(); return; }
  if (k === "tabla") { const n = blInsertar(blHtml([{ t: "tabla", f: [["", "", ""], ["", "", ""], ["", "", ""]] }], true)); blSeleccionar(n, true); blCambio(); blCursorCelda(n.querySelector("td")); return; }
  const celda = blCelda();
  if (celda) {   // dentro de una celda solo hay formato de letra; los estilos de bloque romperían la tabla
    if (k === "b" && celda.parentNode.rowIndex === 0) blAviso("El encabezado de la tabla ya va en negritas.");
    else if (k === "b" || k === "i") { document.execCommand(k === "b" ? "bold" : "italic"); blCambio(); }
    else blAviso("Dentro de una tabla solo se usan negritas y cursiva.");
    return;
  }
  blQuitarSel(); blFoco();
  if (k === "a") { blCtxEnlace(); return; }
  const antes = /^(ul|ol)$/.test(k) && getSelection().isCollapsed ? blPos() : null;
  if (k === "b") document.execCommand("bold");
  else if (k === "i") document.execCommand("italic");
  else if (k === "ul") document.execCommand("insertUnorderedList");
  else if (k === "ol") document.execCommand("insertOrderedList");
  else {
    const tag = k === "cita" ? "blockquote" : k;
    let actual = ""; try { actual = String(document.queryCommandValue("formatBlock") || "").toLowerCase(); } catch (_) {}
    document.execCommand("formatBlock", false, actual === tag && tag !== "p" ? "p" : tag);   // tocar otra vez el mismo estilo lo regresa a párrafo
  }
  blOrdenar();
  if (antes) blIrA(antes);   // al hacer la lista el navegador manda el cursor al inicio: se regresa a donde estaba
  blEstado(); blCambio();
}
blDoc.addEventListener("keydown", e => {
  const td = e.target.closest ? e.target.closest('[data-b="tabla"] td') : null;
  if (td) {   // en una tabla: Enter baja de renglón dentro de la celda y Tab pasa a la celda siguiente
    if (e.key === "Enter" && !e.isComposing) { e.preventDefault(); document.execCommand("insertLineBreak"); }
    else if (e.key === "Tab") { const cs = [...td.closest("table").querySelectorAll("td")], sig = cs[cs.indexOf(td) + (e.shiftKey ? -1 : 1)]; if (sig) { e.preventDefault(); blCursorCelda(sig); } }
    return;
  }
  if (e.key !== "Enter" || e.shiftKey || e.isComposing) return;
  const n = getSelection().anchorNode, el = n && (n.nodeType === 1 ? n : n.parentElement), b = el && el.closest("h1,h2,h3,h4,blockquote");
  // Enter en un título o cita vacíos: vuelve a texto normal (para "salir" del estilo)
  if (b && blDoc.contains(b) && !b.textContent.trim()) { e.preventDefault(); document.execCommand("formatBlock", false, "p"); blOrdenar(); blEstado(); }
});

// ---- Pegar y soltar: entra limpio (títulos, listas, negritas, enlaces); las fotos pegadas o soltadas se suben
blDoc.addEventListener("paste", e => {
  const cd = e.clipboardData; if (!cd) return;
  e.preventDefault();
  const fotos = [...(cd.files || [])].filter(f => f.type.startsWith("image/"));
  if (fotos.length) { blSubirFotos(fotos, null); return; }
  if (e.target.closest && e.target.closest('[data-b="tabla"] td')) { const t = (cd.getData("text/plain") || "").replace(/\s*\n+\s*/g, " "); if (t.trim()) document.execCommand("insertText", false, t); blCambio(); return; }
  const html = cd.getData("text/html"), txt = cd.getData("text/plain");
  let limpio = "";
  if (html) { const c = blLeer(blInerte(html)).filter(b => b.t !== "img" && b.t !== "btn"); limpio = c.length === 1 && c[0].t === "p" ? c[0].x : blHtml(c, true); }
  if (!limpio && txt) { const partes = txt.replace(/\r/g, "").split(/\n+/).map(x => x.trim()).filter(Boolean); limpio = partes.length > 1 ? partes.map(x => `<p>${esc(x)}</p>`).join("") : esc(txt.trim()); }
  if (limpio) document.execCommand("insertHTML", false, limpio);
  blCambio();
});
blDoc.addEventListener("dragover", e => { if ([...(e.dataTransfer.types || [])].includes("Files")) e.preventDefault(); });
blDoc.addEventListener("drop", e => {
  const fs = [...(e.dataTransfer.files || [])]; if (!fs.length) return;
  e.preventDefault(); const b = blBloque(e.target); if (b) { const r = document.createRange(); r.selectNodeContents(b); r.collapse(false); blRango = r; }
  blSubirFotos(fs, null);
});
blDoc.addEventListener("dragstart", e => { if (e.target.closest && e.target.closest("[data-b]")) e.preventDefault(); });

// ---- Imágenes, botones y líneas: piezas que se seleccionan con un clic y se ajustan en la franja de opciones
function blInsertar(html, ref){
  const t = document.createElement("template"); t.innerHTML = html; const nodo = t.content.firstElementChild; if (!nodo) return null;
  if (!ref && blIsla && blIsla.isConnected) ref = blIsla;
  if (!ref && blRango) { const c = blRango.startContainer; ref = c === blDoc ? (blDoc.childNodes[Math.max(0, blRango.startOffset - 1)] || null) : blBloque(c); }
  if (ref && ref.parentNode === blDoc) { if (ref.nodeType === 1 && ref.tagName === "P" && !ref.textContent.trim() && !ref.querySelector("[data-b],img")) ref.replaceWith(nodo); else ref.after(nodo); }
  else blDoc.appendChild(nodo);
  const sig = nodo.nextElementSibling;
  if (!sig || sig.dataset.b) { const p = document.createElement("p"); p.innerHTML = "<br>"; nodo.after(p); }   // siempre se puede seguir escribiendo debajo
  const r = document.createRange(); r.selectNodeContents(nodo.nextElementSibling); r.collapse(true); blRango = r;   // lo siguiente continúa debajo
  return nodo;
}
function blQuitarSel(){ if (blIsla) blIsla.classList.remove("sel"); blIsla = null; blCtx.classList.add("hidden"); blCtx.innerHTML = ""; }
function blSeleccionar(el, conCursor){ if (!el) return; blQuitarSel(); blIsla = el; el.classList.add("sel"); if (!conCursor) getSelection().removeAllRanges(); blCtxIsla(); }
blDoc.addEventListener("click", e => {
  const isla = e.target.closest("[data-b]");
  if (!isla || !blDoc.contains(isla)) { blQuitarSel(); return; }
  if (isla.dataset.b === "tabla" && e.target.closest("td")) { if (blIsla !== isla) blSeleccionar(isla, true); return; }   // clic en una celda: se escribe ahí
  e.preventDefault(); blSeleccionar(isla);
});
blDoc.addEventListener("focusin", e => { const td = e.target.closest && e.target.closest('[data-b="tabla"] td'), isla = td && td.closest("[data-b]"); if (isla && blIsla !== isla) blSeleccionar(isla, true); });
// La celda de tabla donde está el cursor (o ninguna) y poner el cursor en una celda
function blCelda(){ const sel = getSelection(), n = sel.rangeCount ? sel.anchorNode : null, el = n && (n.nodeType === 1 ? n : n.parentElement), td = el && el.closest ? el.closest("td") : null; return td && blDoc.contains(td) && td.closest('[data-b="tabla"]') ? td : null; }
function blCursorCelda(td){ if (!td) return; td.focus({ preventScroll: true }); const r = document.createRange(); r.selectNodeContents(td); r.collapse(false); const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r); }
document.addEventListener("keydown", e => {
  if (!blIsla || !current || e.target.closest("input,textarea,select,[contenteditable=true]")) return;
  if (e.key === "Backspace" || e.key === "Delete") { e.preventDefault(); blAccion("quitar"); }
});
function blAjustarFila(f){ const n = f.querySelectorAll("img").length; f.classList.toggle("b-fila", n > 1); if (n > 1) f.style.setProperty("--n", Math.min(3, n)); else f.style.removeProperty("--n"); }
function blCtxIsla(){
  const el = blIsla; if (!el) return;
  const t = el.dataset.b, mover = '<button type="button" class="btn ghost small" data-cx="texto-arriba" title="Escribir un párrafo arriba">＋ Texto arriba</button><button type="button" class="btn ghost small" data-cx="arriba" title="Subir un lugar">↑</button><button type="button" class="btn ghost small" data-cx="abajo" title="Bajar un lugar">↓</button><button type="button" class="btn ghost small" data-cx="quitar">Quitar</button>';
  let h;
  if (t === "img") {
    const imgs = [...el.querySelectorAll("img")], w = el.dataset.w || "g";
    h = `<div class="fila"><b>${imgs.length > 1 ? imgs.length + " fotos en fila" : "Imagen"}</b>${imgs.length === 1 ? `<span class="seg" role="group" aria-label="Tamaño">${[["ch", "Chica"], ["m", "Mediana"], ["g", "Grande"]].map(([k, l]) => `<button type="button" data-cx="w" data-v="${k}" class="${w === k ? "on" : ""}">${l}</button>`).join("")}</span>` : '<button type="button" class="btn ghost small" data-cx="separar">Separar en fotos sueltas</button>'}${imgs.length < 3 ? '<button type="button" class="btn ghost small" data-cx="mas">＋ Foto al lado</button>' : ""}${mover}</div>`
      + imgs.map((im, i) => `<div class="fila"><input type="text" data-cx="alt" data-i="${i}" maxlength="125" aria-label="Texto alternativo${imgs.length > 1 ? " de la foto " + (i + 1) : ""}" placeholder="${imgs.length > 1 ? "Foto " + (i + 1) + ": qué" : "Qué"} se ve en la foto (texto alternativo: ayuda al SEO y a quien no puede verla)" value="${esc(im.getAttribute("alt") || "")}">${imgs.length > 1 ? `<button type="button" class="btn ghost small" data-cx="quitar-foto" data-i="${i}">Quitar esta</button>` : ""}</div>`).join("")
      + `<div class="fila"><input type="text" data-cx="pie" maxlength="200" aria-label="Pie de foto" placeholder="Pie de foto (opcional), por ejemplo el crédito del fotógrafo" value="${esc(el.dataset.pie || "")}"></div>`;
  } else if (t === "btn") {
    h = `<div class="fila"><b>Botón</b><input type="text" data-cx="btn-x" maxlength="80" aria-label="Texto del botón" placeholder="Texto del botón" value="${esc(el.dataset.x || "")}"><input type="url" data-cx="btn-href" aria-label="Enlace del botón" placeholder="A dónde lleva: https://www.yucatanlove.com/…" value="${esc(el.dataset.href || "")}">${mover}</div>`;
  } else if (t === "tabla") {
    h = `<div class="fila"><b>Tabla</b><button type="button" class="btn ghost small" data-cx="t-fila" title="Agregar una fila debajo de donde estás escribiendo">＋ Fila</button><button type="button" class="btn ghost small" data-cx="t-col" title="Agregar una columna a la derecha de donde estás escribiendo">＋ Columna</button><button type="button" class="btn ghost small" data-cx="t-nofila" title="Quitar la fila donde estás escribiendo">− Fila</button><button type="button" class="btn ghost small" data-cx="t-nocol" title="Quitar la columna donde estás escribiendo">− Columna</button>${mover}</div><div class="fila"><span class="note">La primera fila es el encabezado y sale en negritas. Tab pasa a la celda siguiente.</span></div>`;
  } else h = `<div class="fila"><b>Línea separadora</b>${mover}</div>`;
  blCtx.innerHTML = h; blCtx.classList.remove("hidden");
}
function blCtxEnlace(){
  if (!blRango) return;
  let a = blRango.startContainer; while (a && a !== blDoc && !(a.nodeType === 1 && a.tagName === "A")) a = a.parentNode;
  if (a === blDoc) a = null;
  if (!a && blRango.collapsed) { blAviso("Selecciona primero el texto que llevará el enlace."); return; }
  blCtx.innerHTML = `<div class="fila"><b>Enlace</b><input type="url" id="bl-url" aria-label="Dirección del enlace" placeholder="https://www.yucatanlove.com/…" value="${esc(a ? a.getAttribute("href") || "" : "")}"><button type="button" class="btn small" data-cx="enlace-ok">Aplicar</button>${a ? '<button type="button" class="btn ghost small" data-cx="enlace-no">Quitar enlace</button>' : ""}<button type="button" class="btn ghost small" data-cx="cerrar">Cancelar</button></div>`;
  blCtx.classList.remove("hidden"); blCtx._a = a; $("bl-url").focus();
}
blCtx.addEventListener("mousedown", e => { if (e.target.closest("button")) e.preventDefault(); });
blCtx.addEventListener("click", e => { const b = e.target.closest("button[data-cx]"); if (b) blAccion(b.dataset.cx, b); });
blCtx.addEventListener("input", e => { const i = e.target.closest("input[data-cx]"); if (i) blAccion(i.dataset.cx, i); });
blCtx.addEventListener("keydown", e => { if (e.key === "Enter" && e.target.tagName === "INPUT") { e.preventDefault(); if (e.target.id === "bl-url") blAccion("enlace-ok"); else e.target.blur(); } });
function blAccion(k, el){
  if (k === "cerrar") { blQuitarSel(); blFoco(); return; }
  if (k === "enlace-ok" || k === "enlace-no") {
    const a = blCtx._a, url = k === "enlace-ok" ? blUrl($("bl-url").value) : "";
    if (k === "enlace-ok" && !url) { blAviso("Escribe una dirección completa, por ejemplo https://www.yucatanlove.com/"); return; }
    blFoco();
    if (a && a.isConnected) { const r = document.createRange(); r.selectNodeContents(a); const s = getSelection(); s.removeAllRanges(); s.addRange(r); }
    document.execCommand(url ? "createLink" : "unlink", false, url || undefined);
    blQuitarSel(); blCambio(); return;
  }
  const f = blIsla; if (!f) return;
  if (k === "alt") { const im = f.querySelectorAll("img")[+el.dataset.i]; if (im) im.setAttribute("alt", el.value); }
  else if (k === "pie") { f.dataset.pie = el.value; let fc = f.querySelector("figcaption"); if (el.value.trim()) { if (!fc) { fc = document.createElement("figcaption"); f.appendChild(fc); } fc.textContent = el.value; } else if (fc) fc.remove(); }
  else if (k === "btn-x") { f.dataset.x = el.value; f.querySelector("span").textContent = el.value || "Texto del botón"; }
  else if (k === "btn-href") f.dataset.href = el.value.trim();
  else if (k === "w") { f.dataset.w = el.dataset.v; f.classList.remove("b-g", "b-m", "b-ch"); f.classList.add("b-" + el.dataset.v); blCtxIsla(); }
  else if (k.startsWith("t-")) {   // filas y columnas de la tabla, junto a la celda donde está el cursor (o al final)
    const tb = f.querySelector("table"), td = blCelda(), cel = td && tb.contains(td) ? td : null, filas = [...tb.rows], nc = filas[0] ? filas[0].cells.length : 0;
    const fi = cel ? cel.parentNode.rowIndex : filas.length - 1, ci = cel ? cel.cellIndex : nc - 1;
    const nueva = () => { const c = document.createElement("td"); c.setAttribute("contenteditable", "true"); c.innerHTML = "<br>"; return c; };
    if (k === "t-fila" && filas.length < 40) { const tr = document.createElement("tr"); for (let i = 0; i < nc; i++) tr.appendChild(nueva()); filas[fi].after(tr); blCursorCelda(tr.cells[ci]); }
    else if (k === "t-col" && nc < 8) { filas.forEach(tr => tr.cells[ci].after(nueva())); blCursorCelda(filas[fi].cells[ci + 1]); }
    else if (k === "t-nofila" && filas.length > 1) { filas[fi].remove(); blCursorCelda(tb.rows[Math.min(fi, tb.rows.length - 1)].cells[ci]); }
    else if (k === "t-nocol" && nc > 2) { filas.forEach(tr => tr.cells[ci].remove()); blCursorCelda(filas[fi].cells[Math.min(ci, nc - 2)]); }
    else { blAviso(k === "t-nofila" ? "La tabla necesita al menos una fila." : k === "t-nocol" ? "La tabla necesita al menos dos columnas." : "La tabla ya no admite más."); return; }
  }
  else if (k === "arriba") { const a = f.previousElementSibling; if (a) a.before(f); f.scrollIntoView({ block: "nearest" }); }
  else if (k === "abajo") { const s = f.nextElementSibling; if (s) s.after(f); if (!f.nextElementSibling) { const p = document.createElement("p"); p.innerHTML = "<br>"; f.after(p); } f.scrollIntoView({ block: "nearest" }); }
  else if (k === "texto-arriba") { const p = document.createElement("p"); p.innerHTML = "<br>"; f.before(p); blQuitarSel(); blCursorEn(p); }
  else if (k === "quitar") { blQuitarSel(); f.remove(); }
  else if (k === "mas") { blDestino = f; $("bl-file").click(); return; }
  else if (k === "quitar-foto") { const im = f.querySelectorAll("img")[+el.dataset.i]; if (im) im.remove(); if (!f.querySelector("img")) { blQuitarSel(); f.remove(); } else { blAjustarFila(f); blCtxIsla(); } }
  else if (k === "separar") {
    const imgs = [...f.querySelectorAll("img")].map(i => ({ src: i.dataset.src, alt: i.getAttribute("alt") || "" })); let ult = f;
    imgs.forEach((im, i) => { ult = blInsertar(blHtml([{ t: "img", imgs: [im], pie: i === imgs.length - 1 ? (f.dataset.pie || "") : "", w: "g" }], true), ult); });
    blQuitarSel(); f.remove(); blSeleccionar(ult);
  }
  blCambio();
}
$("bl-file").addEventListener("change", e => { const fs = [...e.target.files]; e.target.value = ""; const d = blDestino; blDestino = null; blSubirFotos(fs, d); });
async function blSubirFotos(files, dest){
  files = files.filter(f => f.type.startsWith("image/") || /\.(heic|heif)$/i.test(f.name));
  if (!files.length || !current) return;
  if (files.some(f => f.size > 40 * 1024 * 1024)) { blAviso("Alguna imagen pesa más de 40 MB. Usa una más ligera."); return; }
  if (dest) files = files.slice(0, Math.max(0, 3 - dest.querySelectorAll("img").length)); else files = files.slice(0, 12);
  const id = current.id; blSubiendo++; blAviso(files.length > 1 ? `Subiendo ${files.length} imágenes…` : "Subiendo imagen…");
  try {
    const rutas = [];
    for (let i = 0; i < files.length; i++) rutas.push(await uploadImage(files[i], id, "b" + i));
    await signedUrls(rutas);
    if (!current || current.id !== id) return;
    if (dest && dest.isConnected) {
      rutas.forEach(r => { const im = document.createElement("img"); im.src = urlOf(r); im.dataset.src = r; im.alt = ""; im.draggable = false; dest.insertBefore(im, dest.querySelector("figcaption")); });
      blAjustarFila(dest); blSeleccionar(dest);
    } else {
      // una sola → imagen suelta; 2 o 3 → una fila; más → varias filas
      const grupos = [], r = rutas.slice(); while (r.length) grupos.push(r.splice(0, r.length === 4 ? 2 : Math.min(3, r.length)));
      let ult = null; grupos.forEach(g => { ult = blInsertar(blHtml([{ t: "img", imgs: g.map(src => ({ src, alt: "" })), pie: "", w: "g" }], true), ult); });
      if (ult) { blSeleccionar(ult); ult.scrollIntoView({ block: "nearest" }); }
    }
    emsg(""); blAviso(""); blCambio();
  } catch (err) { blAviso(errMsg(err)); emsg(errMsg(err), true); }
  finally { blSubiendo--; }
}
// Al pasar un post a tipo Blog, lo que ya estaba escrito en el Caption se vuelve el inicio del artículo
$("e-tipo").addEventListener("change", () => { if (current && esBlogEd() && !blDoc.textContent.trim() && !blDoc.querySelector("[data-b]")) { blDoc.innerHTML = blHtml(bloquesDe(Object.assign({}, current, { cuerpo: current.cuerpo, caption: $("e-caption").value })), true); } wpPintar(); });

/* ---------- Pasar el artículo a WordPress ----------
   1) Copiar con formato y descargar las fotos: funciona siempre (se pega en el editor de WordPress).
   2) Enviar como borrador: lo hace la función "wp" de Supabase con la clave de aplicación de WordPress (guardada allá,
      nunca en la app). Sube las fotos a la biblioteca de WordPress, arma el artículo y lo deja como borrador. Solo quien administra. */
const wpMsg = (t, warn) => { const m = $("wp-msg"); m.textContent = t || ""; m.classList.toggle("warn", !!warn); };
function blHtmlCopia(c){
  let n = 0;
  return (Array.isArray(c) ? c : []).map(b => b.t === "img" ? (b.imgs || []).map(i => `<p><em>[Imagen ${++n}${i.alt ? ": " + esc(i.alt) : ""}]</em></p>`).join("") + (b.pie ? `<p><em>${esc(b.pie)}</em></p>` : "") : b.t === "tabla" ? `<table><tbody>${(b.f || []).map((r, k) => `<tr>${(r || []).map(x => `<td>${k === 0 ? `<b>${blSan(x)}</b>` : blSan(x)}</td>`).join("")}</tr>`).join("")}</tbody></table>` : blHtml([b], false)).join("\n");
}
async function copiarRico(html, texto){
  try { if (navigator.clipboard && window.ClipboardItem) { await navigator.clipboard.write([new ClipboardItem({ "text/html": new Blob([html], { type: "text/html" }), "text/plain": new Blob([texto], { type: "text/plain" }) })]); return true; } } catch (_) {}
  const d = document.createElement("div"); d.innerHTML = html; d.style.cssText = "position:fixed;left:-9999px;top:0"; document.body.appendChild(d);
  const r = document.createRange(); r.selectNodeContents(d); const s = getSelection(); s.removeAllRanges(); s.addRange(r);
  let ok = false; try { ok = document.execCommand("copy"); } catch (_) {} s.removeAllRanges(); d.remove(); return ok;
}
$("wp-copiar").addEventListener("click", async () => {
  const b = borradorBlog(); if (!b) return;
  if (!b.cuerpo.length) { wpMsg("Todavía no hay texto en el artículo."); return; }
  const ok = await copiarRico(blHtmlCopia(b.cuerpo), blTexto(b.cuerpo));
  wpMsg(ok ? "Artículo copiado con su formato (títulos, negritas, listas y enlaces). Pégalo en WordPress; donde dice [Imagen 1], [Imagen 2]… van las fotos." : "No se pudo copiar. Intenta de nuevo.", !ok);
});
$("wp-fotos").addEventListener("click", async () => {
  const b = borradorBlog(); if (!b) return;
  const rutas = [b.imagen_path, ...blImgs(b.cuerpo)].filter(Boolean);
  if (!rutas.length) { wpMsg("Este artículo todavía no tiene fotos guardadas."); return; }
  wpMsg("Preparando fotos…");
  try {
    await signedUrls(rutas); const base = (b.seo && b.seo.slug) || slugify(b.copy) || "articulo";
    for (let i = 0; i < rutas.length; i++) {
      const esPortada = i === 0 && !!b.imagen_path, num = i + (b.imagen_path ? 0 : 1);
      const f = await aJpg(rutas[i], esPortada ? `${base}-portada` : `${base}-imagen-${String(num).padStart(2, "0")}`);
      const u = URL.createObjectURL(f), a = document.createElement("a"); a.href = u; a.download = f.name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 4000); await new Promise(r => setTimeout(r, 350));
    }
    wpMsg(`${rutas.length} fotos descargadas, numeradas en el orden en que aparecen en el artículo.`);
  } catch (err) { wpMsg(errMsg(err), true); }
});
$("wp-enviar").addEventListener("click", async () => {
  if (!current || !esAdmin) return;
  if (editorDirty) { wpMsg("Guarda primero los cambios del artículo y vuelve a enviarlo.", true); return; }
  const btn = $("wp-enviar"); btn.disabled = true; wpMsg("Enviando a WordPress: sube las fotos y arma el borrador. Puede tardar un minuto…");
  try {
    if (!(Array.isArray(current.cuerpo) && current.cuerpo.length)) {   // artículo escrito antes del editor nuevo: su texto se guarda ya con formato antes de enviarlo
      const c = blLeer(blDoc); if (!c.length) { wpMsg("Todavía no hay texto en el artículo.", true); return; }
      const { error: e0 } = await sb.from("posts").update({ cuerpo: c, caption: blTexto(c) || null }).eq("id", current.id); if (e0) throw e0;
      current.cuerpo = c; current.caption = blTexto(c) || null;
    }
    const { data, error } = await sb.functions.invoke("wp", { body: { accion: "enviar", post_id: current.id } });
    let res = data; if (error) { try { res = await error.context.json(); } catch (_) { res = { error: error.message }; } }
    if (!res || res.error) { wpMsg(res && res.sin_conexion ? "WordPress todavía no está conectado: falta guardar su usuario y su clave de aplicación en Supabase." : (res && res.error) || "No se pudo enviar. Intenta de nuevo.", true); return; }
    if (res.wp && current) current.wp = res.wp;
    wpPintar();   // primero el estado («En WordPress desde…»), después el aviso, para que no se borre
    wpMsg((res.nuevo ? "Listo: quedó como borrador en WordPress." : "Listo: se actualizó en WordPress.") + (res.avisos && res.avisos.length ? " Ojo: " + res.avisos.join(" ") : ""));
  } catch (err) { wpMsg(errMsg(err), true); }
  finally { btn.disabled = false; }
});
function wpPintar(){
  const w = current && current.wp;
  $("wp-enviar").classList.toggle("hidden", !esAdmin);
  $("wp-enviar").textContent = w && w.id ? "Actualizar en WordPress" : "Enviar a WordPress como borrador";
  const ed = w && /^https:\/\//.test(w.editar || "") ? w.editar : "";
  $("wp-estado").innerHTML = w && w.id ? `En WordPress desde ${esc(cuando(w.at))}${w.por ? " · lo envió " + esc(nombreDe(w.por)) : ""}${ed ? ` · <a href="${esc(ed)}" target="_blank" rel="noopener">Abrir en WordPress ↗</a>` : ""}` : (esAdmin ? "" : "Cuando esté terminado, quien administra lo envía a WordPress.");
  wpMsg("");
}

/* ---------- Vista del artículo del blog (calcada de una entrada de yucatanlove.com) ---------- */
let blgPost = null;
// Partes fijas del sitio (revisadas el 24 nov 2026): barra de arriba con buscador y redes, y pie de página
function ylIco(k){
  return { fb: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13.5 22v-8h2.7l.4-3.2h-3.1V8.7c0-.9.3-1.6 1.6-1.6h1.7V4.2c-.3 0-1.3-.1-2.5-.1-2.5 0-4.1 1.5-4.1 4.2v2.4H7.4V14h2.8v8z"/></svg>',
    ig: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.3" cy="6.7" r="1.1" fill="currentColor" stroke="none"/></svg>',
    pin: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a10 10 0 0 0-3.6 19.3c-.1-.8-.2-2 0-2.9l1.2-5s-.3-.6-.3-1.5c0-1.4.8-2.5 1.8-2.5.9 0 1.3.6 1.3 1.4 0 .9-.6 2.2-.8 3.4-.2 1 .5 1.8 1.5 1.8 1.8 0 3.2-1.9 3.2-4.7 0-2.4-1.7-4.1-4.2-4.1a4.4 4.4 0 0 0-4.6 4.4c0 .9.3 1.8.8 2.3.1.1.1.2.1.3l-.3 1.2c0 .2-.2.2-.4.1-1.3-.6-2-2.4-2-3.9 0-3.2 2.3-6.1 6.7-6.1 3.5 0 6.2 2.5 6.2 5.8 0 3.5-2.2 6.3-5.2 6.3-1 0-2-.5-2.3-1.2l-.6 2.4c-.2.9-.8 2-1.2 2.6A10 10 0 1 0 12 2z"/></svg>',
    tw: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M22 5.9c-.7.3-1.5.5-2.4.6.9-.5 1.5-1.3 1.8-2.3-.8.5-1.7.8-2.6 1a4.1 4.1 0 0 0-7 3.7A11.6 11.6 0 0 1 3.4 4.7a4.1 4.1 0 0 0 1.3 5.5c-.7 0-1.3-.2-1.9-.5 0 2 1.4 3.7 3.3 4.1-.6.2-1.2.2-1.8.1.5 1.6 2 2.8 3.8 2.8A8.2 8.2 0 0 1 2 18.4a11.6 11.6 0 0 0 6.3 1.8c7.5 0 11.7-6.3 11.7-11.7v-.5c.8-.6 1.5-1.3 2-2.1z"/></svg>',
    mail: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="5" width="18" height="14" rx="1.5"/><path d="M3.5 6.5 12 13l8.5-6.5"/></svg>' }[k] || "";
}
function ylArriba(){ return `<div class="yl-top">search <span></span><i class="yl-soc">${ylIco("fb")}${ylIco("ig")}${ylIco("pin")}</i></div>`; }
function ylPie(){ return `<footer class="yl-foot"><nav><span>Home</span><span>Services</span><span>About</span><span>Real Weddings</span><span>Journal</span><span>Media</span><span>Contact</span></nav><i class="yl-soc">${ylIco("fb")}${ylIco("ig")}${ylIco("pin")}</i><p>From Yucatan with ❤️ to the world</p><b>YUCATANLOVE</b><p>999 291 2666 · Av. Colón #201, García Ginerés, 97070 Mérida, Yucatán, México</p><span>Privacy Policy</span></footer>`; }
function htmlArticulo(p, conSeo){
  const s = p.seo || {};
  const d = p.fecha ? new Date(p.fecha + "T12:00:00") : null, mes = d ? d.toLocaleString("en-US", { month: "short" }) : "";
  const tit = x => x.copy || ((x.seo || {}).titulo || "").split("|")[0].trim() || "Sin título", h1 = tit(p);
  const tags = String(s.tags || "").split(",").map(x => x.trim()).filter(Boolean);
  const otros = posts.filter(x => x.id !== p.id && x.tipo === "Blog"), rel = otros.slice(0, 4);
  const dmy = f => f ? String(f).slice(0, 10).split("-").reverse().join("/") : "";          // 13/02/2025, como las pone el sitio
  // Anterior y siguiente: el sitio los ordena por fecha
  const orden = otros.filter(x => x.fecha).concat(p.fecha ? [p] : []).sort((a, b) => a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0), yo = orden.indexOf(p);
  const ant = yo > 0 ? orden[yo - 1] : null, sig = yo >= 0 && yo < orden.length - 1 ? orden[yo + 1] : null;
  // Orden de la página, igual que una entrada del sitio: imagen destacada con la fecha · categoría · título · texto ·
  // TAGS (solo si tiene) · comentarios y compartir · You May Also Like · Leave a Comment · anterior/siguiente · pie.
  return `<div class="yl yl-post">
    ${ylArriba()}
    <header class="yl-head"><div class="yl-logo"><img src="icons/logo-color-texto.png" alt="YUC'ATÅLOVE"><span>TOGETHER AS ONE</span></div><nav><span>Home</span><span>Services</span><span>About</span><span>Real Weddings</span><span class="on">Journal</span><span>Media</span><span>Contact</span></nav></header>
    <div class="ylp-hero">${(p._portada || p.imagen_path) ? `<img src="${esc(p._portada || urlOf(p.imagen_path) || thumbUrl(p.imagen_path))}" alt="${esc(s.alt || "")}">` : `<div class="ylp-noimg">Imagen destacada (1200×558)</div>`}
      ${d ? `<div class="ylp-date"><b>${d.getDate()}</b><span>${esc(mes)}</span><span>${d.getFullYear()}</span></div>` : ""}</div>
    <div class="ylp-body">
      <span class="ylp-cat">${esc(s.cat || "Sin categoría")}</span>
      <h1>${esc(h1)}</h1>
      <div class="ylp-txt">${p._slot ? '<div id="bl-slot"></div>' : (blHtml(bloquesDe(p), false).replace(/<a href=/g, '<a target="_blank" rel="noopener" href=') || "<p><em>Aún no hay texto. Ábrelo para editar y escribe sobre la página.</em></p>")}</div>
      ${tags.length ? `<div class="ylp-tags"><span>TAGS:</span>${tags.map(t => `<a>${esc(t)}</a>`).join("")}</div>` : ""}
      <div class="ylp-pie"><span>0 Comments</span><span class="ylp-share">Share ${ylIco("fb")}${ylIco("tw")}${ylIco("pin")}${ylIco("mail")}</span></div>
      ${rel.length ? `<h3 class="ylp-rel-t">You May Also Like</h3><div class="ylp-rel">${rel.map(r => `<div><div class="yl-img">${r.imagen_path ? `<img src="${esc(thumbUrl(r.imagen_path))}" alt="">` : ""}</div><h4>${esc(tit(r))}</h4><time>${esc(dmy(r.fecha))}</time></div>`).join("")}</div>` : ""}
      <div class="ylp-coment"><h3 class="ylp-rel-t">Leave a Comment</h3><div class="ylp-caja"></div><div class="ylp-campos"><span></span><span></span><span></span></div></div>
      ${ant || sig ? `<div class="ylp-nav"><div>${ant ? `<small>Previous Post</small><b>${esc(tit(ant))}</b>` : ""}</div><div class="der">${sig ? `<small>Next Post</small><b>${esc(tit(sig))}</b>` : ""}</div></div>` : ""}
    </div>
    ${ylPie()}
    <p class="ylp-nota">No se ve en la página, pero Google y las redes lo muestran junto al enlace: escrito por <b>${esc(s.autor || "—")}</b> · <b id="ylp-min">${minLectura(blTexto(bloquesDe(p)))}</b> min de lectura.</p>
    ${conSeo ? `<div class="ylp-seo"><h4>Lo que verá Google y el equipo web</h4>
      ${[["Título SEO", s.titulo], ["Meta descripción", s.desc], ["URL", s.slug ? "https://www.yucatanlove.com/" + s.slug + "/" : ""], ["Palabra clave", s.kw], ["Categoría", s.cat], ["Etiquetas", s.tags], ["Autor", s.autor], ["Alt de la imagen", s.alt], ["H1", h1], ["Texto", blTexto(bloquesDe(p))]].map(([l, v]) => `<div class="ylp-f"><span>${l}</span><p>${esc(v ? (l === "Texto" ? String(v).slice(0, 220) + (String(v).length > 220 ? "…" : "") : v) : "— falta —")}</p>${v ? `<button type="button" class="btn ghost small" data-cp="${esc(l)}">Copiar</button>` : ""}</div>`).join("")}
    </div>` : ""}</div>`;
}
async function abrirArticulo(p){
  blgPost = p; const s = p.seo || {}; await signedUrls([...slidesOf(p), ...blImgs(bloquesDe(p))]);
  const h1 = p.copy || (s.titulo || "").split("|")[0].trim() || "Sin título";
  $("blg-url").textContent = "yucatanlove.com/" + (s.slug || slugify(h1)) + "/";
  $("blg-page").innerHTML = htmlArticulo(p, true);
  $("blg-edit").classList.toggle("hidden", !!p._borrador);
  $("blg").classList.remove("hidden"); document.body.classList.add("sv-open"); $("blg").scrollTop = 0;
}
/* Borrador del editor (lo que se está escribiendo, aunque no esté guardado) */
function borradorBlog(){
  if (!current) return null;
  const cuerpo = blLeer(blDoc);
  return Object.assign({}, current, { copy: $("e-copy").value.trim(), cuerpo, caption: blTexto(cuerpo), fecha: $("e-fecha").value || current.fecha, seo: seoLeer(), _portada: pendingUrl || "", _borrador: true });
}
let prevTimer = null;
function pintarPrevBlog(){
  clearTimeout(prevTimer);
  const esBlog = esBlogEd(); $("editor").classList.toggle("ed-blog", esBlog);
  $("e-copy-l").textContent = esBlog ? "Título del artículo (H1)" : "Copy";
  if (!esBlog) blQuitarSel();
  prevTimer = setTimeout(() => { if (esBlogEd() && current) blPintarPagina(); }, 250);
}
// Rehace lo que rodea al texto (encabezado del sitio, portada, título, etiquetas) y vuelve a colocar la hoja donde se escribe
function blPintarPagina(){
  const b = borradorBlog(); if (!b) return;
  if (BL_ANCHO.matches) {
    if (document.activeElement === blDoc && $("bl-slot")) return;   // no mover la hoja mientras se escribe en ella
    $("ed-prev").appendChild(blDoc);
    b._slot = true; $("ed-prev-page").innerHTML = htmlArticulo(b, false);
  }
  blColocar();
  $("ed-prev-url").textContent = "yucatanlove.com/" + ((b.seo || {}).slug || slugify(b.copy) || "…") + "/";
}
function cerrarArticulo(){ $("blg").classList.add("hidden"); document.body.classList.remove("sv-open"); blgPost = null; }
$("blg-close").addEventListener("click", cerrarArticulo);
$("blg-edit").addEventListener("click", () => { const p = blgPost; cerrarArticulo(); if (p) openEditor(p); });
document.addEventListener("keydown", e => { if (e.key === "Escape" && !$("blg").classList.contains("hidden")) cerrarArticulo(); });
$("blg-page").addEventListener("click", async e => {
  const b = e.target.closest("[data-cp]"); if (!b || !blgPost) return; const s = blgPost.seo || {};
  const map = { "Título SEO": s.titulo, "Meta descripción": s.desc, "URL": s.slug, "Palabra clave": s.kw, "Categoría": s.cat, "Etiquetas": s.tags, "Autor": s.autor, "Alt de la imagen": s.alt, "H1": blgPost.copy, "Texto": blgPost.caption };
  const ok = await copiarTexto(map[b.dataset.cp] || ""); b.textContent = ok ? "Copiado ✓" : "No se pudo"; setTimeout(() => b.textContent = "Copiar", 1400);
});

/* ---------- Editor de perfil de cada red ---------- */
const PF_CAMPOS = {
  instagram: { campos: ["usuario","categoria","bio","link","seguidores","seguidos","extra"], extra: "Publicaciones (vacío = las del plan)" },
  tiktok:    { campos: ["usuario","bio","link","seguidores","seguidos","extra"], extra: "Me gusta (total)" },
  pinterest: { campos: ["usuario","bio","link","seguidores","seguidos","extra"], extra: "Visualizaciones mensuales" },
  facebook:  { campos: ["categoria","precio","telefono","ubicacion","bio","link","seguidores","extra"], extra: "Reacciones", portada: true },
  pauta:     { campos: ["link","extra"], extra: "Botón del anuncio (ej. Más información)", sinFoto: true, nota: "Los anuncios usan la foto y el usuario de Instagram." },
  blog:      { campos: ["bio","categoria","link"], bio: "Título de la sección (ej. Start your wedding planning)", foto: "Logo del blog" },
};
let pfPlat = "", pfFile = null, pfFile2 = null, pfUrl = "", pfUrl2 = "";
function abrirEditorPerfil(k){
  pfPlat = k; pfFile = pfFile2 = null; const P = pf(k), C = PF_CAMPOS[k] || PF_CAMPOS.instagram;
  $("pfm-t").textContent = "Editar perfil de " + PLATS[k].n;
  ["nombre","usuario","categoria","ubicacion","bio","link","seguidores","seguidos","extra","precio","telefono"].forEach(c => { $("pf-" + c).value = P[c] || ""; });
  document.querySelectorAll("#pfm-form [data-pf]").forEach(l => l.classList.toggle("hidden", !C.campos.includes(l.dataset.pf)));
  $("pf-extra-l").textContent = C.extra || "Extra";
  document.querySelector('#pfm-form [data-pf="categoria"]').firstChild.textContent = k === "blog" ? "Descripción de la sección" : "Categoría"; $("pf-bio-l").textContent = C.bio || "Presentación / bio";
  $("pfm-portada-wrap").classList.toggle("hidden", !C.portada);
  document.querySelector(".pfm-foto").classList.toggle("hidden", !!C.sinFoto);
  $("pfm-av-btn").textContent = C.foto ? "Cambiar " + C.foto.toLowerCase() : "Cambiar foto de perfil";
  $("pfm-todas").checked = false; $("pfm-todas").parentElement.classList.toggle("hidden", k === "blog");
  pintarFotosPerfil(); $("pfm-msg").textContent = C.nota || "";
  $("pfm").classList.remove("hidden"); document.body.classList.add("sv-open");
  setTimeout(() => $("pf-nombre").focus(), 50);
}
function pintarFotosPerfil(){
  const f = pfUrl || urlOf(pf(pfPlat).foto_path), c = pfUrl2 || urlOf(pf(pfPlat).portada_path);
  $("pfm-av").innerHTML = `<img src="${esc(f || "icons/simbolo-arena.png")}" alt="">`; $("pfm-av").classList.toggle("foto", !!f);
  $("pfm-cover").style.backgroundImage = c ? `url('${c}')` : ""; $("pfm-cover").textContent = c ? "" : "Sin portada (se usa la primera imagen del mes)";
}
function cerrarEditorPerfil(){ $("pfm").classList.add("hidden"); document.body.classList.remove("sv-open"); if (pfUrl) URL.revokeObjectURL(pfUrl); if (pfUrl2) URL.revokeObjectURL(pfUrl2); pfUrl = pfUrl2 = ""; pfFile = pfFile2 = null; }
$("pfm-close").addEventListener("click", cerrarEditorPerfil);
$("pfm-cancel").addEventListener("click", cerrarEditorPerfil);
$("pfm").addEventListener("click", e => { if (e.target.id === "pfm") cerrarEditorPerfil(); });
document.addEventListener("keydown", e => { if (e.key === "Escape" && !$("pfm").classList.contains("hidden")) cerrarEditorPerfil(); });
["pfm-av","pfm-av-btn"].forEach(id => $(id).addEventListener("click", () => $("pfm-file").click()));
["pfm-cover","pfm-cover-btn"].forEach(id => $(id).addEventListener("click", () => $("pfm-file2").click()));
$("pfm-file").addEventListener("change", e => { const f = e.target.files[0]; e.target.value = ""; if (!f) return; pfFile = f; if (pfUrl) URL.revokeObjectURL(pfUrl); pfUrl = URL.createObjectURL(f); pintarFotosPerfil(); });
$("pfm-file2").addEventListener("change", e => { const f = e.target.files[0]; e.target.value = ""; if (!f) return; pfFile2 = f; if (pfUrl2) URL.revokeObjectURL(pfUrl2); pfUrl2 = URL.createObjectURL(f); pintarFotosPerfil(); });
$("pfm-form").addEventListener("submit", async e => {
  e.preventDefault(); if (!pfPlat) return;
  const btn = $("pfm-save"); btn.disabled = true; const msg = t => $("pfm-msg").textContent = t;
  try {
    const row = { plataforma: pfPlat, updated_at: new Date().toISOString() };
    const C = PF_CAMPOS[pfPlat] || {}; ["nombre","usuario","categoria","ubicacion","bio","link","seguidores","seguidos","extra","precio","telefono"].forEach(c => { if (c === "nombre" || (C.campos || []).includes(c)) row[c] = $("pf-" + c).value.trim() || null; });
    if (row.usuario) row.usuario = row.usuario.replace(/^@/, "");
    const viejas = [];
    if (pfFile) { msg("Subiendo foto…"); const p = await uploadImage(pfFile, "perfiles"); if (pf(pfPlat).foto_path) viejas.push(pf(pfPlat).foto_path); row.foto_path = p; }
    if (pfFile2) { msg("Subiendo portada…"); const p = await uploadImage(pfFile2, "perfiles"); if (pf(pfPlat).portada_path) viejas.push(pf(pfPlat).portada_path); row.portada_path = p; }
    msg("Guardando…");
    const { error } = await sb.from("perfiles").upsert(row);
    if (error) throw error;
    if ($("pfm-todas").checked) {
      const foto = row.foto_path || pf(pfPlat).foto_path;
      if (foto) { const otras = Object.keys(PLATS).filter(k => k !== pfPlat && k !== "blog");
        const { error: e2 } = await sb.from("perfiles").upsert(otras.map(k => ({ plataforma: k, foto_path: foto, updated_at: new Date().toISOString() }))); if (e2) throw e2; }
    }
    await loadPerfiles();
    const enUso = new Set(Object.values(perfiles).flatMap(r => [r.foto_path, r.portada_path]));
    const borrar = viejas.filter(p => p && !enUso.has(p)); if (borrar.length) sb.storage.from(CFG.bucket).remove(borrar.flatMap(p => [p, thumbOf(p)]));
    cerrarEditorPerfil(); renderFeed();
  } catch (err) { msg(errMsg(err)); }
  finally { btn.disabled = false; }
});

/* ---------- Vista "listo para publicar": copiar caption y guardar imágenes ---------- */
let pubPost = null;
async function abrirPublicar(p){
  pubPost = p;
  const s = slidesOf(p); await signedUrls(s);
  $("pub-meta").textContent = [p.tipo, p.fecha ? fmtCorto(p.fecha) : "sin fecha", p.pilar].filter(Boolean).join(" · ");
  const st = p.status || "", sc = colorDe("status", st) || "#F6F6F4", chip = $("pub-status");
  chip.textContent = st; chip.style.display = st ? "" : "none"; chip.style.background = sc; chip.style.color = textOn(sc);
  $("pub-track").innerHTML = s.length ? s.map((x, i) => `<div class="pub-slide"><img src="${esc(urlOf(x) || thumbUrl(x))}" alt="Imagen ${i + 1}" ${i ? 'loading="lazy"' : ""}></div>`).join("")
    : `<div class="pub-slide pub-empty"><div class="label-sm">${esc(p.pilar || "")}</div><p>${esc(p.copy || "Sin imagen")}</p><span>Aún no tiene imagen. Súbela desde la Parrilla.</span></div>`;
  $("pub-track").scrollLeft = 0;
  $("pub-dots").innerHTML = s.length > 1 ? s.map((_, i) => `<i class="${i ? "" : "on"}"></i>`).join("") : "";
  $("pub-count").classList.toggle("hidden", s.length < 2); $("pub-count").textContent = `1 / ${s.length}`;
  $("pub-imgs").textContent = s.length > 1 ? `⤓ Guardar ${s.length} imágenes` : "⤓ Guardar imagen";
  $("pub-imgs").disabled = !s.length;
  $("pub-cap").textContent = p.caption || "Este post todavía no tiene caption.";
  $("pub-cap").classList.toggle("vacio", !p.caption); $("pub-copy-cap").disabled = !p.caption;
  $("pub-copy-wrap").classList.toggle("hidden", !p.copy); $("pub-copy").textContent = p.copy || "";
  $("pub-cont-wrap").classList.toggle("hidden", !linksDe(p.contenido).length); $("pub-cont").innerHTML = chipsLinks(p.contenido);
  $("pub-done").classList.toggle("hidden", st === "Publicado" || !lista("status").some(o => o.valor === "Publicado"));
  pmsg("");
  $("pub").classList.remove("hidden"); document.body.classList.add("sv-open");
  $("pub").querySelector(".pub-side").scrollTop = 0;
  history.pushState({ pub: true }, "", location.hash);
}
function pmsg(t, warn){ const m = $("pub-msg"); m.textContent = t || ""; m.classList.toggle("warn", !!warn); }
function cerrarPublicar(fromPop){
  if ($("pub").classList.contains("hidden")) return;
  $("pub").classList.add("hidden"); document.body.classList.remove("sv-open"); pubPost = null;
  if (!fromPop && history.state && history.state.pub) history.back();
}
async function copiarTexto(t){
  try { await navigator.clipboard.writeText(t); return true; }
  catch (_) { const ta = document.createElement("textarea"); ta.value = t; ta.style.position = "fixed"; ta.style.opacity = "0"; document.body.appendChild(ta); ta.select(); let ok = false; try { ok = document.execCommand("copy"); } catch (_) {} ta.remove(); return ok; }
}
// Convierte a JPG para que Instagram, Meta y la galería del celular la acepten sin problema
async function aJpg(path, nombre){
  const r = await fetch(urlOf(path)); if (!r.ok) throw new Error("No se pudo descargar la imagen.");
  const b = await r.blob();
  try {
    const bmp = await createImageBitmap(b); const cv = document.createElement("canvas"); cv.width = bmp.width; cv.height = bmp.height;
    cv.getContext("2d").drawImage(bmp, 0, 0); bmp.close && bmp.close();
    const j = await new Promise(res => cv.toBlob(res, "image/jpeg", 0.95));
    if (j) return new File([j], nombre + ".jpg", { type: "image/jpeg" });
  } catch (_) {}
  return new File([b], nombre + "." + (b.type.split("/")[1] || "jpg"), { type: b.type });
}
async function guardarImagenes(p, msg){
  const s = slidesOf(p); if (!s.length) return;
  msg(s.length > 1 ? "Preparando imágenes…" : "Preparando imagen…");
  try {
    await signedUrls(s);
    const base = `yucatalove-${p.fecha || "post"}`;
    const files = await Promise.all(s.map((x, i) => aJpg(x, s.length > 1 ? `${base}-${i + 1}` : base)));
    if (isMobile() && navigator.canShare && navigator.canShare({ files })) {
      try { await navigator.share({ files }); msg("Listo. Elige “Guardar imagen” o compártela directo a Instagram."); return; }
      catch (e) { if (e && e.name === "AbortError") { msg(""); return; } }
    }
    for (const f of files) { const u = URL.createObjectURL(f), a = document.createElement("a"); a.href = u; a.download = f.name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 4000); await new Promise(r => setTimeout(r, 350)); }
    msg(files.length > 1 ? `${files.length} imágenes descargadas en orden.` : "Imagen descargada.");
  } catch (err) { msg(errMsg(err), true); }
}
$("pub-close").addEventListener("click", () => cerrarPublicar());
$("pub").addEventListener("click", e => { if (e.target.id === "pub") cerrarPublicar(); });
window.addEventListener("popstate", () => cerrarPublicar(true));
document.addEventListener("keydown", e => { if (e.key === "Escape" && !$("pub").classList.contains("hidden")) cerrarPublicar(); });
$("pub-track").addEventListener("scroll", () => {
  const t = $("pub-track"), i = Math.round(t.scrollLeft / Math.max(1, t.clientWidth)), n = t.children.length;
  [...$("pub-dots").children].forEach((d, k) => d.classList.toggle("on", k === i));
  $("pub-count").textContent = `${i + 1} / ${n}`;
}, { passive: true });
$("pub-copy-cap").addEventListener("click", async () => { if (pubPost && pubPost.caption) pmsg(await copiarTexto(pubPost.caption) ? "Caption copiado. Pégalo en Instagram o Meta." : "No se pudo copiar; mantén presionado el texto para copiarlo.", false); });
$("pub-copy-copy").addEventListener("click", async () => { if (pubPost && pubPost.copy) pmsg(await copiarTexto(pubPost.copy) ? "Texto copiado." : "No se pudo copiar.", false); });
$("pub-imgs").addEventListener("click", () => pubPost && guardarImagenes(pubPost, pmsg));
$("pub-edit").addEventListener("click", () => { const p = pubPost; cerrarPublicar(true); if (history.state && history.state.pub) history.replaceState(null, "", location.hash); if (p) openEditor(p); });
$("pub-done").addEventListener("click", async () => {
  if (!pubPost) return; const p = pubPost;
  const { error } = await sb.from("posts").update({ status: "Publicado" }).eq("id", p.id);
  if (error) { pmsg(errMsg(error), true); return; }
  p.status = "Publicado"; renderAll(); abrirPublicarRefresh(p); pmsg("Marcado como publicado.");
});
function abrirPublicarRefresh(p){ const sc = colorDe("status", p.status) || "#F6F6F4", chip = $("pub-status"); chip.textContent = p.status; chip.style.display = ""; chip.style.background = sc; chip.style.color = textOn(sc); $("pub-done").classList.add("hidden"); }
$("stories").addEventListener("click", async e => {
  if (e.target.closest("#story-add")) { await nuevoDesdeFeed("Historia"); return; }
  const t = e.target.closest(".story"); if (!t) return; abrirHistorias(t.dataset.id); });

/* ---------- Visor de historias (como en Instagram) ---------- */
let svList = [], svIdx = 0, svTimer = null, svStart = 0;
const SV_MS = 5000;
function historiasVisibles(){ return feedList().filter(p => p.tipo === "Historia" && !esPauta(p)).sort((a, b) => String(a.fecha || "").localeCompare(String(b.fecha || ""))); }
async function abrirHistorias(id){
  svList = historiasVisibles(); svIdx = Math.max(0, svList.findIndex(p => p.id === id));
  await signedUrls(svList.map(p => p.imagen_path).filter(Boolean));
  $("sv").classList.remove("hidden"); document.body.classList.add("sv-open");
  history.pushState({ sv: true }, "", location.hash);
  mostrarHistoria();
}
function mostrarHistoria(){
  const p = svList[svIdx]; if (!p) return cerrarHistorias();
  $("sv-bars").innerHTML = svList.map((_, i) => `<span><i style="width:${i < svIdx ? 100 : 0}%"></i></span>`).join("");
  $("sv-date").textContent = fmtCorto(p.fecha) || "sin fecha";
  const st = p.status || "", sc = colorDe("status", st) || "#F6F6F4";
  const chip = $("sv-status"); chip.textContent = st; chip.style.display = st ? "" : "none"; chip.style.background = sc; chip.style.color = textOn(sc);
  const src = urlOf(p.imagen_path);
  $("sv-media").innerHTML = src ? `<img src="${esc(src)}" alt="">` : `<div class="sv-empty"><div class="label-sm">${esc(p.pilar || "")}</div><p>${esc(p.copy || "Historia sin imagen")}</p><span>Toca ✎ Editar para subir la imagen</span></div>`;
  $("sv-copy").textContent = p.copy || "";
  clearTimeout(svTimer); svStart = Date.now();
  const bar = $("sv-bars").children[svIdx].firstElementChild;
  requestAnimationFrame(() => { bar.style.transition = `width ${SV_MS}ms linear`; bar.style.width = "100%"; });
  svTimer = setTimeout(() => moverHistoria(1), SV_MS);
}
function moverHistoria(d){ const n = svIdx + d; if (n < 0) { svIdx = 0; return mostrarHistoria(); } if (n >= svList.length) return cerrarHistorias(); svIdx = n; mostrarHistoria(); }
function cerrarHistorias(fromPop){
  if ($("sv").classList.contains("hidden")) return;
  clearTimeout(svTimer); $("sv").classList.add("hidden"); document.body.classList.remove("sv-open");
  if (!fromPop && history.state && history.state.sv) history.back();
}
$("sv-prev").addEventListener("click", () => moverHistoria(-1));
$("sv-next").addEventListener("click", () => moverHistoria(1));
$("sv-close").addEventListener("click", () => cerrarHistorias());
$("sv-save").addEventListener("click", () => { const p = svList[svIdx]; if (!p || !p.imagen_path) { $("sv-copy").textContent = "Esta historia aún no tiene imagen."; return; } clearTimeout(svTimer); guardarImagenes(p, t => { if (t) $("sv-copy").textContent = t; }); });
$("sv-edit").addEventListener("click", () => { const p = svList[svIdx]; cerrarHistorias(true); if (history.state && history.state.sv) history.replaceState(null, "", location.hash); if (p) openEditor(p); });
$("sv").addEventListener("click", e => { if (e.target.id === "sv") cerrarHistorias(); });
window.addEventListener("popstate", () => cerrarHistorias(true));
document.addEventListener("keydown", e => { if ($("sv").classList.contains("hidden")) return;
  if (e.key === "Escape") cerrarHistorias(); else if (e.key === "ArrowRight") moverHistoria(1); else if (e.key === "ArrowLeft") moverHistoria(-1); });
$("feed-grid").addEventListener("dragstart", e => { const t = e.target.closest(".tile"); if (t) { e.dataTransfer.setData("text/plain", t.dataset.id); e.dataTransfer.effectAllowed = "move"; } });
$("feed-grid").addEventListener("dragover", e => { const t = e.target.closest(".tile"); if (t) { e.preventDefault(); t.classList.add("drag-over"); } });
$("feed-grid").addEventListener("dragleave", e => { const t = e.target.closest(".tile"); if (t) t.classList.remove("drag-over"); });
$("feed-grid").addEventListener("drop", e => { const t = e.target.closest(".tile"); if (!t) return; e.preventDefault(); t.classList.remove("drag-over"); const from = e.dataTransfer.getData("text/plain"); if (from && from !== t.dataset.id) moveTo(from, t.dataset.id); });
async function persistOrder(changes){
  for (const p of changes) { const { error } = await sb.from("posts").update({ orden: p.orden }).eq("id", p.id); if (error) { banner(errMsg(error)); break; } }
}
async function moveTo(fromId, toId){
  const feed = feedOrder(feedList());
  const ids = feed.map(p => p.id), fi = ids.indexOf(fromId), ti = ids.indexOf(toId); if (fi < 0 || ti < 0) return;
  ids.splice(ti, 0, ids.splice(fi, 1)[0]);
  const base = Math.min(...feed.map(p => p.orden ?? 0));
  const changes = [];
  ids.forEach((id, i) => { const p = posts.find(x => x.id === id); if (p.orden !== base + i) { p.orden = base + i; changes.push(p); } });
  renderFeed(); await persistOrder(changes);
}
async function moveBy(delta){
  if (!current) return;
  const feed = feedOrder(feedList()), i = feed.findIndex(p => p.id === current.id), j = i + delta;
  if (i < 0) { emsg("Este post no está en el feed (es historia o está filtrado)."); return; }
  if (j < 0 || j >= feed.length) { emsg(delta < 0 ? "Ya es el primero del feed." : "Ya es el último del feed."); return; }
  await moveTo(current.id, feed[j].id); emsg(`Ahora es el #${j + 1} del feed.`);
}
$("btn-sort").addEventListener("click", async () => {
  const all = [...posts].sort((a, b) => String(b.fecha || "").localeCompare(String(a.fecha || "")));
  const changes = []; all.forEach((p, i) => { if (p.orden !== i) { p.orden = i; changes.push(p); } });
  renderFeed(); await persistOrder(changes);
});


async function nuevoDesdeFeed(tipo){
  const p = await addPost(); if (!p) return;
  const hoy = iso(new Date()), patch = { tipo, fecha: hoy, dia: diaDe(hoy), mes: mesDe(hoy) };
  const { error } = await sb.from("posts").update(patch).eq("id", p.id);
  if (!error) Object.assign(p, patch);
  renderFeed(); openEditor(p);
  emsg(tipo === "Historia" ? "Historia creada con fecha de hoy. Ajusta la fecha, sube la imagen y guarda." : "Post creado con fecha de hoy. Elige el tipo, sube la imagen y guarda.");
}


/* ---------- Editor de post ---------- */
const E_FIELDS = ["fecha","dia","semana","mes","tipo","pilar","status","cumplio","publicacion","copy","caption","inspo","contenido"];   // los comentarios van aparte, firmados
let editorDirty = false;
function emsg(t, warn){ const m = $("e-msg"); m.textContent = t || ""; m.classList.toggle("warn", !!warn); }
function setPreview(src){ $("e-preview").innerHTML = src ? `<img src="${esc(src)}" alt="Imagen del post">` : "Subir imagen o portada<br><span class='note'>Vertical 4:5 se ve mejor</span>"; }
function openEditor(p){
  current = p; pendingFile = null; editorDirty = false; if (pendingUrl) { URL.revokeObjectURL(pendingUrl); pendingUrl = null; }
  $("e-title").textContent = p.fecha ? `Post del ${fmtCorto(p.fecha)}` : "Post nuevo";
  ["dia","semana","mes","tipo","pilar","status","cumplio"].forEach(k => { $("e-"+k).innerHTML = optionsHtml(k === "dia" ? "dia" : k === "mes" ? "mes" : k, p[k], true); $("e-"+k).value = p[k] || ""; });
  ["fecha","publicacion","copy","caption","inspo","contenido"].forEach(k => { $("e-"+k).value = p[k] || ""; });
  $("e-publicacion").disabled = !publicacionDisponible(p);
  $("e-publicacion").placeholder = publicacionDisponible(p) ? "Enlace o referencia de la publicación final" : "Pendiente de activar en Supabase";
  LINK_FIELDS.forEach(k => { $("e-"+k+"-links").innerHTML = chipsLinks(p[k]); });
  pvIdx = 0; renderPreview(); renderSlides(); $("e-rmimg").classList.toggle("hidden", !p.imagen_path); emsg("");
  cargarHistorial(); iaLimpiar(); blCargar(p); seoCargar(p); pintarTomado(); pintarPrevBlog(); wpPintar();
  renderUltimo(); renderComentarios(); $("c-text").value = "";
  $("editor").classList.remove("hidden"); $("scrim").classList.remove("hidden");
  if (isMobile()) document.body.style.overflow = "hidden";
  $("editor").querySelector(".ed-body").scrollTop = 0;
  if (view === "feed") renderFeed();
  history.pushState({ editor: true }, "", location.hash);
}
function closeEditor(fromPop){
  if ($("editor").classList.contains("hidden")) return;
  if (editorDirty && !fromPop && !window.__forceClose) { emsg("Tienes cambios sin guardar. Toca Guardar o vuelve a tocar ✕ para descartarlos.", true); window.__forceClose = true; setTimeout(() => { window.__forceClose = false; }, 4000); return; }
  window.__forceClose = false;
  current = null; editorDirty = false; pendingFile = null; blQuitarSel(); blDoc.innerHTML = "";
  $("editor").classList.add("hidden"); $("scrim").classList.add("hidden"); document.body.style.overflow = "";
  if (!fromPop && history.state && history.state.editor) history.back();
  if (view === "feed") renderFeed();
}
window.addEventListener("popstate", () => { if (!$("editor").classList.contains("hidden")) closeEditor(true); });
$("e-close").addEventListener("click", () => closeEditor());
$("scrim").addEventListener("click", () => closeEditor());
document.addEventListener("keydown", e => { if (e.key === "Escape" && !$("editor").classList.contains("hidden") && !document.querySelector("dialog[open]")) closeEditor(); });
$("editor").addEventListener("input", e => { if (!e.target.closest(".coments, .ia")) editorDirty = true; if (e.target.id === "e-inspo" || e.target.id === "e-contenido") $(e.target.id + "-links").innerHTML = chipsLinks(e.target.value); });
$("editor").addEventListener("change", e => { if (e.target.closest(".coments, .ia")) return; editorDirty = true; if (e.target.id === "e-fecha" && e.target.value) { if (!$("e-dia").value) $("e-dia").value = diaDe(e.target.value); if (!$("e-mes").value) $("e-mes").value = mesDe(e.target.value); } });
$("e-prev").addEventListener("click", () => moveBy(-1));
$("e-next").addEventListener("click", () => moveBy(1));
$("e-preview").addEventListener("click", () => { if (pvIdx === 0) $("e-file").click(); });
$("e-file").addEventListener("change", e => {
  const f = e.target.files[0]; e.target.value = ""; if (!f) return;
  if (!f.type.startsWith("image/") && !/\.(heic|heif)$/i.test(f.name)) { emsg("Ese archivo no es una imagen.", true); return; }
  if (f.size > 40 * 1024 * 1024) { emsg("La imagen pesa más de 40 MB. Usa una más ligera.", true); return; }
  pendingFile = f; editorDirty = true; if (pendingUrl) URL.revokeObjectURL(pendingUrl); pendingUrl = URL.createObjectURL(f); pvIdx = 0; renderPreview(); emsg("Portada lista. Toca Guardar.");
});
async function uploadImage(file, postId, suf = ""){
  emsg("Optimizando imagen…");
  const big = await compress(file, 1440, 0.86), small = big ? await compress(file, 480, 0.8, big.blob.type) : null;
  const stamp = Date.now() + suf;
  let path, body, type;
  if (big) { path = `${postId}/${stamp}.${big.ext}`; body = big.blob; type = big.blob.type; }
  else { // el navegador no pudo leerla (p. ej. algunos HEIC): se sube tal cual
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
    if (file.size > 20 * 1024 * 1024) throw new Error("La imagen es demasiado pesada. Usa una de menos de 20 MB.");
    path = `${postId}/${stamp}.${ext}`; body = file; type = file.type || "image/jpeg";
  }
  emsg("Subiendo imagen…");
  const { error } = await sb.storage.from(CFG.bucket).upload(path, body, { contentType: type, upsert: false, cacheControl: "31536000" });
  if (error) throw error;
  if (small) await sb.storage.from(CFG.bucket).upload(thumbOf(path), small.blob, { contentType: small.blob.type, upsert: true, cacheControl: "31536000" });
  return path;
}
$("e-save").addEventListener("click", async () => {
  if (!current) return;
  const btn = $("e-save"); btn.disabled = true;
  try {
    const patch = {};
    E_FIELDS.forEach(k => { if (k === "publicacion" && !publicacionDisponible(current)) return; const v = $("e-"+k).value; patch[k] = (k === "copy" ? v.trim() : v) || null; });
    const fotosAntes = blImgs(current.cuerpo);
    if (patch.tipo === "Blog") { if (blSubiendo) throw new Error("Espera a que terminen de subir las imágenes del artículo."); patch.cuerpo = blLeer(blDoc); patch.caption = blTexto(patch.cuerpo) || null; }
    const seo = seoLeer(); if (patch.tipo === "Blog" || Object.values(seo).some(Boolean)) patch.seo = seo;
    const old = current.imagen_path;
    if (pendingFile) patch.imagen_path = await uploadImage(pendingFile, current.id);
    emsg("Guardando…");
    const { data: fila, error } = await sb.from("posts").update(patch).eq("id", current.id).select("tomado_por,tomado_at");
    if (error) throw error;
    const fr = Array.isArray(fila) ? fila[0] : fila; if (fr) Object.assign(patch, fr);
    if (patch.imagen_path) { await signedUrls(allImagePaths([{ imagen_path: patch.imagen_path }])); if (old) sb.storage.from(CFG.bucket).remove([old, thumbOf(old)]); }
    Object.assign(current, patch); const i = posts.findIndex(p => p.id === current.id); if (i >= 0) posts[i] = current;
    if (patch.cuerpo) { const quedan = blImgs(patch.cuerpo), sobran = fotosAntes.filter(x => !quedan.includes(x)); if (sobran.length) sb.storage.from(CFG.bucket).remove(sobran.flatMap(x => [x, thumbOf(x)])); }   // fotos que se quitaron del artículo
    pendingFile = null; editorDirty = false; emsg("Guardado."); current.updated_by = user.email; current.updated_at = new Date().toISOString(); renderUltimo();
    $("e-title").textContent = current.fecha ? `Post del ${fmtCorto(current.fecha)}` : "Post nuevo";
    pvIdx = 0; renderPreview(); renderSlides(); $("e-rmimg").classList.toggle("hidden", !current.imagen_path);
    renderAll(); cargarHistorial(); pintarTomado();
  } catch (err) { emsg(errMsg(err), true); }
  finally { btn.disabled = false; }
});
$("e-rmimg").addEventListener("click", async () => {
  if (!current || !current.imagen_path) return;
  await quitarSlide(0);
});
$("e-del").addEventListener("click", () => { if (current) { editorDirty = false; confirmDelete(current); } });

/* ---------- Carrusel: varias imágenes por post ---------- */
let pvIdx = 0;
function renderPreview(){
  if (!current) return;
  const s = slidesOf(current), n = s.length;
  if (pvIdx >= n) pvIdx = Math.max(0, n - 1);
  if (pvIdx === 0 && pendingUrl) setPreview(pendingUrl);
  else setPreview(s[pvIdx] ? (urlOf(s[pvIdx]) || thumbUrl(s[pvIdx])) : "");
  const multi = n > 1;
  $("pv-prev").classList.toggle("hidden", !multi || pvIdx === 0);
  $("pv-next").classList.toggle("hidden", !multi || pvIdx >= n - 1);
  $("pv-count").classList.toggle("hidden", !multi);
  $("pv-count").textContent = `${pvIdx + 1} / ${n}`;
  $("e-preview").title = pvIdx === 0 ? "Toca para cambiar la portada" : "";
}
function esCarrusel(){ return $("e-tipo").value === "Carrusel" || (current && slidesOf(current).length > 1); }
function renderSlides(){
  if (!current) return;
  $("e-slides").classList.toggle("hidden", !esCarrusel());
  const s = slidesOf(current);
  $("slide-strip").innerHTML = s.map((x, i) => `<div class="slide${i === pvIdx ? " sel" : ""}" data-i="${i}">
      <button type="button" class="sl-img" data-ver="${i}" aria-label="Ver imagen ${i + 1}" style="background-image:url('${esc(thumbUrl(x))}')"><span>${i + 1}</span></button>
      <div class="sl-ctl"><button type="button" data-mv="-1" aria-label="Mover antes" ${i === 0 ? "disabled" : ""}>◀</button><button type="button" data-rm aria-label="Quitar imagen ${i + 1}">✕</button><button type="button" data-mv="1" aria-label="Mover después" ${i === s.length - 1 ? "disabled" : ""}>▶</button></div></div>`).join("")
    + `<button type="button" class="slide add" id="sl-add"><span>＋</span>Agregar</button>`;
}
async function guardarSlides(list){
  const patch = { imagen_path: list[0] || null, imagenes: list.slice(1) };
  const { error } = await sb.from("posts").update(patch).eq("id", current.id);
  if (error) { emsg(errMsg(error), true); return false; }
  Object.assign(current, patch); const i = posts.findIndex(p => p.id === current.id); if (i >= 0) posts[i] = current;
  renderPreview(); renderSlides(); $("e-rmimg").classList.toggle("hidden", !current.imagen_path); renderAll(); cargarHistorial();
  return true;
}
async function quitarSlide(i){
  if (pendingFile) { emsg("Primero guarda o descarta la nueva portada.", true); return; }
  const s = slidesOf(current), x = s[i]; if (!x) return;
  s.splice(i, 1);
  if (await guardarSlides(s)) { sb.storage.from(CFG.bucket).remove([x, thumbOf(x)]); emsg(i === 0 && s.length ? "Portada quitada. La siguiente imagen ahora es la portada." : "Imagen quitada."); }
}
$("e-tipo").addEventListener("change", renderSlides);
$("pv-prev").addEventListener("click", () => { pvIdx--; renderPreview(); renderSlides(); });
$("pv-next").addEventListener("click", () => { pvIdx++; renderPreview(); renderSlides(); });
$("slide-strip").addEventListener("click", async e => {
  if (!current) return;
  if (e.target.closest("#sl-add")) { if (pendingFile) { emsg("Primero guarda o descarta la nueva portada.", true); return; } $("e-files").click(); return; }
  const sl = e.target.closest(".slide"); if (!sl) return; const i = +sl.dataset.i;
  if (e.target.closest("[data-ver]")) { pvIdx = i; renderPreview(); renderSlides(); return; }
  if (e.target.closest("[data-rm]")) { await quitarSlide(i); return; }
  const mv = e.target.closest("[data-mv]");
  if (mv) {
    if (pendingFile) { emsg("Primero guarda o descarta la nueva portada.", true); return; }
    const d = +mv.dataset.mv, s = slidesOf(current), j = i + d; if (j < 0 || j >= s.length) return;
    [s[i], s[j]] = [s[j], s[i]]; pvIdx = j;
    if (await guardarSlides(s)) emsg(j === 0 || i === 0 ? "Orden guardado. La imagen 1 es la portada." : "Orden guardado.");
  }
});
$("e-files").addEventListener("change", async e => {
  const files = [...e.target.files]; e.target.value = ""; if (!files.length || !current) return;
  const s = slidesOf(current), nuevas = [];
  try {
    for (let k = 0; k < files.length; k++) {
      const f = files[k];
      if (!f.type.startsWith("image/") && !/\.(heic|heif)$/i.test(f.name)) continue;
      if (f.size > 40 * 1024 * 1024) { emsg(`${f.name} pesa más de 40 MB; se omitió.`, true); continue; }
      const path = await uploadImage(f, current.id); nuevas.push(path);
      emsg(`Subidas ${k + 1} de ${files.length}…`);
    }
  } catch (err) { emsg(errMsg(err), true); }
  if (!nuevas.length) return;
  await signedUrls(allImagePaths([{ imagenes: nuevas }]));
  if (await guardarSlides(s.concat(nuevas))) { pvIdx = s.length; renderPreview(); renderSlides(); emsg(`${nuevas.length === 1 ? "Imagen agregada" : nuevas.length + " imágenes agregadas"} al carrusel.`); }
});

/* ---------- SEO del blog (calcado de yucatanlove.com: Yoast SEO, categoría, TAGS, autor y tiempo de lectura) ---------- */
/* Lo que existe hoy en el WordPress del sitio (revisado el 24 nov 2026), para que el artículo salga con la misma categoría,
   etiquetas y autor que los demás. Categorías: [id en WordPress, nombre tal cual, id de su categoría madre]; primero las del
   árbol actual (Experience Mexican Wedding), que es el que usan los artículos recientes. Si crean una nueva se puede escribir a mano. */
const WP_CATS = [[263,"Experience Mexican Wedding",0],
  [257,"Wedding Planning",263],[271,"Wedding Planner",257],[273,"Wedding Ceremony",257],[272,"Wedding Preparation",257],[270,"Wedding Budget",257],[274,"Wedding Wellness",257],
  [258,"Wedding Themes",263],[292,"Wedding Details",258],[291,"Wedding Styles",258],[293,"Wedding Floral",258],
  [260,"Wedding Services",263],[288,"Fun Wedding Activities",260],[286,"Wedding Art",260],[285,"Wedding Music",260],[275,"Wedding Catering",260],[277,"Wedding Food",275],[278,"Wedding Drinks",275],
  [262,"Travel Advisory Yucatan",263],[281,"Travel Experience",262],[282,"Adventure Travel",262],[283,"Best honeymoon destinations in Mexico",262],
  [256,"Wedding Venues",263],[279,"Beach Wedding",256],[121,"Celestun Beach",279],[122,"Cozumel Island",279],[139,"Holbox Island",279],[269,"Hotel Villas Caracol",279],[310,"Hacienda Xtepén",256],
  [255,"Hacienda Wedding Venue",256],[309,"Casa Palomeque",255],[119,"Cenote X'Batun",255],[120,"Chablé Resort",255],[123,"Hacienda Chichí Suárez",255],[312,"Hacienda Chuntuac",255],[124,"Hacienda Dzibikak",255],
  [125,"Hacienda Itzincab Cámara",255],[126,"Hacienda Sac Chich",255],[296,"Hacienda San Antonio Hool",255],[127,"Hacienda San Diego Cutz",255],[128,"Hacienda San Jose Cholul",255],[267,"Hacienda San Pedro Ochil",255],
  [129,"Hacienda Santa Cruz",255],[298,"Hacienda Santa Lucía Kantoyná",255],[280,"Hacienda Santa Rosa",255],[130,"Hacienda Selva Maya",255],[131,"Hacienda Sotuta de Peón",255],[132,"Hacienda Suytunchen",255],
  [133,"Hacienda Tamchen",255],[134,"Hacienda Tekik de Regil",255],[136,"Hacienda Temozon",255],[137,"Hacienda Texán de Palomeque",255],[138,"Hacienda Uayamon",255],[297,"Hacienda Xcanatun",255],
  [268,"Hacienda Yaxcopoil",255],[140,"Mansion Hotel",255],[141,"Quinta Montes Molina",255],
  [143,"Wedding Beauty and Wellness",0],[144,"Makeup",143],[261,"Wedding Look",143],[289,"Elegant Couple",261],[290,"Wedding Guest Looks",261],
  [72,"Wedding Essentials",0],[154,"Ideas & Tips",72],[147,"Destination Wedding",72],[148,"Beach Wedding",147],[150,"Cenote Wedding",147],[149,"Religious Wedding",72],[151,"Legal Wedding",72],[152,"Symbolic Wedding",72],[155,"Catering",72],[156,"Favor",72],
  [157,"Wedding Fashion",0],[158,"Bridal and Groom´s Wear",157],[159,"Jewelry and Accesories",157],[161,"Guest",157],[164,"Wedding Planner",0]];
const WP_TAGS = ["Residential Retreats","Ideas & Tips","Destination Wedding","Wedding Planner","Religious Wedding","Jewelry and Accesories","Symbolic Wedding","Bridal and Groom´s Wear","Hacienda Temozón Sur","Hacienda Uayamón","Catering","Wellness","yucatan weddings","Cenote Wedding","cenote xbatun","Favor","Hindu wedding","Legal Wedding","Makeup","chinese wedding","lgbt wedding","Mayan wedding","travel experience","Wedding symbols","Hacienda Sac Chich"];
const WP_AUTORES = ["Karen Solis","Evi Escobedo","Ivonne de YucatánLove","Content Manager"];
const YL_SUFIJO = " - YUC'ATÅLOVE 💕 Wedding Planners";   // así completa Yoast el título en Google cuando no se escribe un título SEO propio
const wpNorma = t => String(t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const catDe = n => { n = wpNorma(n); return n ? WP_CATS.find(c => wpNorma(c[1]) === n) || null : null; };   // si hay dos con el mismo nombre, la del árbol actual
const catRuta = c => { const r = []; let m = WP_CATS.find(x => x[0] === c[2]); while (m && r.length < 4) { r.unshift(m[1]); const pid = m[2]; m = WP_CATS.find(x => x[0] === pid); } return r.join(" › "); };
const SEO_K = { titulo: "seo-titulo", desc: "seo-desc", slug: "seo-slug", kw: "seo-kw", cat: "seo-cat", autor: "seo-autor", tags: "seo-tags", alt: "seo-alt" };
const slugify = s => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").replace(/-+/g, "-").slice(0, 75).replace(/-+$/, "");
const palabras = t => (String(t || "").trim().match(/\S+/g) || []).length;
const minLectura = t => Math.max(1, Math.round(palabras(t) / 200));
function seoLeer(){ const o = {}; Object.entries(SEO_K).forEach(([k, id]) => { const v = $(id).value.trim(); if (v) o[k] = k === "slug" ? slugify(v) : v; }); const c = catDe(o.cat); if (c) o.catId = c[0]; return o; }
function seoCargar(p){ const s = (p && p.seo) || {}; Object.entries(SEO_K).forEach(([k, id]) => { $(id).value = s[k] || ""; }); seoToggle(); seoPintar(); }
function seoToggle(){ $("seo-box").classList.toggle("hidden", $("e-tipo").value !== "Blog"); }
function seoPintar(){
  const cuerpo = esBlogEd() ? blLeer(blDoc) : [];
  const s = seoLeer(), h1 = $("e-copy").value.trim(), body = esBlogEd() ? blTexto(cuerpo) : $("e-caption").value, kw = (s.kw || "").toLowerCase();
  const subt = cuerpo.filter(b => b.t === "h"), fotos = cuerpo.filter(b => b.t === "img").flatMap(b => b.imgs || []);
  const sueltos = cuerpo.flatMap(b => [b.x, ...(b.items || []), ...(b.f || []).flat()]).filter(Boolean).join(" ");   // todo el texto con sus enlaces
  const t = s.titulo || (h1 ? h1 + YL_SUFIJO : "Título del artículo"), d = s.desc || body.slice(0, 155) || "Meta descripción…";
  $("seo-t-c").textContent = `${(s.titulo || "").length}/60`; $("seo-t-c").className = "cnt" + ((s.titulo || "").length > 60 ? " mal" : "");
  $("seo-d-c").textContent = `${(s.desc || "").length}/155`; $("seo-d-c").className = "cnt" + ((s.desc || "").length > 160 ? " mal" : "");
  $("seo-preview").innerHTML = `<div class="sg-site"><span class="sg-fav">Y</span><div><b>YUC'ATÅLOVE</b><span>https://www.yucatanlove.com › ${esc(s.slug || slugify(h1) || "…")}</span></div></div>
    <div class="sg-t">${esc(t.length > 62 ? t.slice(0, 60) + "…" : t)}</div><div class="sg-d">${esc(d.length > 158 ? d.slice(0, 155) + "…" : d)}</div>`;
  const has = (txt) => kw && String(txt || "").toLowerCase().includes(kw);
  const pals = palabras(body);
  const checks = [
    [!!s.kw, "Tiene palabra clave principal"],
    [has(s.titulo), "La palabra clave está en el título SEO"],
    [has(h1), "La palabra clave está en el título (H1)"],
    [has(s.desc), "La palabra clave está en la meta descripción"],
    [kw && (s.slug || "").includes(slugify(kw)), "La palabra clave está en la URL"],
    [has(body.slice(0, 600)), "La palabra clave aparece al inicio del texto"],
    [(s.titulo || "").length >= 30 && (s.titulo || "").length <= 60, "Título SEO entre 30 y 60 caracteres"],
    [(s.desc || "").length >= 120 && (s.desc || "").length <= 160, "Meta descripción entre 120 y 160 caracteres"],
    [pals >= 600, `Texto de al menos 600 palabras (lleva ${pals})`],
    [subt.filter(b => b.n === 2).length >= 2, `Tiene al menos 2 subtítulos H2 (lleva ${subt.filter(b => b.n === 2).length})`],
    [!subt.some(b => b.n === 1), "Un solo H1: el título (sin otro H1 dentro del texto)"],
    [subt.some(b => has(blPlano(b.x))), "La palabra clave aparece en algún subtítulo"],
    [fotos.length > 0, `Tiene imágenes dentro del texto (lleva ${fotos.length})`],
    [fotos.length > 0 && fotos.every(f => (f.alt || "").trim()), "Todas las imágenes del texto tienen texto alternativo"],
    [!!catDe(s.cat), s.cat && !catDe(s.cat) ? `La categoría “${s.cat}” no está entre las del sitio` : "Tiene una categoría del sitio"], [!!s.tags, "Tiene etiquetas (TAGS)"], [!!s.alt, "La imagen destacada tiene texto alternativo"],
    // Armado como los artículos del sitio
    [cuerpo.length > 0 && cuerpo[0].t === "p", "Empieza con una introducción antes del primer subtítulo"],
    [/href="https?:\/\/(www\.)?yucatanlove\.com/i.test(sueltos) || cuerpo.some(b => b.t === "btn" && /^https?:\/\/(www\.)?yucatanlove\.com/i.test(b.href || "")), "Enlaza a otra página de yucatanlove.com"],
    [fotos.length === 0 || /captured by|photo credits?|photos? by|fotograf/i.test(body), "Lleva el crédito de las fotos (en el sitio: “A vision of YUC'ATÅLOVE ®, captured by …”)"],
  ];
  $("seo-chk").innerHTML = checks.map(([ok, t]) => `<li class="${ok ? "ok" : ""}">${ok ? "✓" : "○"} ${esc(t)}</li>`).join("") + `<li class="info">⏱ ${minLectura(body)} min de lectura · ${pals} palabras</li>`;
  seoAyudas(s);
}
// Debajo de Categoría: en qué parte del sitio queda (o aviso si no existe). Debajo de Etiquetas: las que ya existen, para elegirlas con un clic.
function seoAyudas(s){
  const c = catDe(s.cat), a = $("seo-cat-a"), ruta = c ? catRuta(c) : "";
  a.textContent = !s.cat ? "Elige una de la lista: son las categorías que existen en el sitio (una por artículo)." : c ? "En el sitio: " + (ruta ? ruta + " › " : "") + c[1] : "No está entre las categorías del sitio. Si es nueva, primero hay que crearla en WordPress.";
  a.classList.toggle("mal", !!s.cat && !c);
  const puestas = String(s.tags || "").split(",").map(wpNorma).filter(Boolean);
  $("seo-tags-sug").innerHTML = "<span>Ya existen en el sitio:</span>" + WP_TAGS.map(t => `<button type="button" data-tag="${esc(t)}" class="${puestas.includes(wpNorma(t)) ? "on" : ""}">${esc(t)}</button>`).join("");
}
$("seo-cats").innerHTML = WP_CATS.filter((c, i) => WP_CATS.findIndex(x => wpNorma(x[1]) === wpNorma(c[1])) === i).map(c => `<option value="${esc(c[1])}">${esc(catRuta(c))}</option>`).join("");
$("seo-autores").innerHTML = WP_AUTORES.map(a => `<option value="${esc(a)}"></option>`).join("");
$("seo-tags-sug").addEventListener("click", e => {
  const b = e.target.closest("button[data-tag]"); if (!b) return;
  const i = $("seo-tags"), l = i.value.split(",").map(x => x.trim()).filter(Boolean), k = l.findIndex(x => wpNorma(x) === wpNorma(b.dataset.tag));
  if (k >= 0) l.splice(k, 1); else l.push(b.dataset.tag);
  i.value = l.join(", "); i.dispatchEvent(new Event("input", { bubbles: true }));
});
["e-tipo"].forEach(id => $(id).addEventListener("change", () => { seoToggle(); seoPintar(); }));
["e-copy","e-caption", ...Object.values(SEO_K)].forEach(id => $(id).addEventListener("input", () => { seoPintar(); pintarPrevBlog(); }));
["e-tipo","e-fecha"].forEach(id => $(id).addEventListener("change", pintarPrevBlog));
$("seo-ver").addEventListener("click", () => { const b = borradorBlog(); if (b) abrirArticulo(b); });
$("ed-prev-full").addEventListener("click", () => { const b = borradorBlog(); if (b) abrirArticulo(b); });
$("seo-slug-auto").addEventListener("click", () => { $("seo-slug").value = slugify($("seo-kw").value && !$("e-copy").value ? $("seo-kw").value : ($("seo-titulo").value || $("e-copy").value).split("|")[0]); editorDirty = true; seoPintar(); });

/* ---------- Asistente de IA (Grok / Claude vía función de Supabase) ---------- */
let iaOpciones = [], iaAccion = "", iaOcupado = false;
const IA_DESTINO = { caption: "caption", pulir_caption: "caption", pulir_idea: "copy", hooks: "caption" };
function iaLimpiar(){ iaOpciones = []; $("ia-out").innerHTML = ""; $("ia-extra").value = ""; }
async function iaPedir(accion){
  if (!current || iaOcupado) return;
  const post = { tipo: $("e-tipo").value, pilar: $("e-pilar").value, fecha: $("e-fecha").value, copy: $("e-copy").value, caption: $("e-caption").value, inspo: $("e-inspo").value, comentarios: textoComentarios(current.id) };
  if (accion === "pulir_caption" && !post.caption.trim()) { $("ia-out").innerHTML = '<p class="note warn">Primero escribe un caption para poder pulirlo, o usa “Sugerir caption”.</p>'; return; }
  if (accion === "pulir_idea" && !post.copy.trim()) { $("ia-out").innerHTML = '<p class="note warn">Escribe la idea en el campo Copy y la pulo.</p>'; return; }
  iaOcupado = true; iaAccion = accion;
  document.querySelectorAll("#ia [data-ia]").forEach(b => b.disabled = true);
  $("ia-out").innerHTML = '<p class="note ia-cargando">Pensando opciones…</p>';
  try {
    const { data, error } = await sb.functions.invoke("ia", { body: { accion, post, idioma: $("ia-lang").value, instruccion: $("ia-extra").value.trim() } });
    let res = data;
    if (error) { try { res = await error.context.json(); } catch (_) { res = { error: error.message }; } }
    if (!res || res.error) {
      $("ia-out").innerHTML = `<p class="note warn">${esc(res && res.sin_clave ? "El asistente todavía no está activado: falta guardar la clave de Grok en Supabase." : (res && res.error) || "No se pudo generar. Intenta de nuevo.")}</p>`;
      return;
    }
    iaOpciones = res.opciones || [];
    const dest = IA_DESTINO[accion];
    $("ia-out").innerHTML = iaOpciones.map((o, i) => `<div class="ia-op"><p>${esc(o)}</p><div class="ia-acc">
        <button type="button" class="btn small" data-usar="${i}" data-campo="${dest}">${dest === "copy" ? "Usar como copy" : accion === "hooks" ? "Poner al inicio del caption" : "Usar como caption"}</button>
        <button type="button" class="btn ghost small" data-copiar="${i}">Copiar</button></div></div>`).join("")
      + `<p class="note">Sugerido por ${esc(res.motor || "IA")}. Revisa antes de guardar.</p>`;
  } catch (err) { $("ia-out").innerHTML = `<p class="note warn">${esc(errMsg(err))}</p>`; }
  finally { iaOcupado = false; document.querySelectorAll("#ia [data-ia]").forEach(b => b.disabled = false); }
}
$("ia").addEventListener("click", async e => {
  const b = e.target.closest("[data-ia]"); if (b) { iaPedir(b.dataset.ia); return; }
  const u = e.target.closest("[data-usar]");
  if (u) {
    const t = iaOpciones[+u.dataset.usar]; if (t == null) return;
    const campo = u.dataset.campo === "copy" ? $("e-copy") : $("e-caption");
    if (iaAccion === "hooks") { const resto = campo.value.replace(/^[^\n]*\n?/, ""); campo.value = t + (resto ? "\n" + resto : ""); }
    else campo.value = t;
    editorDirty = true; campo.dispatchEvent(new Event("input", { bubbles: true }));
    emsg("Texto puesto en " + (u.dataset.campo === "copy" ? "Copy" : "Caption") + ". Revisa y toca Guardar.");
    return;
  }
  const c = e.target.closest("[data-copiar]");
  if (c) { const ok = await copiarTexto(iaOpciones[+c.dataset.copiar] || ""); c.textContent = ok ? "Copiado ✓" : "No se pudo"; setTimeout(() => c.textContent = "Copiar", 1500); }
});

/* ---------- Historial de cambios ---------- */
const H_LABEL = { fecha:"Fecha", dia:"Día", semana:"Semana", mes:"Mes", tipo:"Tipo", pilar:"Pilar", status:"Status", cumplio:"¿Cumplió?", publicacion:"Publicación", copy:"Copy", caption:"Caption", inspo:"Inspo", comentarios:"Comentarios", contenido:"Contenido" };
const H_LARGOS = ["publicacion","copy","caption","inspo","comentarios","contenido"];
let histPost = null;
async function cargarHistorial(){
  if (!current) return; const id = current.id; histPost = id;
  const { data, error } = await sb.from("historial").select("*").eq("post_id", id).order("created_at", { ascending: false }).limit(60);
  if (histPost !== id || !current) return;
  const list = error ? [] : (data || []).filter(h => h.post_id === id || !h.post_id);
  $("h-n").textContent = list.length ? `(${list.length})` : "";
  $("h-list").innerHTML = list.length ? list.map(h => `<li><div><b>${esc(nombreDe(h.autor))}</b> ${histTexto(h)}</div><span class="note">${esc(cuando(h.created_at))}</span></li>`).join("")
    : '<li class="note">Aún no hay cambios registrados.</li>';
}
function histTexto(h){
  const v = t => `<span class="h-v">${esc(t)}</span>`;
  if (h.campo === "creado") return "creó el post";
  if (h.campo === "imagen_path") return !h.antes ? "subió la portada" : !h.despues ? "quitó la portada" : "cambió la portada";
  if (h.campo === "imagenes") { const a = +h.antes, d = +h.despues; return d > a ? `agregó ${d - a === 1 ? "una imagen" : (d - a) + " imágenes"} al carrusel` : d < a ? `quitó ${a - d === 1 ? "una imagen" : (a - d) + " imágenes"} del carrusel` : "reordenó el carrusel"; }
  const L = H_LABEL[h.campo] || h.campo;
  if (H_LARGOS.includes(h.campo)) {
    if (!h.antes) return `agregó ${L}`;
    if (!h.despues) return `borró ${L}`;
    const ant = h.antes.length > 140 ? h.antes.slice(0, 140) + "…" : h.antes;
    return `editó ${L}<div class="h-antes">Antes: ${esc(ant)}</div>`;
  }
  const fmt = x => h.campo === "fecha" && x ? fmtCorto(x) : x;
  return `cambió ${L}: ${h.antes ? `<s>${esc(fmt(h.antes))}</s> → ` : ""}${h.despues ? v(fmt(h.despues)) : "<i>vacío</i>"}`;
}


/* ---------- Comentarios firmados ----------
   Cada comentario es una entrada aparte con quién lo puso y cuándo (tabla "comentarios"); nadie escribe
   encima del de otra persona. La columna Comentarios de la Parrilla muestra el último y abre la ventana
   con todos; en el editor están al final. Lo borra su autor o quien administra (regla en la base). */
async function loadComentarios(){
  const { data, error } = await sb.from("comentarios").select("*").order("created_at");
  if (!error) { comentarios = data || []; renderAll(); }
}
let cIdx = null;   // comentarios agrupados por post; se rehace solo cuando la lista cambia
function comentariosDe(id){
  if (!cIdx || cIdx.src !== comentarios || cIdx.n !== comentarios.length) {
    const m = new Map();
    for (const c of comentarios) { const l = m.get(c.post_id); if (l) l.push(c); else m.set(c.post_id, [c]); }
    m.forEach(l => l.sort((a, b) => String(a.created_at).localeCompare(String(b.created_at))));
    cIdx = { src: comentarios, n: comentarios.length, m };
  }
  return cIdx.m.get(id) || [];
}
const nComent = id => comentariosDe(id).length;
const ultimoComentario = id => { const l = comentariosDe(id); return l.length ? String(l[l.length - 1].created_at || "") : ""; };
const textoComentarios = id => comentariosDe(id).map(c => `${nombreDe(c.autor)}: ${c.texto}`).join("\n");
function nombreDe(email){
  const m = team.find(t => t.email.toLowerCase() === String(email || "").toLowerCase());
  return (m && m.nombre) || String(email || "Alguien").split("@")[0];
}
function cuando(ts){
  if (!ts) return "";
  const d = new Date(ts), diff = (Date.now() - d) / 60000;
  if (diff < 1) return "ahora";
  if (diff < 60) return `hace ${Math.round(diff)} min`;
  if (diff < 1440 && d.getDate() === new Date().getDate()) return `hoy ${d.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}`;
  return d.toLocaleString("es-MX", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}
// Nombre corto para espacios chicos: el primer nombre, o dos palabras si hay otra persona con el mismo (Ana Belén / Ana Laura)
function nombreCorto(email){
  const p = nombreDe(email).split(/\s+/), yo = String(email || "").toLowerCase();
  const repetido = team.some(t => t.email.toLowerCase() !== yo && String(t.nombre || "").trim().split(/\s+/)[0].toLowerCase() === p[0].toLowerCase());
  return repetido && p[1] ? p[0] + " " + p[1] : p[0];
}
const fechaLarga = ts => { try { return new Date(ts).toLocaleString("es-MX", { dateStyle: "full", timeStyle: "short" }); } catch (_) { return ""; } };
function bolitaDe(email, chica){
  const n = nombreDe(email), c = colorPersona(email);
  return `<span class="bolita${chica ? " ch" : ""}" style="background:${c};color:${textOn(c)}" aria-hidden="true">${esc(iniciales(n))}</span>`;
}
// Celda de la columna Comentarios: el último comentario con la bolita de quien lo puso (y cuántos hay)
function comentCelda(p){
  const l = comentariosDe(p.id);
  if (!l.length) return '<button class="txt empty" data-coment title="Escribir un comentario" aria-label="Escribir un comentario"><span class="clamp">—</span></button>';
  const u = l[l.length - 1], n = nombreDe(u.autor);
  return `<button class="txt cm" data-coment title="${esc(n)} · ${esc(cuando(u.created_at))}. Clic para ver ${l.length > 1 ? "los " + l.length + " comentarios" : "el comentario"} y responder">${bolitaDe(u.autor, true)}<span class="clamp"><b>${esc(nombreCorto(u.autor))}:</b> ${esc(String(u.texto).replace(/\s*\n+\s*/g, " "))}</span>${l.length > 1 ? `<span class="cm-n">${l.length}</span>` : ""}</button>`;
}
// En las tarjetas de celular: una línea con el último comentario y su autor
function comentTarjeta(p){
  const l = comentariosDe(p.id); if (!l.length) return "";
  const u = l[l.length - 1];
  return `<span class="pcoment" data-coment>${bolitaDe(u.autor, true)}<span><b>${esc(nombreCorto(u.autor))}:</b> ${esc(String(u.texto).replace(/\s*\n+\s*/g, " "))}</span></span>`;
}
function renderUltimo(){
  const p = current; if (!p) return;
  $("e-last").textContent = p.updated_by ? `Último cambio: ${nombreDe(p.updated_by)} · ${cuando(p.updated_at)}` : "";
}
function comentariosHtml(id){
  const yo = ((user && user.email) || "").toLowerCase(), l = comentariosDe(id);
  return l.length ? l.map(c => {
    const mio = String(c.autor || "").toLowerCase() === yo;
    return `<li class="c-item${mio ? " mio" : ""}">${bolitaDe(c.autor)}<div class="c-cuerpo"><div class="c-meta"><span><b>${esc(nombreDe(c.autor))}</b> · <time datetime="${esc(c.created_at || "")}" title="${esc(fechaLarga(c.created_at))}">${esc(cuando(c.created_at))}</time></span>${mio || esAdmin ? `<button type="button" class="c-del" data-cdel="${esc(c.id)}">Borrar</button>` : ""}</div><div class="c-txt">${esc(c.texto)}</div></div></li>`;
  }).join("") : '<li class="c-empty">Todavía no hay comentarios en este post.</li>';
}
// Pinta los comentarios donde estén a la vista: en el editor y/o en la ventana de comentarios
function renderComentarios(){
  if (current) $("c-list").innerHTML = comentariosHtml(current.id);
  if (cdPost && $("cdlg").open) $("cd-list").innerHTML = comentariosHtml(cdPost.id);
}
async function enviarComentario(postId, ta, btn, aviso){
  const t = ta.value.trim(); if (!t || !postId || btn.disabled) return false;
  btn.disabled = true;
  const { data, error } = await sb.from("comentarios").insert({ post_id: postId, texto: t, autor: user.email }).select().single();
  btn.disabled = false;
  if (error) { aviso(errMsg(error), true); return false; }
  if (data && !comentarios.find(c => c.id === data.id)) comentarios.push(data);
  ta.value = ""; aviso(""); renderComentarios(); renderAll();
  return true;
}
// Borrar pide un segundo clic (para no borrar por accidente el comentario de alguien)
async function clicBorrarComentario(e, aviso){
  const b = e.target.closest("[data-cdel]"); if (!b) return;
  if (!b.dataset.ok) { b.dataset.ok = "1"; b.textContent = "¿Borrar? Sí"; setTimeout(() => { if (b.isConnected) { delete b.dataset.ok; b.textContent = "Borrar"; } }, 3500); return; }
  const id = b.dataset.cdel; b.disabled = true;
  const { error } = await sb.from("comentarios").delete().eq("id", id);
  if (error) { b.disabled = false; aviso(errMsg(error), true); return; }
  comentarios = comentarios.filter(c => c.id !== id); renderComentarios(); renderAll();
}
const cdAviso = (t, warn) => { const m = $("cd-msg"); m.textContent = t || ""; m.classList.toggle("warn", !!warn); };
// En el editor
$("c-form").addEventListener("submit", async e => {
  e.preventDefault(); if (!current) return;
  if (await enviarComentario(current.id, $("c-text"), $("c-send"), emsg)) { const l = $("c-list"); l.lastElementChild && l.lastElementChild.scrollIntoView({ block: "nearest" }); }
});
$("c-text").addEventListener("keydown", e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); $("c-form").requestSubmit(); } });
$("c-list").addEventListener("click", e => clicBorrarComentario(e, emsg));
// Ventana de comentarios (desde la columna de la Parrilla o el globito 💬 en celular)
let cdPost = null;
function abrirComentarios(p){
  const d = $("cdlg"); cdPost = p;
  $("cd-title").textContent = `Comentarios${p.fecha ? " · " + fmtCorto(p.fecha) : ""}`;
  $("cd-sub").textContent = [p.tipo, String(p.copy || "").replace(/\s+/g, " ").trim().slice(0, 90)].filter(Boolean).join(" · ");
  $("cd-text").value = ""; cdAviso("");
  if (!d.open) d.showModal();
  renderComentarios();
  const l = $("cd-list"); l.scrollTop = l.scrollHeight;
  $("cd-text").focus();
}
$("cdlg").addEventListener("close", () => { cdPost = null; });
$("cdlg").addEventListener("click", e => { if (e.target === $("cdlg")) $("cdlg").close(); });   // clic fuera de la ventana
$("cd-close").addEventListener("click", () => $("cdlg").close());
$("cd-form").addEventListener("submit", async e => {
  e.preventDefault(); if (!cdPost) return;
  if (await enviarComentario(cdPost.id, $("cd-text"), $("cd-send"), cdAviso)) { const l = $("cd-list"); l.scrollTop = l.scrollHeight; $("cd-text").focus(); }
});
$("cd-text").addEventListener("keydown", e => { if (e.key === "Enter" && !e.shiftKey && !e.isComposing && !isMobile()) { e.preventDefault(); $("cd-form").requestSubmit(); } });
$("cd-list").addEventListener("click", e => clicBorrarComentario(e, cdAviso));

/* ---------- Resumen ---------- */
function crossTable(el, rowsKey, rowVals, colKey, colVals, rowsFilter){
  const data = posts.filter(rowsFilter || (() => true));
  const cnt = (r, c) => data.filter(p => (r === null || p[rowsKey] === r) && (c === null || p[colKey] === c)).length;
  const rowsUsed = rowVals.filter(r => cnt(r, null) > 0);
  const extraRows = cnt(null, null) - rowsUsed.reduce((s, r) => s + cnt(r, null), 0);
  let h = `<thead><tr><th></th>${colVals.map(c => `<th>${esc(c)}</th>`).join("")}<th>Total</th></tr></thead><tbody>`;
  rowsUsed.forEach(r => { h += `<tr><td>${esc(r)}</td>${colVals.map(c => { const n = cnt(r, c); return `<td class="${n ? "" : "zero"}">${n}</td>`; }).join("")}<td><b>${cnt(r, null)}</b></td></tr>`; });
  if (extraRows > 0) h += `<tr><td class="note">Sin asignar</td>${colVals.map(c => { const n = data.filter(p => !rowVals.includes(p[rowsKey]) && p[colKey] === c).length; return `<td class="${n ? "" : "zero"}">${n}</td>`; }).join("")}<td>${extraRows}</td></tr>`;
  h += `<tr class="total"><td>Total</td>${colVals.map(c => `<td>${cnt(null, c)}</td>`).join("")}<td>${data.length}</td></tr></tbody>`;
  el.innerHTML = data.length ? h : '<tbody><tr><td class="note">Todavía no hay posts para este filtro.</td></tr></tbody>';
}
$("rs-mes").addEventListener("change", renderResumen);
function renderResumen(){
  renderCalendar();
  const m = $("rs-mes").value, byMes = p => !m || p.mes === m;
  crossTable($("sum-semana"), "semana", lista("semana").map(o => o.valor), "tipo", lista("tipo").map(o => o.valor), byMes);
  crossTable($("sum-pilar-tipo"), "pilar", lista("pilar").map(o => o.valor), "tipo", lista("tipo").map(o => o.valor), byMes);
  crossTable($("sum-pilar"), "pilar", lista("pilar").map(o => o.valor), "status", lista("status").map(o => o.valor), byMes);
  crossTable($("sum-mes"), "mes", MESES, "pilar", lista("pilar").map(o => o.valor));
  const d = posts.filter(byMes), si = d.filter(p => p.cumplio === "✔").length, no = d.filter(p => p.cumplio === "✖").length;
  $("sum-cumplio").innerHTML = `<div class="kpi"><b>${si}</b>Cumplieron ✔</div><div class="kpi"><b>${no}</b>No cumplieron ✖</div><div class="kpi"><b>${d.length - si - no}</b>Sin evaluar</div>`;
}


/* ---------- Calendario ---------- */
let calRef = (() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); })();
const DOW = ["Lun","Mar","Mié","Jue","Vie","Sáb","Dom"];
const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
function calPost(p){
  const c = colorDe("tipo", p.tipo) || "#C3ACA9", u = thumbUrl(p.imagen_path);
  const label = [p.tipo, p.copy].filter(Boolean).join(" · ") || "Sin copy";
  return `<button type="button" class="cal-post${p.status === "Publicado" ? " ya-pub" : ""}" data-open="${p.id}" style="border-left-color:${c}" title="${esc(label + (p.status ? " — " + p.status : ""))}">${u ? `<img src="${esc(u)}" alt="" loading="lazy">` : ""}<span class="t">${esc(label)}</span></button>`;
}
function renderCalendar(){
  const y = calRef.getFullYear(), m = calRef.getMonth(), hoy = iso(new Date());
  $("cal-month").textContent = `${MESES[m]} ${y}`;
  $("cal-legend").innerHTML = lista("tipo").map(o => chip("tipo", o.valor)).join("") + '<span class="note">· Lo publicado se ve más tenue</span>';
  const byDay = {};
  posts.forEach(p => { if (p.fecha) (byDay[p.fecha] = byDay[p.fecha] || []).push(p); });
  Object.values(byDay).forEach(l => l.sort((a, b) => String(a.tipo || "").localeCompare(String(b.tipo || ""))));
  // cuadrícula de lunes a domingo
  const first = new Date(y, m, 1), start = new Date(y, m, 1 - ((first.getDay() + 6) % 7));
  let h = DOW.map(d => `<div class="cal-dow">${d}</div>`).join("");
  for (let i = 0; i < 42; i++) {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i), k = iso(d);
    if (i >= 35 && d.getMonth() !== m) break;
    h += `<div class="cal-day${d.getMonth() !== m ? " out" : ""}${k === hoy ? " today" : ""}"><span class="cal-num">${d.getDate()}</span>${(byDay[k] || []).map(calPost).join("")}<button type="button" class="cal-add" data-add="${k}" aria-label="Agregar post el ${d.getDate()} de ${MESES[d.getMonth()]}" title="Agregar post este día">＋</button></div>`;
  }
  $("cal-grid").innerHTML = h;
  // agenda para celular: solo los días del mes con publicaciones
  const dias = Object.keys(byDay).filter(k => k.startsWith(`${y}-${String(m + 1).padStart(2, "0")}-`)).sort();
  $("cal-agenda").innerHTML = dias.length ? dias.map(k => { const d = new Date(k + "T12:00:00"); return `<li><div class="d${k === hoy ? " today" : ""}">${DOW[(d.getDay() + 6) % 7]}<b>${d.getDate()}</b></div><div class="items">${byDay[k].map(calPost).join("")}</div></li>`; }).join("")
    : '<li class="empty-state">No hay publicaciones con fecha en este mes.</li>';
  const sin = posts.filter(p => !p.fecha).length;
  $("cal-sinfecha").textContent = sin ? `${sin} post${sin === 1 ? "" : "s"} sin fecha no aparece${sin === 1 ? "" : "n"} en el calendario. Asígnales fecha en la Parrilla.` : "";
}
$("cal-prev").addEventListener("click", () => { calRef = new Date(calRef.getFullYear(), calRef.getMonth() - 1, 1); renderCalendar(); });
$("cal-next").addEventListener("click", () => { calRef = new Date(calRef.getFullYear(), calRef.getMonth() + 1, 1); renderCalendar(); });
$("cal-today").addEventListener("click", () => { const d = new Date(); calRef = new Date(d.getFullYear(), d.getMonth(), 1); renderCalendar(); });
$("view-resumen").addEventListener("click", async e => {
  const o = e.target.closest("[data-open]"); if (o) { const p = posts.find(x => x.id === o.dataset.open); if (p) openEditor(p); return; }
  const a = e.target.closest("[data-add]"); if (!a) return;
  const f = a.dataset.add, p = await addPost(); if (!p) return;
  const patch = { fecha: f, dia: diaDe(f), mes: mesDe(f) };
  const { error } = await sb.from("posts").update(patch).eq("id", p.id);
  if (!error) Object.assign(p, patch);
  renderCalendar(); openEditor(p);
});


/* ---------- Exportar mes a PDF ---------- */
function tagHtml(name, v){ if (!v) return ""; const c = colorDe(name, v) || "#F6F6F4"; return `<span style="background:${c};color:${textOn(c)}">${esc(v)}</span>`; }
async function exportarPDF(){
  const btn = $("cal-pdf"); btn.disabled = true; btn.textContent = "Preparando…";
  try {
    const y = calRef.getFullYear(), m = calRef.getMonth(), pref = `${y}-${String(m + 1).padStart(2, "0")}-`;
    const delMes = posts.filter(p => p.fecha && p.fecha.startsWith(pref)).sort((a, b) => a.fecha.localeCompare(b.fecha));
    await signedUrls(allImagePaths(delMes));
    const full = p => urlOf(p.imagen_path) || thumbUrl(p.imagen_path);
    const cuenta = (k) => { const o = {}; delMes.forEach(p => { const v = p[k] || "Sin asignar"; o[v] = (o[v] || 0) + 1; }); return o; };
    const porTipo = cuenta("tipo"), porStatus = cuenta("status");
    const titulo = `${MESES[m]} ${y}`;
    // Portada
    let h = `<section class="pr-page pr-cover"><img class="pr-art" src="icons/composicion.svg" alt=""><img src="icons/logo-color.png" alt="YUC'ATÅLOVE"><h1>Parrilla de contenido</h1><div class="sub">${titulo}</div>
      <div class="pr-stats"><div class="pr-stat"><b>${delMes.length}</b>publicaciones</div>${Object.entries(porTipo).map(([k, n]) => `<div class="pr-stat"><b>${n}</b>${esc(k)}</div>`).join("")}</div>
      <div class="pr-stats">${Object.entries(porStatus).map(([k, n]) => `<div class="pr-stat"><b>${n}</b>${esc(k)}</div>`).join("")}</div>
      <div class="pr-foot">Generado el ${new Date().toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" })}</div></section>`;
    // Calendario
    const byDay = {}; delMes.forEach(p => (byDay[p.fecha] = byDay[p.fecha] || []).push(p));
    const first = new Date(y, m, 1), start = new Date(y, m, 1 - ((first.getDay() + 6) % 7));
    let cal = DOW.map(d => `<div class="dow">${d}</div>`).join("");
    for (let i = 0; i < 42; i++) {
      const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i), k = iso(d);
      if (i >= 35 && d.getMonth() !== m) break;
      cal += `<div class="${d.getMonth() !== m ? "out" : ""}"><span class="n">${d.getDate()}</span>${(byDay[k] || []).map(p => `<span class="it" style="border-left-color:${colorDe("tipo", p.tipo) || "#C3ACA9"}">${esc([p.tipo, p.copy].filter(Boolean).join(" · ") || "Sin copy")}</span>`).join("")}</div>`;
    }
    h += `<section class="pr-page"><h2 class="pr-h">Calendario <small>${titulo}</small></h2><div class="pr-cal">${cal}</div></section>`;
    // Feed (como se verá en Instagram: lo más reciente arriba)
    const feed = feedOrder(delMes.filter(p => !esInterno(p)));
    h += `<section class="pr-page"><h2 class="pr-h">Vista del feed <small>${feed.length} publicaciones · sin historias</small></h2><div class="pr-feed">${feed.map(p => { const u = full(p); return `<div class="pr-tile">${u ? `<img src="${esc(u)}" alt="">` : `<em>${esc(p.copy || p.tipo || "Sin imagen")}</em>`}<span>${fmtCorto(p.fecha)}</span></div>`; }).join("") || '<p>Sin publicaciones en el feed este mes.</p>'}</div></section>`;
    // Detalle de cada post
    h += `<section class="pr-page"><h2 class="pr-h">Detalle de publicaciones <small>${titulo}</small></h2>${delMes.map(p => { const u = full(p); return `<article class="pr-post"><div class="img">${u ? `<img src="${esc(u)}" alt="">` : ""}</div><div>
      <h3>${esc((p.dia ? p.dia + " " : "") + fmtCorto(p.fecha))}${p.semana ? " · " + esc(p.semana) : ""}</h3>
      <div class="pr-tags">${tagHtml("tipo", p.tipo)}${tagHtml("pilar", p.pilar)}${tagHtml("status", p.status)}${p.cumplio ? tagHtml("cumplio", p.cumplio) : ""}</div>
      ${p.copy ? `<div class="lbl">Copy</div><div class="txt">${esc(p.copy)}</div>` : ""}
      ${p.caption ? `<div class="lbl">Caption</div><div class="txt">${esc(p.caption)}</div>` : ""}
      ${nComent(p.id) ? `<div class="lbl">Comentarios</div><div class="txt">${comentariosDe(p.id).map(c => `<b>${esc(nombreDe(c.autor))}</b> (${esc(new Date(c.created_at).toLocaleDateString("es-MX", { day: "numeric", month: "short" }))}): ${esc(c.texto)}`).join("\n")}</div>` : ""}
      ${p.inspo ? `<div class="lbl">Inspo / Referencia</div><div class="txt">${linkify(p.inspo)}</div>` : ""}
      ${p.publicacion ? `<div class="lbl">Publicación</div><div class="txt">${linkify(p.publicacion)}</div>` : ""}
      ${p.contenido ? `<div class="lbl">Contenido</div><div class="txt">${linkify(p.contenido)}</div>` : ""}
    </div></article>`; }).join("") || "<p>No hay publicaciones con fecha en este mes.</p>"}</section>`;
    const area = $("print-area"); area.innerHTML = h;
    await Promise.all([...area.querySelectorAll("img")].map(img => img.complete ? null : new Promise(r => { img.onload = img.onerror = r; setTimeout(r, 8000); })));
    const prevTitle = document.title; document.title = `Parrilla YUC'ATÅLOVE - ${titulo}`;
    window.print();
    setTimeout(() => { document.title = prevTitle; }, 1000);
  } catch (err) { banner("No se pudo preparar el PDF: " + errMsg(err)); }
  finally { btn.disabled = false; btn.textContent = "⤓ Exportar mes a PDF"; }
}
$("cal-pdf").addEventListener("click", exportarPDF);

/* ---------- Ajustes ---------- */
function renderOpts(){
  const l = $("op-lista").value, items = opciones[l] || [];
  $("opt-list").innerHTML = items.length ? items.map((o, i) => `<li><span class="sw" style="background:${esc(o.color || "#fff")}"></span><span class="grow">${esc(o.valor)}</span>
    <label class="sr" for="oc-${i}">Color de ${esc(o.valor)}</label><select id="oc-${i}" data-color="${esc(o.valor)}">${PALETA.map(([h, n]) => `<option value="${h}"${(o.color || "").toUpperCase() === h ? " selected" : ""}>${n}</option>`).join("")}</select>
    <button class="icon-btn" data-up="${i}" title="Subir" aria-label="Subir">↑</button><button class="icon-btn" data-rm="${esc(o.valor)}" title="Quitar" aria-label="Quitar ${esc(o.valor)}">✕</button></li>`).join("") : '<li class="note">Sin opciones.</li>';
}
$("op-lista").addEventListener("change", renderOpts);
$("opt-list").addEventListener("change", async e => {
  const s = e.target.closest("[data-color]"); if (!s) return;
  const { error } = await sb.from("opciones").update({ color: s.value }).eq("lista", $("op-lista").value).eq("valor", s.dataset.color);
  if (error) banner(errMsg(error)); else loadOpciones();
});
$("opt-list").addEventListener("click", async e => {
  const l = $("op-lista").value, items = opciones[l] || [];
  const rm = e.target.closest("[data-rm]"), up = e.target.closest("[data-up]");
  if (rm) {
    const v = rm.dataset.rm, usados = posts.filter(p => p[l] === v).length;
    const d = $("confirm"); $("cf-text").textContent = `Se quitará “${v}” de la lista.${usados ? ` ${usados} post(s) lo tienen; conservarán el texto.` : ""}`;
    d.onclose = async () => { if (d.returnValue !== "ok") return; const { error } = await sb.from("opciones").delete().eq("lista", l).eq("valor", v); if (error) banner(errMsg(error)); else loadOpciones(); };
    d.returnValue = ""; d.showModal();
  }
  if (up) {
    const i = +up.dataset.up; if (i === 0) return;
    const reordered = items.slice(); reordered.splice(i - 1, 0, reordered.splice(i, 1)[0]);
    for (let k = 0; k < reordered.length; k++) { if (reordered[k].orden !== k + 1) { const { error } = await sb.from("opciones").update({ orden: k + 1 }).eq("lista", l).eq("valor", reordered[k].valor); if (error) { banner(errMsg(error)); return; } } }
    loadOpciones();
  }
});
$("opt-form").addEventListener("submit", async e => {
  e.preventDefault();
  const l = $("op-lista").value, v = $("op-valor").value.trim(); if (!v) return;
  if ((opciones[l] || []).some(o => o.valor.toLowerCase() === v.toLowerCase())) { banner("Esa opción ya existe."); return; }
  const { error } = await sb.from("opciones").insert({ lista: l, valor: v, color: $("op-color").value, orden: (opciones[l] || []).length + 1 });
  if (error) banner(errMsg(error)); else { $("op-valor").value = ""; banner(""); loadOpciones(); }
});
let team = [], esAdmin = false;
async function loadTeam(){ const { data } = await sb.from("miembros").select("*").order("created_at"); team = data || [];
  if (user) { const n = nombreDe(user.email); $("who-email").textContent = n; $("who-email").title = user.email; } const yo = team.find(m => m.email.toLowerCase() === ((user && user.email) || "").toLowerCase()); esAdmin = !!(yo && yo.admin); $("uso-card").classList.toggle("hidden", !esAdmin); if (view === "ajustes") { renderTeam(); if (esAdmin) loadUso(); } }
function renderTeam(){
  const yo = ((user && user.email) || "").toLowerCase(), adm = team.find(m => m.admin);
  $("team-list").innerHTML = team.length ? team.map(m => {
    const mio = m.email.toLowerCase() === yo;
    const accion = mio ? '<span class="note">Tú</span>' : (esAdmin && !m.admin ? `<button class="icon-btn" data-rmt="${esc(m.email)}" title="Quitar" aria-label="Quitar ${esc(m.email)}">✕</button>` : "");
    return `<li><span class="grow">${esc(m.nombre ? m.nombre + " · " : "")}${esc(m.email)}${m.admin ? ' <span class="adm">Administra</span>' : ""}</span>${accion}</li>`;
  }).join("") : '<li class="note">No puedes ver el equipo hasta que tu correo esté en la lista.</li>';
  // Solo quien administra ve el formulario para agregar y los botones para quitar (y la base de datos lo exige igual)
  $("team-form").classList.toggle("hidden", !esAdmin);
  $("team-note").textContent = "Solo los correos de esta lista pueden ver y editar la parrilla. " + (esAdmin
    ? "Solo tú puedes agregar o quitar personas. Después de agregar un correo, esa persona crea su acceso en la pantalla de entrada."
    : `Solo ${adm ? (adm.nombre || adm.email) : "quien administra"} puede agregar o quitar personas.`);
}
$("team-list").addEventListener("click", e => {
  const b = e.target.closest("[data-rmt]"); if (!b || !esAdmin) return;
  const em = b.dataset.rmt, d = $("confirm"); $("cf-text").textContent = `${em} ya no podrá ver ni editar la parrilla.`;
  d.onclose = async () => { if (d.returnValue !== "ok") return; const { data, error } = await sb.from("miembros").delete().eq("email", em).select("email"); if (error) banner(errMsg(error)); else if (Array.isArray(data) && !data.length) banner("No se pudo quitar: solo quien administra puede hacerlo."); else { banner(""); loadTeam(); } };
  d.returnValue = ""; d.showModal();
});
$("team-form").addEventListener("submit", async e => {
  e.preventDefault(); if (!esAdmin) return;
  const email = $("tm-email").value.trim().toLowerCase(), nombre = $("tm-nombre").value.trim() || null; if (!email) return;
  const { error } = await sb.from("miembros").insert({ email, nombre });
  if (error) banner(/duplicate/i.test(error.message) ? "Ese correo ya está en el equipo." : /row-level security/i.test(error.message) ? "Solo quien administra puede agregar personas." : errMsg(error)); else { $("tm-email").value = ""; $("tm-nombre").value = ""; banner(""); loadTeam(); }
});



/* ---------- Espacio usado ---------- */
const LIMITE = 1024 * 1024 * 1024; // 1 GB del plan gratuito
const fmtMB = b => b >= 1024 * 1024 * 1024 ? (b / 1024 / 1024 / 1024).toFixed(2) + " GB" : (b / 1024 / 1024).toFixed(1) + " MB";
async function loadUso(){
  const { data, error } = await sb.rpc("uso_almacenamiento");
  if (error || !data || !data.length) { $("st-text").textContent = "No se pudo calcular el espacio."; return; }
  const { bytes, archivos } = data[0], pct = Math.min(100, bytes / LIMITE * 100);
  const conImg = posts.filter(p => p.imagen_path).length, prom = conImg ? bytes / conImg : 0;
  $("st-bar").style.width = Math.max(pct, bytes ? 1 : 0) + "%";
  $("st-meter").setAttribute("aria-valuenow", pct.toFixed(1)); $("st-meter").classList.toggle("alto", pct >= 80);
  let t = `${fmtMB(bytes)} de 1 GB (${pct < 1 && bytes ? "menos de 1" : Math.round(pct)}%) · ${conImg} post${conImg === 1 ? "" : "s"} con imagen`;
  const porImg = prom || 0.3 * 1024 * 1024; // estimado: ~0.3 MB por post (imagen optimizada + miniatura)
  t += ` · caben unas ${Math.max(0, Math.floor((LIMITE - bytes) / porImg)).toLocaleString("es-MX")} imágenes más`;
  if (pct >= 80) t += ". Ya casi se llena: borra imágenes que no uses o considera el plan Pro.";
  $("st-text").textContent = t;
}

/* ---------- Mi contraseña ---------- */
$("pw-form").addEventListener("submit", async e => {
  e.preventDefault();
  const a = $("pw-new").value, b = $("pw-rep").value, m = $("pw-msg");
  m.classList.add("warn");
  if (a.length < 6) { m.textContent = "Usa al menos 6 caracteres."; return; }
  if (a !== b) { m.textContent = "Las dos contraseñas no coinciden."; return; }
  const { error } = await sb.auth.updateUser({ password: a });
  if (error) { m.textContent = /different from the old/i.test(error.message) ? "La contraseña nueva debe ser distinta a la actual." : errMsg(error); return; }
  m.classList.remove("warn"); m.textContent = "Listo, tu contraseña se cambió."; $("pw-new").value = ""; $("pw-rep").value = "";
});

/* ---------- Inicio ---------- */
sb.auth.getSession().then(({ data }) => { if (!data.session) showAuth(); }).catch(() => showAuth());
})();
