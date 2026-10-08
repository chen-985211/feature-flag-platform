import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { root, run } from '../../scripts/lib/project.mjs';
import { buildDocker } from '../../scripts/lib/docker.mjs';
import { docker, freePort, project, report } from './support.mjs';

const countsSQL = `SELECT json_build_object('users',(SELECT count(*) FROM users),'flags',(SELECT count(*) FROM flags),'rules',(SELECT count(*) FROM rules),'versions',(SELECT count(*) FROM flag_versions),'audits',(SELECT count(*) FROM audit_entries))`;

async function login(origin, username, password) {
  const response = await fetch(origin + '/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: origin },
    body: JSON.stringify({ username, password }),
    signal: AbortSignal.timeout(10000),
  });
  assert.equal(response.status, 200, 'container login must succeed');
  const session = await response.json();
  assert.equal(session.user.username, username);
  const cookie = response.headers.get('set-cookie')?.split(';')[0];
  assert.ok(cookie && session.csrf_token, 'real Cookie and CSRF required');
  return {
    async request(url, method = 'GET', body, status = 200) {
      const response = await fetch(origin + url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Origin: origin,
          Cookie: cookie,
          'X-CSRF-Token': session.csrf_token,
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
        signal: AbortSignal.timeout(10000),
      });
      assert.equal(
        response.status,
        status,
        `${method} ${url}: unexpected container response`,
      );
      return status === 204 ? undefined : await response.json();
    },
  };
}

async function expectReady(stack) {
  const response = await fetch(stack.origin + '/health/ready', {
    signal: AbortSignal.timeout(5000),
  });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).status, 'ready');
  assert.equal(
    await stack.sql(
      "SELECT version::text || '/' || dirty::text FROM schema_migrations",
    ),
    '1/false',
  );
}

async function preservedState(stack, password, expected) {
  const admin = await login(stack.origin, 'admin', password);
  assert.deepEqual(
    await admin.request(`/api/flags/${expected.id}`),
    expected,
    'configuration must survive lifecycle operations',
  );
  const result = await admin.request('/api/evaluations', 'POST', {
    environment: 'development',
    key: expected.key,
    attributes: {},
  });
  assert.equal(result.value, false);
  assert.equal(result.source, 'default');
  assert.equal(result.revision, 2);
  const history = await admin.request(`/api/flags/${expected.id}/history`);
  assert.equal(history.total, 2);
  assert.equal(history.items[0].revision, 2);
  await admin.request('/api/auth/logout', 'POST', undefined, 204);
}

export async function runDockerSmoke() {
  await docker(['info', '--format', '{{.ServerVersion}}']);
  await buildDocker('didi:local');
  const inspect = JSON.parse(
    (await docker(['image', 'inspect', 'didi:local'])).output.toString(),
  )[0];
  assert.equal(inspect.Config.User, '65532:65532');
  const name = 'didi-smoke-' + randomBytes(6).toString('hex');
  const directory = mkdtempSync(path.join(tmpdir(), 'didi-container-'));
  const password = randomBytes(24).toString('hex');
  // URL-special characters prove PGPASSWORD works without DSN interpolation.
  const databasePassword = randomBytes(24).toString('hex') + ':p@/$?&%';
  const stack = project(
    name,
    directory,
    await freePort(),
    password,
    databasePassword,
  );
  const restored = project(
    name + '-restore',
    directory,
    await freePort(),
    password,
    databasePassword,
  );
  const evidence = {
    image: inspect.Id,
    platform: `${inspect.Os}/${inspect.Architecture}`,
    user: inspect.Config.User,
    checks: [],
  };
  const step = (message) => {
    console.log('Docker smoke: ' + message);
    evidence.checks.push(message);
  };
  const failures = [];
  try {
    await stack.compose(['config', '--quiet']);
    await stack.compose(['up', '-d', '--wait', '--wait-timeout', '120', 'app']);
    await expectReady(stack);
    const container = (await stack.compose(['ps', '-q', 'app'])).output
      .toString()
      .trim();
    const runtime = JSON.parse(
      (
        await docker(['inspect', '--format', '{{json .HostConfig}}', container])
      ).output.toString(),
    );
    assert.equal(runtime.ReadonlyRootfs, true);
    assert.deepEqual(runtime.CapDrop, ['ALL']);
    const seed = await stack.compose(['run', '--rm', 'seed']);
    assert.match(seed.output.toString(), /created=5 preserved=0/);
    assert.deepEqual(JSON.parse(await stack.sql(countsSQL)), {
      users: 3,
      flags: 5,
      rules: 5,
      versions: 5,
      audits: 5,
    });
    const page = await fetch(stack.origin + '/', {
      signal: AbortSignal.timeout(5000),
    });
    assert.equal(page.status, 200);
    assert.match(await page.text(), /\/assets\/.*\.js/);
    step(
      'empty volume → migration v1/clean → non-root/read-only app healthy → explicit demo seed',
    );

    const admin = await login(stack.origin, 'admin', password);
    const list = await admin.request(
      '/api/flags?environment=development&q=demo-default',
    );
    assert.equal(list.total, 1);
    const initial = list.items[0];
    const changed = await admin.request(`/api/flags/${initial.id}`, 'PUT', {
      name: '容器持久化配置',
      key: 'docker-preserved',
      default_value: false,
      expected_revision: 1,
    });
    assert.equal(changed.revision, 2);
    const stale = await admin.request(
      `/api/flags/${initial.id}`,
      'PUT',
      {
        name: 'Must not overwrite',
        key: 'stale',
        default_value: true,
        expected_revision: 1,
      },
      409,
    );
    assert.equal(stale.error.code, 'VERSION_CONFLICT');
    const viewer = await login(stack.origin, 'viewer', password);
    const denied = await viewer.request(
      `/api/flags/${initial.id}/enabled`,
      'PATCH',
      { enabled: false, expected_revision: 2 },
      403,
    );
    assert.equal(denied.error.code, 'FORBIDDEN');
    await preservedState(stack, password, changed);
    await viewer.request('/api/auth/logout', 'POST', undefined, 204);
    await admin.request('/api/auth/logout', 'POST', undefined, 204);
    step(
      'real login → edited demo r2 → stale revision/readonly rejected → evaluation + atomic history → logout',
    );

    await run(
      'pnpm',
      ['--dir', 'frontend', 'exec', 'playwright', 'test'],
      root,
      {
        ...process.env,
        E2E_PASSWORD: password,
        E2E_ADMIN_USERNAME: 'admin',
        E2E_ADMIN_NAME: '管理员',
        E2E_EDITOR_USERNAME: 'editor',
        E2E_VIEWER_USERNAME: 'viewer',
        E2E_CONTAINER_URL: stack.origin,
        E2E_ARTIFACTS_DIR: path.join(
          root,
          'test-results',
          'docker',
          name,
          'browser',
        ),
      },
    );
    step(
      'four existing Playwright journeys through embedded container app and isolated PostgreSQL (retries=0)',
    );

    const before = JSON.parse(await stack.sql(countsSQL));
    await stack.compose(['down', '--remove-orphans']);
    await stack.compose(['up', '-d', '--wait', '--wait-timeout', '120', 'app']);
    await expectReady(stack);
    const repeat = await stack.compose(['run', '--rm', 'seed']);
    assert.match(repeat.output.toString(), /created=0 preserved=5/);
    await stack.compose(['run', '--rm', 'migrate']);
    assert.deepEqual(JSON.parse(await stack.sql(countsSQL)), before);
    await preservedState(stack, password, changed);
    step(
      'containers removed/recreated with same volume; migrate/seed repeated without resetting configuration/version/audit',
    );

    await stack.compose(['stop', 'app']);
    await stack.sql('UPDATE schema_migrations SET dirty=true');
    const rejected = await stack.compose(['up', '-d', 'app'], undefined, true);
    assert.notEqual(
      rejected.code,
      0,
      'failed migration must block app startup',
    );
    const migration = (await stack.compose(['ps', '-aq', 'migrate'])).output
      .toString()
      .trim();
    const migrationState = JSON.parse(
      (
        await docker(['inspect', '--format', '{{json .State}}', migration])
      ).output.toString(),
    );
    assert.equal(migrationState.Running, false);
    assert.equal(migrationState.ExitCode, 1);
    assert.match(
      (
        await stack.compose(['logs', '--no-color', 'migrate'])
      ).output.toString(),
      /MIGRATION_FAILED/,
    );
    assert.equal(
      (
        await docker([
          'inspect',
          '--format',
          '{{.State.Running}}',
          (await stack.compose(['ps', '-aq', 'app'])).output.toString().trim(),
        ])
      ).output
        .toString()
        .trim(),
      'false',
    );
    // This owned fixture changes only the migration marker, never migration SQL.
    await stack.sql('UPDATE schema_migrations SET dirty=false');
    await stack.compose(['up', '-d', '--wait', '--wait-timeout', '120', 'app']);
    await expectReady(stack);
    await preservedState(stack, password, changed);
    step(
      'dirty migration rejected → application remains stopped → fixture marker restored → clean startup',
    );

    await stack.compose(['stop', 'app']);
    const dump = (
      await stack.compose([
        'exec',
        '-T',
        'db',
        'pg_dump',
        '-U',
        'didi',
        '-d',
        'didi',
        '--format=custom',
        '--no-owner',
        '--no-acl',
      ])
    ).output;
    assert.ok(dump.length > 0);
    await restored.compose([
      'up',
      '-d',
      '--wait',
      '--wait-timeout',
      '120',
      'db',
    ]);
    await restored.compose(
      [
        'exec',
        '-T',
        'db',
        'pg_restore',
        '-U',
        'didi',
        '-d',
        'didi',
        '--exit-on-error',
        '--no-owner',
        '--no-acl',
      ],
      dump,
    );
    await restored.compose([
      'up',
      '-d',
      '--wait',
      '--wait-timeout',
      '120',
      'app',
    ]);
    await expectReady(restored);
    assert.deepEqual(JSON.parse(await restored.sql(countsSQL)), before);
    await preservedState(restored, password, changed);
    evidence.counts = before;
    evidence.backupBytes = dump.length;
    step(
      'database custom dump restored to a separate empty project/volume; accounts/configuration/versions/audit and evaluation preserved',
    );
    evidence.status = 'passed';
  } catch (error) {
    failures.push(error);
  } finally {
    const cleanupFailures = [];
    for (const owned of [restored, stack]) {
      try {
        await owned.compose(['down', '--volumes', '--remove-orphans']);
        for (const args of [
          ['container', 'ls', '-a', '--format', '{{.ID}}'],
          ['network', 'ls', '--format', '{{.ID}}'],
          ['volume', 'ls', '--format', '{{.Name}}'],
        ]) {
          const remaining = await docker([
            ...args,
            '--filter',
            `label=com.docker.compose.project=${owned.name}`,
          ]);
          assert.equal(
            remaining.output.toString().trim(),
            '',
            'owned containers, networks and volumes must be cleaned',
          );
        }
      } catch (error) {
        cleanupFailures.push(error);
      }
    }
    rmSync(directory, { recursive: true, force: true });
    failures.push(...cleanupFailures);
    evidence.cleaned = cleanupFailures.length === 0;
    evidence.status = failures.length ? 'failed' : 'passed';
    report(name, evidence);
  }
  if (failures.length)
    throw new AggregateError(
      failures,
      failures.map((error) => error.message).join('\n'),
    );
  console.log(
    `PASS: Docker delivery verified; image ${evidence.image}; report test-results/docker/${name}/verification.json`,
  );
}
