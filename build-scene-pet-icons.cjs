'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=__dirname,dir=path.join(root,'dist/icons/scene-pets');
const scenes=['无名鬼城','青丘','银华境','须弥东界','鬼市','五行山'];
const pets=require('./dist/assets/scene-data.js').pets.filter(p=>p.scenes.some(s=>scenes.includes(s)));
const normalize=name=>String(name||'').trim().replace(/（/g,'(').replace(/）/g,')');
const input=['base-sources.json','new-sources.json',...(fs.existsSync(path.join(dir,'extra-sources.json'))?['extra-sources.json']:[])].flatMap(file=>{
  const data=JSON.parse(fs.readFileSync(path.join(dir,file),'utf8'));
  return Array.isArray(data)?data:data.items;
});
const ids=new Set();
const items=input.map(item=>{
  const pet=pets.find(p=>String(p.id)===String(item.id));
  if(!pet||normalize(pet.name)!==normalize(item.name)||ids.has(String(item.id)))throw Error('Invalid/duplicate pet identity: '+JSON.stringify(item));
  ids.add(String(item.id));
  if(!/^\.\/icons\/scene-pets\/\d+\.(png|gif|jpe?g|webp)$/i.test(item.src))throw Error('Unsafe image path: '+item.src);
  if(!item.sourcePage||!item.imageUrl||!item.sha256)throw Error('Image provenance incomplete: '+item.name);
  const bytes=fs.readFileSync(path.join(root,'dist',item.src));
  const sha256=crypto.createHash('sha256').update(bytes).digest('hex');
  if(sha256!==item.sha256.toLowerCase())throw Error('Image hash mismatch: '+item.name);
  if(item.renderCrop){const c=item.renderCrop;if(![c.x,c.y,c.width,c.height].every(Number.isFinite)||c.x<0||c.y<0||c.width<=0||c.height<=0||c.x+c.width>item.width||c.y+c.height>item.height)throw Error('Invalid render viewport: '+item.name);}
  return {...item,id:String(item.id),name:pet.name,kind:'asset',scenes:pet.scenes.filter(s=>scenes.includes(s)),sha256};
}).sort((a,b)=>Number(a.id)-Number(b.id));
const missing=pets.filter(p=>!ids.has(String(p.id))).map(p=>({id:p.id,name:p.name}));
if(missing.length)throw Error('Missing scene pet artwork: '+JSON.stringify(missing));
const byId=Object.fromEntries(items.map(item=>{const c=item.renderCrop,r=c?c.width/c.height:1,vertical=Math.max(0,(1-1/r)*50),horizontal=Math.max(0,(1-r)*50);return [item.id,{id:item.id,name:item.name,src:item.src,label:item.name+(item.variantLabel?' · '+item.variantLabel:''),viewBox:c?[(c.y/item.height)*100,((item.width-c.x-c.width)/item.width)*100,((item.height-c.y-c.height)/item.height)*100,(c.x/item.width)*100]:null,viewClip:c?[vertical,horizontal,vertical,horizontal]:null}];}));
const byName=Object.fromEntries(items.map(item=>[normalize(item.name),item.id]));
const output=`(function(root){
  'use strict';
  const byId=Object.freeze(${JSON.stringify(byId)}),byName=Object.freeze(${JSON.stringify(byName)});
  const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
  const normalize=name=>String(name||'').trim().replace(/（/g,'(').replace(/）/g,')');
  function resolve(item){
    if(!item||typeof item!=='object')return null;
    const name=normalize(item.name),id=String(item.id||'');
    // IDs only match their expected name; record IDs must not select unrelated art.
    const key=own(byId,id)&&normalize(byId[id].name)===name?id:own(byName,name)?byName[name]:null;
    if(!key)return null;
    const value=byId[key];return {src:value.src,kind:'asset',label:value.label,petId:value.id,viewBox:value.viewBox,viewClip:value.viewClip};
  }
  const api={resolve,count:Object.keys(byId).length};
  if(typeof module==='object'&&module.exports)module.exports=api;else root.scenePetIcons=api;
})(typeof window==='object'?window:globalThis);\n`;
fs.writeFileSync(path.join(root,'dist/assets/scene-pet-icons.js'),output);
fs.writeFileSync(path.join(dir,'manifest.json'),JSON.stringify({generatedBy:'build-scene-pet-icons.cjs',scenes,count:items.length,items,rights:'Original game artwork remains owned by its respective rights holders, including NetEase. Public availability does not establish an open redistribution license; not covered by this project MIT license.'},null,2));
console.log('PASS: '+items.length+' scene pets have name-matched, hashed local artwork.');
