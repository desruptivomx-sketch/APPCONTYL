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
if ("serviceWorker" in navigator) window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
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
const allImagePaths = list => list.flatMap(p => p.imagen_path ? [p.imagen_path, thumbOf(p.imagen_path)] : []);

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
      else { const n = payload.new; const i = posts.findIndex(p => p.id === n.id); if (i >= 0) posts[i] = n; else posts.push(n); if (n.imagen_path) await signedUrls(allImagePaths([n])); }
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
document.querySelectorAll(".tabs button").forEach(b => b.addEventListener("click", () => setView(b.dataset.view)));
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
    if (p.imagen_path) sb.storage.from(CFG.bucket).remove([p.imagen_path, thumbOf(p.imagen_path)]);
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
function feedList(){
  const m = $("ff-mes").value, s = $("ff-status").value;
  return posts.filter(p => (!m || p.mes === m || (!p.mes && mesDe(p.fecha) === m)) && (!s || p.status === s));
}
// Solo lo que aparece en la cuadrícula de Instagram: historias y otras plataformas quedan fuera
const FUERA_DEL_FEED = ["Historia", "Pin", "TikTok", "Video YT", "Blog"];
const enFeed = p => !FUERA_DEL_FEED.includes(p.tipo);
const feedOrder = list => list.filter(enFeed).sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0) || String(b.fecha || "").localeCompare(String(a.fecha || "")));
function renderFeed(){
  const list = feedList();
  const feed = feedOrder(list);
  const st = list.filter(p => p.tipo === "Historia").sort((a, b) => String(a.fecha || "").localeCompare(String(b.fecha || "")));
  $("st-feed").textContent = feed.length; $("st-img").textContent = feed.filter(p => p.imagen_path).length; $("st-story").textContent = st.length;
  const otras = list.filter(p => FUERA_DEL_FEED.includes(p.tipo) && p.tipo !== "Historia").length;
  $("st-otras").textContent = otras ? `${otras} de otras plataformas (Pin, TikTok, YouTube, Blog) no se muestran en la cuadrícula; están en la Parrilla y el Calendario.` : "";
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
    b.innerHTML = (src ? `<img src="${esc(src)}" alt="" loading="lazy" decoding="async">` : `<div class="ph"><div class="label-sm">${esc(p.pilar || "")}</div><div class="t">${esc(p.copy || p.tipo || "Post")}</div><div class="u">Subir imagen</div></div>`)
      + (ICON[p.tipo] ? ICON[p.tipo](src ? "#fff" : "#674E4A") : "")
      + `<div class="meta"><span class="chip date">${fmtCorto(p.fecha)}</span>${st ? `<span class="chip" style="background:${sc};color:${textOn(sc)}">${esc(st)}</span>` : ""}</div>`;
    frag.appendChild(b);
  });
  g.appendChild(frag);
  const s = $("stories");
  s.innerHTML = `<button type="button" class="story story-add" id="story-add"><div class="ring"><span>＋</span></div>Nueva</button>` + st.map(p => { const src = thumbUrl(p.imagen_path); return `<button type="button" class="story" data-id="${p.id}"><div class="ring"><span style="${src ? `background-image:url('${esc(src)}')` : ""}"></span></div>${esc(fmtCorto(p.fecha))}</button>`; }).join("");
}
$("feed-grid").addEventListener("click", e => { const t = e.target.closest(".tile"); if (!t) return; const p = posts.find(x => x.id === t.dataset.id); if (p) openEditor(p); });
$("stories").addEventListener("click", async e => {
  if (e.target.closest("#story-add")) { await nuevoDesdeFeed("Historia"); return; }
  const t = e.target.closest(".story"); if (!t) return; const p = posts.find(x => x.id === t.dataset.id); if (p) openEditor(p); });
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
$("feed-add").addEventListener("click", () => nuevoDesdeFeed("Post estático"));

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
  setPreview(urlOf(p.imagen_path) || thumbUrl(p.imagen_path)); $("e-rmimg").classList.toggle("hidden", !p.imagen_path); emsg("");
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
$("editor").addEventListener("input", e => { if (!e.target.closest(".coments")) editorDirty = true; if (e.target.id === "e-inspo" || e.target.id === "e-contenido") $(e.target.id + "-links").innerHTML = chipsLinks(e.target.value); });
$("editor").addEventListener("change", e => { if (e.target.closest(".coments")) return; editorDirty = true; if (e.target.id === "e-fecha" && e.target.value) { if (!$("e-dia").value) $("e-dia").value = diaDe(e.target.value); if (!$("e-mes").value) $("e-mes").value = mesDe(e.target.value); } });
$("e-prev").addEventListener("click", () => moveBy(-1));
$("e-next").addEventListener("click", () => moveBy(1));
$("e-preview").addEventListener("click", () => $("e-file").click());
$("e-file").addEventListener("change", e => {
  const f = e.target.files[0]; e.target.value = ""; if (!f) return;
  if (!f.type.startsWith("image/") && !/\.(heic|heif)$/i.test(f.name)) { emsg("Ese archivo no es una imagen.", true); return; }
  if (f.size > 40 * 1024 * 1024) { emsg("La imagen pesa más de 40 MB. Usa una más ligera.", true); return; }
  pendingFile = f; editorDirty = true; if (pendingUrl) URL.revokeObjectURL(pendingUrl); pendingUrl = URL.createObjectURL(f); setPreview(pendingUrl); emsg("Imagen lista. Toca Guardar.");
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
    setPreview(urlOf(current.imagen_path) || thumbUrl(current.imagen_path)); $("e-rmimg").classList.toggle("hidden", !current.imagen_path);
    renderAll();
  } catch (err) { emsg(errMsg(err), true); }
  finally { btn.disabled = false; }
});
$("e-rmimg").addEventListener("click", async () => {
  if (!current || !current.imagen_path) return;
  const old = current.imagen_path;
  const { error } = await sb.from("posts").update({ imagen_path: null }).eq("id", current.id);
  if (error) { emsg(errMsg(error), true); return; }
  sb.storage.from(CFG.bucket).remove([old, thumbOf(old)]); current.imagen_path = null; setPreview(""); $("e-rmimg").classList.add("hidden"); emsg("Imagen quitada."); renderAll();
});
$("e-del").addEventListener("click", () => { if (current) { editorDirty = false; confirmDelete(current); } });


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
    const feed = feedOrder(delMes);
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
