import { useState } from 'react';
import type { Flag, CreateFlag } from '../application/contracts';
import { ApiError, feedback } from '../../../shared-kernel/errors';
import { Button } from '../../../presentation/components/button';
export function FlagForm({
  initial,
  environment,
  save,
  cancel,
  reload,
}: {
  initial?: Flag;
  environment: CreateFlag['environment'];
  save: (input: CreateFlag, revision?: number) => Promise<void>;
  cancel: () => void;
  reload?: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [key, setKey] = useState(initial?.key ?? '');
  const [enabled, setEnabled] = useState(initial?.enabled ?? true);
  const [defaultValue, setDefault] = useState(initial?.default_value ?? false);
  const [revision] = useState(initial?.revision);
  const [error, setError] = useState<unknown>();
  const [busy, setBusy] = useState(false);
  async function submit() {
    setBusy(true);
    setError(undefined);
    try {
      await save(
        { name, key, environment, enabled, default_value: defaultValue },
        revision,
      );
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form
      className="panel form-grid"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
      aria-label={initial ? '编辑配置' : '新建配置'}
    >
      <h2>{initial ? '编辑配置' : '新建 Flag'}</h2>
      <p className="muted">
        {environment}
        {revision && ` · 基于 revision ${String(revision)}`}
      </p>
      <label>
        名称
        <input
          required
          maxLength={160}
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
          disabled={busy}
        />
      </label>
      <label>
        Key
        <input
          required
          maxLength={128}
          value={key}
          onChange={(e) => setKey(e.target.value)}
          disabled={busy}
        />
      </label>
      {!initial && (
        <label className="check-label">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            disabled={busy}
          />
          启用配置
        </label>
      )}
      <label className="check-label">
        <input
          type="checkbox"
          checked={defaultValue}
          onChange={(e) => setDefault(e.target.checked)}
          disabled={busy}
        />
        默认返回 true
      </label>
      {error !== undefined && (
        <p className="error-message" role="alert">
          {feedback(error)}
        </p>
      )}
      {error instanceof ApiError &&
        error.code === 'VERSION_CONFLICT' &&
        reload && (
          <div>
            <Button type="button" variant="outline" onClick={reload}>
              加载最新版本
            </Button>
            <p className="muted">加载后将用最新配置替换本地输入。</p>
          </div>
        )}
      <div className="actions">
        <Button type="submit" disabled={busy}>
          {busy ? '保存中…' : '保存配置'}
        </Button>
        <Button type="button" variant="ghost" onClick={cancel} disabled={busy}>
          取消
        </Button>
      </div>
    </form>
  );
}
