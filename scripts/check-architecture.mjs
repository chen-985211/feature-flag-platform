import { execFileSync } from 'node:child_process';
import { root, run } from './lib/project.mjs';
import path from 'node:path';

await run('pnpm', ['check:frontend-architecture']);
const backend = path.join(root, 'backend');
const standard = new Set(
  execFileSync('go', ['list', 'std'], { cwd: backend, encoding: 'utf8' })
    .trim()
    .split('\n'),
);
const packages = execFileSync(
  'go',
  ['list', '-f', '{{.ImportPath}} {{.Imports}}', './...'],
  { cwd: backend, encoding: 'utf8' },
)
  .trim()
  .split('\n');
const errors = [];
const within = (name, base) => name === base || name.startsWith(`${base}/`);
for (const row of packages) {
  const [name, ...dependencies] = row
    .replaceAll('[', '')
    .replaceAll(']', '')
    .split(' ')
    .filter(Boolean);
  const ownContext = name.match(/\/contexts\/([^/]+)\//)?.[1];
  const layerRoot = name.match(/^(.*)\/(?:domain|application)(?:\/|$)/)?.[1];
  for (const dependency of dependencies) {
    if (
      /\/domain(?:\/|$)/.test(name) &&
      !standard.has(dependency) &&
      !within(dependency, `${layerRoot}/domain`)
    )
      errors.push(`${name}: domain imports ${dependency}`);
    if (
      /\/application(?:\/|$)/.test(name) &&
      !standard.has(dependency) &&
      !within(dependency, `${layerRoot}/domain`) &&
      !within(dependency, `${layerRoot}/application`)
    )
      errors.push(`${name}: application imports ${dependency}`);
    const targetContext = dependency.match(/\/contexts\/([^/]+)\//)?.[1];
    if (
      ownContext &&
      targetContext &&
      ownContext !== targetContext &&
      !within(
        dependency,
        `didi/backend/internal/contexts/${targetContext}/public`,
      )
    )
      errors.push(`${name}: crosses private context ${dependency}`);
  }
}
if (errors.length) {
  console.error(errors.join('\n'));
  process.exitCode = 1;
} else console.log('PASS: Go package dependencies point inward.');
