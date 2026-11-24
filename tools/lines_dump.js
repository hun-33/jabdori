// src/01-core.js의 캐릭터 대사를 꺼내 JSON으로 출력 (목소리 대본·검수용)
const fs = require('fs');
const s = fs.readFileSync(__dirname + '/../src/01-core.js', 'utf8');
const a = s.indexOf('const MIREUM_VOCALS'), b = s.indexOf('/* ---------- 캐릭터 목록');
const C = new Function(s.slice(a, b) + '; return CHAR_MIREUM;')();
const out = [];
const walk = (o, k) => {
  if (typeof o === 'string') out.push({ id: k, tpl: o });
  else if (Array.isArray(o)) o.forEach((x, i) => walk(x, `${k}.${i}`));
  else for (const kk in o) walk(o[kk], k ? `${k}.${kk}` : kk);
};
walk(C.lines, '');
console.log(JSON.stringify({ lines: out, vocals: Object.keys(C.vocals) }));
