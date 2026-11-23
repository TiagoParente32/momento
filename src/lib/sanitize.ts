// Allowlist HTML sanitizer for note content.
const ALLOWED = new Set([
  'P', 'BR', 'DIV', 'SPAN', 'B', 'STRONG', 'I', 'EM', 'U', 'S', 'STRIKE', 'H1', 'H2', 'H3',
  'UL', 'OL', 'LI', 'BLOCKQUOTE', 'CODE', 'PRE', 'A', 'HR',
]);
// Elements whose content must be dropped entirely, not unwrapped.
const DROP = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'TEMPLATE', 'NOSCRIPT', 'SVG', 'MATH', 'HEAD', 'TITLE', 'META', 'LINK']);

function clean(node: Node, doc: Document) {
  for (const child of Array.from(node.childNodes)) {
    if (child.nodeType === Node.TEXT_NODE) continue;
    if (child.nodeType !== Node.ELEMENT_NODE) { child.remove(); continue; }
    const el = child as Element;
    const tag = el.tagName.toUpperCase();
    if (DROP.has(tag)) { el.remove(); continue; }
    if (!ALLOWED.has(tag)) {
      clean(el, doc);
      const frag = doc.createDocumentFragment();
      while (el.firstChild) frag.appendChild(el.firstChild);
      el.replaceWith(frag);
      continue;
    }
    for (const attr of Array.from(el.attributes)) {
      const name = attr.name.toLowerCase();
      if (tag === 'A' && name === 'href') {
        const v = attr.value.trim();
        if (!/^(https?:|mailto:)/i.test(v)) el.removeAttribute(attr.name);
        continue;
      }
      el.removeAttribute(attr.name);
    }
    if (tag === 'A') {
      el.setAttribute('target', '_blank');
      el.setAttribute('rel', 'noopener noreferrer');
    }
    clean(el, doc);
  }
}

export function sanitizeHtml(html: string): string {
  if (!html) return '';
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
  clean(doc.body, doc);
  return doc.body.innerHTML;
}

/** Plain text from note HTML, keeping line breaks between blocks. */
export function htmlToText(html: string): string {
  if (!html) return '';
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
  doc.body.querySelectorAll('br').forEach((b) => b.replaceWith('\n'));
  doc.body.querySelectorAll('p,div,h1,h2,h3,li,blockquote,pre,hr').forEach((b) => b.append('\n'));
  doc.body.querySelectorAll('li').forEach((li) => li.prepend('• '));
  return (doc.body.textContent ?? '').replace(/\n{3,}/g, '\n\n').trim();
}

/** Lightweight HTML → Markdown for export. */
export function htmlToMarkdown(html: string): string {
  const doc = new DOMParser().parseFromString(`<body>${sanitizeHtml(html)}</body>`, 'text/html');
  const walk = (n: Node, listCtx?: { ordered: boolean; i: number }): string => {
    if (n.nodeType === Node.TEXT_NODE) return n.textContent ?? '';
    if (n.nodeType !== Node.ELEMENT_NODE) return '';
    const el = n as Element;
    const inner = (ctx?: { ordered: boolean; i: number }) => Array.from(el.childNodes).map((c) => walk(c, ctx)).join('');
    switch (el.tagName) {
      case 'B': case 'STRONG': return `**${inner()}**`;
      case 'I': case 'EM': return `*${inner()}*`;
      case 'S': case 'STRIKE': return `~~${inner()}~~`;
      case 'U': return inner();
      case 'CODE': return el.parentElement?.tagName === 'PRE' ? inner() : '`' + inner() + '`';
      case 'PRE': return '\n```\n' + inner() + '\n```\n';
      case 'H1': return `\n# ${inner()}\n`;
      case 'H2': return `\n## ${inner()}\n`;
      case 'H3': return `\n### ${inner()}\n`;
      case 'BR': return '\n';
      case 'HR': return '\n---\n';
      case 'A': return `[${inner()}](${el.getAttribute('href') ?? ''})`;
      case 'BLOCKQUOTE': return '\n' + inner().split('\n').map((l) => `> ${l}`).join('\n') + '\n';
      case 'UL': return '\n' + inner({ ordered: false, i: 0 }) + '\n';
      case 'OL': return '\n' + inner({ ordered: true, i: 0 }) + '\n';
      case 'LI': {
        const prefix = listCtx?.ordered ? `${++listCtx.i}. ` : '- ';
        return prefix + inner().trim() + '\n';
      }
      case 'P': case 'DIV': return '\n' + inner() + '\n';
      default: return inner();
    }
  };
  return walk(doc.body).replace(/\n{3,}/g, '\n\n').trim() + '\n';
}
