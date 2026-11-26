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

// ---- Función gsc completa, con Supabase y Google simulados (nada sale a la red) ----
const crypto=require("node:crypto");
const {handle:gsc}=new Function("Deno",gscSource+"\nreturn {handle};")(undefined);
const par=crypto.generateKeyPairSync("rsa",{modulusLength:2048,privateKeyEncoding:{type:"pkcs8",format:"pem"},publicKeyEncoding:{type:"spki",format:"pem"}});
const CUENTA={type:"service_account",client_email:"lector@proyecto.iam.gserviceaccount.com",private_key:par.privateKey};
const ADMIN="Bearer cab."+Buffer.from(JSON.stringify({email:"contenidostde@gmail.com"})).toString("base64url")+".firma", OTRO="Bearer cab."+Buffer.from(JSON.stringify({email:"karens.tde@gmail.com"})).toString("base64url")+".firma";
// Sustituye fetch mientras corre una prueba: Supabase (es_admin), el canje de token de Google y Search Console
async function conServicios(opc,fn){
 const real=globalThis.fetch,vistos={supabase:[],token:[],consultas:[]};
 globalThis.fetch=async(url,init={})=>{
  url=String(url);const h=new Headers(init.headers||{});
  if(url.startsWith("https://sb.test/rest/v1/rpc/es_admin")){vistos.supabase.push(h.get("apikey"));if(opc.llaveBuena&&h.get("apikey")!==opc.llaveBuena)return respuesta({message:"Invalid API key"},{status:401});return respuesta(h.get("Authorization")===ADMIN);}
  if(url==="https://oauth2.googleapis.com/token"){
   const p=new URLSearchParams(String(init.body)),[c,d,f]=String(p.get("assertion")).split(".");
   const firmaOk=crypto.verify("RSA-SHA256",Buffer.from(c+"."+d),par.publicKey,Buffer.from(f,"base64url"));
   vistos.token.push({grant:p.get("grant_type"),cab:JSON.parse(Buffer.from(c,"base64url")),datos:JSON.parse(Buffer.from(d,"base64url")),firmaOk});
   return opc.googleRechaza||!firmaOk?respuesta({error:"invalid_grant"},{status:400}):respuesta({access_token:"ficha-de-google",expires_in:3600});
  }
  if(url.startsWith("https://www.googleapis.com/webmasters/v3/sites/")){
   const b=JSON.parse(init.body);vistos.consultas.push({url,auth:h.get("Authorization"),b});
   if(opc.sinAcceso)return respuesta({error:{code:403,message:"User does not have sufficient permission for site"}},{status:403});
   const dim=(b.dimensions||[])[0];
   return respuesta(opc.sinFilas?{}:{rows:dim==="query"?[{keys:["mayan wedding"],clicks:60,impressions:900,ctr:0.0667,position:4.2}]:dim==="date"?[{keys:[b.startDate],clicks:5,impressions:150,ctr:0.033,position:8}]:[{clicks:b.startDate>"2026-10-01"?150:100,impressions:4200,ctr:0.0357,position:8.4}]});
  }
  throw new Error("petición inesperada a "+url);
 };
 try{return await fn(vistos);}finally{globalThis.fetch=real;}
}
const ENT={SUPABASE_URL:"https://sb.test",SUPABASE_ANON_KEY:"anon-vieja",GSC_SITE_URL:"sc-domain:yucatanlove.com",GSC_SERVICE_ACCOUNT_JSON:JSON.stringify(CUENTA)};
const pedir=async(body,auth=ADMIN,ent=ENT,cab={})=>{const r=await gsc(new Request("https://f.test/gsc",{method:"POST",headers:{"Content-Type":"application/json",...(auth?{Authorization:auth}:{}),...cab},body:JSON.stringify(body)}),k=>ent[k]);return {s:r.status,texto:await r.clone().text(),...(await r.json())};};
const PAG="https://www.yucatanlove.com/mayan-wedding-ceremony/";
test("gsc: sin sesión, sin ser quien administra o con otra propiedad, nunca llega a Google",async()=>{
 await conServicios({},async v=>{
  assert.equal((await pedir({page:PAG,days:28},null)).s,401);
  assert.equal((await pedir({page:PAG,days:28},OTRO)).s,403);
  assert.equal((await pedir({page:"https://otro-sitio.com/a/",days:28})).s,400);
  assert.equal((await pedir({page:"https://www.yucatanlove.com.evil.test/a/",days:28})).s,400);
  assert.equal(v.token.length,0);assert.equal(v.consultas.length,0);
 });
});
test("gsc: sin configurar avisa cómo está, sin llamar a Google",async()=>{
 await conServicios({},async v=>{
  const r=await pedir({page:PAG,days:28},ADMIN,{...ENT,GSC_SERVICE_ACCOUNT_JSON:""});assert.equal(r.s,503);assert.equal(r.setup,true);assert.equal(v.token.length,0);
 });
});
test("gsc: firma bien la cuenta de servicio, pide solo lectura y consulta la página exacta",async()=>{
 await conServicios({},async v=>{
  const r=await pedir({page:PAG,days:28});
  assert.equal(r.s,200);assert.equal(r.ok,true);
  assert.equal(v.token.length,1);const t=v.token[0];
  assert.equal(t.firmaOk,true);assert.equal(t.cab.alg,"RS256");assert.equal(t.grant,"urn:ietf:params:oauth:grant-type:jwt-bearer");
  assert.equal(t.datos.scope,"https://www.googleapis.com/auth/webmasters.readonly");assert.equal(t.datos.iss,CUENTA.client_email);assert.equal(t.datos.aud,"https://oauth2.googleapis.com/token");assert.equal(t.datos.exp-t.datos.iat,3600);
  assert.equal(v.consultas.length,4);
  for(const c of v.consultas){
   assert.equal(c.url,"https://www.googleapis.com/webmasters/v3/sites/sc-domain%3Ayucatanlove.com/searchAnalytics/query");assert.equal(c.auth,"Bearer ficha-de-google");
   assert.equal(c.b.type,"web");assert.equal(c.b.dataState,"final");assert.deepEqual(c.b.dimensionFilterGroups,[{filters:[{dimension:"page",operator:"equals",expression:PAG}]}]);
  }
  const dias=(a)=>(new Date(a.endDate)-new Date(a.startDate))/86400000+1;
  assert.equal(dias(r.range.current),28);assert.equal(dias(r.range.previous),28);assert.ok(r.range.previous.endDate<r.range.current.startDate);
  assert.equal(r.current.clicks,150);assert.equal(r.previous.clicks,100);assert.equal(r.queries[0].keys[0],"mayan wedding");assert.equal(r.series.length,1);
  assert.equal(r.texto.includes("PRIVATE KEY"),false);assert.equal(r.texto.includes("ficha-de-google"),false);assert.equal(r.texto.includes(CUENTA.client_email),false);
 });
});
test("gsc: periodo inválido usa 28 días; sin filas no inventa ceros",async()=>{
 await conServicios({sinFilas:true},async v=>{
  const r=await pedir({page:PAG,days:"muchos"});assert.equal(r.s,200);assert.equal(r.current,null);assert.equal(r.previous,null);assert.deepEqual(r.queries,[]);
  assert.equal((new Date(r.range.current.endDate)-new Date(r.range.current.startDate))/86400000+1,28);
 });
});
test("gsc: si Google rechaza, responde con un mensaje seguro (sin secretos)",async()=>{
 await conServicios({sinAcceso:true},async()=>{const r=await pedir({page:PAG,days:7});assert.equal(r.s,502);assert.ok(/Search Console respondió 403/.test(r.error));assert.equal(r.texto.includes("PRIVATE KEY"),false);});
 await conServicios({googleRechaza:true},async v=>{const r=await pedir({page:PAG,days:7});assert.equal(r.s,502);assert.ok(/Google no autorizó la cuenta de servicio/.test(r.error));assert.equal(v.consultas.length,0);});
 await conServicios({},async v=>{const r=await pedir({page:PAG,days:7},ADMIN,{...ENT,GSC_SERVICE_ACCOUNT_JSON:"{esto no es json"});assert.equal(r.s,502);assert.equal(r.texto.includes("esto no es json"),false);assert.equal(v.token.length,0);});
});
test("gsc: usa la llave de Supabase que funcione (la de la app, la nueva o la anterior)",async()=>{
 await conServicios({llaveBuena:"sb_publishable_app"},async v=>{
  const r=await pedir({page:PAG,days:7},ADMIN,{...ENT,SUPABASE_PUBLISHABLE_KEYS:JSON.stringify({default:"sb_publishable_app"})},{apikey:"llave-inventada"});
  assert.equal(r.s,200);assert.deepEqual(v.supabase,["llave-inventada","sb_publishable_app"]);
 });
 await conServicios({llaveBuena:"ninguna"},async v=>{const r=await pedir({page:PAG,days:7});assert.equal(r.s,401);assert.equal(v.token.length,0);});
});
test("gsc: consulta previa del navegador (CORS) y métodos",async()=>{
 const o=await gsc(new Request("https://f.test/gsc",{method:"OPTIONS",headers:{"Access-Control-Request-Headers":"authorization, apikey, content-type, x-otra"}}),k=>ENT[k]);
 assert.equal(o.status,200);assert.ok(o.headers.get("Access-Control-Allow-Headers").includes("x-otra"));
 assert.equal((await gsc(new Request("https://f.test/gsc",{method:"GET"}),k=>ENT[k])).status,405);
});
