// 원본 PNG → slug 매핑 (육안 확인 결과: docs/ASSET_AUDIT.md 참조)
// kind: bg(1600x900) | char(h768) | obj(512) | title(w1024)
const P = '05_'; // 공통 prefix 축약용 아님 — 가독성용
const N = (t, n) => `ChatGPT Image 2026년 8월 15일 오전 ${t}${n ? ` (${n})` : ''}.png`;

export const ASSET_MAP = [
  // characters
  // 미사용 이동(2026-08-19 → _unused/assets-20260819): { dir: 'assets', file: N('05_11_37', 1), slug: 'char-girl-full', kind: 'char' },
  { dir: 'assets', file: N('05_11_37', 2), slug: 'char-puppy-sit', kind: 'char' },
  // 미사용 이동(2026-08-19 → _unused/assets-20260819): { dir: 'assets', file: N('05_11_49', 1), slug: 'char-girl-full-2', kind: 'char' },
  { dir: 'assets', file: N('05_11_49', 2), slug: 'char-puppy-close', kind: 'char' },
  { dir: 'assets', file: N('05_12_03', 1), slug: 'char-girl-crouch', kind: 'char' },
  { dir: 'assets', file: N('05_12_03', 2), slug: 'char-puppy-sniff', kind: 'char' },
  { dir: 'assets', file: N('05_12_36', 1), slug: 'char-girl-board', kind: 'char' },
  // 미사용 이동(2026-08-19 → _unused/assets-20260819): { dir: 'assets', file: N('05_12_36', 2), slug: 'char-puppy-trail', kind: 'char' },
  // 미사용 이동(2026-08-19 → _unused/assets-20260819): { dir: 'assets', file: N('05_14_04', 1), slug: 'char-girl-seed-machine', kind: 'char' },
  { dir: 'assets', file: N('05_14_04', 2), slug: 'char-puppy-vials', kind: 'char' },
  { dir: 'assets', file: N('05_14_24', 1), slug: 'char-girl-whatif', kind: 'char' },
  // 미사용 이동(2026-08-19 → _unused/assets-20260819): { dir: 'assets', file: N('05_14_24', 2), slug: 'char-puppy-whatif', kind: 'char' },
  { dir: 'assets', file: N('05_14_43', 1), slug: 'char-girl-storyboard', kind: 'char' },
  { dir: 'assets', file: N('05_14_43', 2), slug: 'char-puppy-scenes', kind: 'char' },
  { dir: 'assets', file: N('05_15_03', 1), slug: 'char-girl-writing', kind: 'char' },
  { dir: 'assets', file: N('05_15_04', 2), slug: 'char-puppy-badges', kind: 'char' },
  { dir: 'assets', file: N('05_15_14', 1), slug: 'char-girl-mint', kind: 'char' },
  { dir: 'assets', file: N('05_15_14', 2), slug: 'char-puppy-mint', kind: 'char' },
  // 미사용 이동(2026-08-19 → _unused/assets-20260819): { dir: 'assets', file: N('05_15_15', 5), slug: 'char-duo-compare-board', kind: 'char' },
  // 미사용 이동(2026-08-19 → _unused/assets-20260819): { dir: 'assets', file: N('05_15_35', 5), slug: 'char-duo-easel', kind: 'char' },
  // 미사용 이동(2026-08-19 → _unused/assets-20260819): { dir: 'assets', file: N('05_15_32', 1), slug: 'char-girl-wand-photos', kind: 'char' },
  // 미사용 이동(2026-08-19 → _unused/assets-20260819): { dir: 'assets', file: N('05_15_32', 2), slug: 'char-puppy-cape-run', kind: 'char' },
  { dir: 'assets', file: N('05_15_50', 1), slug: 'char-girl-endings', kind: 'char' },
  // 미사용 이동(2026-08-19 → _unused/assets-20260819): { dir: 'assets', file: N('05_15_50', 2), slug: 'char-puppy-scroll-fly', kind: 'char' },
  // 미사용 이동(2026-08-19 → _unused/assets-20260819): { dir: 'assets', file: N('05_15_56', 8), slug: 'char-duo-blank-easel', kind: 'char' },
  { dir: 'assets', file: N('05_16_10', 1), slug: 'char-girl-holdpaper', kind: 'char' },
  { dir: 'assets', file: N('05_16_10', 2), slug: 'char-puppy-book', kind: 'char' },

  // stage 1 — props & clues
  { dir: 'assets', file: N('05_11_50', 3), slug: 'prop-mansion-ext', kind: 'obj' },
  // 미사용 이동(2026-08-19 → _unused/assets-20260819): { dir: 'assets', file: N('05_11_51', 4), slug: 'prop-magnifier', kind: 'obj' },
  { dir: 'assets', file: N('05_11_52', 5), slug: 'prop-storybook', kind: 'obj' },
  { dir: 'assets', file: N('05_11_53', 6), slug: 'prop-quill-magic', kind: 'obj' },
  { dir: 'assets', file: N('05_11_55', 7), slug: 'clue-letter-sealed', kind: 'obj' },
  { dir: 'assets', file: N('05_11_56', 8), slug: 'prop-inkbottle-galaxy', kind: 'obj' },
  { dir: 'assets', file: N('05_11_59', 9), slug: 'clue-key-old', kind: 'obj' },
  { dir: 'assets', file: N('05_12_00', 10), slug: 'prop-detective-bag', kind: 'obj' },
  { dir: 'assets', file: N('05_12_05', 3), slug: 'prop-flashlight', kind: 'obj' },
  { dir: 'assets', file: N('05_12_05', 4), slug: 'clue-drawer-open', kind: 'obj' },
  { dir: 'assets', file: N('05_12_06', 5), slug: 'prop-curtain-window', kind: 'obj' },
  { dir: 'assets', file: N('05_12_08', 6), slug: 'clue-footprints', kind: 'obj' },
  { dir: 'assets', file: N('05_12_09', 7), slug: 'clue-portrait-dog', kind: 'obj' },
  { dir: 'assets', file: N('05_12_10', 8), slug: 'clue-journal-open', kind: 'obj' },
  { dir: 'assets', file: N('05_12_11', 9), slug: 'prop-magic-lens', kind: 'obj' },
  { dir: 'assets', file: N('05_12_13', 10), slug: 'prop-wall-lantern', kind: 'obj' },

  // stage 2 — interpretation
  { dir: 'assets', file: N('05_12_38', 3), slug: 'prop-clue-board', kind: 'obj' },
  { dir: 'assets', file: N('05_12_40', 4), slug: 'prop-suspect-cards', kind: 'obj' },
  { dir: 'assets', file: N('05_12_40', 5), slug: 'clue-keepsake-box', kind: 'obj' },
  { dir: 'assets', file: N('05_12_42', 6), slug: 'prop-round-device', kind: 'obj' },
  { dir: 'assets', file: N('05_12_43', 7), slug: 'prop-compare-stand', kind: 'obj' },
  { dir: 'assets', file: N('05_12_44', 8), slug: 'prop-projector', kind: 'obj' },
  { dir: 'assets', file: N('05_12_45', 9), slug: 'prop-case-file', kind: 'obj' },
  // 미사용 이동(2026-08-19 → _unused/assets-20260819): { dir: 'assets', file: N('05_12_45', 10), slug: 'prop-evidence-cabinet', kind: 'obj' },

  // stage 2 — story seed
  { dir: 'assets', file: N('05_14_06', 3), slug: 'prop-seed-machine', kind: 'obj' },
  { dir: 'assets', file: N('05_14_08', 4), slug: 'prop-magic-card-girl', kind: 'obj' },
  { dir: 'assets', file: N('05_14_09', 5), slug: 'prop-heart-flask', kind: 'obj' },
  { dir: 'assets', file: N('05_14_10', 6), slug: 'prop-locked-gate', kind: 'obj' },
  { dir: 'assets', file: N('05_14_10', 7), slug: 'prop-secret-amulet', kind: 'obj' },
  // 미사용 이동(2026-08-19 → _unused/assets-20260819): { dir: 'assets', file: N('05_14_10', 8), slug: 'prop-scroll-frame', kind: 'obj' },
  { dir: 'assets', file: N('05_14_11', 9), slug: 'prop-four-vials', kind: 'obj' },
  { dir: 'assets', file: N('05_14_11', 10), slug: 'prop-seed-cabinet', kind: 'obj' },

  // stage 3 — what if
  { dir: 'assets', file: N('05_14_25', 3), slug: 'prop-whatif-machine', kind: 'obj' },
  { dir: 'assets', file: N('05_14_25', 4), slug: 'prop-hourglass', kind: 'obj' },
  { dir: 'assets', file: N('05_14_26', 5), slug: 'prop-signpost', kind: 'obj' },
  { dir: 'assets', file: N('05_14_26', 6), slug: 'prop-theater-masks', kind: 'obj' },
  { dir: 'assets', file: N('05_14_28', 7), slug: 'prop-story-chest', kind: 'obj' },
  { dir: 'assets', file: N('05_14_28', 8), slug: 'prop-whatif-cards', kind: 'obj' },
  { dir: 'assets', file: N('05_14_28', 9), slug: 'prop-question-orb', kind: 'obj' },
  { dir: 'assets', file: N('05_14_29', 10), slug: 'prop-idea-easel', kind: 'obj' },

  // stage 3 — storyboard
  { dir: 'assets', file: N('05_14_44', 3), slug: 'prop-storyboard-easel', kind: 'obj' },
  { dir: 'assets', file: N('05_14_46', 4), slug: 'prop-quest-path', kind: 'obj' },
  { dir: 'assets', file: N('05_14_46', 5), slug: 'prop-crossroad-sign', kind: 'obj' },
  { dir: 'assets', file: N('05_14_47', 6), slug: 'prop-structure-crystals', kind: 'obj' },
  { dir: 'assets', file: N('05_14_49', 7), slug: 'prop-relation-board', kind: 'obj' },
  { dir: 'assets', file: N('05_14_50', 8), slug: 'prop-story-vortex', kind: 'obj' },
  { dir: 'assets', file: N('05_14_51', 9), slug: 'prop-mini-theater', kind: 'obj' },
  { dir: 'assets', file: N('05_14_52', 10), slug: 'prop-world-globe', kind: 'obj' },

  // stage 4 — writing & revision
  { dir: 'assets', file: N('05_15_05', 3), slug: 'prop-emotion-flasks', kind: 'obj' },
  // 미사용 이동(2026-08-19 → _unused/assets-20260819): { dir: 'assets', file: N('05_15_14', 3), slug: 'prop-revision-desk', kind: 'obj' },
  { dir: 'assets', file: N('05_15_15', 4), slug: 'prop-ink-vacuum', kind: 'obj' },
  { dir: 'assets', file: N('05_15_16', 6), slug: 'prop-branch-tree', kind: 'obj' },
  { dir: 'assets', file: N('05_15_17', 7), slug: 'prop-emotion-masks', kind: 'obj' },
  { dir: 'assets', file: N('05_15_18', 8), slug: 'prop-idea-crystals', kind: 'obj' },
  // 미사용 이동(2026-08-19 → _unused/assets-20260819): { dir: 'assets', file: N('05_15_19', 9), slug: 'prop-paper-portal', kind: 'obj' },
  // 미사용 이동(2026-08-19 → _unused/assets-20260819): { dir: 'assets', file: N('05_15_21', 10), slug: 'prop-seal-press', kind: 'obj' },
  // 미사용 이동(2026-08-19 → _unused/assets-20260819): { dir: 'assets', file: N('05_15_33', 3), slug: 'prop-ending-machine', kind: 'obj' },
  { dir: 'assets', file: N('05_15_33', 4), slug: 'prop-ink-vacuum-2', kind: 'obj' },
  { dir: 'assets', file: N('05_15_37', 6), slug: 'prop-branch-tree-2', kind: 'obj' },
  // 미사용 이동(2026-08-19 → _unused/assets-20260819): { dir: 'assets', file: N('05_15_37', 7), slug: 'prop-emotion-masks-2', kind: 'obj' },
  // 미사용 이동(2026-08-19 → _unused/assets-20260819): { dir: 'assets', file: N('05_15_38', 8), slug: 'prop-hint-crystals', kind: 'obj' },
  // 미사용 이동(2026-08-19 → _unused/assets-20260819): { dir: 'assets', file: N('05_15_39', 9), slug: 'prop-scroll-wreath', kind: 'obj' },
  // 미사용 이동(2026-08-19 → _unused/assets-20260819): { dir: 'assets', file: N('05_15_39', 10), slug: 'prop-seal-press-2', kind: 'obj' },

  // stage 5 — endings & completion
  // 미사용 이동(2026-08-19 → _unused/assets-20260819): { dir: 'assets', file: N('05_15_51', 3), slug: 'prop-ending-doors-wheel', kind: 'obj' },
  { dir: 'assets', file: N('05_15_51', 4), slug: 'prop-golden-gate', kind: 'obj' },
  { dir: 'assets', file: N('05_15_53', 5), slug: 'prop-mystery-portal', kind: 'obj' },
  { dir: 'assets', file: N('05_15_55', 6), slug: 'prop-mirror-gate', kind: 'obj' },
  { dir: 'assets', file: N('05_15_56', 7), slug: 'prop-film-wreath', kind: 'obj' },
  { dir: 'assets', file: N('05_15_57', 9), slug: 'prop-scene-tree', kind: 'obj' },
  // 미사용 이동(2026-08-19 → _unused/assets-20260819): { dir: 'assets', file: N('05_15_58', 10), slug: 'prop-seal-press-3', kind: 'obj' },
  { dir: 'assets', file: N('05_16_11', 3), slug: 'prop-bookshelf', kind: 'obj' },
  { dir: 'assets', file: N('05_16_11', 4), slug: 'prop-popup-book', kind: 'obj' },
  { dir: 'assets', file: N('05_16_13', 5), slug: 'badge-completion', kind: 'obj' },
  { dir: 'assets', file: N('05_16_13', 6), slug: 'prop-book-pedestal', kind: 'obj' },
  { dir: 'assets', file: N('05_16_14', 7), slug: 'prop-flying-books', kind: 'obj' },
  { dir: 'assets', file: N('05_16_14', 8), slug: 'prop-book-press', kind: 'obj' },
  { dir: 'assets', file: N('05_16_15', 9), slug: 'prop-shelf-return', kind: 'obj' },
  { dir: 'assets', file: N('05_16_15', 10), slug: 'badge-trophy', kind: 'obj' },

  // title
  { dir: 'assets', file: N('05_16_27'), slug: 'ui-title-logo', kind: 'title' },

  // backgrounds (page 1:1)
  { dir: 'background', file: N('05_13_15', 1), slug: 'bg-p01-library', kind: 'bg' },
  { dir: 'background', file: N('05_13_15', 2), slug: 'bg-p02-lab', kind: 'bg' },
  { dir: 'background', file: N('05_13_17', 3), slug: 'bg-p03-board', kind: 'bg' },
  { dir: 'background', file: N('05_13_17', 4), slug: 'bg-p04-workshop', kind: 'bg' },
  { dir: 'background', file: N('05_13_18', 5), slug: 'bg-p05-orrery', kind: 'bg' },
  { dir: 'background', file: N('05_13_18', 6), slug: 'bg-p06-frames', kind: 'bg' },
  { dir: 'background', file: N('05_13_19', 7), slug: 'bg-p07-theater', kind: 'bg' },
  { dir: 'background', file: N('05_13_20', 8), slug: 'bg-p08-corrupted', kind: 'bg' },
  { dir: 'background', file: N('05_13_21', 9), slug: 'bg-p09-doors', kind: 'bg' },
  { dir: 'background', file: N('05_13_21', 10), slug: 'bg-p10-bright', kind: 'bg' },
  // 2026-08-17 추가 — 코드로 그려 두었던 것을 실제 그림으로 교체
  { dir: 'assets', file: 'ChatGPT Image 2026년 8월 17일 오후 05_12_34 (1).png', slug: 'prop-ink-monster', kind: 'obj' },
  { dir: 'assets', file: 'ChatGPT Image 2026년 8월 17일 오후 05_12_35 (2).png', slug: 'tex-parchment', kind: 'title' },
  // 2026-08-18 추가 — P5 만약의 방 레버 (CSS 원+막대를 그림으로 교체)
  { dir: 'assets', file: 'ChatGPT Image 2026년 8월 18일 오후 09_00_17.png', slug: 'prop-whatif-lever', kind: 'obj' },
];

// 중복본 (MD5 동일) — 변환하지 않고 _source 로만 이동
export const DUPLICATES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => ({
  dir: 'assets',
  file: N('05_12_24', n),
}));
