/* =========================================================
   01b-mireum: 공식 마스코트 '미루먼지' SVG 생성기
   - 한 함수(mireumSVG)가 표정·자세·동작·부풂·코스튬을 조합해 그린다.
   - 앱 화면과 내보내기 에셋(SVG/PNG)이 같은 코드를 쓴다.
   - 좌표계: viewBox 0 0 240 240, 몸 중심 (120,134), 바닥 기준선 y=198
   ========================================================= */

const MIREUM = {
  name: '미루먼지',
  colors: {
    body: '#FFF7EA', line: '#6B574B', face: '#3B2E28', cheek: '#F2A7A7',
    tear: '#9CC6EC', spark: '#F3CF62', vein: '#E5735F', gloom: '#A99BD8',
    tongue: '#F08A8A', wood: '#E9C9A0', paper: '#FFFDF8', tick: '#8F82C8',
    lav: '#A99BD8', lavDark: '#7E70B8', coral: '#E88B7D', pinkIn: '#F6C6C6',
  },
};

/* ---------- 몸 실루엣: 둥근 구름 + 불규칙한 혹, 화날수록 뾰족·커짐 ---------- */
const MR_WEIGHTS = [1.0, 0.82, 1.12, 0.9, 1.06, 0.86, 1.14, 0.94, 1.0, 0.84, 1.1, 0.92, 1.04, 0.88, 1.08, 0.96, 1.0, 0.9];
function mrBodyPath(fluff = 0) {
  const cx = 120, cy = 134, rx = 80, ryTop = 66, ryBot = 58;
  const n = 12 + Math.round(fluff * 5);
  const ws = MR_WEIGHTS.slice(0, n);
  const total = ws.reduce((a, b) => a + b, 0);
  const start = -Math.PI / 2 - 0.18;
  const pt = (a) => {
    const s = Math.sin(a);
    return [cx + rx * Math.cos(a), cy + (s > 0 ? ryBot : ryTop) * s];
  };
  let a = start;
  let [x0, y0] = pt(a);
  let d = `M${x0.toFixed(1)} ${y0.toFixed(1)}`;
  for (let i = 0; i < n; i++) {
    const a1 = a + (ws[i] / total) * Math.PI * 2;
    const [x1, y1] = pt(a1);
    const chord = Math.hypot(x1 - x0, y1 - y0);
    const mid = (a + a1) / 2;
    const bottom = Math.sin(mid) > 0.55; // 바닥 쪽은 납작하게 (앉아 있는 느낌)
    if (fluff > 0.55 && !bottom) {
      // 털이 곤두선 모양: 끝이 살짝 뾰족한 혹
      const k = 1 + 0.16 + fluff * 0.12;
      const [mx, my] = [cx + rx * k * Math.cos(mid), cy + (Math.sin(mid) > 0 ? ryBot : ryTop) * k * Math.sin(mid)];
      d += ` Q${mx.toFixed(1)} ${my.toFixed(1)} ${x1.toFixed(1)} ${y1.toFixed(1)}`;
    } else {
      const r = chord * (bottom ? 1.25 : 0.56 - fluff * 0.04);
      d += ` A${r.toFixed(1)} ${r.toFixed(1)} 0 0 1 ${x1.toFixed(1)} ${y1.toFixed(1)}`;
    }
    a = a1; x0 = x1; y0 = y1;
  }
  return d + ' Z';
}

/* ---------- 머리 위 작은 구름 (기본형의 표식) ---------- */
const MR_TUFT = '<g class="mr-tuftg"><path class="mr-tuft" d="M98 79 A9.5 9.5 0 0 1 103 63 A11 11 0 0 1 120 54 A11 11 0 0 1 137 62 A9.5 9.5 0 0 1 143 78 Q121 84 98 79 Z"/></g>';

/* ---------- 표정: 눈·눈썹·입·볼·효과 ---------- */
const C = MIREUM.colors;
const MR_FACES = {
  default: {
    eyes: '<g class="mr-eyes"><ellipse cx="99" cy="130" rx="5.6" ry="7" class="f"/><ellipse cx="141" cy="130" rx="5.6" ry="7" class="f"/><circle cx="101" cy="127.2" r="1.8" class="hl"/><circle cx="143" cy="127.2" r="1.8" class="hl"/></g>',
    mouth: '<path d="M112 143 q4 5 8 0 q4 5 8 0"/>',
  },
  happy: {
    eyes: '<g class="mr-eyes"><path d="M93 132 q7 -10 14 0"/><path d="M133 132 q7 -10 14 0"/></g>',
    mouth: '<path d="M108 139 q12 18 24 0 Z" class="f"/><path d="M113.5 147 q6.5 5 13 0" class="tongue"/>',
    extra: 'spark',
  },
  focus: {
    eyes: '<g class="mr-eyes"><ellipse cx="99" cy="131" rx="5" ry="6.2" class="f"/><ellipse cx="141" cy="131" rx="5" ry="6.2" class="f"/><circle cx="100.8" cy="128.6" r="1.6" class="hl"/><circle cx="142.8" cy="128.6" r="1.6" class="hl"/></g>',
    brows: '<path d="M91 117.5 L107 120.5"/><path d="M149 117.5 L133 120.5"/>',
    mouth: '<path d="M114 142.5 q6 2.5 12 0"/>',
  },
  suspicious: {
    eyes: '<g class="mr-eyes"><path d="M92 127 H108"/><path d="M132 127 H148"/><circle cx="104" cy="130.5" r="3.4" class="f"/><circle cx="144" cy="130.5" r="3.4" class="f"/></g>',
    brows: '<path d="M92 118.5 H107"/><path d="M132 115 q8 -6 16 0"/>',
    mouth: '<path d="M113 143.5 q4 -3 7.5 0 t7.5 -1"/>',
    extra: 'question',
  },
  angry: {
    eyes: '<g class="mr-eyes"><ellipse cx="101" cy="130" rx="4.4" ry="5" class="f"/><ellipse cx="139" cy="130" rx="4.4" ry="5" class="f"/></g>',
    brows: '<path d="M90 114 L108 122.5" class="thick"/><path d="M150 114 L132 122.5" class="thick"/>',
    mouth: '<path d="M111.5 146.5 q8.5 -9 17 0 Z" class="f"/>',
    extra: 'vein',
  },
  furious: { // 분노 최고 단계 (마감 직전·마감 도달)
    eyes: '<g class="mr-eyes"><path d="M93 124.5 l11 5.5 l-11 5.5"/><path d="M147 124.5 l-11 5.5 l11 5.5"/></g>',
    brows: '<path d="M89 113 L108 121.5" class="thick"/><path d="M151 113 L132 121.5" class="thick"/>',
    mouth: '<path d="M109 140 q11 -4 22 0 q-1 12 -11 12 q-10 0 -11 -12 Z" class="f"/>',
    extra: 'vein steam',
  },
  disappointed: {
    eyes: '<g class="mr-eyes"><circle cx="100" cy="132" r="3.8" class="f"/><circle cx="140" cy="132" r="3.8" class="f"/></g>',
    brows: '<path d="M92 121.5 L107 117"/><path d="M148 121.5 L133 117"/>',
    mouth: '<path d="M113.5 146 q6.5 -5.5 13 0"/>',
    extra: 'gloom sweat',
  },
  sad: {
    eyes: '<g class="mr-eyes"><path d="M93 126 l9 5 l-9 4.5"/><path d="M147 126 l-9 5 l9 4.5"/></g>',
    mouth: '<path d="M110 146 q5 -5 10 0 q5 -5 10 0"/>',
    extra: 'tears',
  },
  surprised: {
    eyes: '<g class="mr-eyes"><circle cx="100" cy="128" r="6.8" class="f"/><circle cx="140" cy="128" r="6.8" class="f"/><circle cx="102.2" cy="125.4" r="2.2" class="hl"/><circle cx="142.2" cy="125.4" r="2.2" class="hl"/></g>',
    brows: '<path d="M92 113 q7 -5 14 -1"/><path d="M134 112 q7 -4 14 1"/>',
    mouth: '<ellipse cx="120" cy="145" rx="5" ry="6" class="f"/>',
    extra: 'bang',
  },
  sleepy: {
    eyes: '<g class="mr-eyes"><path d="M93 130 q7 5.5 14 0"/><path d="M133 130 q7 5.5 14 0"/></g>',
    mouth: '<ellipse cx="120" cy="143" rx="3" ry="3.4" class="f"/>',
    extra: 'zz',
  },
  proud: {
    eyes: '<g class="mr-eyes"><path d="M93 131 q7 -7 14 0"/><path d="M133 131 q7 -7 14 0"/></g>',
    brows: '<path d="M93 118 q7 -3 13 0"/><path d="M134 118 q7 -3 13 0"/>',
    mouth: '<path d="M109 139.5 q11 9 22 0"/>',
    extra: 'spark',
  },
};

/* ---------- 효과 (글자 없이 기호만 그림) ---------- */
const MR_EXTRAS = {
  spark: `<g class="mr-fx fx-spark"><path d="M196 74 l3 8 l8 3 l-8 3 l-3 8 l-3 -8 l-8 -3 l8 -3 Z"/><path d="M40 92 l2 5 l5 2 l-5 2 l-2 5 l-2 -5 l-5 -2 l5 -2 Z"/><path d="M208 128 l1.6 4 l4 1.6 l-4 1.6 l-1.6 4 l-1.6 -4 l-4 -1.6 l4 -1.6 Z"/></g>`,
  question: `<g class="mr-fx fx-q"><path d="M184 66 q0 -12 12 -12 q12 0 12 11 q0 8 -9 11 q-3 1 -3 6"/><circle cx="196" cy="91" r="2.6" class="dot"/></g>`,
  vein: `<g class="mr-fx fx-vein"><path d="M173 72 Q175 80 166 82"/><path d="M185 72 Q183 80 192 82"/><path d="M173 98 Q175 90 166 88"/><path d="M185 98 Q183 90 192 88"/></g>`,
  steam: `<g class="mr-fx fx-steam"><path class="st s0" d="M88 70 c-6 -7 6 -12 0 -19 c-5 -6 5 -10 0 -16"/><path class="st s1" d="M152 70 c-6 -7 6 -12 0 -19 c-5 -6 5 -10 0 -16"/></g>`,
  gloom: `<g class="mr-fx fx-gloom"><path d="M92 42 v18"/><path d="M106 36 v22"/><path d="M120 40 v18"/><path d="M134 36 v22"/><path d="M148 42 v18"/></g>`,
  sweat: `<g class="mr-fx fx-sweat"><path d="M172 104 q-6 8 -6 12 a6 6 0 0 0 12 0 q0 -4 -6 -12 Z"/></g>`,
  tears: `<g class="mr-fx fx-tears"><path d="M96 137 q-4 12 -2 24"/><path d="M144 137 q4 12 2 24"/><path class="drop" d="M84 160 q-4 6 -4 9 a4 4 0 0 0 8 0 q0 -3 -4 -9 Z"/><path class="drop" d="M156 160 q-4 6 -4 9 a4 4 0 0 0 8 0 q0 -3 -4 -9 Z"/></g>`,
  bang: `<g class="mr-fx fx-bang"><path d="M190 58 l-3 22"/><circle cx="185.6" cy="88" r="2.6" class="dot"/><path d="M204 66 l-6 16"/><circle cx="196" cy="88" r="2.2" class="dot"/></g>`,
  zz: `<g class="mr-fx fx-zz"><path d="M170 70 h12 l-12 13 h12"/><path d="M190 50 h9 l-9 10 h9"/></g>`,
};

/* ---------- 자세: 팔·발·소품 ---------- */
const ARM = (cx, cy, rot, cls = '') => `<ellipse class="mr-arm ${cls}" cx="${cx}" cy="${cy}" rx="10" ry="13.5" transform="rotate(${rot} ${cx} ${cy})"/>`;
const CLIPBOARD = `<g class="mr-prop prop-clip"><rect x="146" y="134" width="52" height="62" rx="6" class="wood"/><rect x="152" y="142" width="40" height="48" rx="3" class="paper"/><rect x="161" y="129" width="22" height="9" rx="3" class="clip"/>
  <path class="tick t1" d="M157 154 l3.5 3.5 l6 -7"/><path class="ln" d="M171 154 h16"/><path class="tick t2" d="M157 166 l3.5 3.5 l6 -7"/><path class="ln" d="M171 166 h16"/><path class="tick t3" d="M157 178 l3.5 3.5 l6 -7"/><path class="ln" d="M171 178 h12"/></g>`;
const FLAG = `<g class="mr-prop prop-flag"><path class="pole" d="M200 162 V70"/><path class="cloth" d="M201 72 q14 -5 28 2 q-6 8 0 17 q-14 -6 -28 -1 Z"/><path class="star" d="M214 78 l1.6 3.6 l3.8 0.4 l-2.9 2.5 l0.9 3.8 l-3.4 -2 l-3.4 2 l0.9 -3.8 l-2.9 -2.5 l3.8 -0.4 Z"/></g>`;
const MR_POSES = {
  idle: () => ARM(43, 158, -18) + ARM(197, 158, 18),
  wave: () => ARM(43, 158, -18) + `<g class="mr-arm-r">${ARM(204, 102, 34)}</g>`,
  cheer: () => `<g class="mr-arm-l">${ARM(30, 94, -42)}</g><g class="mr-arm-r">${ARM(210, 94, 42)}</g>`,
  nag: () => ARM(43, 158, -18) + `<g class="mr-arm-r">${ARM(206, 108, 22)}</g>`,
  check: () => ARM(43, 158, -18) + CLIPBOARD + ARM(150, 176, -30),
  cry: () => ARM(76, 160, 40) + ARM(164, 160, -40),
  curl: () => ARM(86, 182, -60) + ARM(154, 182, 60),
  puff: () => ARM(36, 138, -70) + ARM(204, 138, 70),
  flag: () => ARM(43, 158, -18) + FLAG + ARM(200, 150, 8),
  chase: () => ARM(52, 168, -50) + ARM(190, 120, 50),
};
const MR_FEET = '<ellipse class="mr-foot" cx="97" cy="197" rx="14" ry="8.5"/><ellipse class="mr-foot" cx="143" cy="197" rx="14" ry="8.5"/>';

/* ---------- 코스튬 (외형 변형). 실루엣과 얼굴은 그대로 두고 덧붙이기만 한다 ---------- */
const COSTUMES = {
  basic: { name: '기본형', tagline: '가장 기본적인 모습', tuft: true },
  bunny: {
    name: '토끼형', tagline: '더 귀여운 잔소리', tuft: false,
    back: '<g class="cos-bunny"><ellipse cx="92" cy="56" rx="13" ry="36" transform="rotate(-14 92 56)" class="b"/><ellipse cx="92" cy="58" rx="6" ry="24" transform="rotate(-14 92 58)" class="in"/><ellipse cx="148" cy="56" rx="13" ry="36" transform="rotate(14 148 56)" class="b"/><ellipse cx="148" cy="58" rx="6" ry="24" transform="rotate(14 148 58)" class="in"/></g>',
  },
  wizard: {
    name: '마법사형', tagline: '마법으로 자극', tuft: false,
    front: '<g class="cos-wizard"><path d="M80 84 Q118 70 160 84 L140 34 Q138 14 166 8 Q128 6 116 40 Z" class="hat"/><ellipse cx="120" cy="84" rx="48" ry="9" class="brim"/><path d="M128 52 l2.4 5.2 l5.6 0.6 l-4.2 3.8 l1.2 5.6 l-5 -2.9 l-5 2.9 l1.2 -5.6 l-4.2 -3.8 l5.6 -0.6 Z" class="star"/></g>',
  },
  angel: {
    name: '천사형', tagline: '칭찬도 해 줄게요', tuft: true,
    back: '<g class="cos-angel"><path d="M54 128 C26 128 6 110 8 86 A12 12 0 0 1 26 82 A13 13 0 0 1 46 80 A12 12 0 0 1 62 92 Z" class="wing"/><path d="M186 128 C214 128 234 110 232 86 A12 12 0 0 1 214 82 A13 13 0 0 1 194 80 A12 12 0 0 1 178 92 Z" class="wing"/></g>',
    front: '<ellipse cx="120" cy="44" rx="25" ry="7" class="halo"/>',
  },
  devil: {
    name: '악마형', tagline: '더 강력한 잡도리', tuft: true,
    back: '<g class="cos-devil"><path d="M188 176 q30 4 28 -22" class="tail"/><path d="M210 150 l12 -6 l-4 13 Z" class="tip"/></g>',
    front: '<g class="cos-devil"><path d="M88 86 q-6 -18 4 -30 q4 14 16 22 Z" class="horn"/><path d="M152 86 q6 -18 -4 -30 q-4 14 -16 22 Z" class="horn"/></g>',
  },
};

/**
 * 미루먼지 그리기
 * @param {object} o
 *  expr   표정: default|happy|focus|suspicious|angry|furious|disappointed|sad|surprised|sleepy|proud
 *  pose   자세: idle|wave|cheer|nag|check|cry|curl|puff|flag|chase
 *  motion 동작: breathe|bounce|look|puff|cry|jump|sleep|chase|check|nag|none
 *  fluff  0~1 부풂(미룰수록 커지고 털이 곤두섬)
 *  costume 코스튬 id
 */
function mireumSVG({ expr = 'default', pose = 'idle', motion = 'breathe', fluff = 0, costume = 'basic', label, shadow = true } = {}) {
  const f = MR_FACES[expr] || MR_FACES.default;
  const cos = COSTUMES[costume] || COSTUMES.basic;
  const fl = clamp(fluff, 0, 1);
  const scale = 1 + fl * 0.11;
  const extras = (f.extra || '').split(' ').filter(Boolean).map((k) => MR_EXTRAS[k]).join('');
  const aria = label ? `role="img" aria-label="${esc(label)}"` : 'aria-hidden="true"';
  const squash = pose === 'cry' || pose === 'curl' ? 'squash' : '';
  return `<svg class="mireum e-${expr} p-${pose} m-${motion} ${fl > 0.55 ? 'bristle' : ''}" viewBox="0 0 240 240" ${aria} focusable="false">
    ${shadow ? '<ellipse class="mr-shadow" cx="120" cy="203" rx="70" ry="9"/>' : ''}
    <g class="mr-all">
      <g class="mr-scale ${squash}" style="transform:scale(${scale.toFixed(3)})">
        ${cos.back || ''}
        ${MR_FEET}
        <path class="mr-body" d="${mrBodyPath(fl)}"/>
        ${cos.tuft ? MR_TUFT : ''}
        <g class="mr-face">
          <ellipse class="mr-cheek" cx="83" cy="144" rx="11.5" ry="7"/><ellipse class="mr-cheek" cx="157" cy="144" rx="11.5" ry="7"/>
          ${f.brows ? `<g class="mr-brows">${f.brows}</g>` : ''}${f.eyes}<g class="mr-mouth">${f.mouth}</g>
        </g>
        ${cos.front || ''}
        <g class="mr-pose">${(MR_POSES[pose] || MR_POSES.idle)()}</g>
      </g>
      ${extras}
    </g>
  </svg>`;
}

/* 표정 이름 (접근성 라벨·문서용) */
const EXPR_LABEL = {
  default: '기본', happy: '행복', focus: '집중', suspicious: '의심', angry: '분노', furious: '분노 최고조',
  disappointed: '실망', sad: '슬픔', surprised: '놀람', sleepy: '졸림', proud: '뿌듯함',
};
