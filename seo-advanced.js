/* SEO avanzado del constructor de blogs: un motor editorial independiente y su panel dentro del cuadro de SEO.
   No usa código ni servicios privados de Yoast. Sus números son guías editoriales (heurísticas), no las puntuaciones de Yoast
   ni posiciones en Google.
   · El motor (analyze, occurrences, articleSchema, metricDelta) no toca la página y se prueba con Node: node --test tests/
   · En el navegador, app.js es privado: este archivo recibe del editor solo lo que necesita mediante window.APPCONTYL_SEO
     (ver «SEO avanzado» en app.js) y se registra ahí. Si este archivo no carga, el editor funciona igual.
   · Lo que depende del servidor (asistente, auditoría del sitio, Search Console, envío de metadatos) viene apagado y se
     enciende en config.js cuando su función ya esté desplegada y probada. */
(function(){
"use strict";

/* ===================== Motor (sin DOM) ===================== */
const norm=s=>String(s||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
const tokens=s=>norm(s).match(/[\p{L}\p{N}]+/gu)||[];
const stem=(w,lang)=>lang==="en"?w.replace(/ies$/,"y").replace(/(?:ches|shes|xes|zes|sses)$/,(m)=>m.slice(0,-2)).replace(/(?<!s)s$/,""):w.replace(/(?:es|s)$/,"");
const words=(s,lang)=>tokens(s).map(w=>stem(w,lang));
function occurrences(text,phrase,lang){
 const a=words(text,lang),b=words(phrase,lang); if(!b.length)return 0;
 let n=0; for(let i=0;i<=a.length-b.length;i++)if(b.every((w,j)=>w===a[i+j])){n++;i+=b.length-1;}return n;
}
function analyze(input){
 const {body="",title="",description="",slug="",headings=[],paragraphs=[],images=[],phrases=[],lang="en",cornerstone=false}=input;
 const w=tokens(body), sentences=body.match(/[^.!?]+(?:[.!?]+|$)/g)||[];
 const sentenceWords=sentences.map(tokens).map(x=>x.length).filter(Boolean);
 const long=sentenceWords.filter(n=>n> (lang==="en"?20:25)).length;
 const syllables=w.reduce((sum,x)=>sum+Math.max(1,(x.match(/[aeiouy]+/g)||[]).length-(lang==="en"&&/[^l]e$/.test(x)?1:0)),0);
 const avg=w.length/Math.max(1,sentenceWords.length), syl=syllables/Math.max(1,w.length);
 const flesch=w.length?Math.round(lang==="es"?206.84-60*syl-1.02*avg:206.835-1.015*avg-84.6*syl):null;
 const transition=lang==="en"?/\b(however|therefore|also|because|for example|in addition|finally|although|instead|meanwhile|moreover|first|then|so)\b/i:/\b(sin embargo|adem[aá]s|por ejemplo|porque|por tanto|finalmente|aunque|primero|despu[eé]s|as[ií]|por eso)\b/i;
 const stop=new Set((lang==="en"?"the a an and or to of in on for is are was were with as by from at that this it you your be can will have has we our they their not but":"el la los las un una y o de del en con por para es son se que su sus al como a no una unos unas esta este entre").split(" "));
 const freq=Object.create(null);w.filter(x=>x.length>3&&!stop.has(x)).forEach(x=>freq[x]=(freq[x]||0)+1);
 const prominent=Object.entries(freq).sort((a,b)=>b[1]-a[1]).slice(0,8);
 const p=phrases.filter(x=>x.term).slice(0,5).map(x=>{
 const variants=[x.term,...(x.synonyms||[])].filter(Boolean);
 const match=t=>variants.some(v=>occurrences(t,v,lang)>0);
 const count=Math.max(...variants.map(v=>occurrences(body,v,lang)));
 const checks=[["Título",match(title)],["Descripción",match(description)],["URL",match(slug.replace(/-/g," "))],["Introducción",match(paragraphs[0]||body.slice(0,350))],["Subtítulos",headings.some(h=>match(h))],["Texto",count>0],["Texto alternativo",images.some(match)]];
 return {term:x.term,count,density:w.length?100*count*tokens(x.term).length/w.length:0,checks};
 });
 return {words:w.length,reading:Math.ceil(w.length/220),flesch,long,avg,transition:sentenceWords.length?Math.round(100*sentences.filter(s=>transition.test(s)).length/sentenceWords.length):0,longParagraphs:paragraphs.filter(x=>tokens(x).length>150).length,passive:sentences.filter(s=>lang==="en"?/\b(?:is|are|was|were|been|being)\s+(?:\w+\s+)?\w+(?:ed|en)\b/i.test(s):/\b(?:es|son|fue|fueron|sido|ser[aá])\s+\w+(?:ado|ido|ada|ida|ados|idos|adas|idas)\b/i.test(s)).length,prominent,phrases:p,cornerstone, sentences:sentenceWords.length};
}
function articleSchema(d){
 const kind=["Article","BlogPosting","NewsArticle"].includes(d.type)?d.type:"BlogPosting";
 const text=v=>String(v||"").trim();
 const obj={"@context":"https://schema.org","@type":kind,headline:text(d.headline),inLanguage:d.lang==="es"?"es":"en"};
 if(text(d.description))obj.description=text(d.description);
 if(d.url)obj.mainEntityOfPage={"@type":"WebPage","@id":d.url};
 if(d.image)obj.image=[d.image];
 if(text(d.author))obj.author={"@type":"Person",name:text(d.author)};
 if(d.datePublished)obj.datePublished=d.datePublished;
 if(d.dateModified)obj.dateModified=d.dateModified;
 return obj;
}
function metricDelta(a,b){return typeof a==="number"&&typeof b==="number"&&b!==0?100*(a-b)/b:null;}
if(typeof module!=="undefined"&&module.exports){module.exports={analyze,occurrences,articleSchema,metricDelta};return;}

/* ===================== Panel dentro del editor ===================== */
const app = window.APPCONTYL_SEO, root = document.getElementById("seo-box");
if (!app || !root) return;
const ACTIVO = Object.assign({ ia: false, auditoria: false, gsc: false, meta: false }, window.APPCONTYL_SEO_ACTIVO || {});
const SITIO = "https://www.yucatanlove.com/";
const el = (tag, txt, cls) => { const n = document.createElement(tag); if (txt != null) n.textContent = txt; if (cls) n.className = cls; return n; };
const boton = txt => { const b = el("button", txt, "btn ghost small"); b.type = "button"; return b; };
const safeUrl = s => { try { const u = new URL(String(s || "").trim()); return /^https?:$/.test(u.protocol) && !u.username && !u.password ? u.href : null; } catch (_) { return null; } };
// items: texto, o [cumple, texto] para una línea con ✓ / ○ (mismo aspecto que la lista de revisión de arriba)
const lista = (parent, items, cls) => { const ul = el("ul", null, cls || "avz-l"); items.forEach(x => ul.append(Array.isArray(x) ? el("li", (x[0] ? "✓ " : "○ ") + x[1], x[0] ? "ok" : "") : el("li", x))); parent.append(ul); return ul; };
const recuerda = (k, v) => { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (_) {} return null; };
const split = s => String(s || "").split(",").map(x => x.trim()).filter(Boolean).slice(0, 12);
const copiaEn = (b, txt, normal) => async () => { b.textContent = await app.copiar(txt()) ? "Copiado" : "No se pudo copiar"; setTimeout(() => { b.textContent = normal; }, 1800); };
// Respuesta de una función del servidor: lo que devolvió, o su mensaje de error
async function servidor(fn, body){
  const { data, error } = await app.invocar(fn, body); let r = data;
  if (error) { r = null; try { r = await error.context.json(); } catch (_) {} if (!r || typeof r !== "object") r = {}; if (!r.error) r.error = "No se pudo conectar con el servidor. Inténtalo de nuevo."; }
  return r && typeof r === "object" ? r : { error: "Respuesta inválida." };
}

const panel = el("details", null, "seo-avz"); panel.id = "seo-avz"; panel.open = recuerda("seoAvzAbierto") === "1";
const cab = el("summary"); cab.append(el("span", "🧭 SEO avanzado", "ia-t"), el("span", "frases relacionadas, legibilidad, enlaces internos, redes y Schema", "note")); panel.append(cab);
root.insertBefore(panel, document.getElementById("wp-box"));   // queda después de la lista de revisión y antes de «Pasarlo a WordPress»

const fields = {}, grupos = {};   // fields: lo que se guarda en seo.advanced
function grupo(id, titulo, abierto){
  const d = el("details", null, "avz-g"), c = el("div", null, "avz-c"); d.open = !!abierto; d.append(el("summary", titulo), c); panel.append(d); grupos[id] = d;
  d.addEventListener("toggle", () => { if (d.open) render(); }); return c;
}
function campo(g, k, rotulo, tipo, opciones){
  const l = el("label", rotulo), n = el(tipo === "textarea" ? "textarea" : tipo === "select" ? "select" : "input");
  if (tipo === "select") for (const [v, t] of opciones) { const o = el("option", t); o.value = v; n.append(o); }
  else if (tipo !== "textarea") n.type = tipo || "text";
  if (tipo === "checkbox") { l.className = "avz-op"; l.prepend(n); }
  else { if (tipo === "textarea") n.rows = 2; if (!tipo || tipo === "textarea" || tipo === "url") n.maxLength = 500; l.append(n); }
  n.dataset.avz = k; g.append(l); fields[k] = n; return n;
}
const valor = k => fields[k].type === "checkbox" ? fields[k].checked : fields[k].value.trim();

/* --- Frases clave --- */
const gFrases = grupo("frases", "Frases clave y variantes", true);
gFrases.append(el("p", "La frase principal es la «Palabra clave principal» de arriba. Aquí cuentan también sus plurales y los sinónimos que escribas.", "note"));
campo(gFrases, "lang", "Idioma del artículo", "select", [["en", "English"], ["es", "Español"]]);
campo(gFrases, "syn0", "Sinónimos de la frase principal (separados por coma)");
const relacionadas = el("details", null, "avz-sub"); relacionadas.append(el("summary", "Frases relacionadas (opcional, hasta 4)")); gFrases.append(relacionadas);   // plegadas mientras no se usen
for (let i = 1; i <= 4; i++) { const f = el("div", null, "avz-fila"); relacionadas.append(f); campo(f, "kw" + i, "Frase relacionada " + i); campo(f, "syn" + i, "Sus sinónimos"); }
campo(gFrases, "cornerstone", "Es contenido pilar (uno de los artículos más importantes del sitio)", "checkbox");
const result = el("div", null, "avz-res"); gFrases.append(result);

/* --- Legibilidad --- */
const readout = grupo("lectura", "Legibilidad", true);

/* --- Enlaces internos (con los artículos que hay en la parrilla) --- */
const links = grupo("enlaces", "Enlaces internos", false);
let memo = { k: "", t: 0, n: 0 };   // cuántos artículos de la parrilla enlazan a este: se recalcula como mucho cada 5 s
const entrantes = (slug, otros) => { const k = slug + "|" + otros.length, ahora = Date.now(); if (memo.k !== k || ahora - memo.t > 5000) memo = { k, t: ahora, n: otros.filter(p => JSON.stringify(p.cuerpo || []).includes("/" + slug + "/")).length }; return memo.n; };

/* --- Vista previa en redes --- */
const gSocial = grupo("redes", "Vista previa en redes (Facebook / X)", false);
campo(gSocial, "socialTitle", "Título para redes"); campo(gSocial, "socialDescription", "Descripción para redes", "textarea"); campo(gSocial, "socialImage", "Dirección (URL) de la imagen para redes", "url");
const preview = el("div", null, "avz-social"); gSocial.append(preview, el("p", "Vista aproximada. Se guardan aquí como guía: en WordPress se copian en la pestaña «Social» de Yoast.", "note"));

/* --- Schema (JSON-LD): solo vista y exportación; no se inserta nada en WordPress --- */
const gSchema = grupo("schema", "Schema (JSON-LD)", false);
campo(gSchema, "schema", "Tipo", "select", [["BlogPosting", "BlogPosting (artículo de blog)"], ["Article", "Article"], ["NewsArticle", "NewsArticle (noticia)"]]);
campo(gSchema, "schemaImage", "Dirección pública de la imagen representativa (opcional)", "url");
{ const f = el("div", null, "avz-fila"); gSchema.append(f); campo(f, "publishedDate", "Fecha real de publicación (opcional)", "date"); campo(f, "modifiedDate", "Fecha real de modificación (opcional)", "date"); }
const schemaNote = el("p", null, "note"), schemaOut = el("pre", null, "avz-pre"), schemaCopy = boton("Copiar JSON-LD"), schemaDownload = boton("Descargar .json");
{ const a = el("div", null, "actions"); a.append(schemaCopy, schemaDownload); gSchema.append(schemaNote, schemaOut, a); }
function makeSchema(){
  const s = app.base(), slug = s.slug || "", u = safeUrl(fields.canonical ? valor("canonical") : guardado.canonical) || safeUrl(app.urlPublicada()) || (slug ? SITIO + encodeURIComponent(slug) + "/" : null);
  const fecha = v => /^\d{4}-\d{2}-\d{2}$/.test(v || "") ? v : null;
  return articleSchema({ type: valor("schema"), headline: app.h1(), description: s.desc, author: s.autor, lang: valor("lang"), url: u, image: safeUrl(valor("schemaImage")) || safeUrl(valor("socialImage")), datePublished: fecha(valor("publishedDate")), dateModified: fecha(valor("modifiedDate")) });
}
function renderSchema(){
  const obj = makeSchema(); schemaOut.textContent = JSON.stringify(obj, null, 2);
  const faltan = [!obj.headline && "título", !obj.author && "autor", !obj.image && "imagen pública", !obj.datePublished && "fecha real de publicación", !obj.mainEntityOfPage && "URL"].filter(Boolean);
  schemaNote.textContent = (faltan.length ? "Falta: " + faltan.join(", ") + ". " : "Tiene los campos recomendados. ") + "Es solo para revisar o exportar: en el sitio el Schema lo genera Yoast, y aquí no se inserta otro ni se garantiza un resultado enriquecido. La URL sale del slug y es provisional hasta que el artículo esté publicado.";
  schemaCopy.disabled = schemaDownload.disabled = !obj.headline;
}
schemaCopy.onclick = copiaEn(schemaCopy, () => JSON.stringify(makeSchema(), null, 2), "Copiar JSON-LD");
schemaDownload.onclick = () => { const u = URL.createObjectURL(new Blob([JSON.stringify(makeSchema(), null, 2)], { type: "application/ld+json" })), a = el("a"); a.href = u; a.download = "article-schema.json"; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 1000); };

/* --- Historial de versiones del análisis (se guarda con el artículo) --- */
const gHist = grupo("historial", "Historial de versiones del análisis", false);
const histNote = el("input"); histNote.placeholder = "Qué cambiaste o qué quieres comprobar (opcional)"; histNote.maxLength = 240;
const histBtn = boton("Registrar esta versión"), histOut = el("div", null, "avz-res");
gHist.append(el("p", "Registra una versión antes y otra después de un cambio, y guarda el artículo para conservarlas. Son indicadores editoriales del texto: no miden posiciones en Google ni conversiones.", "note"), histNote, histBtn, histOut);
let guardado = {}, experiments = [];
function renderHistory(msg){
  histOut.replaceChildren(); if (msg) histOut.append(el("p", msg, "note"));
  for (const x of experiments.slice().reverse()) {
    const fila = el("div", null, "avz-exp"), f = new Date(x.at);
    fila.append(el("strong", isNaN(f) ? String(x.at) : f.toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" })), el("p", x.note || "Sin nota"), el("p", (x.words | 0) + " palabras · Flesch " + (x.flesch ?? "—") + " · " + (x.matched | 0) + " de " + (x.checks | 0) + " comprobaciones de frases", "note"));
    histOut.append(fila);
  }
}
histBtn.onclick = () => {
  const a = analyze(entrada()); if (!a.words) { renderHistory("Escribe el artículo antes de registrar una versión."); return; }
  experiments = [...experiments, { at: new Date().toISOString(), note: histNote.value.trim(), words: a.words, flesch: a.flesch, matched: a.phrases.reduce((n, p) => n + p.checks.filter(c => c[1]).length, 0), checks: a.phrases.reduce((n, p) => n + p.checks.length, 0) }].slice(-20);
  histNote.value = ""; app.cambio(); renderHistory("Registrada. Guarda el artículo para conservarla.");
};

/* --- Ajustes técnicos que viajan a WordPress (apagado: el sitio aún no deja escribir esos campos de Yoast desde fuera) --- */
let technical = null;
if (ACTIVO.meta) {
  const g = grupo("tecnico", "Ajustes técnicos para WordPress", false);
  campo(g, "canonical", "URL canónica", "url"); campo(g, "oldSlug", "Slug anterior (propuesta de redirección; no se crea sola)");
  campo(g, "applyMeta", "Enviar estos ajustes y los de redes a WordPress (solo mientras sea borrador)", "checkbox");
  campo(g, "noindex", "Pedir noindex (desmarcarlo después no quita una orden anterior)", "checkbox");
  technical = el("p", null, "note"); g.append(technical);
}

/* --- Auditoría de enlaces del sitio publicado (apagado hasta desplegar esa parte de la función wp; solo quien administra) --- */
let auditData = null, renderAudit = () => {};
if (ACTIVO.auditoria) {
  const g = grupo("auditoria", "Auditoría de enlaces del sitio publicado", false), auditButton = boton("Consultar el sitio"), auditOut = el("div", null, "avz-res"); g.append(auditButton, auditOut);
  let ocupado = false;
  renderAudit = () => {
    auditOut.replaceChildren(); if (!auditData) return;
    const d = entrada(), r = auditData, items = r.articulos || [], f = new Date(r.fecha);
    auditOut.append(el("p", "Se leyeron " + items.length + " entradas y páginas publicadas" + (isNaN(f) ? "" : " · " + f.toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" })), "note"));
    for (const [k, v] of Object.entries(r.cobertura || {})) auditOut.append(el("p", (k === "posts" ? "Entradas" : k === "pages" ? "Páginas" : k) + ": " + (v.leidos | 0) + " de " + (v.total ?? "?") + (v.completa ? " (todas)" : " (lectura parcial)"), "note"));
    auditOut.append(el("p", "Cuenta los enlaces que hay dentro del texto de esas entradas y páginas; no ve menús, pies de página ni otros tipos de contenido. No es un rastreo completo del sitio.", "note"));
    const termSet = new Set(tokens(d.title + " " + d.phrases.map(p => p.term).join(" ")).filter(x => x.length > 3));
    const relevant = items.filter(p => safeUrl(p.url) && p.slug !== d.slug).map(p => ({ ...p, score: [...new Set(tokens(p.titulo + " " + p.slug))].filter(t => termSet.has(t)).length })).filter(p => p.score > 0).sort((a, b) => b.score - a.score).slice(0, 8);
    auditOut.append(el("strong", "Artículos publicados que conviene enlazar"));
    for (const p of relevant) { const u = safeUrl(p.url), fila = el("div", null, "avz-enl"), a = el("a", p.titulo || p.slug), c = boton("Copiar enlace"); a.href = u; a.target = "_blank"; a.rel = "noopener noreferrer"; c.onclick = copiaEn(c, () => u, "Copiar enlace"); fila.append(a, c); auditOut.append(fila); }
    if (!relevant.length) auditOut.append(el("p", "No hay coincidencias suficientes con el título y las frases de este artículo."));
    const sueltos = items.filter(p => p.entrantes === 0); auditOut.append(el("strong", "Sin enlaces entrantes en la muestra: " + sueltos.length));
    if (sueltos.length) lista(auditOut, sueltos.slice(0, 15).map(p => p.titulo || p.slug));
    const este = items.find(p => p.slug === d.slug); if (este) auditOut.append(el("p", "Este artículo: " + este.entrantes + " páginas lo enlazan y él enlaza a " + este.salientes + "."));
  };
  auditButton.onclick = async () => {
    if (ocupado) return; ocupado = true; auditButton.disabled = true; auditOut.replaceChildren(el("p", "Leyendo el contenido publicado…", "note"));
    try { const r = await servidor("wp", { accion: "auditoria_seo" }); if (!r.ok || !Array.isArray(r.articulos)) throw Error(r.error || "La auditoría no está disponible."); auditData = r; renderAudit(); }
    catch (e) { auditData = null; auditOut.replaceChildren(el("p", e.message || "No disponible", "note")); }
    finally { ocupado = false; auditButton.disabled = false; }
  };
}

/* --- Google Search Console (apagado hasta desplegar la función gsc y darle acceso; solo quien administra) --- */
let resetPerf = () => {};
if (ACTIVO.gsc) {
  const g = grupo("gsc", "Google Search Console · rendimiento", false);
  const perfUrl = el("input"); perfUrl.type = "url"; perfUrl.placeholder = "Dirección publicada exacta del artículo";
  const perfPeriod = el("select"); for (const n of [7, 28, 90]) { const o = el("option", "Últimos " + n + " días"); o.value = String(n); perfPeriod.append(o); } perfPeriod.value = "28";
  const perfBtn = boton("Consultar"), perfOut = el("div", null, "avz-res"); g.append(perfUrl, perfPeriod, perfBtn, perfOut);
  let turno = 0;
  resetPerf = () => { turno++; perfBtn.disabled = false; perfOut.replaceChildren(); perfUrl.value = app.urlPublicada() || ""; };
  perfBtn.onclick = async () => {
    const page = safeUrl(perfUrl.value); if (!page) { perfOut.replaceChildren(el("p", "Escribe la dirección publicada exacta del artículo.", "note")); return; }
    const yo = ++turno, id = (app.post() || {}).id; perfBtn.disabled = true; perfOut.replaceChildren(el("p", "Consultando a Google…", "note"));
    const vigente = () => yo === turno && (app.post() || {}).id === id;   // si cambió de artículo o volvió a consultar, esta respuesta ya no se pinta
    try {
      const r = await servidor("gsc", { page, days: Number(perfPeriod.value) }); if (!vigente()) return;
      if (!r.ok || !r.range || !r.range.current) throw Error(r.error || "Respuesta inválida.");
      perfOut.replaceChildren(el("p", r.range.current.startDate + " a " + r.range.current.endDate + " · búsqueda web · frente al periodo anterior de igual duración", "note"));
      if (!r.current) { perfOut.append(el("p", "Google no devolvió filas para esa dirección y ese periodo. No significa necesariamente cero.")); return; }
      const fmt = (k, v) => typeof v !== "number" ? "—" : k === "ctr" ? (v * 100).toFixed(2) + " %" : k === "position" ? v.toFixed(1) : v.toLocaleString("es-MX");
      for (const [k, rotulo] of [["clicks", "Clics"], ["impressions", "Impresiones"], ["ctr", "CTR"], ["position", "Posición media"]]) {
        const a = r.current[k], b = r.previous ? r.previous[k] : undefined, delta = k === "position" || k === "ctr" ? null : metricDelta(a, b);
        perfOut.append(el("p", rotulo + ": " + fmt(k, a) + " · antes: " + fmt(k, b) + (delta === null ? "" : " · " + (delta >= 0 ? "+" : "") + delta.toFixed(1) + " %")));
      }
      perfOut.append(el("strong", "Consultas principales"));
      const tabla = el("table", null, "avz-tabla"), cabeza = el("tr"); ["Consulta", "Clics", "Impr.", "CTR", "Pos."].forEach(x => cabeza.append(el("th", x))); tabla.append(cabeza);
      for (const q of (Array.isArray(r.queries) ? r.queries : []).slice(0, 20)) { const fila = el("tr"); [(q.keys && q.keys[0]) || "", fmt("clicks", q.clicks), fmt("impressions", q.impressions), fmt("ctr", q.ctr), fmt("position", q.position)].forEach(x => fila.append(el("td", x))); tabla.append(fila); }
      perfOut.append(tabla, el("p", "Google puede omitir consultas anónimas o filas. Es una comparación de dos periodos: no prueba que un cambio haya causado la diferencia.", "note"));
    } catch (e) { if (vigente()) perfOut.replaceChildren(el("p", e.message || "No disponible", "note")); }
    finally { if (yo === turno) perfBtn.disabled = false; }
  };
}

/* --- Asistente editorial (apagado: la función ia de hoy solo pule captions de Instagram; necesita su acción «seo» y una clave de IA) --- */
let aiOut = null;
if (ACTIVO.ia) {
  const g = grupo("ia", "Asistente editorial", false), btns = el("div", null, "actions"); aiOut = el("div", null, "avz-res"); g.append(btns, aiOut);
  for (const [tarea, rotulo] of [["meta", "Proponer título y descripción"], ["mejoras", "Proponer mejoras de SEO"], ["resumen", "Resumir el artículo"], ["plan", "Planear contenido relacionado"], ["inclusivo", "Revisar lenguaje inclusivo"], ["alt", "Mejorar textos alternativos"]]) {
    const b = boton(rotulo); btns.append(b);
    b.onclick = async () => {
      const d = entrada(), id = (app.post() || {}).id; if (!d.body.trim() && tarea !== "plan") { aiOut.replaceChildren(el("p", "Escribe el artículo primero.", "note")); return; }
      b.disabled = true; aiOut.replaceChildren(el("p", "Pidiendo sugerencias…", "note"));
      try {
        const r = await servidor("ia", { accion: "seo", tarea, idioma: d.lang, frases: d.phrases.map(p => p.term).filter(Boolean), post: { tipo: "Blog", copy: d.h1 || d.title, caption: d.body.slice(0, 24000), alts: d.images.filter(Boolean).slice(0, 30) } });
        if ((app.post() || {}).id !== id) return;
        if (r.error || !Array.isArray(r.opciones) || !r.opciones.length) throw Error(/acci[oó]n no v[aá]lida/i.test(r.error || "") ? "El asistente de SEO todavía no está instalado en el servidor." : r.error || "El asistente no devolvió sugerencias.");
        aiOut.replaceChildren();
        for (const op of r.opciones) { if (typeof op !== "string") continue; const p = el("p", op), c = boton("Copiar"); p.style.whiteSpace = "pre-wrap"; c.onclick = copiaEn(c, () => op, "Copiar"); aiOut.append(p, c); }
        aiOut.append(el("p", "Son sugerencias: revísalas antes de usarlas. Nada se aplica ni se publica solo.", "note"));
      } catch (e) { if ((app.post() || {}).id === id) aiOut.replaceChildren(el("p", e.message || "No disponible", "note")); }
      finally { b.disabled = false; }
    };
  }
}

/* --- Leer, restaurar y pintar --- */
// Lo que se guarda en seo.advanced: solo lo que tiene valor. Parte de lo ya guardado (un campo que hoy no se muestra no se
// pierde) y encima va lo que hay en pantalla; lo que se vació o está en su valor de inicio no se guarda.
const INICIO = { lang: "en", schema: "BlogPosting" };
function snapshot(){
  const o = Object.assign({}, guardado);
  Object.keys(fields).forEach(k => { const v = valor(k); if (v === "" || v === false || v === INICIO[k]) delete o[k]; else o[k] = v; });
  if (experiments.length) o.experiments = experiments.slice(-20); else delete o.experiments;
  return o;
}
function restore(o){
  guardado = o && typeof o === "object" && !Array.isArray(o) ? Object.assign({}, o) : {};
  for (const [k, n] of Object.entries(fields)) { if (n.type === "checkbox") n.checked = guardado[k] === true; else n.value = typeof guardado[k] === "string" ? guardado[k] : ""; }
  if (fields.lang.value !== "es") fields.lang.value = "en"; if (!fields.schema.value) fields.schema.value = "BlogPosting";
  experiments = Array.isArray(guardado.experiments) ? guardado.experiments.filter(x => x && typeof x.at === "string").slice(-20) : [];
  relacionadas.open = [1, 2, 3, 4].some(i => guardado["kw" + i] || guardado["syn" + i]);
  histNote.value = ""; renderHistory(); if (aiOut) aiOut.replaceChildren(); resetPerf();
}
// ctx: lo que el editor ya leyó al repintar ({ cuerpo, seo }), para no leer el artículo dos veces
function entrada(ctx){
  const b = ctx && Array.isArray(ctx.cuerpo) ? ctx.cuerpo : (app.esBlog() ? app.bloques() : []), s = (ctx && ctx.seo) || app.base();
  return { cuerpo: b, body: app.texto(b), title: s.titulo || app.h1(), h1: app.h1(), description: s.desc || "", slug: s.slug || "",
    headings: b.filter(x => x && x.t === "h").map(x => app.plano(x.x)), paragraphs: b.filter(x => x && x.t === "p").map(x => app.plano(x.x)),
    images: [s.alt || "", ...b.filter(x => x && x.t === "img").flatMap(x => (x.imgs || []).map(f => (f && f.alt) || ""))],
    phrases: [{ term: s.kw || "", synonyms: split(valor("syn0")) }, ...[1, 2, 3, 4].map(i => ({ term: valor("kw" + i), synonyms: split(valor("syn" + i)) }))],
    lang: valor("lang"), cornerstone: valor("cornerstone") };
}
function render(ctx){
  if (root.classList.contains("hidden") || !panel.open) return;   // plegado o fuera de un Blog: no calcula nada
  const admin = !!app.esAdmin(); for (const k of ["auditoria", "gsc"]) if (grupos[k]) grupos[k].classList.toggle("hidden", !admin);
  const d = entrada(ctx), a = analyze(d);
  if (grupos.frases.open) {
    result.replaceChildren();
    if (!a.phrases.length) result.append(el("p", "Escribe arriba la «Palabra clave principal» para empezar.", "note"));
    for (const p of a.phrases) { result.append(el("strong", p.term + " · " + p.count + (p.count === 1 ? " vez" : " veces") + " en el texto · " + p.density.toFixed(1) + " %")); lista(result, p.checks.map(([k, v]) => [v, k]), "seo-chk"); }
  }
  if (grupos.lectura.open) {
    readout.replaceChildren();
    if (!a.words) readout.append(el("p", "Escribe el artículo para ver su legibilidad.", "note"));
    else {
      const pct = n => a.sentences ? Math.round(100 * n / a.sentences) : 0, facil = a.flesch >= 60 ? "fácil de leer" : a.flesch >= 30 ? "algo difícil" : "difícil";
      lista(readout, [
        [a.flesch >= 60, "Facilidad de lectura (Flesch): " + a.flesch + " de 100, " + facil],
        [pct(a.long) <= 25, "Frases largas: " + a.long + " de " + a.sentences + " (" + pct(a.long) + " %; conviene no pasar de 25 %)"],
        [a.transition >= 30, "Frases con palabras de transición: " + a.transition + " % (conviene 30 % o más)"],
        [a.longParagraphs === 0, "Párrafos de más de 150 palabras: " + a.longParagraphs],
        [pct(a.passive) <= 10, "Posible voz pasiva: " + a.passive + " frases (" + pct(a.passive) + " %; conviene no pasar de 10 %)"],
      ], "seo-chk avz-1");
      lista(readout, ["Promedio: " + a.avg.toFixed(1) + " palabras por frase", "Palabras más usadas: " + (a.prominent.map(([x, n]) => x + " (" + n + ")").join(", ") || "—"), ...(a.cornerstone ? ["Contenido pilar: revisa que sea de los más completos, que otros artículos lo enlacen y que se actualice cada cierto tiempo."] : [])]);
      readout.append(el("p", "Son guías editoriales calculadas sobre los párrafos; no equivalen a la puntuación de Yoast.", "note"));
    }
  }
  if (grupos.enlaces.open) {
    links.replaceChildren();
    const yo = (app.post() || {}).id, otros = (app.posts() || []).filter(p => p && p.tipo === "Blog" && p.id !== yo), mio = JSON.stringify(d.cuerpo);
    const terms = new Set(tokens(d.title + " " + d.body).filter(x => x.length > 4));
    const cand = otros.map(p => { const t = p.copy || (p.seo && p.seo.titulo) || "", slug = p.seo && p.seo.slug, s = p.seo || {}; return { t, slug, score: [...new Set(tokens(t + " " + (s.kw || "") + " " + (s.tags || "")))].filter(x => terms.has(x)).length }; }).filter(x => x.slug && x.score > 0).sort((x, y) => y.score - x.score).slice(0, 5);
    links.append(el("p", "Artículos de la parrilla que tratan temas parecidos. Aquí no se comprueba que ya estén publicados en el sitio.", "note"));
    if (!cand.length) links.append(el("p", "Todavía no hay otros artículos con temas en común."));
    for (const c of cand) { const u = SITIO + encodeURIComponent(c.slug) + "/", fila = el("div", null, "avz-enl"), ya = mio.includes("/" + c.slug + "/"), b = boton("Copiar URL"); b.onclick = copiaEn(b, () => u, "Copiar URL"); fila.append(el("span", (ya ? "✓ ya enlazado · " : "") + c.t), b); links.append(fila); }
    const principal = d.phrases[0].term, clave = t => words(t, d.lang).join(" "), choque = principal ? otros.filter(p => p.seo && p.seo.kw && clave(p.seo.kw) === clave(principal)) : [];
    if (choque.length) { links.append(el("strong", "Otro artículo usa la misma palabra clave principal")); lista(links, choque.map(p => p.copy || (p.seo && p.seo.titulo) || "Sin título")); links.append(el("p", "Si los dos buscan lo mismo pueden competir entre sí en Google: conviene diferenciarlos.", "note")); }
    if (d.slug) links.append(el("p", "Artículos de la parrilla que enlazan a este: " + entrantes(d.slug, otros) + ".", "note"));
  }
  if (grupos.redes.open) {
    preview.replaceChildren(); const img = safeUrl(valor("socialImage")), c = el("div");
    if (img) { const im = el("img"); im.src = img; im.alt = ""; im.referrerPolicy = "no-referrer"; im.loading = "lazy"; preview.append(im); }
    c.append(el("small", "yucatanlove.com"), el("b", valor("socialTitle") || d.title || "Título del artículo"), el("span", valor("socialDescription") || d.description || "Descripción del artículo")); preview.append(c);
  }
  if (grupos.schema.open) renderSchema();
  if (technical) technical.textContent = (valor("canonical") && !safeUrl(valor("canonical")) ? "La URL canónica no es válida. " : "") + (valor("oldSlug") && valor("oldSlug") !== d.slug ? "Redirección propuesta: " + valor("oldSlug") + " → " + d.slug + ". " : "") + "Solo se intentan enviar si marcas la casilla y la entrada sigue en borrador; noindex nunca se aplica a una entrada publicada.";
  if (grupos.auditoria && grupos.auditoria.open && auditData) renderAudit();
}
panel.addEventListener("toggle", () => { recuerda("seoAvzAbierto", panel.open ? "1" : "0"); render(); });
panel.addEventListener("input", e => { if (e.target && e.target.dataset && e.target.dataset.avz) app.cambio(); render(); });
app.registrar({ leer: () => { const o = snapshot(); return Object.keys(o).length ? o : null; }, cargar: p => restore(p && p.seo && p.seo.advanced), pintar: render });
})();
