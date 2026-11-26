// @ts-nocheck
// Función de Supabase «gsc»: Google Search Console en SOLO LECTURA, para quien administra la parrilla y solo sobre la
// propiedad configurada. Secretos (nunca en el navegador ni en Git): GSC_SERVICE_ACCOUNT_JSON y GSC_SITE_URL.
// Quién llama se comprueba aquí mismo con su sesión (es_admin en la base, que valida la firma del token); por eso
// funciona igual con la verificación de JWT de la puerta de Supabase activada o desactivada.
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
const reply=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json","Cache-Control":"no-store"}});
const enc=new TextEncoder();
const base64url=(bytes)=>btoa(String.fromCharCode(...bytes)).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
const encode=(v)=>base64url(enc.encode(JSON.stringify(v)));
async function token(account){
 if(!account.client_email||!account.private_key)throw Error("Cuenta de servicio incompleta.");
 const now=Math.floor(Date.now()/1000);
 const jwt=encode({alg:"RS256",typ:"JWT"})+"."+encode({iss:account.client_email,scope:"https://www.googleapis.com/auth/webmasters.readonly",aud:"https://oauth2.googleapis.com/token",iat:now,exp:now+3600});
 const pem=account.private_key.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g,"");
 const raw=Uint8Array.from(atob(pem),c=>c.charCodeAt(0));
 const key=await crypto.subtle.importKey("pkcs8",raw,{name:"RSASSA-PKCS1-v1_5",hash:"SHA-256"},false,["sign"]);
 const signature=base64url(new Uint8Array(await crypto.subtle.sign("RSASSA-PKCS1-v1_5",key,enc.encode(jwt))));
 const r=await fetch("https://oauth2.googleapis.com/token",{method:"POST",body:new URLSearchParams({grant_type:"urn:ietf:params:oauth:grant-type:jwt-bearer",assertion:jwt+"."+signature}),signal:AbortSignal.timeout(12000)});
 const d=await r.json().catch(()=>({}));
 if(!r.ok||!d.access_token)throw Error("Google no autorizó la cuenta de servicio. Revisa sus credenciales.");
 return d.access_token;
}
const date=d=>d.toISOString().slice(0,10);
export function windows(days,now=new Date()){
 const end=new Date(now.getTime()-3*86400000);
 const start=new Date(end.getTime()-(days-1)*86400000);
 const prevEnd=new Date(start.getTime()-86400000),prevStart=new Date(prevEnd.getTime()-(days-1)*86400000);
 return {current:{startDate:date(start),endDate:date(end)},previous:{startDate:date(prevStart),endDate:date(prevEnd)}};
}
export function pageAllowed(page,site){
 try{
  const u=new URL(page);if(u.protocol!=="https:"||u.username||u.password||u.hash)return false;
  if(site.startsWith("sc-domain:")){const host=site.slice(10).toLowerCase();return !!host&&(u.hostname===host||u.hostname.endsWith("."+host));}
  const p=new URL(site);return u.origin===p.origin&&u.pathname.startsWith(p.pathname.endsWith("/")?p.pathname:p.pathname+"/");
 }catch{return false;}
}
export async function handle(req,env){
 if(req.method==="OPTIONS")return new Response("ok",{headers:{...cors,"Access-Control-Allow-Headers":req.headers.get("Access-Control-Request-Headers")||cors["Access-Control-Allow-Headers"]}});
 if(req.method!=="POST")return reply({error:"Método no permitido"},405);
 try{
  const auth=req.headers.get("Authorization")||"",sb=String(env("SUPABASE_URL")||"").replace(/\/+$/,"");
  if(!/^Bearer .+/i.test(auth))return reply({error:"Tu sesión en la app ya no es válida. Cierra sesión, vuelve a entrar e inténtalo de nuevo."},401);
  // Llave pública de Supabase: la que manda la app, la nueva (publicable) o la de antes; se usa la primera que la base acepte
  const dic=(k)=>{try{const o=JSON.parse(env(k)||"null");return o&&typeof o==="object"?String(o.default||Object.values(o)[0]||""):"";}catch{return "";}};
  const llaves=[...new Set([req.headers.get("apikey"),dic("SUPABASE_PUBLISHABLE_KEYS"),env("SUPABASE_ANON_KEY")].map(x=>String(x||"").trim()).filter(Boolean))];
  let check=null;
  for(const k of llaves){check=await fetch(sb+"/rest/v1/rpc/es_admin",{method:"POST",headers:{Authorization:auth,apikey:k,"Content-Type":"application/json"},body:"{}",signal:AbortSignal.timeout(10000)});if(check.status!==401)break;}
  if(!check||check.status===401)return reply({error:"Tu sesión en la app ya no es válida. Cierra sesión, vuelve a entrar e inténtalo de nuevo."},401);
  if(!check.ok||await check.json().catch(()=>false)!==true)return reply({error:"Solo quien administra la parrilla puede consultar Search Console."},403);
  const site=String(env("GSC_SITE_URL")||"").trim(),secret=env("GSC_SERVICE_ACCOUNT_JSON");
  if(!site||!secret)return reply({error:"Falta configurar Google Search Console en Supabase.",setup:true},503);
  const b=await req.json().catch(()=>({})),page=String(b.page||"").trim(),days=[7,28,90].includes(b.days)?b.days:28;
  if(!pageAllowed(page,site))return reply({error:"La URL no pertenece a la propiedad configurada."},400);
  const access=await token(JSON.parse(secret)),range=windows(days);
  const query=async(period,dimensions=[],rowLimit=100)=>{
   const url="https://www.googleapis.com/webmasters/v3/sites/"+encodeURIComponent(site)+"/searchAnalytics/query";
   const r=await fetch(url,{method:"POST",headers:{Authorization:"Bearer "+access,"Content-Type":"application/json"},body:JSON.stringify({...period,type:"web",dataState:"final",dimensions,rowLimit,dimensionFilterGroups:[{filters:[{dimension:"page",operator:"equals",expression:page}]}]}),signal:AbortSignal.timeout(15000)});
   if(!r.ok)throw Error("Search Console respondió "+r.status+". Revisa el acceso de lectura a la propiedad.");
   const d=await r.json();return Array.isArray(d.rows)?d.rows:[];
  };
  const [current,previous,queries,series]=await Promise.all([query(range.current),query(range.previous),query(range.current,["query"],50),query(range.current,["date"],100)]);
  return reply({ok:true,page,range,current:current[0]||null,previous:previous[0]||null,queries,series});
 }catch(e){return reply({error:"No se pudo consultar Search Console. "+(e instanceof Error&&/^(Google no autoriz|Search Console respondió|Cuenta de servicio)/.test(e.message)?e.message:"Revisa la configuración y vuelve a intentar.")},502);}
}
if(typeof Deno!=="undefined"&&Deno.serve)Deno.serve(req=>handle(req,k=>Deno.env.get(k)));
