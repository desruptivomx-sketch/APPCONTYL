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
function showAuth(){ hideBoot(); clearTimeout(bootTimer); $("app").classList.add("hidden"); $("recover").classList.add("hidden"); closeEditor(); $("auth").classList.remove("hidden"); }
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
  $("auth").classList.add("hidden"); $("app").classList.remove("hidden");
  $("who-email").textContent = user.email; $("pw-user").value = user.email;
  banner(""); netState();
  setView(location.hash.replace("#","") || "parrilla");
  const { data: yo, error: e1 } = await sb.from("miembros").select("email").limit(1);
  if (e1 || !yo || !yo.length) banner("Tu correo (" + user.email + ") todavía no está en el equipo. Pide a alguien del equipo que lo agregue en Ajustes → Equipo y vuelve a abrir la app.");
  await Promise.all([loadOpciones(), loadPosts(), loadTeam(), loadComentarios()]);
  subscribe();
}
async function loadOpciones(){
  const { data, error } = await sb.from("opciones").select("*").order("orden");
  if (error) return;
  opciones = { tipo:[], pilar:[], status:[], semana:[] };
  (data||[]).forEach(o => { (opciones[o.lista] = opciones[o.lista] || []).push(o); });
  fillSelects(); renderAll();
}
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
      else { const n = payload.new; const i = posts.findIndex(p => p.id === n.id); if (i >= 0) posts[i] = n; else posts.push(n); if (slidesOf(n).length) await signedUrls(allImagePaths([n])); }
      if (current && !editorDirty) { const c = posts.find(p => p.id === current.id); if (c) current = c; }
      renderAll(true);
    })
    .on("postgres_changes", { event: "*", schema: "public", table: "opciones" }, () => loadOpciones())
    .on("postgres_changes", { event: "*", schema: "public", table: "comentarios" }, payload => {
      if (payload.eventType === "DELETE") comentarios = comentarios.filter(c => c.id !== payload.old.id);
      else if (!comentarios.find(c => c.id === payload.new.id)) comentarios.push(payload.new);
      if (current) renderComentarios();
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
}
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
    if (k === "__q") { const q = v.toLowerCase(); if (!["copy","caption","comentarios","inspo","contenido","pilar","tipo"].some(f => String(p[f] || "").toLowerCase().includes(q))) return false; continue; }
    const val = p[k];
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
    if (k === "mes") { x = MESES.indexOf(x); y = MESES.indexOf(y); }
    if (k === "dia") { x = DIAS.indexOf(x); y = DIAS.indexOf(y); }
    if (x === "" || x === -1) return 1; if (y === "" || y === -1) return -1;
    return (x > y ? 1 : x < y ? -1 : 0) * sortDir || String(a.created_at).localeCompare(String(b.created_at));
  });
  return rows;
}
function renderTable(){ if (isMobile()) renderMobileFilters(); else renderHead(); renderBody(); }
function cellHtml(p, c){
  const v = p[c.k];
  if (c.type === "date") return `<input type="date" data-k="fecha" value="${esc(v || "")}" aria-label="Fecha">`;
  if (c.type === "list") {
    const col = colorDe(c.list, v);
    const style = col ? `background:${col};color:${textOn(col)}` : "";
    return `<select data-k="${c.k}" class="${v && col ? "chip-sel" : ""}" style="${style}" aria-label="${esc(c.label)}">${optionsHtml(c.list, v, true)}</select>`;
  }
  if (c.type === "thumb") { const u = thumbUrl(v); return v && u ? `<button class="icon-btn" data-img="${p.id}" title="Ver o cambiar imagen"><img class="thumb" src="${esc(u)}" alt="" loading="lazy" decoding="async"></button>` : `<button class="icon-btn" data-img="${p.id}" title="Subir imagen" aria-label="Subir imagen">＋</button>`; }
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
          <span class="pcopy${p.copy ? "" : " empty"}">${esc(p.copy || "Sin copy")}</span>
          ${(linksDe(p.contenido).length || linksDe(p.inspo).length) ? `<span class="lnks">${chipsLinks(p.contenido)}${chipsLinks(p.inspo)}</span>` : ""}
          <span class="pchips">${chip("tipo", p.tipo)}${chip("pilar", p.pilar)}${chip("status", p.status)}${chip("cumplio", p.cumplio)}${nComent(p.id) ? `<span class="cbadge">💬 ${nComent(p.id)}</span>` : ""}</span>
        </span></div></li>`;
    }).join("") : `<li class="empty-state">${emptyMsg}</li>`;
    return;
  }
  $("tbody").innerHTML = rows.length ? rows.map(p => `<tr data-id="${p.id}">${COLS.map(c => `<td class="c-${c.k}${c.sticky ? " sticky" : ""}">${cellHtml(p, c)}</td>`).join("")}<td class="c-acc"><button class="icon-btn" data-edit="${p.id}" title="Abrir editor y comentarios" aria-label="Abrir editor">✎${nComent(p.id) ? `<span class="cbadge"> 💬${nComent(p.id)}</span>` : ""}</button><button class="icon-btn" data-del="${p.id}" title="Eliminar post" aria-label="Eliminar post">🗑</button></td></tr>`).join("")
    : `<tr><td colspan="${COLS.length + 1}" style="padding:28px;text-align:center;color:var(--chocolate)">${emptyMsg}</td></tr>`;
}
$("cards").addEventListener("keydown", e => { if ((e.key === "Enter" || e.key === " ") && e.target.matches(".pcard")) { e.preventDefault(); e.target.click(); } });
$("cards").addEventListener("click", e => { if (e.target.closest("a")) return; const b = e.target.closest("[data-open]"); if (!b) return; const p = posts.find(x => x.id === b.dataset.open); if (p) openEditor(p); });
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
  const long = e.target.closest("[data-long]"), del = e.target.closest("[data-del]"), img = e.target.closest("[data-img]"), ed = e.target.closest("[data-edit]");
  const tr = e.target.closest("tr"); if (!tr) return;
  const p = posts.find(x => x.id === tr.dataset.id); if (!p) return;
  if (long) editLong(p, long.dataset.long);
  else if (del) confirmDelete(p);
  else if (img || ed) openEditor(p);
});
async function savePatch(id, patch, rerender){
  const p = posts.find(x => x.id === id); if (p) Object.assign(p, patch);
  saved("Guardando…");
  const { error } = await sb.from("posts").update(patch).eq("id", id);
  if (error) saved(errMsg(error), true); else saved("Guardado");
  if (rerender) renderBody();
}
function editLong(p, k){
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
    const imgs = slidesOf(p); if (imgs.length) sb.storage.from(CFG.bucket).remove(imgs.flatMap(x => [x, thumbOf(x)]));
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
// La pauta (tipo o pilar "Pauta") es publicidad: no aparece en el feed orgánico (cuadrícula, historias ni Facebook)
const enFeed = p => !FUERA_DEL_FEED.includes(p.tipo) && !esPauta(p);
const feedOrder = list => list.filter(enFeed).sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0) || String(b.fecha || "").localeCompare(String(a.fecha || "")));
/* ---------- Plataformas del Feed (Instagram, TikTok, Pinterest, Facebook, Pauta, Blog) ---------- */
const PLATS = {
  instagram: { n: "Instagram", bio: "Destination weddings in Yucatán · Together as one", filtro: null },
  tiktok:    { n: "TikTok", bio: "Videos de TikTok del mes", filtro: p => p.tipo === "TikTok", vacio: "No hay TikToks para este filtro. En la Parrilla, ponles tipo “TikTok”." },
  pinterest: { n: "Pinterest", bio: "Pines del mes", filtro: p => p.tipo === "Pin", vacio: "No hay pines para este filtro. En la Parrilla, ponles tipo “Pin”." },
  facebook:  { n: "Facebook", bio: "Así se verán en Facebook los posts del feed de Instagram", filtro: p => !FUERA_DEL_FEED.includes(p.tipo) && !esPauta(p), vacio: "No hay posts del feed para este filtro." },
  pauta:     { n: "Pauta", bio: "Anuncios del mes", filtro: p => esPauta(p), vacio: "No hay pauta para este filtro. En la Parrilla, ponles tipo “Pauta”." },
  blog:      { n: "Blog", bio: "Artículos del blog", filtro: p => p.tipo === "Blog", vacio: "No hay artículos para este filtro. En la Parrilla, ponles tipo “Blog”." },
};
function esPauta(p){ return [p.tipo, p.pilar].some(x => String(x || "").trim().toLowerCase() === "pauta"); }
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
  const av = (cls = "") => `<span class="pf-av ${cls}"><img src="icons/simbolo-arena.png" alt=""></span>`;
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
      <div class="tt-prof">${av("tt-av")}<h3>yucatalove</h3><div class="tt-user">YUC'ATÅLOVE</div>
        <div class="tt-stats"><span><b>—</b> Siguiendo</span><span><b>—</b> Seguidores</span><span><b>—</b> Me gusta</span></div>
        <div class="tt-btns"><span class="tt-follow">Seguir</span><span class="tt-msg">Mensaje</span></div>
        <p class="tt-bio">Destination weddings in Yucatán 🤍 Together as one</p><span class="tt-link">🔗 yucatalove.com</span></div>
      <div class="tt-tabs"><span class="on">${I.grid}</span><span>${I.lock}</span><span>${I.heart}</span></div>
      ${list.length ? `<div class="tt-grid">${list.map(p => `<button type="button" class="tt-tile" data-id="${p.id}">${media(p)}${chipSt(p)}<span class="tt-views">${I.play}${esc(fmtCorto(p.fecha) || "sin fecha")}</span></button>`).join("")}</div>` : vacio}</div>`;

  if (plat === "pinterest") html = `<div class="pn">
      <div class="pn-prof">${av("pn-av")}<h3>YUC'ATÅLOVE</h3>
        <div class="pn-user"><span class="pn-p">P</span> yucatalove · <u>yucatalove.com</u></div>
        <p class="pn-bio">Destination weddings in Yucatán · Together as one</p>
        <div class="pn-stats"><b>—</b> seguidores · <b>—</b> seguidos</div>
        <div class="pn-btns"><span class="pn-share">Compartir</span><span class="pn-follow">Seguir</span></div></div>
      <div class="pn-tabs"><span class="on">Creados</span><span>Guardados</span></div>
      ${list.length ? (() => { const cols = innerWidth >= 1000 ? 5 : innerWidth >= 700 ? 4 : 2, C = Array.from({ length: cols }, () => []);
        list.forEach((p, i) => C[i % cols].push(`<button type="button" class="pn-pin" data-id="${p.id}" title="${esc(titulo(p))}"><div class="pn-img" style="--pn-r:${["2/3","1/1","3/4","9/16","4/5"][(parseInt(String(p.id).replace(/[^0-9a-f]/gi, "").slice(-4), 16) || i) % 5]}">${media(p)}<span class="pn-ov"></span><span class="pn-save">Guardar</span><span class="pn-dom">↗ yucatalove.com</span><span class="pn-ics"><i>${I.share}</i><i>${I.dots}</i></span></div><div class="pn-t">${chipSt(p)}<span>${I.dots}</span></div></button>`));
        return `<div class="pn-grid">${C.map(c => `<div class="pn-col">${c.join("")}</div>`).join("")}</div>`; })() : vacio}</div>`;

  if (plat === "facebook") {
    const portada = list.find(p => p.imagen_path);
    const fotos = (p) => { const s = slidesOf(p); if (s.length < 2) return `<div class="fb-media">${img(p) ? `<img src="${esc(full(p))}" alt="" loading="lazy">` : ph(p)}</div>`;
      const vis = s.slice(0, 4); return `<div class="fb-media fb-m${Math.min(s.length, 4)}">${vis.map((x, i) => `<div><img src="${esc(thumbUrl(x))}" alt="" loading="lazy">${i === 3 && s.length > 4 ? `<span class="fb-more">+${s.length - 4}</span>` : ""}</div>`).join("")}</div>`; };
    html = `<div class="fb">
      <div class="fb-top"><div class="fb-cover">${portada ? `<img src="${esc(full(portada))}" alt="">` : `<div class="fb-cover-ph"><img src="icons/logo-arena-texto.png" alt=""></div>`}</div>
        <div class="fb-id">${av("fb-av")}<div class="fb-name"><h3>YUC'ATÅLOVE</h3><span><b>—</b> Me gusta · <b>—</b> seguidores</span></div>
          <div class="fb-btns"><span class="fb-like">${I.like} Me gusta</span><span class="fb-msg">${I.com} Mensaje</span></div></div>
        <div class="fb-tabs"><span class="on">Publicaciones</span><span>Información</span><span>Menciones</span><span>Opiniones</span><span>Seguidores</span><span>Fotos</span><span>Más ▾</span></div></div>
      <div class="fb-body"><aside class="fb-intro"><h4>Detalles</h4><p>Destination weddings in Yucatán · Together as one</p><ul><li>ℹ️ Página · Organizador de bodas</li><li>📍 Mérida, Yucatán, México</li><li>🔗 yucatalove.com</li></ul></aside>
        <div class="fb-feed">${list.length ? list.map(p => `<button type="button" class="fb-post" data-id="${p.id}">
          <div class="fb-ph">${av("fb-av-s")}<div><b>YUC'ATÅLOVE</b><span>${esc(fmtCorto(p.fecha) || "sin fecha")} · 🌐</span></div>${chipSt(p)}<i>${I.dots}</i></div>
          ${(p.caption || p.copy) ? `<div class="fb-text"><p>${esc(p.caption || p.copy)}</p></div>` : ""}${fotos(p)}
          <div class="fb-reac"><span>👍❤️ —</span><span>— comentarios · — veces compartido</span></div>
          <div class="fb-acts"><span>${I.like} Me gusta</span><span>${I.com} Comentar</span><span>${I.share} Compartir</span></div></button>`).join("") : vacio}</div></div></div>`;
  }

  if (plat === "pauta") html = `<div class="ad-feed">${list.length ? list.map(p => { const n = slidesOf(p).length; return `<button type="button" class="ig-ad" data-id="${p.id}">
      <div class="ig-h">${av("ig-av")}<div><b>yucatalove</b><span>Publicidad</span></div>${chipSt(p)}<i>${I.dots}</i></div>
      <div class="ig-media">${img(p) ? `<img src="${esc(full(p))}" alt="" loading="lazy">` : ph(p)}${n > 1 ? `<span class="tile-n">1/${n}</span>` : ""}</div>
      <div class="ig-cta"><span>Más información</span><span>›</span></div>
      <div class="ig-icons"><span>${I.heart}${I.com}${I.send}</span><span>${I.save}</span></div>
      <p class="ig-cap"><b>yucatalove</b> ${esc(p.caption || p.copy || "")}</p>
      <span class="ig-date">${esc(fmtCorto(p.fecha) || "sin fecha")}</span></button>`; }).join("") : vacio}</div>`;

  if (plat === "blog") {
    const [dest, ...resto] = list;
    const meta = p => `<span class="bl-cat">${esc(p.pilar || "Blog")}</span>`;
    const ext = p => { const c = String(p.caption || ""); return esc(c.slice(0, 170)) + (c.length > 170 ? "…" : ""); };
    html = `<div class="bl">
      <header class="bl-head"><img src="icons/logo-color-texto.png" alt="YUC'ATÅLOVE"><nav><span>Weddings</span><span>Haciendas</span><span>Wedding weekend</span><span class="on">Journal</span><span>Contact</span></nav></header>
      <div class="bl-hero"><span class="label-sm">Journal</span><h2>Stories from Yucatán</h2></div>
      ${dest ? `<button type="button" class="bl-dest" data-id="${dest.id}"><div class="bl-img">${img(dest) ? `<img src="${esc(full(dest))}" alt="">` : ph(dest)}</div><div class="bl-txt">${meta(dest)}<h3>${esc(titulo(dest))}</h3><p>${ext(dest)}</p><span class="bl-more">Leer artículo →</span><span class="bl-date">${esc(fmtCorto(dest.fecha) || "sin fecha")} ${chipSt(dest)}</span></div></button>` : vacio}
      ${resto.length ? `<div class="bl-grid">${resto.map(p => `<button type="button" class="bl-card" data-id="${p.id}"><div class="bl-img">${media(p)}</div>${meta(p)}<h3>${esc(titulo(p))}</h3><p>${ext(p)}</p><span class="bl-date">${esc(fmtCorto(p.fecha) || "sin fecha")} ${chipSt(p)}</span></button>`).join("")}</div>` : ""}</div>`;
  }
  v.innerHTML = html;
}
$("plat-view").addEventListener("click", e => { const t = e.target.closest("[data-id]"); if (!t) return; const p = posts.find(x => x.id === t.dataset.id); if (p) abrirPublicar(p); });

function renderFeed(){
  const P = PLATS[plat], esIG = plat === "instagram";
  $("plat-name").textContent = P.n; $("prof-bio").textContent = P.bio;
  $("ig-view").classList.toggle("hidden", !esIG); $("ig-stats").classList.toggle("hidden", !esIG); $("ig-profile").classList.toggle("hidden", !esIG); $("btn-sort").classList.toggle("hidden", !esIG);
  $("plat-view").classList.toggle("hidden", esIG);
  if (!esIG) { renderPlataforma(); return; }
  const list = feedList();
  const feed = feedOrder(list);
  const st = list.filter(p => p.tipo === "Historia" && !esPauta(p)).sort((a, b) => String(a.fecha || "").localeCompare(String(b.fecha || "")));
  $("st-feed").textContent = feed.length; $("st-img").textContent = feed.filter(p => p.imagen_path).length; $("st-story").textContent = st.length;
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
  s.innerHTML = `<button type="button" class="story story-add" id="story-add"><div class="ring"><span>＋</span></div>Nueva</button>` + st.map(p => { const src = thumbUrl(p.imagen_path); return `<button type="button" class="story" data-id="${p.id}"><div class="ring"><span style="${src ? `background-image:url('${esc(src)}')` : ""}"></span></div>${esc(fmtCorto(p.fecha))}</button>`; }).join("");
}
$("feed-grid").addEventListener("click", e => { const t = e.target.closest(".tile"); if (!t) return; const p = posts.find(x => x.id === t.dataset.id); if (p) abrirPublicar(p); });

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
const E_FIELDS = ["fecha","dia","semana","mes","tipo","pilar","status","cumplio","copy","caption","inspo","comentarios","contenido"];
let editorDirty = false;
function emsg(t, warn){ const m = $("e-msg"); m.textContent = t || ""; m.classList.toggle("warn", !!warn); }
function setPreview(src){ $("e-preview").innerHTML = src ? `<img src="${esc(src)}" alt="Imagen del post">` : "Subir imagen o portada<br><span class='note'>Vertical 4:5 se ve mejor</span>"; }
function openEditor(p){
  current = p; pendingFile = null; editorDirty = false; if (pendingUrl) { URL.revokeObjectURL(pendingUrl); pendingUrl = null; }
  $("e-title").textContent = p.fecha ? `Post del ${fmtCorto(p.fecha)}` : "Post nuevo";
  ["dia","semana","mes","tipo","pilar","status","cumplio"].forEach(k => { $("e-"+k).innerHTML = optionsHtml(k === "dia" ? "dia" : k === "mes" ? "mes" : k, p[k], true); $("e-"+k).value = p[k] || ""; });
  ["fecha","copy","caption","inspo","comentarios","contenido"].forEach(k => { $("e-"+k).value = p[k] || ""; });
  LINK_FIELDS.forEach(k => { $("e-"+k+"-links").innerHTML = chipsLinks(p[k]); });
  pvIdx = 0; renderPreview(); renderSlides(); $("e-rmimg").classList.toggle("hidden", !p.imagen_path); emsg("");
  cargarHistorial(); iaLimpiar();
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
  current = null; editorDirty = false; pendingFile = null;
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
async function uploadImage(file, postId){
  emsg("Optimizando imagen…");
  const big = await compress(file, 1440, 0.86), small = big ? await compress(file, 480, 0.8, big.blob.type) : null;
  const stamp = Date.now();
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
    E_FIELDS.forEach(k => { const v = $("e-"+k).value; patch[k] = (k === "copy" ? v.trim() : v) || null; });
    const old = current.imagen_path;
    if (pendingFile) patch.imagen_path = await uploadImage(pendingFile, current.id);
    emsg("Guardando…");
    const { error } = await sb.from("posts").update(patch).eq("id", current.id);
    if (error) throw error;
    if (patch.imagen_path) { await signedUrls(allImagePaths([{ imagen_path: patch.imagen_path }])); if (old) sb.storage.from(CFG.bucket).remove([old, thumbOf(old)]); }
    Object.assign(current, patch); const i = posts.findIndex(p => p.id === current.id); if (i >= 0) posts[i] = current;
    pendingFile = null; editorDirty = false; emsg("Guardado."); current.updated_by = user.email; current.updated_at = new Date().toISOString(); renderUltimo();
    $("e-title").textContent = current.fecha ? `Post del ${fmtCorto(current.fecha)}` : "Post nuevo";
    pvIdx = 0; renderPreview(); renderSlides(); $("e-rmimg").classList.toggle("hidden", !current.imagen_path);
    renderAll(); cargarHistorial();
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

/* ---------- Asistente de IA (Grok / Claude vía función de Supabase) ---------- */
let iaOpciones = [], iaAccion = "", iaOcupado = false;
const IA_DESTINO = { caption: "caption", pulir_caption: "caption", pulir_idea: "copy", hooks: "caption" };
function iaLimpiar(){ iaOpciones = []; $("ia-out").innerHTML = ""; $("ia-extra").value = ""; }
async function iaPedir(accion){
  if (!current || iaOcupado) return;
  const post = { tipo: $("e-tipo").value, pilar: $("e-pilar").value, fecha: $("e-fecha").value, copy: $("e-copy").value, caption: $("e-caption").value, inspo: $("e-inspo").value, comentarios: $("e-comentarios").value };
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
const H_LABEL = { fecha:"Fecha", dia:"Día", semana:"Semana", mes:"Mes", tipo:"Tipo", pilar:"Pilar", status:"Status", cumplio:"¿Cumplió?", copy:"Copy", caption:"Caption", inspo:"Inspo", comentarios:"Comentarios", contenido:"Contenido" };
const H_LARGOS = ["copy","caption","inspo","comentarios","contenido"];
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


/* ---------- Comentarios ---------- */
async function loadComentarios(){
  const { data, error } = await sb.from("comentarios").select("*").order("created_at");
  if (!error) { comentarios = data || []; renderAll(); }
}
const nComent = id => comentarios.reduce((n, c) => n + (c.post_id === id ? 1 : 0), 0);
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
function renderUltimo(){
  const p = current; if (!p) return;
  $("e-last").textContent = p.updated_by ? `Último cambio: ${nombreDe(p.updated_by)} · ${cuando(p.updated_at)}` : "";
}
function renderComentarios(){
  if (!current) return;
  const list = comentarios.filter(c => c.post_id === current.id).sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
  const yo = ((user && user.email) || "").toLowerCase();
  $("c-list").innerHTML = list.length ? list.map(c => `<li class="c-item${c.autor.toLowerCase() === yo ? " mio" : ""}"><div class="c-meta"><span><b>${esc(nombreDe(c.autor))}</b> · ${esc(cuando(c.created_at))}</span>${c.autor.toLowerCase() === yo ? `<button type="button" class="c-del" data-cdel="${c.id}">Borrar</button>` : ""}</div><div class="c-txt">${esc(c.texto)}</div></li>`).join("")
    : '<li class="c-empty">Todavía no hay mensajes sobre este post.</li>';
}
$("c-form").addEventListener("submit", async e => {
  e.preventDefault();
  const t = $("c-text").value.trim(); if (!t || !current) return;
  $("c-send").disabled = true;
  const { data, error } = await sb.from("comentarios").insert({ post_id: current.id, texto: t, autor: user.email }).select().single();
  $("c-send").disabled = false;
  if (error) { emsg(errMsg(error), true); return; }
  if (!comentarios.find(c => c.id === data.id)) comentarios.push(data);
  $("c-text").value = ""; renderComentarios(); renderAll();
  const l = $("c-list"); l.lastElementChild && l.lastElementChild.scrollIntoView({ block: "nearest" });
});
$("c-text").addEventListener("keydown", e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); $("c-form").requestSubmit(); } });
$("c-list").addEventListener("click", async e => {
  const b = e.target.closest("[data-cdel]"); if (!b) return;
  const { error } = await sb.from("comentarios").delete().eq("id", b.dataset.cdel);
  if (error) { emsg(errMsg(error), true); return; }
  comentarios = comentarios.filter(c => c.id !== b.dataset.cdel); renderComentarios(); renderAll();
});

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
  return `<button type="button" class="cal-post${p.status === "Publicado" ? " pub" : ""}" data-open="${p.id}" style="border-left-color:${c}" title="${esc(label + (p.status ? " — " + p.status : ""))}">${u ? `<img src="${esc(u)}" alt="" loading="lazy">` : ""}<span class="t">${esc(label)}</span></button>`;
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
    let h = `<section class="pr-page pr-cover"><img src="icons/logo-color.png" alt="YUC'ATÅLOVE"><h1>Parrilla de contenido</h1><div class="sub">${titulo}</div>
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
      ${p.comentarios ? `<div class="lbl">Comentarios</div><div class="txt">${esc(p.comentarios)}</div>` : ""}
      ${p.inspo ? `<div class="lbl">Inspo / Referencia</div><div class="txt">${linkify(p.inspo)}</div>` : ""}
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
async function loadTeam(){ const { data } = await sb.from("miembros").select("*").order("created_at"); team = data || []; const yo = team.find(m => m.email.toLowerCase() === ((user && user.email) || "").toLowerCase()); esAdmin = !!(yo && yo.admin); $("uso-card").classList.toggle("hidden", !esAdmin); if (view === "ajustes") { renderTeam(); if (esAdmin) loadUso(); } }
function renderTeam(){
  $("team-list").innerHTML = team.length ? team.map(m => `<li><span class="grow">${esc(m.nombre ? m.nombre + " · " : "")}${esc(m.email)}</span>${m.email.toLowerCase() === ((user && user.email) || "").toLowerCase() ? '<span class="note">Tú</span>' : `<button class="icon-btn" data-rmt="${esc(m.email)}" title="Quitar" aria-label="Quitar ${esc(m.email)}">✕</button>`}</li>`).join("") : '<li class="note">No puedes ver el equipo hasta que tu correo esté en la lista.</li>';
}
$("team-list").addEventListener("click", e => {
  const b = e.target.closest("[data-rmt]"); if (!b) return;
  const em = b.dataset.rmt, d = $("confirm"); $("cf-text").textContent = `${em} ya no podrá ver ni editar la parrilla.`;
  d.onclose = async () => { if (d.returnValue !== "ok") return; const { error } = await sb.from("miembros").delete().eq("email", em); if (error) banner(errMsg(error)); else loadTeam(); };
  d.returnValue = ""; d.showModal();
});
$("team-form").addEventListener("submit", async e => {
  e.preventDefault();
  const email = $("tm-email").value.trim().toLowerCase(), nombre = $("tm-nombre").value.trim() || null; if (!email) return;
  const { error } = await sb.from("miembros").insert({ email, nombre });
  if (error) banner(/duplicate/i.test(error.message) ? "Ese correo ya está en el equipo." : errMsg(error)); else { $("tm-email").value = ""; $("tm-nombre").value = ""; banner(""); loadTeam(); }
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
