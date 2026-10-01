(function (root) {
  'use strict';
  const columns = ['物品ID', '物品名称', '价格（万）', '分类'];
  function decodeText(buffer, fileName = '价格.csv') {
    const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    const bomEncoding = bytes[0] === 0xff && bytes[1] === 0xfe ? 'utf-16le'
      : bytes[0] === 0xfe && bytes[1] === 0xff ? 'utf-16be'
      : bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf ? 'utf-8' : null;
    const encodings = bomEncoding ? [bomEncoding] : ['utf-8', 'gb18030', 'big5', 'utf-16le', 'utf-16be'];
    let utf8Text;
    for (const encoding of encodings) {
      try {
        const text = new TextDecoder(encoding, { fatal: true }).decode(bytes).replace(/^\uFEFF/, '');
        if (encoding === 'utf-8') utf8Text = text;
        if (/\.json$/i.test(fileName)) {
          if (!Array.isArray(JSON.parse(text))) continue;
        } else parseCsv(text);
        return text;
      } catch (_) { /* Try the next encoding, validating the decoded headers. */ }
    }
    // Preserve a useful missing-header error for readable UTF-8 files.
    if (utf8Text && !utf8Text.includes('\u0000')) {
      if (/\.json$/i.test(fileName)) JSON.parse(utf8Text);
      else parseCsv(utf8Text);
    }
    throw new Error('无法识别文件编码或表头。支持 UTF-8、GBK/GB2312/GB18030、Big5、UTF-16。请用 Excel/WPS 另存为 CSV UTF-8，并保留导出表头。');
  }
  function cell(value) {
    return '"' + String(value == null ? '' : value).replace(/"/g, '""') + '"';
  }
  function exportCsv(items) {
    return '\uFEFF' + [columns, ...items.map(item => [item.id, item.name, item.price, item.category])]
      .map(row => row.map(cell).join(',')).join('\r\n') + '\r\n';
  }
  function parseCsv(text) {
    text = String(text).replace(/^\uFEFF/, '');
    const rows = [];
    let row = [], field = '', quoted = false;
    for (let n = 0; n < text.length; n++) {
      const c = text[n];
      if (c === '"') {
        if (quoted && text[n + 1] === '"') { field += '"'; n++; }
        else if (quoted || field === '') quoted = !quoted;
        else throw new Error('CSV 引号格式不正确');
      } else if (!quoted && (c === ',' || c === '\t')) {
        row.push(field); field = '';
      } else if (!quoted && (c === '\r' || c === '\n')) {
        row.push(field); field = '';
        if (row.some(value => value.trim() !== '')) rows.push(row);
        row = [];
        if (c === '\r' && text[n + 1] === '\n') n++;
      } else field += c;
    }
    if (quoted) throw new Error('CSV 引号未闭合，请重新另存为 CSV 文件');
    row.push(field);
    if (row.some(value => value.trim() !== '')) rows.push(row);
    if (!rows.length) throw new Error('价格清单为空');
    const normalize = value => value.trim().replace(/[\s\uFEFF]/g, '').replace(/\(/g, '（').replace(/\)/g, '）').toLowerCase()
      .replace(/名稱/g, '名称').replace(/價格/g, '价格').replace(/萬/g, '万').replace(/分類/g, '分类');
    const header = rows.shift().map(normalize);
    const indexes = columns.map(title => header.indexOf(normalize(title)));
    if (indexes.some(index => index < 0)) throw new Error('请保留导出表格的四列表头：' + columns.join('、'));
    return rows.map((values, index) => ({
      id: values[indexes[0]], name: values[indexes[1]],
      price: values[indexes[2]], category: values[indexes[3]], row: index + 2
    }));
  }
  function prepareImport(text, fileName, items) {
    const records = /\.json$/i.test(fileName) ? JSON.parse(text.replace(/^\uFEFF/, '')) : parseCsv(text);
    if (!Array.isArray(records)) throw new Error('价格清单必须是表格或 JSON 数组');
    const updates = [], seen = new Set();
    let skipped = 0;
    records.forEach((record, index) => {
      const line = record?.row || index + 1;
      if (!record || typeof record !== 'object') throw new Error('第 ' + line + ' 行格式不正确');
      const id = String(record.id == null ? '' : record.id).trim();
      const name = String(record.name == null ? '' : record.name).trim();
      const target = items.findIndex(item => id && String(item.id) === id);
      const itemIndex = target >= 0 ? target : items.findIndex(item => item.name === name);
      if (itemIndex < 0) throw new Error('第 ' + line + ' 行物品未找到：' + (name || id));
      if (target >= 0 && name && items[target].name !== name) throw new Error('第 ' + line + ' 行物品ID与名称不一致，请保留原物品名称');
      const value = record.price;
      if (value == null || String(value).trim() === '') { skipped++; return; }
      if (!['string', 'number'].includes(typeof value)) throw new Error('第 ' + line + ' 行价格应填写数字');
      const number = Number(String(value).trim());
      if (!Number.isFinite(number) || number < 0) throw new Error('第 ' + line + ' 行价格应为大于或等于 0 的数字，单位为万');
      if (seen.has(itemIndex)) throw new Error('第 ' + line + ' 行物品重复：' + items[itemIndex].name);
      seen.add(itemIndex);
      updates.push({ index: itemIndex, price: number });
    });
    if (!updates.length) throw new Error('没有可导入的价格，请在价格（万）列填写数字');
    return { updates, skipped };
  }
  const api = { decodeText, exportCsv, parseCsv, prepareImport };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.priceListCodec = api;
})(typeof window === 'object' ? window : globalThis);
