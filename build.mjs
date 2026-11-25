// src/ 를 합쳐 하나의 index.html 로 만든다 (Node.js만 있으면 됨 — 윈도우·맥 공통)
//  - dist/ : 웹(PWA) 버전
//  - www/  : 안드로이드 앱 버전 (Capacitor가 앱 안에 넣는 폴더, dist와 같은 내용)
// 사용: npm run build   (= node build.mjs && npx cap sync android)
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, rmSync, cpSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const src = join(root, 'src');
const read = (p) => readFileSync(p, 'utf8');

const html = read(join(src, 'index.html'));
const css = read(join(src, 'styles.css')) + '\n' + read(join(src, 'mireum.css'));
const order = ['00-native.js', '01-core.js', '01b-mireum.js', '02-views.js', '03-sheets.js', '04-app.js', '04b-input.js', '04c-voice.js', '04d-account.js', '05-native.js', '05b-voice-pack.js', '05c-watch.js'];
const js = order.map((f) => read(join(src, f))).join('\n');
const capPath = join(root, 'node_modules/@capacitor/core/dist/capacitor.js');
const capjs = (existsSync(capPath) ? read(capPath) : read(join(src, 'vendor-capacitor.js'))).split('\n//# sourceMappingURL')[0];
// replace에 함수를 넘겨 $ 기호가 특수 문자로 해석되지 않게 한다
const out = html.replace('/*STYLE*/', () => css).replace('/*CAPACITOR*/', () => capjs).replace('/*SCRIPT*/', () => js);

const dist = join(root, 'dist');
mkdirSync(dist, { recursive: true });
writeFileSync(join(dist, 'index.html'), out, 'utf8');
for (const f of ['manifest.webmanifest', 'sw.js']) copyFileSync(join(src, f), join(dist, f));
// 캐릭터 목소리 파일 (src/voice/<캐릭터>/*.mp3) → dist/voice
if (existsSync(join(src, 'voice'))) { rmSync(join(dist, 'voice'), { recursive: true, force: true }); cpSync(join(src, 'voice'), join(dist, 'voice'), { recursive: true }); }
console.log('dist/index.html', Buffer.byteLength(out), 'bytes');

const www = join(root, 'www');
rmSync(www, { recursive: true, force: true });
cpSync(dist, www, { recursive: true });
console.log('www/ <- dist/ (안드로이드 앱용)');
