import { randomBytes } from 'node:crypto';
import { execFileSync, spawn } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { files, loadEnvironment, root, run } from './lib/project.mjs';

loadEnvironment();
const backend = path.join(root, 'backend');
const tool = path.join(root, '.tools', 'bin', 'golangci-lint');
const tasks = {
  async 'install-tools'() {
    mkdirSync(path.dirname(tool), { recursive: true });
    await run(
      'go',
      [
        'install',
        'github.com/golangci/golangci-lint/v2/cmd/golangci-lint@v2.14.0',
      ],
      root,
      { ...process.env, GOBIN: path.dirname(tool) },
    );
  },
  async 'format-go'() {
    await run('gofmt', ['-w', ...files('*.go')]);
  },
  'format-go-check'() {
    const output = execFileSync('gofmt', ['-l', ...files('*.go')], {
      cwd: root,
      encoding: 'utf8',
    });
    if (output.trim()) throw new Error(`Go formatting required:\n${output}`);
  },
  async 'lint-go'() {
    if (!existsSync(tool)) throw new Error('Run pnpm tools:install first');
    const version = execFileSync(tool, ['version', '--short'], {
      encoding: 'utf8',
    }).trim();
    if (!version.includes('2.14.0'))
      throw new Error('golangci-lint must be v2.14.0');
    await run('go', ['vet', './...'], backend);
    await run(tool, ['run', '--config', '../.golangci.yml'], backend);
  },
  async check() {
    for (const task of [
      'check:docs',
      'check:project',
      'format:check',
      'typecheck',
      'lint',
      'check:architecture',
      'check:unused',
    ])
      await run('pnpm', [task]);
  },
  async 'test-unit'() {
    await run('go', ['test', './internal/...', '-count=1'], backend);
    await run('pnpm', ['--dir', 'frontend', 'test:unit']);
  },
  async 'test-integration'() {
    await run('go', ['test', './tests/integration/...', '-count=1'], backend);
  },
  async 'test-race'() {
    await run('go', ['test', '-race', './...', '-count=1'], backend);
  },
  async build() {
    await run('pnpm', ['--dir', 'frontend', 'build']);
    const assets = path.join(backend, 'internal/platform/web/assets');
    mkdirSync(assets, { recursive: true });
    for (const file of readdirSync(assets))
      if (file !== '.gitkeep')
        rmSync(path.join(assets, file), { recursive: true });
    cpSync(path.join(root, 'frontend/dist'), assets, { recursive: true });
    mkdirSync(path.join(root, '.build'), { recursive: true });
    await run(
      'go',
      ['build', '-o', '../.build/didi-server', './cmd/server'],
      backend,
    );
    await run(
      'go',
      ['build', '-o', '../.build/didi-migrate', './cmd/migrate'],
      backend,
    );
    await run(
      'go',
      ['build', '-o', '../.build/didi-seed', './cmd/seed'],
      backend,
    );
  },
  async 'seed-users'() {
    await run('go', ['run', './cmd/seed'], backend);
  },
  async 'test-e2e'() {
    await tasks.build();
    await run(
      'pnpm',
      ['--dir', 'frontend', 'exec', 'playwright', 'test'],
      root,
      { ...process.env, E2E_PASSWORD: randomBytes(24).toString('hex') },
    );
  },
  async 'e2e-server'() {
    await run(
      'go',
      ['build', '-o', '../.build/didi-e2e-server', './tests/e2e/server'],
      backend,
    );
    await run(path.join(root, '.build/didi-e2e-server'), []);
  },
  async start() {
    await run(path.join(root, '.build/didi-server'), []);
  },
  async migrate() {
    await run('go', ['run', './cmd/migrate', 'up'], backend);
  },
  async 'migrate-down'() {
    await run('go', ['run', './cmd/migrate', 'down'], backend);
  },
  async 'dev-backend'() {
    await run('go', ['run', './cmd/server'], backend);
  },
  async dev() {
    mkdirSync(path.join(root, '.build'), { recursive: true });
    await run(
      'go',
      ['build', '-o', '../.build/didi-server', './cmd/server'],
      backend,
    );
    const children = [
      spawn(path.join(root, '.build/didi-server'), [], {
        cwd: root,
        stdio: 'inherit',
      }),
      spawn('pnpm', ['--dir', 'frontend', 'dev'], {
        cwd: root,
        stdio: 'inherit',
      }),
    ];
    const close = () => children.forEach((child) => child.kill('SIGTERM'));
    process.once('SIGINT', close);
    process.once('SIGTERM', close);
    await Promise.all(
      children.map(
        (child) =>
          new Promise((resolve, reject) => {
            child.once('error', (error) => {
              close();
              reject(error);
            });
            child.once('exit', (code, signal) => {
              close();
              if (code === 0 || signal === 'SIGTERM' || signal === 'SIGINT')
                resolve();
              else
                reject(
                  new Error(`Development child exited (${code ?? signal})`),
                );
            });
          }),
      ),
    );
  },
  async verify() {
    await tasks.check();
    for (const task of [
      'test:unit',
      'test:component',
      'test:contract',
      'test:integration',
      'build',
    ])
      await run('pnpm', [task]);
  },
  async 'verify-full'() {
    await tasks.verify();
    await tasks['test-race']();
    await run(
      'pnpm',
      ['--dir', 'frontend', 'exec', 'playwright', 'test'],
      root,
      { ...process.env, E2E_PASSWORD: randomBytes(24).toString('hex') },
    );
  },
};
try {
  const name = process.argv[2];
  if (!Object.hasOwn(tasks, name)) throw new Error(`Unknown task: ${name}`);
  await tasks[name]();
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
