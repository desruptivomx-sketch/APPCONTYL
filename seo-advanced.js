/* Motor editorial independiente. No usa código ni servicios privados de Yoast. */
(function(){
"use strict";
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
if(typeof module!=="undefined"&&module.exports){module.exports={analyze,occurrences};return;}
const root=document.getElementById("seo-box"); if(!root)return;
const el=(tag,txt,cls)=>{const n=document.createElement(tag);if(txt!=null)n.textContent=txt;if(cls)n.className=cls;return n;};
const panel=el("details",null,"seo-advanced");panel.open=true;
panel.append(el("summary","SEO avanzado · inteligencia editorial"));
const style=el("style");style.textContent=".seo-advanced{margin-top:16px;border-top:1px solid #aaa5;padding-top:12px}.seo-advanced summary{cursor:pointer;font-weight:700}.seo-advanced .adv-group{margin:12px 0;padding:12px;border:1px solid #aaa5;border-radius:8px}.seo-advanced label{display:block;margin:6px 0}.seo-advanced input:not([type=checkbox]),.seo-advanced select{width:100%;box-sizing:border-box}.seo-advanced .adv-row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}.seo-advanced .adv-row>*{flex:1;min-width:110px}.seo-advanced .adv-note{font-size:12px;opacity:.8}.seo-advanced button{margin:4px 4px 4px 0}.seo-advanced ul{padding-left:20px}.seo-advanced .adv-social{border:1px solid #aaa5;padding:12px;border-radius:8px;overflow-wrap:anywhere}.seo-advanced img{width:100%;max-height:180px;object-fit:cover}.seo-advanced .adv-status{font-size:12px;line-height:1.6}";
panel.append(style);root.append(panel);
const fields={};const group=t=>{const d=el("div",null,"adv-group");d.append(el("strong",t));panel.append(d);return d;};
function field(g,k,label,type="text"){const l=el("label",label);const n=el(type==="textarea"?"textarea":"input");if(type!=="textarea")n.type=type;if(type==="checkbox")n.checked=false;else n.maxLength=500;l.append(n);g.append(l);fields[k]=n;return n;}
const g=group("Palabras clave y variantes");const lang=el("select");for(const [v,t] of [["en","English"],["es","Español"]]){const o=el("option",t);o.value=v;lang.append(o);}g.append(lang);fields.lang=lang;
field(g,"syn0","Sinónimos de la palabra clave principal (separados por coma)");
for(let i=1;i<=4;i++){const row=el("div",null,"adv-row");g.append(row);field(row,"kw"+i,"Frase relacionada "+i);field(row,"syn"+i,"Sinónimos");}
field(g,"cornerstone","Contenido pilar","checkbox");const result=el("div",null,"adv-status");g.append(result);
const read=group("Legibilidad e insights");const readout=el("div");read.append(readout);
const linking=group("Enlazado interno y contenido relacionado");const links=el("div");linking.append(links);
const audit=group("Auditoría de contenido publicado");
const auditButton=el("button","Consultar WordPress","btn ghost small");auditButton.type="button";
const auditOut=el("div",null,"adv-status");audit.append(auditButton,auditOut);
let auditData=null,auditBusy=false;
function renderAudit(){
 if(!auditData)return;
 const d=input(),r=auditData,items=r.articulos||[],cov=r.cobertura||{};
 auditOut.replaceChildren();
 auditOut.append(el("p","Lectura de "+items.length+" entradas/páginas · "+new Date(r.fecha).toLocaleString("es-MX"),"adv-note"));
 for(const [k,v] of Object.entries(cov))auditOut.append(el("p",k+": "+v.leidos+"/"+(v.total??"?")+(v.completa?" · completo":" · parcial"),"adv-note"));
 auditOut.append(el("p","Los enlaces se cuentan entre artículos y páginas consultados, sin menús, widgets, otros tipos de contenido ni JavaScript. No es una auditoría de rastreo completa.","adv-note"));
 const termSet=new Set(tokens(d.title+" "+d.phrases.map(p=>p.term).join(" ")).filter(w=>w.length>3));
 const relevant=items.filter(p=>p.url&&p.slug!==d.slug).map(p=>({...p,score:[...new Set(tokens(p.titulo+" "+p.slug))].filter(t=>termSet.has(t)).length})).filter(p=>p.score>0).sort((a,b)=>b.score-a.score).slice(0,8);
 auditOut.append(el("strong","Enlaces internos recomendados (publicados)"));
 for(const p of relevant){const row=el("div",null,"adv-row"),a=el("a",p.titulo);const u=safeUrl(p.url);if(!u)continue;a.href=u;a.target="_blank";a.rel="noopener noreferrer";row.append(a);const c=el("button","Copiar enlace","btn ghost small");c.type="button";c.onclick=async()=>{c.textContent=await copiarTexto(u)?"Copiado":"No se pudo";};row.append(c);auditOut.append(row);}
 if(!relevant.length)auditOut.append(el("p","No hay coincidencias suficientes."));
 const orphan=items.filter(p=>p.entrantes===0);auditOut.append(el("strong","Sin enlaces entrantes detectados: "+orphan.length));
 list(auditOut,orphan.slice(0,15).map(p=>p.titulo||p.slug));
 const thisPost=items.find(p=>p.slug===d.slug);if(thisPost)auditOut.append(el("p","Artículo actual: "+thisPost.entrantes+" fuentes entrantes y "+thisPost.salientes+" destinos internos en la muestra."));
}
auditButton.onclick=async()=>{
 if(auditBusy)return;auditBusy=true;auditButton.disabled=true;auditOut.textContent="Consultando contenido publicado…";
 try{const {data,error}=await sb.functions.invoke("wp",{body:{accion:"auditoria_seo"}});if(error||!data?.ok||!Array.isArray(data.articulos))throw Error(data?.error||"Auditoría no disponible. Verifica los permisos de administrador y el despliegue de la función wp.");auditData=data;renderAudit();}
 catch(e){auditData=null;auditOut.textContent=e.message||"No disponible";}
 finally{auditBusy=false;auditButton.disabled=false;}
};
const social=group("Vista previa social · Facebook / X");field(social,"socialTitle","Título social");field(social,"socialDescription","Descripción social","textarea");field(social,"socialImage","URL de imagen social");const preview=el("div",null,"adv-social");social.append(preview);
const tech=group("Configuración editorial y técnica");field(tech,"canonical","URL canónica");field(tech,"applyMeta","Enviar ajustes SEO avanzados a WordPress (solo borradores)","checkbox");field(tech,"noindex","Solicitar noindex","checkbox");field(tech,"oldSlug","Slug anterior (propuesta de redirección)");field(tech,"schema","Tipo de Schema (Article / BlogPosting / NewsArticle)");const technical=el("div",null,"adv-note");tech.append(technical);
const ai=group("Asistencia editorial");const aiOut=el("div",null,"adv-status");const actions=[["meta","Generar metadatos"],["optimize","Proponer mejoras SEO"],["summary","Resumir artículo"],["plan","Planificar contenido"],["inclusive","Revisar lenguaje inclusivo"],["alt","Sugerir textos alternativos"]];
const btns=el("div");ai.append(btns,aiOut);
const split=s=>String(s||"").split(",").map(x=>x.trim()).filter(Boolean).slice(0,12);
const value=k=>fields[k].type==="checkbox"?fields[k].checked:fields[k].value.trim();
function snapshot(){const o={};Object.keys(fields).forEach(k=>o[k]=value(k));return o;}
function restore(o){for(const [k,n] of Object.entries(fields)){if(n.type==="checkbox")n.checked=!!o?.[k];else n.value=o?.[k]??(k==="lang"?"en":"");}aiOut.replaceChildren();}
function input(){const b=esBlogEd()?blLeer(blDoc):[],s=originalRead(),body=esBlogEd()?blTexto(b):"";return {body,title:s.titulo||$("e-copy").value,description:s.desc||"",slug:s.slug||"",headings:b.filter(x=>x.t==="h").map(x=>blPlano(x.x)),paragraphs:b.filter(x=>x.t==="p").map(x=>blPlano(x.x)),images:[s.alt||"",...b.filter(x=>x.t==="img").flatMap(x=>(x.imgs||[]).map(f=>f.alt||""))],phrases:[{term:s.kw||"",synonyms:split(value("syn0"))},...Array.from({length:4},(_,i)=>({term:value("kw"+(i+1)),synonyms:split(value("syn"+(i+1)))}))],lang:value("lang"),cornerstone:value("cornerstone")};}
function list(parent,items){const ul=el("ul");items.forEach(x=>ul.append(el("li",x)));parent.append(ul);}
function safeUrl(s){try{const u=new URL(s);return /^https?:$/.test(u.protocol)?u.href:null;}catch{return null;}}
function render(){
 if(root.classList.contains("hidden"))return;
 const d=input(),a=analyze(d);result.replaceChildren();
 if(!a.phrases.length)result.append(el("p","Define una frase principal para comenzar."));
 for(const p of a.phrases){result.append(el("strong",p.term+" · "+p.count+" apariciones (máximo por variante) · "+p.density.toFixed(1)+"% estimado"));list(result,p.checks.map(([k,v])=>(v?"✓ ":"○ ")+k));}
 readout.replaceChildren();list(readout,[a.words+" palabras · "+a.reading+" min aprox.","Flesch "+(a.flesch??"—")+" (estimación lingüística)","Frases largas: "+a.long+" de "+a.sentences,"Promedio de palabras por frase: "+a.avg.toFixed(1),"Transiciones detectadas: "+a.transition+"%","Párrafos de más de 150 palabras: "+a.longParagraphs,"Posible voz pasiva: "+a.passive+" frases","Palabras destacadas: "+a.prominent.map(([w,n])=>w+" ("+n+")").join(", "),...(a.cornerstone?["Contenido pilar: revisa profundidad, enlaces y actualización periódica."]:[])]);
 links.replaceChildren();const terms=new Set(tokens(d.title+" "+d.body).filter(w=>w.length>4));const candidates=(typeof posts!=="undefined"?posts:[]).filter(p=>p.tipo==="Blog"&&p.id!==current?.id).map(p=>{const t=p.copy||p.seo?.titulo||"",slug=p.seo?.slug;const score=[...new Set(tokens(t+" "+(p.seo?.kw||"")+" "+(p.seo?.tags||"")))].filter(x=>terms.has(x)).length;return {t,slug,score};}).filter(x=>x.slug&&x.score>0).sort((a,b)=>b.score-a.score).slice(0,5);
 links.append(el("p","Sugerencias de la biblioteca local; no comprueban publicación ni existencia de la URL.","adv-note"));
 if(!candidates.length)links.append(el("p","No hay coincidencias suficientes."));
 for(const c of candidates){const row=el("div",null,"adv-row");row.append(el("span",c.t));const b=el("button","Copiar URL","btn ghost small");b.type="button";b.onclick=async()=>{const ok=await copiarTexto("https://www.yucatanlove.com/"+encodeURIComponent(c.slug)+"/");b.textContent=ok?"Copiado":"No se pudo";};row.append(b);links.append(row);}
 const local=(typeof posts!=="undefined"?posts:[]).filter(p=>p.tipo==="Blog"&&p.id!==current?.id);
 const primary=d.phrases[0].term;const conflicts=primary?local.filter(p=>norm(p.seo?.kw).trim()===norm(primary).trim()):[];
 if(conflicts.length){links.append(el("strong","Posible canibalización de palabra clave"));list(links,conflicts.map(p=>p.copy||p.seo?.titulo||"Sin título"));}
 const slug=d.slug; if(slug){const incoming=local.filter(p=>JSON.stringify(p.cuerpo||[]).includes("/"+slug+"/")).length;links.append(el("p","Enlaces entrantes detectados en borradores locales: "+incoming+" (no equivale a auditoría del sitio publicado).","adv-note"));}
 preview.replaceChildren();const url=safeUrl(value("socialImage"));if(url){const im=el("img");im.src=url;im.alt="Vista previa social";im.referrerPolicy="no-referrer";preview.append(im);}
 preview.append(el("small","Facebook · YUCATANLOVE.COM · vista aproximada"),el("strong",value("socialTitle")||d.title),el("p",value("socialDescription")||d.description),el("hr"),el("small","X · tarjeta aproximada"),el("strong",value("socialTitle")||d.title),el("p",value("socialDescription")||d.description));
 technical.textContent=(value("canonical")&&!safeUrl(value("canonical"))?"URL canónica inválida. ":"")+(value("oldSlug")&&value("oldSlug")!==d.slug?"Redirección propuesta: "+value("oldSlug")+" → "+d.slug+". ":"")+"Los campos avanzados compatibles solo se intentan enviar si autorizas el envío y la entrada está en borrador. Schema y redirecciones siguen siendo propuestas. El ajuste noindex nunca se aplica a una entrada publicada.";
}
const originalRead=seoLeer,originalLoad=seoCargar,originalRender=seoPintar;
seoLeer=function(){const s=originalRead();if($("e-tipo").value==="Blog")s.advanced=snapshot();return s;};
seoCargar=function(p){restore(p?.seo?.advanced||{});originalLoad(p);render();if(auditData)renderAudit();};
seoPintar=function(){originalRender();render();};
panel.addEventListener("input",()=>{editorDirty=true;render();});
for(const [action,label] of actions){const b=el("button",label,"btn ghost small");b.type="button";btns.append(b);b.onclick=async()=>{
 const d=input(),id=current?.id;if(!d.body.trim()&&action!=="plan"){aiOut.textContent="Escribe el artículo primero.";return;}
 b.disabled=true;aiOut.textContent="Solicitando sugerencias…";
 try{
 const prompts={meta:"Genera 3 opciones de título SEO y descripción, sin inventar datos.",optimize:"Identifica mejoras concretas y propone reemplazos de fragmentos; conserva hechos y estilo.",summary:"Resume el artículo en 3 puntos.",plan:"Propón 5 ideas y un esquema editorial para bodas destino en Yucatán.",inclusive:"Señala lenguaje potencialmente excluyente y alternativas contextualizadas.",alt:"Propón mejoras para los textos alternativos existentes. No describas imágenes que no puedas ver."};
 const {data,error}=await sb.functions.invoke("ia",{body:{accion:"pulir_caption",post:{tipo:"Blog",copy:d.title,caption:(d.body||d.title||"Destination weddings in Yucatán").slice(0,18000)},idioma:d.lang,instruccion:prompts[action]+" Palabras clave: "+d.phrases.map(p=>p.term).join(", ")}});
 if(current?.id!==id)return;
 if(error||!data||data.error||!Array.isArray(data.opciones)||!data.opciones.length)throw new Error("El asistente existente no devolvió sugerencias válidas.");
 aiOut.replaceChildren();for(const option of data.opciones){if(typeof option!=="string")continue;const p=el("p",option);p.style.whiteSpace="pre-wrap";aiOut.append(p);const c=el("button","Copiar sugerencia","btn ghost small");c.type="button";c.onclick=()=>copiarTexto(option);aiOut.append(c);}aiOut.append(el("p","Revisa antes de aplicar. La respuesta depende del asistente de Supabase existente.","adv-note"));
 }catch(e){if(current?.id===id)aiOut.textContent=e.message||"No disponible";}finally{b.disabled=false;}
};}
})();
