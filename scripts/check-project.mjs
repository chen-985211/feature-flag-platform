import { readFileSync } from 'node:fs';
import { files, root } from './lib/project.mjs';
import path from 'node:path';

const errors = [];
for (const file of files()) {
  if (
    /\.(?:ts|tsx|mjs|cjs|go|sql|css)$/.test(file) &&
    readFileSync(path.join(root, file), 'utf8').trimEnd().split('\n').length >
      700
  )
    errors.push(`${file}: exceeds 700 lines`);
  if (file.endsWith('.py'))
    errors.push(`${file}: project checks must use Node`);
  if (file.endsWith('package.json')) {
    const manifest = JSON.parse(readFileSync(path.join(root, file), 'utf8'));
    for (const section of ['dependencies', 'devDependencies'])
      for (const [name, version] of Object.entries(manifest[section] ?? {}))
        if (!/^\d+\.\d+\.\d+$/.test(version))
          errors.push(`${file}: ${name} must use exact version`);
  }
}
if (errors.length) {
  console.error(errors.join('\n'));
  process.exitCode = 1;
} else
  console.log(
    'PASS: exact dependency versions, file size and Node-only project scripts.',
  );
