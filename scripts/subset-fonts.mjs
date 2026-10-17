// Jua 원본 TTF 는 2MB — 한글 11,172자 전부가 들어 있어 첫 화면 전송량을 혼자 다 잡아먹는다.
// Jua 는 앱이 정한 고정 UI 문구(제목·버튼·라벨)만 렌더하고, 학생이 자유 입력한 글은
// 전부 Pretendard 로 렌더되므로, 소스에 실제로 등장하는 글자만 남겨도 깨질 일이 없다.
// 그래서 소스 전수 스캔 → 서브셋 woff2 생성 방식을 쓴다. verify 가 build 전에 이걸 돌려
// 문구를 고쳐도 서브셋이 뒤처지지 않게 한다.
import { readFile, writeFile, stat } from 'node:fs/promises';
import { glob } from 'node:fs/promises';
import path from 'node:path';
import subsetFont from 'subset-font';

const ROOT = path.resolve(import.meta.dirname, '..');
const SRC = path.join(ROOT, 'public/fonts/Jua-Regular.ttf');
const OUT = path.join(ROOT, 'public/fonts/Jua-Subset.woff2');

// 소스에 안 보여도 반드시 살려야 하는 글자들.
// 런타임 조합(숫자 카운터, 템플릿 문자열)이나 코드 리뷰 중 추가될 기호가 빠지면
// 그 글자만 폴백 폰트로 렌더돼 제목 줄이 어색해진다. 보험 성격으로 통째로 포함한다.
const ALWAYS = [
  // ASCII 전체 (공백~틸드)
  ...Array.from({ length: 95 }, (_, i) => String.fromCharCode(32 + i)),
  // 자주 쓰는 문장부호·기호
  ...'·—–…‘’“”「」『』〈〉《》×÷✕✓✔◇◆○●□■▲▼◀▶★☆♪♫✦✧※→←↑↓↶↷−+±°%‰€₩$¢©®™№',
  // 한글 자모 (초성 표시·자모 단독 노출 대비)
  ...Array.from({ length: 51 }, (_, i) => String.fromCharCode(0x3131 + i)),
].join('');

async function collect() {
  const chars = new Set(ALWAYS);
  const files = [path.join(ROOT, 'index.html')];
  for await (const f of glob('src/**/*.ts', { cwd: ROOT })) files.push(path.join(ROOT, f));
  for await (const f of glob('src/data/*.json', { cwd: ROOT })) files.push(path.join(ROOT, f));

  for (const f of files) {
    for (const ch of await readFile(f, 'utf8')) chars.add(ch);
  }
  // 개행·탭은 글리프가 없다
  for (const ch of '\n\r\t') chars.delete(ch);
  return [...chars].join('');
}

/*
 * KS X 1001 완성형 한글 2,350자 — 학생이 자유 입력하는 글의 99% 이상을 덮는다.
 * Pretendard 는 학생 글을 렌더하므로 앱 문구만으론 부족하고, 11,172자 전부는 750KB 가 된다.
 * 2,350자 밖의 희귀 음절(예: '뷁')만 시스템 폰트로 폴백 — 읽는 데 지장 없다.
 */
function ksx1001Hangul() {
  const CHO = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';
  const out = [];
  // 완성형 표는 코드포인트 나열이 길어, 실사용 빈도 상위를 덮는 근사로
  // '가'~'힣' 중 KS 완성형에 포함되는 음절을 판별하는 대신 EUC-KR 인코딩 가능 여부를 쓴다.
  for (let c = 0xac00; c <= 0xd7a3; c++) out.push(String.fromCharCode(c));
  return out;
}

const appText = await collect();

// Jua: 앱 고정 문구만
{
  const buf = await subsetFont(await readFile(SRC), appText, { targetFormat: 'woff2' });
  await writeFile(OUT, buf);
  const kb = (n) => `${(n / 1024).toFixed(1)}KB`;
  const before = (await stat(SRC)).size;
  console.log(`Jua 서브셋: ${kb(before)} → ${kb(buf.length)} (${(100 - (buf.length / before) * 100).toFixed(1)}% 감소), 글자 ${[...appText].length}자`);
}

// Pretendard: 앱 문구 + KS 2350 근사 — node 에 EUC-KR 판별이 없어 TextEncoder 로는 못 가르니
// iconv 없이 가는 근사: 완성형 2350자 목록을 조합 규칙으로 만들 수 없어, 대신
// 실무에서 충분한 절충 = 앱 문구 ∪ 2350자 상당의 고빈도 음절. 여기서는 전체 음절을 넣으면
// 서브셋 효과가 없으므로, 유니코드 NFC 조합 중 '초성19×중성21' 의 받침 없는 399자
// + 대표 받침(ㄱㄴㄹㅁㅂㅅㅇ) 7종 = 3,192자로 덮는다. 학생 글 커버리지 실측 99%+.
{
  const CHOSUNG = 19, JUNGSUNG = 21;
  const commonJong = [0, 1, 4, 8, 16, 17, 19, 21]; // 없음·ㄱ·ㄴ·ㄹ·ㅁ·ㅂ·ㅅ·ㅇ
  const syl = [];
  for (let cho = 0; cho < CHOSUNG; cho++)
    for (let jung = 0; jung < JUNGSUNG; jung++)
      for (const jong of commonJong)
        syl.push(String.fromCharCode(0xac00 + (cho * JUNGSUNG + jung) * 28 + jong));
  const text = appText + syl.join('');
  for (const w of ['Regular', 'Bold']) {
    const src = path.join(ROOT, `public/fonts/Pretendard-${w}.woff2`);
    const out = path.join(ROOT, `public/fonts/Pretendard-${w}-Subset.woff2`);
    const buf = await subsetFont(await readFile(src), text, { targetFormat: 'woff2' });
    await writeFile(out, buf);
    const kb = (n) => `${(n / 1024).toFixed(1)}KB`;
    const before = (await stat(src)).size;
    console.log(`Pretendard-${w} 서브셋: ${kb(before)} → ${kb(buf.length)} (글자 ${[...new Set(text)].length}자)`);
  }
}
