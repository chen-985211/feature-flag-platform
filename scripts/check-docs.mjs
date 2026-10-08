import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { files, root } from './lib/project.mjs';

const prose = (text) => text.replace(/^```[^\n]*\n[\s\S]*?^```[^\n]*$/gm, '');
function anchors(file) {
  const counts = new Map();
  return new Set(
    [
      ...prose(readFileSync(file, 'utf8')).matchAll(/^#{1,6}\s+(.+?)\s*$/gm),
    ].map(([, heading]) => {
      const slug = heading
        .replaceAll('`', '')
        .toLowerCase()
        .replace(/[^\p{L}\p{N}_\-\s]/gu, '')
        .replaceAll(' ', '-');
      const count = counts.get(slug) ?? 0;
      counts.set(slug, count + 1);
      return count ? `${slug}-${count}` : slug;
    }),
  );
}
const docs = files('*.md').map((name) => path.join(root, name));
const errors = [];
const graph = new Map();
let links = 0;
for (const file of docs) {
  const text = readFileSync(file, 'utf8');
  const label = path.relative(root, file);
  graph.set(file, []);
  if (!text.startsWith('# ')) errors.push(`${label}: missing H1`);
  if ([...text.matchAll(/^```/gm)].length % 2)
    errors.push(`${label}: unbalanced fences`);
  if (!text.endsWith('\n') || text.endsWith('\n\n'))
    errors.push(`${label}: expected one final newline`);
  text.split('\n').forEach((line, i) => {
    if (line.trimEnd() !== line)
      errors.push(`${label}:${i + 1}: trailing whitespace`);
  });
  for (const [, href] of prose(text).matchAll(/\[[^\]]+\]\(([^)]+)\)/g)) {
    if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(href)) continue;
    const [local, fragment] = href.split('#');
    const target = local
      ? path.resolve(path.dirname(file), decodeURIComponent(local))
      : file;
    links++;
    if (!existsSync(target)) {
      errors.push(`${label}: missing ${href}`);
      continue;
    }
    graph.get(file).push(target);
    if (
      fragment &&
      target.endsWith('.md') &&
      !anchors(target).has(decodeURIComponent(fragment))
    )
      errors.push(`${label}: invalid anchor ${href}`);
  }
}
const seen = new Set();
const pending = [path.join(root, 'AGENTS.md'), path.join(root, 'README.md')];
while (pending.length) {
  const file = pending.pop();
  if (!seen.has(file)) {
    seen.add(file);
    pending.push(...(graph.get(file) ?? []));
  }
}
for (const file of docs)
  if (!seen.has(file))
    errors.push(
      `${path.relative(root, file)}: unreachable from documentation entry`,
    );
if (errors.length) {
  console.error(errors.join('\n'));
  process.exitCode = 1;
} else
  console.log(
    `PASS: ${docs.length} Markdown files, ${links} internal links/anchors, navigation, fences and whitespace.`,
  );
