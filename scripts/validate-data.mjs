// 콘텐츠 JSON 검증 — 스키마/ID중복/금지필드/최소개수
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const errors = [];
const load = async (f) => JSON.parse(await readFile(path.join(ROOT, 'src/data', f), 'utf8'));

const FORBIDDEN = /"correct(Answer|Meaning|Ending)"|"meaning"/;

// 금지 필드 전수 검사
for (const f of ['clues.json', 'storySeeds.json', 'whatIf.json', 'sceneTags.json', 'endingStyles.json', 'hints.json']) {
  const raw = await readFile(path.join(ROOT, 'src/data', f), 'utf8');
  if (FORBIDDEN.test(raw)) errors.push(`${f}: 금지 필드(correct*/meaning) 발견`);
}

// clues
const clues = await load('clues.json');
if (clues.length < 30) errors.push(`clues: ${clues.length}개 (30개 이상 권장)`);
const clueIds = new Set();
for (const c of clues) {
  if (clueIds.has(c.id)) errors.push(`clues: 중복 id ${c.id}`);
  clueIds.add(c.id);
  for (const k of ['id', 'name', 'category', 'assetId', 'inspectMode']) {
    if (!c[k]) errors.push(`clues ${c.id}: ${k} 누락`);
  }
  if (!Array.isArray(c.observationQuestions) || c.observationQuestions.length === 0)
    errors.push(`clues ${c.id}: observationQuestions 누락`);
}

// storySeeds
const seeds = await load('storySeeds.json');
for (const key of ['protagonist', 'desire', 'obstacle', 'secret']) {
  if (!seeds[key] || seeds[key].length < 12) errors.push(`storySeeds.${key}: ${seeds[key]?.length ?? 0}개 (12개 이상 필요)`);
}

// whatIf
const whatIf = await load('whatIf.json');
if (whatIf.length < 30) errors.push(`whatIf: ${whatIf.length}개 (30개 이상 필요)`);
const wiIds = new Set();
for (const w of whatIf) {
  if (wiIds.has(w.id)) errors.push(`whatIf: 중복 id ${w.id}`);
  wiIds.add(w.id);
}

// sceneTags / endingStyles
const tags = await load('sceneTags.json');
if (tags.length !== 8) errors.push(`sceneTags: ${tags.length}개 (8개 필요)`);
const ends = await load('endingStyles.json');
if (ends.length !== 5) errors.push(`endingStyles: ${ends.length}개 (5개 필요)`);
for (const e of ends) {
  if (!e.strategy) errors.push(`endingStyles ${e.id}: strategy 누락`);
  if (e.example || e.content) errors.push(`endingStyles ${e.id}: 예시 결말문 필드 금지`);
}

// pageConfig
const pc = await load('pageConfig.json');
if (pc.length !== 10) errors.push(`pageConfig: ${pc.length}개 (10개 필요)`);

// 학생 UI 영어 검사 (label/name/prompt/strategy에 영단어)
const koreanFields = [];
for (const c of clues) koreanFields.push(c.name, ...c.observationQuestions);
for (const k of Object.keys(seeds)) for (const s of seeds[k]) koreanFields.push(s.label, s.prompt);
for (const w of whatIf) koreanFields.push(w.prompt);
for (const t of tags) koreanFields.push(t.label, t.question);
for (const e of ends) koreanFields.push(e.label, e.strategy);
for (const t of koreanFields) {
  if (/[A-Za-z]{4,}/.test(t)) errors.push(`학생 노출 텍스트에 영어 의심: "${t}"`);
}

if (errors.length) {
  console.error('데이터 검증 실패:\n' + errors.map((e) => ` - ${e}`).join('\n'));
  process.exit(1);
}
console.log(`데이터 검증 통과 (단서 ${clues.length}, WHAT IF ${whatIf.length}, 씨앗 4×12+)`);
