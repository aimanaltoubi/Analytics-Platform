export function norm(s) {
  return String(s || '')
    .replace(/[\u064B-\u0652]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/\u0640/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

const SOUNDEX_MAP = {
  b: '1', f: '1', v: '1', p: '1',
  c: '2', g: '2', j: '2', k: '2', q: '2', s: '2', x: '2', z: '2',
  d: '3', t: '3', l: '4', m: '5', n: '5', r: '6',
  'ب': '1', 'ف': '1', 'ث': '1', 'پ': '1',
  'ج': '2', 'ح': '2', 'خ': '2', 'ك': '2', 'ق': '2', 'گ': '2', 'س': '2', 'ز': '2', 'ش': '2', 'ص': '2',
  'د': '3', 'ت': '3', 'ط': '3', 'ظ': '3', 'ض': '3',
  'ل': '4', 'م': '5', 'ن': '5', 'ر': '6',
  'ع': '7', 'غ': '7', 'ه': '7', 'ء': '7', 'ؤ': '7', 'ئ': '7',
  'ا': '0', 'و': '0', 'ي': '0'
};

function jaro(a, b) {
  if (!a || !b) return 0;
  const md = Math.floor(Math.max(a.length, b.length) / 2) - 1;
  const am = new Array(a.length).fill(false);
  const bm = new Array(b.length).fill(false);
  let m = 0;
  for (let i = 0; i < a.length; i++) {
    const st = Math.max(0, i - md);
    const en = Math.min(i + md + 1, b.length);
    for (let j = st; j < en; j++) {
      if (bm[j] || a[i] !== b[j]) continue;
      am[i] = bm[j] = true;
      m++;
      break;
    }
  }
  if (m === 0) return 0;
  let t = 0, k = 0;
  for (let i = 0; i < a.length; i++) {
    if (!am[i]) continue;
    while (!bm[k]) k++;
    if (a[i] !== b[k]) t++;
    k++;
  }
  t = t / 2;
  return (m / a.length + m / b.length + (m - t) / m) / 3;
}

export function jaroWinkler(a, b) {
  const j = jaro(a, b);
  let p = 0;
  for (let i = 0; i < Math.min(a.length, b.length, 4); i++) {
    if (a[i] === b[i]) p++;
    else break;
  }
  return j + p * 0.1 * (1 - j);
}

export function soundex(s) {
  s = norm(s);
  if (!s) return '';
  let code = '';
  let last = SOUNDEX_MAP[s[0]] || '';
  for (let i = 1; i < s.length && code.length < 3; i++) {
    const c = SOUNDEX_MAP[s[i]];
    if (!c || c === '0') continue;
    if (c === last) continue;
    code += c;
    last = c;
  }
  while (code.length < 3) code += '0';
  return s[0] + code;
}

// درجة التطابق الاسمي/الصوتي بين 0 و1
export function nameSimilarity(a, b) {
  const n1 = norm(a), n2 = norm(b);
  if (!n1 || !n2) return 0;
  if (n1 === n2) return 1;
  const jw = jaroWinkler(n1, n2);
  const sx = soundex(n1) === soundex(n2);
  return Math.max(jw, sx ? 0.92 : 0);
}