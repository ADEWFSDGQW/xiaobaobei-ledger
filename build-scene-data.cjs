const fs = require('node:fs');
const path = require('node:path');
const digits = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
function floorNumber(raw) {
  if (/^\d+$/.test(raw)) return Number(raw);
  if (raw === '十') return 10;
  if (raw.length === 1 && digits[raw]) return digits[raw];
  const parts = raw.match(/^([一二三四五六七八九])?十([一二三四五六七八九])?$/);
  return parts ? (parts[1] ? digits[parts[1]] : 1) * 10 + (parts[2] ? digits[parts[2]] : 0) : NaN;
}
function scenes(raw) {
  if (/^(不会出现|无固定场景|.*天气随机出现)$/.test(raw)) return [];
  const result = [];
  let prefix = '';
  for (let part of raw.replace(/地府迷宫/g, '地狱迷宫').replace(/[（）()]/g, '').split(/[，,、]/)) {
    // Convert only the trailing floor-number captures, never characters in
    // map names: 五行山 must remain 五行山 instead of becoming 5行山.
    part = part.trim();
    const match = part.match(/^(.*?)([\d一二三四五六七八九十]+)(?:[~～]([\d一二三四五六七八九十]+))?(?:层)?$/);
    if (match && (match[1] || prefix)) {
      prefix = match[1] || prefix;
      const from = floorNumber(match[2]), to = floorNumber(match[3] || match[2]);
      if (!Number.isInteger(from) || !Number.isInteger(to) || from < 1 || to < from || to > 99) throw new Error('楼层编号不正确：' + part);
      for (let i = from; i <= to; i++) result.push(prefix + i + '层');
    } else { prefix = ''; if (part) result.push(part); }
  }
  return [...new Set(result)];
}
function build(source) {
  // The shipped records retain their original raw scene text. If the original
  // zhsInfo.js is unavailable, rebuilding only the derived scene arrays from
  // those unchanged raw fields preserves every other local data field.
  const existing = source ? null : require('./dist/assets/scene-data.js');
  const rawPets = source ? Object.entries(require(path.resolve(source)).zhsTable).map(([id, pet]) => ({ id, ...pet })) : existing.pets;
  const pets = rawPets.map(pet => ({ ...pet, scenes: scenes(pet.scene) }));
  const data = { source: existing ? existing.source : '金算盘源码 zhsInfo.js', pets, scenes: [...new Set(pets.flatMap(p => p.scenes))].sort((a, b) => a.localeCompare(b, 'zh-CN')) };
  fs.writeFileSync(path.join(__dirname, 'dist/assets/scene-data.js'), '(function(root){const data=' + JSON.stringify(data) + ';if(typeof module==="object"&&module.exports)module.exports=data;else root.sceneData=data;})(globalThis);\n');
  console.log(`${pets.length} 条召唤兽，${data.scenes.length} 个场景`);
  return data;
}
if (require.main === module) build(process.argv[2]);
module.exports = { scenes, build };
