'use strict';
// Reuse shipped art and the two verified, unmodified JPEGs referenced below.
// Other missing game art gets clearly labelled generic SVG symbols.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = __dirname;
const iconDir = path.join(root, 'dist/icons');
const genericDir = path.join(iconDir, 'treasure');
fs.mkdirSync(genericDir, { recursive: true });
const bundlePath = path.join(root, 'dist/assets/index-CGBfnq9b.js');
const bundle = fs.readFileSync(bundlePath, 'utf8');
const start = bundle.indexOf('Om={') + 3;
const end = bundle.indexOf('},si={', start) + 1;
if (start < 3 || end <= start) throw new Error('Could not locate the existing inline asset dictionary');
// The minifier leaves some ASCII keys unquoted. Read only static PNG string
// literals rather than evaluating the compiled object or the surrounding app.
const inline = Object.fromEntries([...bundle.slice(start, end).matchAll(/(?:"([^"\\]+)"|([A-Za-z_$\u4e00-\u9fff][\w$\u4e00-\u9fff]*)):"(data:image\/png;base64,[A-Za-z0-9+/=]+)"/g)].map(match => [match[1] || match[2], match[3]]));
if (Object.keys(inline).length !== 79) throw new Error('Unexpected inline PNG inventory; review the current app before extraction');
const extracted = [];
for (const [name, data] of Object.entries(inline)) {
  if (!/^[\w\u4e00-\u9fff]+$/.test(name)) continue;
  const found = fs.readdirSync(iconDir).find(file => path.parse(file).name === name && /\.png$/i.test(file));
  if (found) continue;
  if (!/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(data)) continue;
  const file = name + '.png';
  fs.writeFileSync(path.join(iconDir, file), Buffer.from(data.split(',')[1], 'base64'));
  extracted.push(file);
}
const symbols = {
  'coins.svg': ['梦幻币通用示意图', '<g fill="#e8b943" stroke="#a97624"><ellipse cx="26" cy="45" rx="18" ry="8"/><path d="M8 38v7c0 10 36 10 36 0v-7"/><ellipse cx="26" cy="38" rx="18" ry="8"/><path d="M8 31v7c0 10 36 10 36 0v-7"/><ellipse cx="26" cy="31" rx="18" ry="8"/><ellipse cx="42" cy="22" rx="13" ry="13"/></g><path d="M38 18h8v8h-8z" fill="#fff0af" stroke="#a97624"/>'],
  'beans.svg': ['花豆通用示意图', '<g stroke="#fff" stroke-width="2"><ellipse cx="22" cy="21" rx="9" ry="13" transform="rotate(-28 22 21)" fill="#d65e72"/><ellipse cx="43" cy="24" rx="9" ry="13" transform="rotate(30 43 24)" fill="#a38ac3"/><ellipse cx="20" cy="45" rx="9" ry="13" transform="rotate(30 20 45)" fill="#d9b24c"/><ellipse cx="42" cy="46" rx="9" ry="13" transform="rotate(-30 42 46)" fill="#76a270"/></g><path d="M18 16q8 3 5 10M42 17q-5 6 0 12M18 38q6 3 4 11M40 40q6 4 2 10" fill="none" stroke="#fff" opacity=".65"/>'],
  'equipment.svg': ['低级装备通用示意图', '<path d="m29 12 19 7v17c0 9-8 16-19 21-11-5-19-12-19-21V19z" fill="#92a9ba" stroke="#607b8e"/><path d="m29 20 12 4v12c0 6-5 11-12 15-7-4-12-9-12-15V24z" fill="#d8e0e6"/><path d="m43 10 10 10-23 23-6-6z" fill="#f0e8d0" stroke="#a3977c"/><path d="m20 33 14 14M27 40l-8 8" stroke="#805d39" stroke-width="5"/>'],
  'pet.svg': ['召唤兽通用轮廓示意图', '<g fill="#96a9bf" stroke="#667d96"><ellipse cx="18" cy="21" rx="7" ry="10" transform="rotate(-25 18 21)"/><ellipse cx="34" cy="16" rx="7" ry="10"/><ellipse cx="49" cy="24" rx="7" ry="10" transform="rotate(25 49 24)"/><path d="M15 48c0-8 9-13 12-18 3-4 8-4 11 0 4 5 13 9 13 18 0 9-10 7-18 4-9 4-18 4-18-4z"/></g>'],
  'flower.svg': ['花卉通用示意图', '<path d="M32 34v23M31 46q-13-16-20-8 3 13 20 13M33 48q13-16 20-8-3 13-20 13" fill="#86aa78" stroke="#547b4b"/><g fill="#e6a6b7" stroke="#ba6e86"><ellipse cx="32" cy="20" rx="9" ry="14"/><ellipse cx="32" cy="20" rx="9" ry="14" transform="rotate(60 32 28)"/><ellipse cx="32" cy="20" rx="9" ry="14" transform="rotate(120 32 28)"/></g><circle cx="32" cy="27" r="6" fill="#e5bd52"/>'],
  'furniture.svg': ['家具通用示意图', '<path d="M12 30h41v9H12zM17 39v17M48 39v17" fill="#c49a68" stroke="#805d3e" stroke-width="4"/><path d="M17 30V11h31v19M21 20h23" fill="none" stroke="#a27749" stroke-width="7"/>'],
  'potion.svg': ['药品烹饪通用示意图', '<path d="M17 10h15v9l7 9v22c0 6-29 6-29 0V28l7-9z" fill="#b5caa6" stroke="#738d62"/><path d="M17 10h15M13 34h23" stroke="#738d62" stroke-width="5"/><path d="M21 39v10M16 44h10" stroke="#f6f2da" stroke-width="3"/><path d="M36 37h22c-1 15-21 15-22 0z" fill="#c68c62" stroke="#8d5a38"/><path d="M40 31q-4-4 0-8M49 30q-4-4 0-8" fill="none" stroke="#b1a18b"/>'],
  'person.svg': ['找人通用示意图', '<circle cx="29" cy="20" r="11" fill="#bf9d80"/><path d="M8 56V43c0-17 42-17 42 0v13" fill="#88a5b7" stroke="#607c91"/><path d="m40 43 9 9 11-20" fill="none" stroke="#d6b85e" stroke-width="5"/>'],
  'cost.svg': ['成本通用示意图', '<path d="M16 8h32v49l-5-4-5 4-6-4-6 4-5-4-5 4z" fill="#eee4c9" stroke="#b39f7f"/><path d="M23 20h18M23 28h18M23 36h9" stroke="#9e8a6c" stroke-width="3"/><circle cx="42" cy="43" r="12" fill="#c77b6f"/><path d="M35 43h14" stroke="#fff" stroke-width="3"/>'],
  'bowl.svg': ['钵通用示意图', '<ellipse cx="32" cy="25" rx="25" ry="10" fill="#cfab62" stroke="#927244"/><path d="M7 25c3 33 47 33 50 0-9 12-41 12-50 0z" fill="#b89555" stroke="#927244"/><ellipse cx="32" cy="25" rx="18" ry="5" fill="#826a42"/>'],
  'flute.svg': ['箫通用示意图', '<path d="m18 55-8-6 35-42 9 7z" fill="#ac8751" stroke="#785c36"/><path d="m16 46 8 6M24 36l8 6M32 26l8 6M40 16l8 6" stroke="#d5bc86" stroke-width="3"/><g fill="#554431"><circle cx="24" cy="41" r="2"/><circle cx="30" cy="34" r="2"/><circle cx="36" cy="27" r="2"/></g>'],
  'battle-token.svg': ['战魄通用示意图', '<path d="m32 6 7 14 17 3-12 12 3 18-15-8-15 8 3-18L8 23l17-3z" fill="#b29ac0" stroke="#7e648e"/><path d="m32 18 8 12-8 13-8-13z" fill="#e1d4e9"/>']
};
for (const [file, [label, drawing]] of Object.entries(symbols)) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64" role="img"><title>${label}</title><rect x="1" y="1" width="62" height="62" rx="10" fill="#f3f0e7" stroke="#ded7c7"/>${drawing}</svg>\n`;
  fs.writeFileSync(path.join(genericDir, file), svg);
}
const known = {};
for (const file of fs.readdirSync(iconDir)) {
  if (/^[\w\u4e00-\u9fff]+\.png$/i.test(file) && fs.statSync(path.join(iconDir, file)).isFile()) known[path.parse(file).name] = './icons/' + file;
}
const digest = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const downloaded = [
  { name: '制造指南书', src: './icons/treasure/zhizao-zhinanshu.jpg', imageUrl: 'https://i2.sinaimg.cn/gm/ol/mhxy/new/item002.jpg', sha256: 'a8259d462a4f8e87f15384ad0580cbf55ea45502cb393892ed7d98c34e6b8c4d' },
  { name: '百炼精铁', src: './icons/treasure/bailian-jingtie.jpg', imageUrl: 'https://i1.sinaimg.cn/gm/ol/mhxy/new/item001.jpg', sha256: '91a0770e1cb15e7dfb74e6d96e2ccdb4642db0c6b649ac1202c99a335682498f' }
].map(item => ({ ...item, kind: 'asset', sourcePage: 'https://games.sina.com.cn/z/xyq/2/mfjn/index.shtml', sourcePageTitle: '技能大全：打造原料 — 新浪游戏《梦幻西游》官方网站合作专区', retrievedAt: '2026-10-27', contentType: 'image/jpeg', width: 120, height: 120, modified: false, visualVerification: 'Downloaded independent image viewed locally. Classic PC-game item art; no visible level numeral, shared across levels. Not a screenshot crop or generated illustration.', rights: 'Game-art rights remain with the relevant rightsholder, including NetEase; the hosting page supplies no open redistribution license. Not covered by the project MIT license.' }));
for (const item of downloaded) {
  const file = path.join(root, 'dist', item.src);
  if (!fs.existsSync(file) || digest(file) !== item.sha256) throw new Error('Verified downloaded image missing or changed: ' + item.name);
}
const files = { ...known, ...Object.fromEntries(downloaded.map(item => [item.name, item.src])) };
const resolver = `(function(root){
  'use strict';
  const files=Object.freeze(${JSON.stringify(files)});
  const own=(object,key)=>Object.prototype.hasOwnProperty.call(object,key);
  const asset=(key,label)=>({src:files[key],kind:'asset',label:label||key});
  const generic=(file,label)=>({src:'./icons/treasure/'+file,kind:'generic',label:label+'（通用示意图）'});
  function resolve(value){
    const item=value&&typeof value==='object'?value:{};
    const rawName=typeof item.name==='string'?item.name.trim():'';
    // Ledger display names may carry a source/map prefix and quantity suffix.
    // Only the resulting name is matched against the fixed local whitelist.
    const name=rawName.split('·').pop().replace(/×\\s*[0-9]+(?:\\.[0-9]+)?\\s*$/,'').trim();
    const category=typeof item.category==='string'?item.category.trim():'';
    const kind=typeof item.kind==='string'?item.kind:'';
    if(kind==='pet'||category==='召唤兽'||category==='场景召唤兽'||category==='pet'){
      // Only our appended numeric skill-count annotation is presentation data.
      // Native form/state parentheses (black/white, past/future, etc.) belong to
      // the whitelisted pet identity and must never be removed generically.
      const petName=name.replace(/(?:（(?:0|[1-9][0-9]?)技能）|\\((?:0|[1-9][0-9]?)技能\\))$/,'').trim();
      const petIcons=typeof module==='object'&&module.exports?require('./scene-pet-icons.js'):root.scenePetIcons;
      return petIcons?.resolve({...item,name:petName})||generic('pet.svg','召唤兽');
    }
    if(kind==='cost'||category==='成本'||category==='cost')return generic('cost.svg','成本');
    if(item.cash===true||kind==='gold'||['现金','金币','梦幻币'].includes(category)||['梦幻币','金币','现金'].includes(name))return generic('coins.svg','梦幻币');
    if(kind==='灵饰书')return asset('灵饰指南书');
    if(kind==='灵饰铁')return asset('元灵晶石');
    if(kind==='修炼果')return asset('修炼果');
    if(kind==='战魄'||name==='战魄')return generic('battle-token.svg','战魄');
    if(own(files,name))return asset(name);
    const graded=name.match(/^\\d{1,3}级(.+)$/);
    if(graded&&own(files,graded[1]))return asset(graded[1]);
    if(name==='玫瑰')return asset('红玫瑰');
    if(/高级.*(?:兽诀|兽决|要诀)/.test(category)||/高级.*(?:兽诀|兽决|要诀)/.test(name))return asset('高级魔兽要诀');
    if(/低级.*(?:兽诀|兽决|要诀)/.test(category)||/低级.*(?:兽诀|兽决|要诀)/.test(name))return asset('低级兽诀');
    if(/高级.*内丹/.test(category)||/高级.*内丹/.test(name))return asset('高级召唤兽内丹');
    if(/低级.*内丹/.test(category)||/低级.*内丹/.test(name)||category==='召唤兽内丹')return asset('召唤兽内丹');
    // Precise item/reward aliases only; beast books and ancient plans above
    // keep their own pictures instead of being caught by a broad "book" rule.
    if(kind==='书'||['制造指南书','制造书'].includes(category)||/^(?:\\d{1,3}级?)?(?:制造指南书|制造书|打造书|书)$/.test(name)||/^(?:制造指南书|制造书|打造书)\\d{1,3}级?$/.test(name))return asset('制造指南书');
    if(kind==='铁'||category==='百炼精铁'||/^(?:\\d{1,3}级?)?(?:百炼精铁|铁)$/.test(name)||/^百炼精铁\\d{1,3}级?$/.test(name))return asset('百炼精铁');
    if(name==='花豆'||category==='花豆')return generic('beans.svg','花豆');
    const equip=name.match(/^(60|70|80)级?(武器|防具|装备)$/);
    if(equip)return asset(equip[1]+(equip[2]==='武器'?'武器':'防具'));
    if(category==='低级装备'||/10[～~至-]50级装备/.test(name)||category==='装备')return generic('equipment.svg','装备');
    if(name==='找人'||category==='person')return generic('person.svg','找人');
    if(/家具/.test(name)||category==='furniture')return generic('furniture.svg','家具');
    if(/三药|烹饪|药品/.test(name)||category==='potion')return generic('potion.svg','药品烹饪');
    if(name==='牡丹'||category==='flower')return generic('flower.svg','花卉');
    if(name==='钵')return generic('bowl.svg','钵');
    if(name==='箫')return generic('flute.svg','箫');
    if(['垃圾变异','指定变异','指定普通'].includes(name))return generic('pet.svg','召唤兽');
    return {src:files['其他'],kind:'fallback',label:'其他物品（通用图）'};
  }
  const api={resolve};
  if(typeof module==='object'&&module.exports)module.exports=api;
  else {root.treasureIcons=api;root.itemIcons=api;}
})(typeof window==='object'?window:globalThis);\n`;
fs.writeFileSync(path.join(root, 'dist/assets/treasure-icons.js'), resolver);
const manifest = {
  generatedBy: 'build-treasure-icons.cjs',
  source: 'Existing dist/icons/current app inline Om dictionary plus two verified unmodified PC-game item JPEGs from the Sina official-cooperation section. Other missing art remains labelled generic.',
  inspectedRelatedAssets: '../ui-work/dist/icons matches the same 79-image set; no extra matching original game pictures in local backup assets',
  extracted,
  reused: Object.entries(known).map(([name, src]) => ({ name, src, kind: 'asset', sha256: digest(path.join(root, 'dist', src)) })),
  downloaded,
  retiredGeneric: ['book.svg', 'metal.svg'],
  generic: Object.entries(symbols).map(([file, [label]]) => ({ src: './icons/treasure/' + file, kind: 'generic', label, provenance: 'Code-authored semantic SVG, not original game artwork', sha256: digest(path.join(genericDir, file)) }))
};
fs.writeFileSync(path.join(genericDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log('Item icons: ' + Object.keys(known).length + ' existing PNGs, ' + downloaded.length + ' verified downloaded JPEGs, ' + Object.keys(symbols).length + ' labelled generic SVGs, ' + extracted.length + ' PNGs extracted.');
