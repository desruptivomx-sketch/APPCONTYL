// Run from the repository root: node --test tests/seo.test.cjs
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {analyze,occurrences}=require("../seo-advanced.js");
const source=fs.readFileSync(path.join(__dirname,"../herramientas/funcion-wp.ts"),"utf8").replace(/export function /g,"function ").replace(/export async function /g,"async function ");
const graph=new Function("URL","Deno",source+"\nreturn grafoSEO;")(URL,undefined);
test("English word forms and transitions",()=>{
 const a=analyze({body:"Wedding planners organize weddings. However, guests travel.",title:"Wedding planners",phrases:[{term:"wedding planner",synonyms:[]}],lang:"en"});
 assert.equal(a.words,7);assert.equal(a.transition,50);assert.equal(a.phrases[0].checks[0][1],true);
 assert.equal(occurrences("weddings","wedding","en"),1);
});
test("Spanish accents, plurals and explicit synonyms",()=>{
 const a=analyze({body:"Bodas en México.",title:"Ceremonia",phrases:[{term:"boda",synonyms:["ceremonia"]}],lang:"es"});
 assert.equal(a.phrases[0].count,1);assert.equal(a.phrases[0].checks[0][1],true);
 assert.equal(occurrences("México","mexico","es"),1);
});
test("empty article",()=>{assert.equal(analyze({}).flesch,null);});
test("graph counts unique internal sources and ignores external/self links",()=>{
 const item=(id,slug,html)=>({id,slug,type:"post",link:"https://www.yucatanlove.com/"+slug+"/",title:{rendered:slug},content:{rendered:html}});
 const a=graph([
  item(1,"a",'<a href="/b/">B</a><a href="https://yucatanlove.com/b/#x">B again</a><a href="/a/">self</a>'),
  item(2,"b",'<a href="https://example.com/a/">outside</a>'),
  item(3,"c",'<a href="../b/">B</a>')
 ],"https://www.yucatanlove.com");
 assert.equal(a[0].salientes,1);assert.equal(a[0].entrantes,0);
 assert.equal(a[1].entrantes,2);assert.equal(a[2].salientes,1);
});

const {articleSchema,metricDelta}=require("../seo-advanced.js");
test("Schema uses factual fields and omits unavailable dates",()=>{
 const a=articleSchema({headline:"Wedding",type:"invalid",author:"Ana",lang:"en"});
 assert.equal(a["@type"],"BlogPosting");assert.equal(a.author.name,"Ana");assert.equal(a.datePublished,undefined);
 assert.equal(articleSchema({headline:"Wedding",type:"NewsArticle"})["@type"],"NewsArticle");
});
test("relative comparison handles zero baseline",()=>{assert.equal(metricDelta(150,100),50);assert.equal(metricDelta(1,0),null);});
const gscSource=fs.readFileSync(path.join(__dirname,"../supabase/functions/gsc/index.ts"),"utf8").replace(/export (async )?function /g,(_,a)=>(a||"")+"function ");
const {windows,pageAllowed}=new Function("Deno",gscSource+"\nreturn {windows,pageAllowed};")(undefined);
test("Search Console equal comparison periods",()=>{
 const w=windows(28,new Date("2026-11-26T12:00:00Z"));
 assert.deepEqual(w.current,{startDate:"2026-10-27",endDate:"2026-11-23"});
 assert.deepEqual(w.previous,{startDate:"2026-09-29",endDate:"2026-10-26"});
});
test("Search Console property scope",()=>{
 assert.equal(pageAllowed("https://www.yucatanlove.com/a/","sc-domain:yucatanlove.com"),true);
 assert.equal(pageAllowed("https://yucatanlove.com.evil.test/a/","sc-domain:yucatanlove.com"),false);
 assert.equal(pageAllowed("https://www.yucatanlove.com/a/","https://www.yucatanlove.com/"),true);
 assert.equal(pageAllowed("https://www.yucatanlove.com/other","https://www.yucatanlove.com/blog/"),false);
});

// ---- Motor: casos que fallaban o no estaban cubiertos (nov 2026) ----
const {stem}=require("../seo-advanced.js");
test("plurales en español: singular y plural dan la misma raíz",()=>{
 for(const [plural,singular] of [["bodas","boda"],["flores","flor"],["luces","luz"],["viajes","viaje"],["países","país"],["noches","noche"],["ciudades","ciudad"],["jardines","jardín"],["imágenes","imagen"],["felices","feliz"],["enlaces","enlace"],["meses","mes"]])
  assert.equal(occurrences(plural,singular,"es"),1,plural+" / "+singular);
 assert.equal(occurrences("una novia feliz","novio","es"),0);
});
test("plurales y posesivos en inglés",()=>{
 for(const [a,b] of [["weddings","wedding"],["venues","venue"],["beaches","beach"],["parties","party"],["dresses","dress"],["boxes","box"]])assert.equal(occurrences(a,b,"en"),1,a+" / "+b);
 assert.equal(occurrences("The bride's speech at the brides’ table","bride speech","en"),1);
 assert.equal(occurrences("a dress code","dresses","en"),1);
});
test("nunca queda una raíz vacía (palabras cortas se dejan igual)",()=>{
 for(const [w,l] of [["es","es"],["s","en"],["is","en"],["as","es"],["mes","es"],["bus","en"]])assert.equal(stem(w,l),w);
 for(const w of ["tres","antes","this","guess","país","crisis","yes"])for(const l of ["es","en"])assert.ok(stem(w,l).length>0);
 assert.equal(occurrences("Es una boda.","","es"),0);
 assert.equal(occurrences("","boda","es"),0);
});
test("cada bloque cierra su frase y la legibilidad se mide sobre los párrafos",()=>{
 const a=analyze({body:"What a Mayan wedding means\n\nThe shaman blesses the couple. Then guests offer flowers.\n\n• Flowers and copal\n• Cacao seeds",paragraphs:["The shaman blesses the couple. Then guests offer flowers."],headings:["What a Mayan wedding means"],lang:"en"});
 assert.equal(a.sentences,2);assert.equal(a.long,0);assert.equal(a.transition,50);assert.equal(a.words,19);
 const b=analyze({body:"Título sin punto\nPrimera frase del texto. Segunda frase.",lang:"es"});
 assert.equal(b.sentences,3);
});
test("transiciones en español con acentos",()=>{
 const a=analyze({body:"Así celebramos la boda. Además, bailamos hasta tarde. Después llegó la cena. Fue un día largo.",lang:"es"});
 assert.equal(a.transition,75);
});
test("la facilidad de lectura queda entre 0 y 100",()=>{
 const raro=analyze({body:"Institucionalizacionalidades extraordinariamente incomprensibilísimas desproporcionadamente interdisciplinariedades",lang:"es"});
 assert.ok(raro.flesch>=0&&raro.flesch<=100);
 const facil=analyze({body:"Yes. No. So. Go.",lang:"en"});
 assert.ok(facil.flesch>=0&&facil.flesch<=100);
});
test("frases: máximo cinco, sinónimos y conteo por variante",()=>{
 const a=analyze({body:"A cenote ceremony is a ritual. The ritual starts at dawn. Another ritual follows.",title:"Cenote ceremony",slug:"cenote-ceremony-guide",images:["","A cenote ceremony at sunrise"],headings:["The ritual"],phrases:[{term:"cenote ceremony",synonyms:["ritual"]},{term:""},{term:"a"},{term:"b"},{term:"c"},{term:"d"},{term:"e"}],lang:"en"});
 assert.equal(a.phrases.length,5);assert.equal(a.phrases[0].count,3);
 assert.deepEqual(a.phrases[0].checks.map(c=>c[1]),[true,false,true,true,true,true,true]);
 assert.equal(analyze({body:"Texto sin la frase.",phrases:[{term:"boda maya"}],lang:"es"}).phrases[0].count,0);
});
test("entradas incompletas no rompen el análisis",()=>{
 assert.doesNotThrow(()=>analyze());assert.doesNotThrow(()=>analyze({phrases:[null,{term:"x",synonyms:null}],headings:[""],images:[""],paragraphs:[""]}));
 assert.equal(analyze({lang:"fr",body:"Bonjour."}).words,1);
});
test("grafo: variantes de la misma dirección cuentan una vez",()=>{
 const item=(id,slug,html,link)=>({id,slug,type:"post",link:link||"https://www.yucatanlove.com/"+slug+"/",title:{rendered:slug+" &amp; <em>x</em>"},content:{rendered:html}});
 const g=graph([
  item(1,"a",'<a href="https://yucatanlove.com/b">1</a><a href="HTTPS://WWW.YUCATANLOVE.COM/b/?utm=1#top">2</a><a href=\'/b//\'>3</a><a href="mailto:x@y.z">m</a><a href="#ancla">n</a><a>sin href</a>'),
  item(2,"b",'<a href="/c/">c</a>'),
  item(3,"c","sin enlaces"),
  {id:4,slug:"sin-link"},null
 ],"https://www.yucatanlove.com");
 assert.equal(g.length,3);assert.equal(g[0].salientes,1);assert.equal(g[1].entrantes,1);assert.equal(g[2].entrantes,1);assert.equal(g[0].entrantes,0);
 assert.equal(g[0].titulo,"a & x");assert.equal(g[0].html,undefined);
});

// ---- Función wp: auditoría del sitio y metadatos avanzados, con un WordPress simulado (nada sale a la red) ----
const {auditarSitio,metaAvanzada}=new Function("URL","Deno",source+"\nreturn {auditarSitio,metaAvanzada};")(URL,undefined);
const respuesta=(cuerpo,{status=200,headers={}}={})=>new Response(JSON.stringify(cuerpo),{status,headers:{"Content-Type":"application/json",...headers}});
const entradaWP=(id,tipo,html)=>({id,type:tipo,slug:tipo+id,link:"https://www.yucatanlove.com/"+tipo+id+"/",title:{rendered:tipo+" "+id},content:{rendered:html||""}});
const sitioSimulado=(falla)=>{const llamadas=[];return {llamadas,wp:async(ruta,init={})=>{
 llamadas.push([init.method||"GET",ruta]);const u=new URL("https://x"+ruta),page=+u.searchParams.get("page"),tipo=u.pathname.slice(1);
 const f=falla&&falla(tipo,page);if(f==="lanza")throw new Error("The operation timed out");if(f)return f;
 if(tipo==="posts")return respuesta(page===1?Array.from({length:50},(_,i)=>entradaWP(i+1,"post",i===0?'<a href="/post2/">x</a>':"")):Array.from({length:10},(_,i)=>entradaWP(i+51,"post",'<a href="/post1/">x</a>')),{headers:{"X-WP-Total":"60","X-WP-TotalPages":"2"}});
 return respuesta([entradaWP(900,"page",'<a href="https://www.yucatanlove.com/post1/">x</a>')],{headers:{"X-WP-Total":"1","X-WP-TotalPages":"1"}});
}};};
test("auditoría: lee todas las páginas, solo con GET y solo lo publicado",async()=>{
 const s=sitioSimulado(),a=await auditarSitio(s.wp,"https://www.yucatanlove.com");
 assert.deepEqual(a.cobertura,{posts:{leidos:60,total:60,completa:true,error:false},pages:{leidos:1,total:1,completa:true,error:false}});
 assert.equal(a.articulos.length,61);
 assert.equal(a.articulos.find(x=>x.slug==="post1").entrantes,11);assert.equal(a.articulos.find(x=>x.slug==="post2").entrantes,1);
 assert.equal(s.llamadas.length,3);assert.ok(s.llamadas.every(([m,r])=>m==="GET"&&r.includes("status=publish")&&r.includes("per_page=50")));
});
test("auditoría: si WordPress falla a media lectura, entrega lo leído como parcial",async()=>{
 const s=sitioSimulado((tipo,page)=>tipo==="posts"&&page===2?respuesta({code:"x"},{status:500}):null),a=await auditarSitio(s.wp,"https://www.yucatanlove.com");
 assert.deepEqual(a.cobertura.posts,{leidos:50,total:60,completa:false,error:true});assert.equal(a.cobertura.pages.completa,true);assert.equal(a.articulos.length,51);
});
test("auditoría: una petición que se queda sin tiempo no tumba la consulta",async()=>{
 const s=sitioSimulado((tipo)=>tipo==="posts"?"lanza":null),a=await auditarSitio(s.wp,"https://www.yucatanlove.com");
 assert.deepEqual(a.cobertura.posts,{leidos:0,total:null,completa:false,error:true});assert.equal(a.articulos.length,1);
 const b=await auditarSitio(sitioSimulado().wp,"https://www.yucatanlove.com",{limite:-1});
 assert.equal(b.articulos.length,0);assert.equal(b.cobertura.posts.completa,false);assert.equal(b.cobertura.pages.error,true);
});
test("auditoría: sin totales de WordPress no afirma que leyó todo; respeta el tope de páginas",async()=>{
 const a=await auditarSitio(async()=>respuesta([entradaWP(1,"post")]),"https://www.yucatanlove.com");
 assert.deepEqual(a.cobertura.posts,{leidos:1,total:null,completa:false,error:false});
 const s=sitioSimulado((tipo,page)=>tipo==="posts"?respuesta([entradaWP(page,"post")],{headers:{"X-WP-Total":"500","X-WP-TotalPages":"10"}}):null),b=await auditarSitio(s.wp,"https://www.yucatanlove.com",{paginas:3});
 assert.equal(s.llamadas.filter(([,r])=>r.startsWith("/posts")).length,3);assert.deepEqual(b.cobertura.posts,{leidos:3,total:500,completa:false,error:false});
 const c=await auditarSitio(async()=>respuesta({code:"rest_forbidden"},{status:401}),"https://www.yucatanlove.com");
 assert.equal(c.articulos.length,0);assert.equal(c.cobertura.posts.error,true);
});
const YOAST={"_yoast_wpseo_opengraph-title":{type:"string"},"_yoast_wpseo_twitter-title":{type:"string"},"_yoast_wpseo_opengraph-description":{type:"string"},"_yoast_wpseo_twitter-description":{type:"string"},"_yoast_wpseo_opengraph-image":{type:"string"},"_yoast_wpseo_twitter-image":{type:"string"},"_yoast_wpseo_canonical":{type:["string","null"]},"_yoast_wpseo_meta-robots-noindex":{type:"string",readonly:true}};
const wpMeta=(props,eco)=>{const llamadas=[];return {llamadas,
 wp:async(ruta,init={})=>{llamadas.push([init.method||"GET",ruta]);return respuesta({schema:{properties:{meta:{properties:props}}}});},
 wpJson:async(ruta,cuerpo)=>{llamadas.push(["POST",ruta,cuerpo]);return respuesta({id:7,meta:eco?eco(cuerpo.meta):cuerpo.meta});}};};
const ADV={applyMeta:true,socialTitle:" Título social ",socialDescription:"Descripción",socialImage:"https://www.yucatanlove.com/f.jpg",canonical:"https://www.yucatanlove.com/a/",noindex:true};
test("metadatos avanzados: sin la casilla marcada no hace ninguna petición",async()=>{
 for(const adv of [undefined,null,{},{applyMeta:false,socialTitle:"x"},{applyMeta:"true",socialTitle:"x"},{applyMeta:true}]){const w=wpMeta(YOAST),r=await metaAvanzada(adv,{id:7,status:"draft"},w.wp,w.wpJson);assert.equal(w.llamadas.length,0);assert.deepEqual(r.seoAvanzado,{guardados:[],pendientes:[]});}
});
test("metadatos avanzados: en borrador envía solo lo que WordPress deja escribir y confirma lo guardado",async()=>{
 const w=wpMeta(YOAST),r=await metaAvanzada(ADV,{id:7,status:"draft"},w.wp,w.wpJson);
 assert.deepEqual(w.llamadas[0],["OPTIONS","/posts/7"]);assert.equal(w.llamadas.length,2);
 const enviado=w.llamadas[1][2].meta;assert.equal(enviado["_yoast_wpseo_opengraph-title"],"Título social");assert.equal(enviado["_yoast_wpseo_canonical"],"https://www.yucatanlove.com/a/");
 assert.equal("_yoast_wpseo_meta-robots-noindex" in enviado,false);           // solo lectura en este WordPress: no se intenta
 assert.equal(r.seoAvanzado.guardados.length,7);assert.deepEqual(r.seoAvanzado.pendientes,["_yoast_wpseo_meta-robots-noindex"]);
 assert.ok(r.avisos.some(a=>a.includes("no dejó guardar")&&a.includes("noindex")));assert.ok(r.avisos.some(a=>a.startsWith("Guardado en el borrador")));
});
test("metadatos avanzados: en un WordPress que no expone esos campos (como el del sitio hoy) no escribe nada",async()=>{
 const w=wpMeta({footnotes:{type:"string"}}),r=await metaAvanzada(ADV,{id:7,status:"draft"},w.wp,w.wpJson);
 assert.equal(w.llamadas.length,1);assert.equal(r.seoAvanzado.guardados.length,0);assert.equal(r.seoAvanzado.pendientes.length,8);
 assert.equal(r.avisos.length,1);assert.ok(/título para redes, descripción para redes, imagen para redes, URL canónica, noindex/.test(r.avisos[0]));
});
test("metadatos avanzados: una entrada que ya no es borrador no se toca",async()=>{
 for(const status of ["publish","future","private","pending"]){const w=wpMeta(YOAST),r=await metaAvanzada(ADV,{id:7,status},w.wp,w.wpJson);assert.equal(w.llamadas.length,0,status);assert.equal(r.seoAvanzado.pendientes.length,8);assert.ok(r.avisos[0].includes("solo se envían mientras la entrada es borrador"));}
});
test("metadatos avanzados: direcciones inválidas no se envían y lo que WordPress no devuelve igual queda pendiente",async()=>{
 const w=wpMeta(YOAST,(m)=>({...m,"_yoast_wpseo_opengraph-title":"otro valor"}));
 const r=await metaAvanzada({applyMeta:true,socialTitle:"T",socialImage:"javascript:alert(1)",canonical:"https://usuario:clave@sitio.com/a/"},{id:7,status:"draft"},w.wp,w.wpJson);
 assert.deepEqual(Object.keys(w.llamadas[1][2].meta).sort(),["_yoast_wpseo_opengraph-title","_yoast_wpseo_twitter-title"]);
 assert.deepEqual(r.seoAvanzado.guardados,["_yoast_wpseo_twitter-title"]);assert.deepEqual(r.seoAvanzado.pendientes,["_yoast_wpseo_opengraph-title"]);
 assert.ok(r.avisos.some(a=>a.includes("canónica no es válida")));assert.ok(r.avisos.some(a=>a.includes("imagen para redes no es válida")));
});
