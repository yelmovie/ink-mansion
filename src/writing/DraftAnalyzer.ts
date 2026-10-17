// 로컬 규칙 기반 퇴고 참고 정보 — 전부 severity 'info', 오답 판정 없음
import { splitSentences, tokenize, countParagraphs } from './KoreanTextUtils';
import connectors from '../data/connectors.json';

export interface RevisionHint {
  type: 'duplicate' | 'repeatedWord' | 'punctuation' | 'paragraph' | 'detail' | 'connection' | 'empty';
  target?: string;
  message: string;
  severity: 'info';
}

export function findDuplicateSentences(text: string): string[] {
  const seen = new Map<string, number>();
  for (const s of splitSentences(text)) {
    const key = s.replace(/[\s.,!?…]/g, '');
    if (key.length < 4) continue; // 아주 짧은 문장은 제외
    seen.set(key, (seen.get(key) ?? 0) + 1);
  }
  return [...seen.entries()].filter(([, n]) => n > 1).map(([k]) => k);
}

export function findRepeatedWords(text: string, threshold = 4): Array<{ word: string; count: number }> {
  const counts = new Map<string, number>();
  for (const w of tokenize(text)) {
    if (w.length < 2) continue;
    counts.set(w, (counts.get(w) ?? 0) + 1);
  }
  return [...counts.entries()]
    .filter(([, n]) => n >= threshold)
    .map(([word, count]) => ({ word, count }))
    .sort((a, b) => b.count - a.count);
}

export function checkPunctuation(text: string): string[] {
  // 종결부호 없이 줄로 끝난 문장 (참고 정보)
  return splitSentences(text).filter((s) => !/[.!?…"'』」”’)\]]$/.test(s) && s.length >= 6);
}

export function findConnectors(text: string): string[] {
  const found = new Set<string>();
  for (const c of connectors as string[]) {
    if (text.includes(c)) found.add(c);
  }
  return [...found];
}

export function analyze(text: string): RevisionHint[] {
  const hints: RevisionHint[] = [];
  const trimmed = text.trim();
  if (!trimmed) {
    return [{ type: 'empty', message: '아직 글이 없어요. 7페이지에서 쓴 글이 이곳으로 넘어와요.', severity: 'info' }];
  }
  const dups = findDuplicateSentences(trimmed);
  if (dups.length > 0) {
    hints.push({ type: 'duplicate', message: `같은 문장이 두 번 이상 등장해요. 모두 필요한 문장인지 확인해 볼까요?`, severity: 'info' });
  }
  for (const r of findRepeatedWords(trimmed).slice(0, 2)) {
    hints.push({ type: 'repeatedWord', target: r.word, message: `'${r.word}' 표현이 ${r.count}번 나와요. 모두 필요한 표현인지 살펴볼까요?`, severity: 'info' });
  }
  const noPunct = checkPunctuation(trimmed);
  if (noPunct.length > 0) {
    hints.push({ type: 'punctuation', message: `마침표나 물음표 없이 끝난 문장이 ${noPunct.length}개 있어요. 문장의 끝을 확인해 볼까요?`, severity: 'info' });
  }
  if (countParagraphs(trimmed) <= 1 && splitSentences(trimmed).length >= 6) {
    hints.push({ type: 'paragraph', message: '글이 한 덩어리로 이어져 있어요. 장면이 바뀌는 곳에서 줄을 바꿔 볼까요?', severity: 'info' });
  }
  if (findConnectors(trimmed).length === 0 && splitSentences(trimmed).length >= 4) {
    hints.push({ type: 'connection', message: "'그때', '하지만' 같은 이음말을 넣으면 장면이 자연스럽게 이어질 수 있어요. 필요할 때만 써도 좋아요.", severity: 'info' });
  }
  const short = splitSentences(trimmed).filter((s) => s.length <= 5);
  if (short.length >= 3) {
    hints.push({ type: 'detail', message: '짧은 문장이 여러 개 있어요. 독자가 장면을 떠올리도록 무엇을 덧붙일 수 있을까요?', severity: 'info' });
  }
  return hints;
}
