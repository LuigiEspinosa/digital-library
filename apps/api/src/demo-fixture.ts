/**
 * The demo scope's baseline fixture (cuatro-portfolio Story 5.9, AD-13, the
 * record `ops/demo-principal.md` § The reset there): one library and the books in
 * it, with fixed ids and fixed times. Each book's file is a one-page PDF built
 * from the text below, byte for byte the same on every build, so the fixture
 * ships inside the compiled API (the image carries `dist` only) and the reset
 * writes the same bytes every time. The texts are in the public domain.
 */

export const DEMO_LIBRARY = {
  id: 'demo-library',
  name: 'Demo library',
  description: 'A shared demo library. Anything added here is removed at the next reset.',
  created_at: '2026-10-01 00:00:00',
};

export const DEMO_BOOKS = [
  {
    id: 'demo-book-1',
    title: 'Pride and Prejudice',
    author: 'Jane Austen',
    published_at: '1813',
    language: 'en',
    created_at: '2026-10-01 00:00:00',
    text: [
      'It is a truth universally acknowledged, that a single man in possession',
      'of a good fortune, must be in want of a wife.',
    ],
  },
  {
    id: 'demo-book-2',
    title: "Alice's Adventures in Wonderland",
    author: 'Lewis Carroll',
    published_at: '1865',
    language: 'en',
    created_at: '2026-10-01 00:00:00',
    text: [
      'Alice was beginning to get very tired of sitting by her sister on the bank,',
      'and of having nothing to do: once or twice she had peeped into the book her',
      'sister was reading, but it had no pictures or conversations in it.',
    ],
  },
  {
    id: 'demo-book-3',
    title: 'The Time Machine',
    author: 'H. G. Wells',
    published_at: '1895',
    language: 'en',
    created_at: '2026-10-01 00:00:00',
    text: [
      'The Time Traveller (for so it will be convenient to speak of him) was',
      'expounding a recondite matter to us.',
    ],
  },
];

/** A one-page PDF 1.4 of a title and its lines, ASCII only, with a correct xref. */
export function demoPdf(title: string, lines: string[]): Buffer {
  const esc = (s: string) => s.replace(/[\\()]/g, (c) => `\\${c}`);
  const content = [
    'BT',
    '/F1 18 Tf',
    '72 720 Td',
    `(${esc(title)}) Tj`,
    '/F1 11 Tf',
    '0 -32 Td',
    ...lines.flatMap((line) => [`(${esc(line)}) Tj`, '0 -16 Td']),
    'ET',
  ].join('\n');
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${Buffer.byteLength(content, 'latin1')} >>\nstream\n${content}\nendstream`,
  ];
  let out = '%PDF-1.4\n';
  const offsets: number[] = [];
  objects.forEach((body, i) => {
    offsets.push(Buffer.byteLength(out, 'latin1'));
    out += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = Buffer.byteLength(out, 'latin1');
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  out += offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('');
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, 'latin1');
}
