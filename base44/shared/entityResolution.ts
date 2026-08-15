// جزيئات عربية ولاتينية تُجرد قبل المطابقة (مشكلة «أل» التعريف و النسبة)
const ARABIC_PARTICLES = ['ابن', 'بن', 'أبو', 'ابو', 'أبي', ' Abdul'.trim()];
const LATIN_PARTICLES = ['al', 'el', 'bin', 'ibn', 'abu', 'ben', 'bint', 'abdul'];

// تجريد جزيئات النسبة والتعريف من اسم مطبّع — يحافظ على الجذر الصوتي
function stripParticles(s) {
  let r = s;
  // بادئات لاتينية موصولة بشرطة أو فاصلة: al-/el-/bin-
  r = r.replace(/\b(al|el|bin|ibn|abu|ben|bint|abdul)[\-\s]?/g, ' ');
  // جزيئات لاتينية مستقلة
  r = r.replace(/\b(al|el|bin|ibn|abu|ben|bint|abdul)\b/g, ' ');
  // «ال» التعريف العربية في بداية كل كلمة
  r = r.replace(/(?:^|\s)ال/g, ' ');
  // جزيئات نسبة عربية مستقلة
  for (const p of ARABIC_PARTICLES) {
    r = r.replace(new RegExp('(?:^|\\s)' + p + '(?:\\s|$)', 'g'), ' ');
  }
  return r.replace(/\s+/g, ' ').trim();
}

export function norm(s) {
  return stripParticles(
    String(s || '')
      .replace(/[\u064B-\u0652]/g, '')
      .replace(/[أإآ]/g, 'ا')
      .replace(/ى/g, 'ي')
      .replace(/ة/g, 'ه')
      .replace(/\u0640/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase()
  );
}

// محرك التوطين العربي → لاتيني على خط أساس صوتي موحد (ICU-like baseline)
const AR2LAT = {
  'ا': 'a', 'أ': 'a', 'إ': 'i', 'آ': 'a', 'ب': 'b', 'ت': 't', 'ث': 'th', 'ج': 'j',
  'ح': 'h', 'خ': 'kh', 'د': 'd', 'ذ': 'dh', 'ر': 'r', 'ز': 'z', 'س': 's', 'ش': 'sh',
  'ص': 's', 'ض': 'd', 'ط': 't', 'ظ': 'z', 'ع': 'a', 'غ': 'gh', 'ف': 'f', 'ق': 'q',
  'ك': 'k', 'ل': 'l', 'م': 'm', 'ن': 'n', 'ه': 'h', 'ة': 'a', 'و': 'w', 'ي': 'y',
  'ؤ': 'u', 'ئ': 'i', 'ء': 'a'
};

export function arabicToLatin(s) {
  if (!s) return '';
  const str = String(s).replace(/[\u064B-\u0652]/g, '').replace(/\u0640/g, '');
  let out = '';
  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    out += AR2LAT[ch] || ch;
  }
  return out.replace(/\s+/g, ' ').trim().toLowerCase();
}

export function isArabic(s) {
  return /[\u0600-\u06FF]/.test(String(s || ''));
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
  let best = Math.max(jw, sx ? 0.92 : 0);
  // مطابقة عبر الكتابات:حوّل الجانب العربي إلى لاتيني وقارنه بالجانب اللاتيني
  const ar1 = isArabic(a), ar2 = isArabic(b);
  if (ar1 !== ar2) {
    const lat1 = ar1 ? norm(arabicToLatin(a)) : n1;
    const lat2 = ar2 ? norm(arabicToLatin(b)) : n2;
    if (lat1 && lat2) {
      if (lat1 === lat2) return 1;
      const cjw = jaroWinkler(lat1, lat2);
      const csx = soundex(lat1) === soundex(lat2);
      best = Math.max(best, cjw, csx ? 0.92 : 0);
    }
  }
  return best;
}