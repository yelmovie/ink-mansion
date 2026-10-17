// 한국어 텍스트 유틸 — 서버/AI 없이 로컬 규칙만 사용
/** 문장 분리: 종결부호(. ! ? …) 기준, 닫는 인용부호는 앞 문장에 붙인다. */
export function splitSentences(text: string): string[] {
  const out: string[] = [];
  let buf = '';
  const chars = [...text];
  for (let i = 0; i < chars.length; i++) {
    const c = chars[i];
    buf += c;
    if ('.!?…'.includes(c)) {
      // 연속 부호(…, !?, ...)와 닫는 인용부호 흡수
      let j = i + 1;
      while (j < chars.length && '.!?…'.includes(chars[j])) {
        buf += chars[j];
        j++;
      }
      while (j < chars.length && '"\'』」”’)]'.includes(chars[j])) {
        buf += chars[j];
        j++;
      }
      i = j - 1;
      const t = buf.trim();
      if (t) out.push(t);
      buf = '';
    } else if (c === '\n') {
      const t = buf.trim();
      if (t) out.push(t);
      buf = '';
    }
  }
  const t = buf.trim();
  if (t) out.push(t);
  return out;
}

/** 공백 기준 어절 토큰화 (조사 분리는 하지 않음 — 참고용) */
export function tokenize(text: string): string[] {
  return text
    .split(/[\s\n]+/)
    .map((w) => w.replace(/[.,!?…"'『』「」“”‘’()[\]]/g, ''))
    .filter((w) => w.length > 0);
}

export function countParagraphs(text: string): number {
  return text
    .split(/\n{2,}|\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0).length;
}
