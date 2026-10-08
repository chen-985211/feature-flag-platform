import { existsSync } from 'node:fs';
import path from 'node:path';
import { root, run } from './project.mjs';

export async function buildDocker(
  image = process.env.DIDI_IMAGE ?? 'didi:local',
) {
  await run('docker', ['build', '--tag', image, '.']);
}

export async function compose(args) {
  const environment = path.join(root, '.env.docker');
  if (!existsSync(environment))
    throw new Error(
      'Copy .env.docker.example to .env.docker and set its passwords first',
    );
  await run('docker', [
    'compose',
    '--env-file',
    environment,
    '-f',
    path.join(root, 'compose.yaml'),
    ...args,
  ]);
}
