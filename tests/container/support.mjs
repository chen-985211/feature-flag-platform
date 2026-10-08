import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import path from 'node:path';
import { root } from '../../scripts/lib/project.mjs';

export async function docker(
  args,
  env = process.env,
  input,
  allowFailure = false,
) {
  return await new Promise((resolve, reject) => {
    const child = spawn('docker', args, {
      cwd: root,
      env,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    const stdout = [],
      stderr = [];
    const interrupt = () => child.kill('SIGINT');
    const terminate = () => child.kill('SIGTERM');
    process.once('SIGINT', interrupt);
    process.once('SIGTERM', terminate);
    const detach = () => {
      process.removeListener('SIGINT', interrupt);
      process.removeListener('SIGTERM', terminate);
    };
    child.stdout.on('data', (data) => stdout.push(data));
    child.stderr.on('data', (data) => stderr.push(data));
    child.stdin.on('error', () => {
      /* Exit status reports a rejected input pipe. */
    });
    child.once('error', () => {
      detach();
      reject(
        new Error(
          'Docker CLI/engine is unavailable; prepare Docker before test:docker',
        ),
      );
    });
    child.once('close', (code, signal) => {
      detach();
      let diagnostic = Buffer.concat(stderr).toString();
      for (const key of [
        'POSTGRES_PASSWORD',
        'SEED_ADMIN_PASSWORD',
        'SEED_EDITOR_PASSWORD',
        'SEED_VIEWER_PASSWORD',
        'E2E_PASSWORD',
      ]) {
        if (env[key])
          diagnostic = diagnostic.split(env[key]).join('[redacted]');
      }
      if (code !== 0 && !allowFailure)
        reject(
          new Error(
            `Docker ${args[0]} failed (${code ?? signal}): ${diagnostic}`,
          ),
        );
      else resolve({ code, output: Buffer.concat(stdout), diagnostic });
    });
    child.stdin.end(input);
  });
}

export async function freePort() {
  const listener = createServer();
  await new Promise((resolve, reject) => {
    listener.once('error', reject);
    listener.listen(0, '127.0.0.1', resolve);
  });
  const port = listener.address().port;
  await new Promise((resolve, reject) =>
    listener.close((error) => (error ? reject(error) : resolve())),
  );
  return port;
}

export function project(name, directory, port, password, databasePassword) {
  const file = path.join(directory, `${name}.env`);
  const env = {
    ...process.env,
    POSTGRES_PASSWORD: databasePassword,
    APP_PORT: String(port),
    APP_ORIGIN: `http://127.0.0.1:${port}`,
    SEED_ADMIN_PASSWORD: password,
    SEED_EDITOR_PASSWORD: password,
    SEED_VIEWER_PASSWORD: password,
    DIDI_IMAGE: 'didi:local',
  };
  writeFileSync(
    file,
    Object.entries(env)
      .filter(([key]) =>
        [
          'POSTGRES_PASSWORD',
          'APP_PORT',
          'APP_ORIGIN',
          'SEED_ADMIN_PASSWORD',
          'SEED_EDITOR_PASSWORD',
          'SEED_VIEWER_PASSWORD',
          'DIDI_IMAGE',
        ].includes(key),
      )
      .map(([key, value]) => `${key}='${value}'`)
      .join('\n') + '\n',
    { mode: 0o600 },
  );
  const base = [
    'compose',
    '--project-name',
    name,
    '--env-file',
    file,
    '-f',
    path.join(root, 'compose.yaml'),
  ];
  return {
    name,
    env,
    origin: env.APP_ORIGIN,
    compose: (args, input, allowFailure) =>
      docker([...base, ...args], env, input, allowFailure),
    async sql(query) {
      const result = await docker(
        [
          ...base,
          'exec',
          '-T',
          'db',
          'psql',
          '-U',
          'didi',
          '-d',
          'didi',
          '-At',
          '-v',
          'ON_ERROR_STOP=1',
          '-c',
          query,
        ],
        env,
      );
      return result.output.toString().trim();
    },
  };
}

export function report(name, value) {
  const directory = path.join(root, 'test-results', 'docker', name);
  mkdirSync(directory, { recursive: true });
  writeFileSync(
    path.join(directory, 'verification.json'),
    JSON.stringify(value, null, 2) + '\n',
  );
}
