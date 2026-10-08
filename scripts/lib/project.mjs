import { execFileSync, spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export const root = fileURLToPath(new URL('../../', import.meta.url));
export function files(pattern = '*') {
  return [
    ...new Set(
      execFileSync(
        'git',
        [
          'ls-files',
          '-z',
          '--cached',
          '--others',
          '--exclude-standard',
          '--',
          pattern,
        ],
        { cwd: root, encoding: 'utf8' },
      )
        .split('\0')
        .filter((name) => name && existsSync(path.join(root, name))),
    ),
  ].sort();
}
export function loadEnvironment() {
  const envFile = path.join(root, '.env');
  if (existsSync(envFile)) process.loadEnvFile(envFile);
}
export async function run(command, args, cwd = root, env = process.env) {
  console.log(`> ${command} ${args.join(' ')}`);
  await new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, env, stdio: 'inherit' });
    const interrupt = () => child.kill('SIGINT');
    const terminate = () => child.kill('SIGTERM');
    const detach = () => {
      process.removeListener('SIGINT', interrupt);
      process.removeListener('SIGTERM', terminate);
    };
    process.once('SIGINT', interrupt);
    process.once('SIGTERM', terminate);
    child.once('error', (error) => {
      detach();
      reject(error);
    });
    child.once('exit', (code, signal) => {
      detach();
      code === 0
        ? resolve()
        : reject(new Error(`${command} failed (${code ?? signal})`));
    });
  });
}
