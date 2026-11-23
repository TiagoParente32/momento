import type { ReactNode } from 'react';

/**
 * Minimal, safe markdown renderer (builds React nodes; never uses innerHTML).
 * Supports headings, bullet/numbered lists, fenced code, blockquotes, hr,
 * **bold**, *italic*, `code` and [links](https://…).
 */
function inline(text: string, keyBase: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|__[^_]+__|`[^`]+`|\*[^*\s][^*]*\*|_[^_\s][^_]*_|\[[^\]]+\]\(https?:\/\/[^)\s]+\))/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const tok = m[0];
    const k = `${keyBase}-${i++}`;
    if (tok.startsWith('**') || tok.startsWith('__')) out.push(<strong key={k}>{tok.slice(2, -2)}</strong>);
    else if (tok.startsWith('`')) out.push(<code key={k} className="rounded bg-ink/10 px-1 py-0.5 text-[0.85em]">{tok.slice(1, -1)}</code>);
    else if (tok.startsWith('[')) {
      const mm = tok.match(/^\[([^\]]+)\]\(([^)]+)\)$/)!;
      out.push(<a key={k} href={mm[2]} target="_blank" rel="noreferrer" className="text-accent underline">{mm[1]}</a>);
    } else out.push(<em key={k}>{tok.slice(1, -1)}</em>);
    last = m.index + tok.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function Markdown({ text }: { text: string }) {
  const lines = text.replace(/\r/g, '').split('\n');
  const blocks: ReactNode[] = [];
  let i = 0;
  let key = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (/^```/.test(line)) {
      const buf: string[] = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) buf.push(lines[i++]);
      i++;
      blocks.push(<pre key={key++} className="my-2 overflow-x-auto rounded-lg bg-ink/5 p-3 text-xs"><code>{buf.join('\n')}</code></pre>);
      continue;
    }
    const h = line.match(/^(#{1,4})\s+(.*)$/);
    if (h) {
      const cls = h[1].length === 1 ? 'text-lg font-bold' : h[1].length === 2 ? 'text-base font-semibold' : 'text-sm font-semibold';
      blocks.push(<p key={key++} className={`${cls} mt-3 mb-1`}>{inline(h[2], `h${key}`)}</p>);
      i++;
      continue;
    }
    if (/^\s*([-*•]|\d+[.)])\s+/.test(line)) {
      const ordered = /^\s*\d+[.)]/.test(line);
      const items: ReactNode[] = [];
      while (i < lines.length && /^\s*([-*•]|\d+[.)])\s+/.test(lines[i])) {
        const content = lines[i].replace(/^\s*([-*•]|\d+[.)])\s+/, '').replace(/^\[( |x)\]\s*/i, (_m, c) => (c.trim() ? '✓ ' : '☐ '));
        items.push(<li key={i}>{inline(content, `li${i}`)}</li>);
        i++;
      }
      blocks.push(ordered
        ? <ol key={key++} className="my-1 list-decimal space-y-0.5 pl-5">{items}</ol>
        : <ul key={key++} className="my-1 list-disc space-y-0.5 pl-5">{items}</ul>);
      continue;
    }
    if (/^>\s?/.test(line)) {
      const buf: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) buf.push(lines[i++].replace(/^>\s?/, ''));
      blocks.push(<blockquote key={key++} className="my-2 border-l-2 border-accent pl-3 text-muted">{inline(buf.join(' '), `q${key}`)}</blockquote>);
      continue;
    }
    if (/^(-{3,}|\*{3,})$/.test(line.trim())) { blocks.push(<hr key={key++} className="my-3 border-line/15" />); i++; continue; }
    if (!line.trim()) { i++; continue; }
    const buf: string[] = [];
    while (i < lines.length && lines[i].trim() && !/^(```|#{1,4}\s|\s*([-*•]|\d+[.)])\s+|>)/.test(lines[i])) buf.push(lines[i++]);
    blocks.push(<p key={key++} className="my-1.5">{inline(buf.join(' '), `p${key}`)}</p>);
  }
  return <div className="text-sm leading-relaxed">{blocks}</div>;
}
