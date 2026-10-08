import { Notice } from '../../../presentation/components/notice';
import { Card } from '../../../presentation/components/ui/card';
import { Checkbox } from '../../../presentation/components/ui/checkbox';
import { Label } from '../../../presentation/components/ui/label';
import { Input } from '../../../presentation/components/ui/input';
import { useState, useId } from 'react';
import type { Flag, CreateFlag } from '../application/contracts';
import { ApiError, feedback } from '../../../shared-kernel/errors';
import { Button } from '../../../presentation/components/button';
export function FlagForm({
  initial,
  environment,
  save,
  cancel,
  reload,
  embedded = false,
  onBusyChange,
}: {
  initial?: Flag;
  environment: CreateFlag['environment'];
  save: (input: CreateFlag, revision?: number) => Promise<void>;
  cancel: () => void;
  reload?: () => void;
  embedded?: boolean;
  onBusyChange?: (busy: boolean) => void;
}) {
  const fieldID = useId();
  const [name, setName] = useState(initial?.name ?? '');
  const [key, setKey] = useState(initial?.key ?? '');
  const [enabled, setEnabled] = useState(initial?.enabled ?? true);
  const [defaultValue, setDefault] = useState(initial?.default_value ?? false);
  const [revision] = useState(initial?.revision);
  const [error, setError] = useState<unknown>();
  const [busy, setBusy] = useState(false);
  async function submit() {
    setBusy(true);
    onBusyChange?.(true);
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
      onBusyChange?.(false);
    }
  }
  return (
    <Card asChild className={embedded ? 'form-surface' : undefined}>
      <form
        className={embedded ? 'form-grid' : 'panel form-grid'}
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
        aria-label={initial ? '编辑配置' : '新建配置'}
      >
        {!embedded && <h2>{initial ? '编辑配置' : '新建 Flag'}</h2>}
        <p className="muted">
          {environment}
          {revision && ` · 基于 revision ${String(revision)}`}
        </p>
        <Label>
          名称
          <Input
            required
            maxLength={160}
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            disabled={busy}
          />
        </Label>
        <Label>
          Key
          <Input
            required
            maxLength={128}
            value={key}
            onChange={(e) => setKey(e.target.value)}
            disabled={busy}
          />
        </Label>
        {!initial && (
          <Label className="check-label" htmlFor={fieldID + '-1'}>
            <Checkbox
              id={fieldID + '-1'}
              checked={enabled}
              onCheckedChange={(checked) => setEnabled(checked === true)}
              disabled={busy}
            />
            启用配置
          </Label>
        )}
        <Label className="check-label" htmlFor={fieldID + '-2'}>
          <Checkbox
            id={fieldID + '-2'}
            checked={defaultValue}
            onCheckedChange={(checked) => setDefault(checked === true)}
            disabled={busy}
          />
          默认返回 true
        </Label>
        {error !== undefined && (
          <Notice className="error-message" role="alert" tone="error">
            {feedback(error)}
          </Notice>
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
          <Button type="submit" variant="primary" disabled={busy}>
            {busy ? '保存中…' : '保存配置'}
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={cancel}
            disabled={busy}
          >
            取消
          </Button>
        </div>
      </form>
    </Card>
  );
}
