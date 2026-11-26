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
