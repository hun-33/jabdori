/* =========================================================
   01b-mireum: 공식 마스코트 '미루먼지' SVG 생성기
   - 한 함수(mireumSVG)가 표정·자세·동작·부풂·코스튬을 조합해 그린다.
   - 앱 화면과 내보내기 에셋(SVG/PNG)이 같은 코드를 쓴다.
   - 좌표계: viewBox 0 0 240 240, 몸 중심 (120,134), 바닥 기준선 y=198
   ========================================================= */

const MIREUM = {
  name: '미루먼지',
  colors: {
    body: '#FFF6E8', line: '#6E5548', face: '#3B2E28', cheek: '#F2A7A7',
    tear: '#9CC6EC', spark: '#F3CF62', vein: '#E5735F', gloom: '#A99BD8',
    tongue: '#F08A8A', wood: '#E9C9A0', paper: '#FFFDF8', tick: '#8F82C8',
    lav: '#A99BD8', lavDark: '#7E70B8', coral: '#E88B7D', pinkIn: '#F6C6C6',
  },
};

/* ---------- 몸 실루엣 (디자인 시트 기본형 기준) ----------
   옆으로 넓고 바닥이 납작한 솜뭉치. 둘레에 작은 혹이 촘촘하고, 크기가 조금씩 달라 손으로 그린 느낌.
   단계(부풂)가 올라가도 모양은 그대로 — 아주 살짝 커지고(최대 6%) 주변 먼지 입자와 떨림만 늘어난다 */
const MR_WEIGHTS = [1.0, 0.86, 1.08, 0.92, 1.04, 0.88, 1.1, 0.95, 1.0, 0.9, 1.06, 0.93, 1.02, 0.89, 1.07, 0.96, 0.98, 0.91];
function mrBodyPath() {
  const cx = 120, cy = 134, rx = 84, ryTop = 76, ryBot = 54;
  const n = 18;
  const total = MR_WEIGHTS.reduce((x, y) => x + y, 0);
  const pt = (t) => { const s = Math.sin(t); return [cx + rx * Math.cos(t), cy + (s > 0 ? ryBot : ryTop) * s]; };
  let t = -Math.PI / 2 - 0.1, [x0, y0] = pt(t);
  let d = `M${x0.toFixed(1)} ${y0.toFixed(1)}`;
  for (let i = 0; i < n; i++) {
    const t1 = t + (MR_WEIGHTS[i] / total) * Math.PI * 2;
    const [x1, y1] = pt(t1);
    const chord = Math.hypot(x1 - x0, y1 - y0);
    const bottom = Math.sin((t + t1) / 2) > 0.62; // 바닥은 거의 평평하게 (앉아 있는 느낌)
    const r = chord * (bottom ? 1.9 : 0.6);
    d += ` A${r.toFixed(1)} ${r.toFixed(1)} 0 0 1 ${x1.toFixed(1)} ${y1.toFixed(1)}`;
    t = t1; x0 = x1; y0 = y1;
  }
  return d + ' Z';
}
const MR_BODY = mrBodyPath();

/* ---------- 머리 위 솜뭉치 + 작은 꼬불 털 (기본형의 표식) ---------- */
const MR_TUFT = '<g class="mr-tuftg"><path class="mr-tuft" d="M99 64 A8 8 0 0 1 104 50 A10 10 0 0 1 120 42 A10 10 0 0 1 136 49 A8 8 0 0 1 141 64 Z"/><path class="mr-curl" d="M126 40 q2 -7 8 -5 q4 2 1 6"/></g>';

/* ---------- 표정: 눈·눈썹·입·볼·효과 ----------
   눈은 작고 까만 타원(작은 흰 점), 얼굴 아래쪽에 넓게. 입은 눈 사이 작은 ω. 볼은 눈 바깥 아래 분홍 타원 */
const C = MIREUM.colors;
const EYE = (x, y = 141, rx = 5, ry = 6.2) => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" class="f"/><circle cx="${x + 1.5}" cy="${y - 2}" r="1.4" class="hl"/>`;
const MR_FACES = {
  default: { eyes: `<g class="mr-eyes">${EYE(98)}${EYE(142)}</g>`, mouth: '<path d="M114 149 q3 3.5 6 0 q3 3.5 6 0"/>' },
  happy: {
    eyes: '<g class="mr-eyes"><path d="M92 143 q6 -9 12 0"/><path d="M136 143 q6 -9 12 0"/></g>',
    mouth: '<path d="M112 147 q8 12 16 0 Z" class="f"/><path d="M115.5 152.5 q4.5 3 9 0" class="tongue"/>',
    extra: 'spark',
  },
  focus: { // 결의
    eyes: `<g class="mr-eyes">${EYE(98, 142, 4.4, 5.2)}${EYE(142, 142, 4.4, 5.2)}</g>`,
    brows: '<path d="M90 128 L105 131.5"/><path d="M150 128 L135 131.5"/>',
    mouth: '<path d="M115 150 q5 2 10 0"/>',
  },
  suspicious: {
    eyes: '<g class="mr-eyes"><path d="M91 139 H105"/><path d="M135 139 H149"/><circle cx="101" cy="142" r="3" class="f"/><circle cx="145" cy="142" r="3" class="f"/></g>',
    brows: '<path d="M135 128 q7 -5 14 0"/>',
    mouth: '<path d="M114 150 q3 -2.5 6 0 t6 -1"/>',
    extra: 'question',
  },
  angry: { // 화남: 눈을 질끈(><)
    eyes: '<g class="mr-eyes"><path d="M92 136 l10 5 l-10 5"/><path d="M148 136 l-10 5 l10 5"/></g>',
    mouth: '<path d="M113 152 q7 -8 14 0 Z" class="f"/>',
    extra: 'vein',
  },
  furious: { // 버럭 (마감 직전·마감 도달)
    eyes: '<g class="mr-eyes"><path d="M92 135 l11 6 l-11 6"/><path d="M148 135 l-11 6 l11 6"/></g>',
    brows: '<path d="M89 126 L105 131" class="thick"/><path d="M151 126 L135 131" class="thick"/>',
    mouth: '<path d="M110 146 q10 -3 20 0 q-1 11 -10 11 q-9 0 -10 -11 Z" class="f"/>',
    extra: 'vein steam',
  },
  disappointed: { // 좌절
    eyes: '<g class="mr-eyes"><path d="M92 141 q6 4 12 0"/><path d="M136 141 q6 4 12 0"/></g>',
    brows: '<path d="M92 131 L104 128"/><path d="M148 131 L136 128"/>',
    mouth: '<path d="M115 152 q5 -4 10 0"/>',
    extra: 'gloom sweat',
  },
  sad: { // 슬픔(엉엉)
    eyes: '<g class="mr-eyes"><path d="M92 137 l9 4.5 l-9 4.5"/><path d="M148 137 l-9 4.5 l9 4.5"/></g>',
    mouth: '<path d="M112 152 q4 -4.5 8 0 q4 -4.5 8 0"/>',
    extra: 'tears',
  },
  surprised: {
    eyes: `<g class="mr-eyes">${EYE(98, 139, 5.4, 6.6)}${EYE(142, 139, 5.4, 6.6)}</g>`,
    brows: '<path d="M91 126 q6 -4 12 -1"/><path d="M137 125 q6 -3 12 1"/>',
    mouth: '<ellipse cx="120" cy="151" rx="4" ry="5" class="f"/>',
    extra: 'bang',
  },
  flustered: { // 당황
    eyes: `<g class="mr-eyes">${EYE(98, 140, 4.2, 5.4)}${EYE(142, 140, 4.2, 5.4)}</g>`,
    mouth: '<path d="M111 151 q3 -3 6 0 t6 0 t6 0"/>',
    extra: 'sweat',
  },
  shy: { // 부끄러움
    eyes: '<g class="mr-eyes"><path d="M92 142 q6 -6 12 0"/><path d="M136 142 q6 -6 12 0"/></g>',
    mouth: '<path d="M115 149 q2.5 3 5 0 q2.5 3 5 0"/>',
    extra: 'blush',
  },
  sleepy: {
    eyes: '<g class="mr-eyes"><path d="M92 141 q6 4.5 12 0"/><path d="M136 141 q6 4.5 12 0"/></g>',
    mouth: '<ellipse cx="120" cy="150" rx="2.6" ry="3" class="f"/>',
    extra: 'zz',
  },
  tired: { // 지침
    eyes: '<g class="mr-eyes"><path d="M92 140 H104"/><path d="M136 140 H148"/><path d="M93 143 q5 2.5 10 0" class="soft"/><path d="M137 143 q5 2.5 10 0" class="soft"/></g>',
    mouth: '<path d="M115 151 q5 -2 10 0"/>',
    extra: 'gloom',
  },
  proud: { // 뿌듯
    eyes: '<g class="mr-eyes"><path d="M92 142 q6 -6 12 0"/><path d="M136 142 q6 -6 12 0"/></g>',
    mouth: '<path d="M112 147 q8 7 16 0"/>',
    extra: 'spark',
  },
};

/* ---------- 효과 (글자 없이 기호만) ---------- */
const MR_EXTRAS = {
  spark: `<g class="mr-fx fx-spark"><path d="M200 82 l3 8 l8 3 l-8 3 l-3 8 l-3 -8 l-8 -3 l8 -3 Z"/><path d="M36 98 l2 5 l5 2 l-5 2 l-2 5 l-2 -5 l-5 -2 l5 -2 Z"/><path d="M212 132 l1.6 4 l4 1.6 l-4 1.6 l-1.6 4 l-1.6 -4 l-4 -1.6 l4 -1.6 Z"/></g>`,
  question: `<g class="mr-fx fx-q"><path d="M188 70 q0 -12 12 -12 q12 0 12 11 q0 8 -9 11 q-3 1 -3 6"/><circle cx="200" cy="95" r="2.6" class="dot"/></g>`,
  vein: `<g class="mr-fx fx-vein"><path d="M175 78 Q177 86 168 88"/><path d="M187 78 Q185 86 194 88"/><path d="M175 104 Q177 96 168 94"/><path d="M187 104 Q185 96 194 94"/></g>`,
  steam: `<g class="mr-fx fx-steam"><path class="st s0" d="M84 78 c-6 -7 6 -12 0 -19 c-5 -6 5 -10 0 -16"/><path class="st s1" d="M156 78 c-6 -7 6 -12 0 -19 c-5 -6 5 -10 0 -16"/></g>`,
  gloom: `<g class="mr-fx fx-gloom"><path d="M92 46 v18"/><path d="M106 40 v22"/><path d="M134 40 v22"/><path d="M148 46 v18"/></g>`,
  sweat: `<g class="mr-fx fx-sweat"><path d="M176 108 q-6 8 -6 12 a6 6 0 0 0 12 0 q0 -4 -6 -12 Z"/></g>`,
  tears: `<g class="mr-fx fx-tears"><path d="M96 147 q-4 10 -2 20"/><path d="M144 147 q4 10 2 20"/><path class="drop" d="M84 168 q-4 6 -4 9 a4 4 0 0 0 8 0 q0 -3 -4 -9 Z"/><path class="drop" d="M156 168 q-4 6 -4 9 a4 4 0 0 0 8 0 q0 -3 -4 -9 Z"/></g>`,
  bang: `<g class="mr-fx fx-bang"><path d="M194 64 l-3 22"/><circle cx="189.6" cy="94" r="2.6" class="dot"/><path d="M208 72 l-6 16"/><circle cx="200" cy="94" r="2.2" class="dot"/></g>`,
  zz: `<g class="mr-fx fx-zz"><path d="M172 76 h12 l-12 13 h12"/><path d="M192 56 h9 l-9 10 h9"/></g>`,
  blush: `<g class="mr-fx fx-blush"><path d="M78 152 l5 -6"/><path d="M84 153 l5 -6"/><path d="M151 153 l5 -6"/><path d="M157 152 l5 -6"/></g>`,
};
/* 부풂(단계)에 따라 주변에 떠다니는 먼지 입자 — 모양 대신 입자 수로 단계를 보여 준다 */
function mrDust(fl) {
  if (fl < 0.15) return '';
  const pts = [[34, 118, 3], [208, 110, 2.6], [46, 72, 2.2], [196, 64, 3], [26, 160, 2], [216, 160, 2.4], [70, 50, 1.8], [172, 44, 2]];
  const k = Math.round(2 + fl * 6);
  return `<g class="mr-dust">${pts.slice(0, k).map(([x, y, r], i) => `<circle cx="${x}" cy="${y}" r="${r}" class="d${i % 3}"/>`).join('')}</g>`;
}

/* ---------- 자세: 작은 손(몸 옆에 붙은 뭉툭한 손)·발·소품 ---------- */
const ARM = (cx, cy, rot, cls = '') => `<ellipse class="mr-arm ${cls}" cx="${cx}" cy="${cy}" rx="8" ry="10.5" transform="rotate(${rot} ${cx} ${cy})"/>`;
const CLIPBOARD = `<g class="mr-prop prop-clip"><rect x="150" y="136" width="48" height="58" rx="6" class="wood"/><rect x="155.5" y="143.5" width="37" height="45" rx="3" class="paper"/><rect x="164" y="131" width="20" height="8.5" rx="3" class="clip"/>
  <path class="tick t1" d="M160 155 l3.5 3.5 l6 -7"/><path class="ln" d="M173 155 h14"/><path class="tick t2" d="M160 166 l3.5 3.5 l6 -7"/><path class="ln" d="M173 166 h14"/><path class="tick t3" d="M160 177 l3.5 3.5 l6 -7"/><path class="ln" d="M173 177 h10"/></g>`;
const FLAG = `<g class="mr-prop prop-flag"><path class="pole" d="M212 168 V78"/><path class="cloth" d="M213 80 q14 -5 28 2 q-6 8 0 17 q-14 -6 -28 -1 Z"/><path class="star" d="M226 86 l1.6 3.6 l3.8 0.4 l-2.9 2.5 l0.9 3.8 l-3.4 -2 l-3.4 2 l0.9 -3.8 l-2.9 -2.5 l3.8 -0.4 Z"/></g>`;
const MR_POSES = {
  idle: () => ARM(42, 164, -24) + ARM(198, 164, 24),
  wave: () => ARM(42, 164, -24) + `<g class="mr-arm-r">${ARM(210, 112, 30)}</g>`,
  cheer: () => `<g class="mr-arm-l">${ARM(28, 108, -40)}</g><g class="mr-arm-r">${ARM(212, 108, 40)}</g>`,
  nag: () => ARM(42, 164, -24) + `<g class="mr-arm-r">${ARM(210, 118, 20)}</g>`,
  check: () => ARM(42, 164, -24) + CLIPBOARD + ARM(152, 178, -30),
  cry: () => ARM(80, 166, 40) + ARM(160, 166, -40),
  curl: () => ARM(88, 184, -60) + ARM(152, 184, 60),
  puff: () => ARM(30, 146, -60) + ARM(210, 146, 60),
  flag: () => ARM(42, 164, -24) + FLAG + ARM(210, 156, 8),
  chase: () => ARM(44, 170, -50) + ARM(198, 128, 50),
};
const MR_FEET = '<ellipse class="mr-foot" cx="100" cy="187" rx="12" ry="7"/><ellipse class="mr-foot" cx="140" cy="187" rx="12" ry="7"/>';

/* 옷 갈아입기·변신은 없앴다 (디자인 기준: 언제나 같은 기본 모습). 예전 저장값 호환을 위해 이름만 남김 */
const COSTUMES = { basic: { name: '기본형', tagline: '가장 기본적인 모습', tuft: true } };

/**
 * 미루먼지 그리기 (디자인 시트 기본형)
 *  expr   표정: default|happy|focus|suspicious|angry|furious|disappointed|sad|surprised|flustered|shy|sleepy|tired|proud
 *  pose   자세: idle|wave|cheer|nag|check|cry|curl|puff|flag|chase
 *  motion 동작: breathe|bounce|look|puff|cry|jump|sleep|chase|check|nag|none
 *  fluff  0~1 단계(몽글→빵빵). 모양은 그대로, 살짝 커지고 먼지 입자·떨림이 늘어난다
 */
let MR_SEQ = 0; // 그라데이션 id가 화면 안에서 겹치지 않게
function mireumSVG({ expr = 'default', pose = 'idle', motion = 'breathe', fluff = 0, label, shadow = true } = {}) {
  const f = MR_FACES[expr] || MR_FACES.default;
  const fl = clamp(fluff, 0, 1);
  const scale = 1 + fl * 0.06;
  const extras = (f.extra || '').split(' ').filter(Boolean).map((k) => MR_EXTRAS[k]).join('');
  const aria = label ? `role="img" aria-label="${esc(label)}"` : 'aria-hidden="true"';
  const squash = pose === 'cry' || pose === 'curl' ? 'squash' : '';
  const gid = 'mrg' + (++MR_SEQ);
  return `<svg class="mireum e-${expr} p-${pose} m-${motion} ${fl > 0.55 ? 'bristle' : ''}" viewBox="0 0 240 240" ${aria} focusable="false">
    <defs><radialGradient id="${gid}" cx="48%" cy="42%" r="62%"><stop offset="0" stop-color="#FFFAF1"/><stop offset=".72" stop-color="#FFF4E4"/><stop offset="1" stop-color="#F3E1D0"/></radialGradient></defs>
    ${shadow ? '<ellipse class="mr-shadow" cx="120" cy="194" rx="72" ry="8"/>' : ''}
    <g class="mr-all">
      <g class="mr-scale ${squash}" style="transform:scale(${scale.toFixed(3)})">
        ${MR_FEET}${MR_TUFT}
        <path class="mr-body" d="${MR_BODY}" style="fill:url(#${gid})"/>
        <path class="mr-sketch" d="${MR_BODY}" transform="translate(0.8 0.6)"/>
        <g class="mr-face">
          <ellipse class="mr-cheek" cx="83" cy="152" rx="10.5" ry="6.5"/><ellipse class="mr-cheek" cx="157" cy="152" rx="10.5" ry="6.5"/>
          ${f.brows ? `<g class="mr-brows">${f.brows}</g>` : ''}${f.eyes}<g class="mr-mouth">${f.mouth}</g>
        </g>
        <g class="mr-pose">${(MR_POSES[pose] || MR_POSES.idle)()}</g>
      </g>
      ${mrDust(fl)}${extras}
    </g>
  </svg>`;
}

/* 표정 이름 (접근성 라벨·문서용) */
const EXPR_LABEL = {
  default: '기본', happy: '행복', focus: '집중', suspicious: '의심', angry: '분노', furious: '분노 최고조',
  disappointed: '좌절', sad: '슬픔', surprised: '놀람', flustered: '당황', shy: '부끄러움', sleepy: '졸림', tired: '지침', proud: '뿌듯함',
};
