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
