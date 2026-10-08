import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Flag, Flags, Rule } from '../application/contracts';
import { ApiError, feedback } from '../../../shared-kernel/errors';
import { Button } from '../../../presentation/components/button';
import { ConfigurationView } from './configuration-view';
import { RuleCondition } from './rule-condition';
const fields: Record<string, string> = {
  name: '名称',
  key: 'Key',
  enabled: '启用状态',
  default_value: '默认结果',
  seed: '灰度 seed',
  rules: '规则及顺序',
};
function DifferenceValue({ field, raw }: { field: string; raw: string }) {
  const value: unknown = JSON.parse(raw);
  if (field === 'rules' && Array.isArray(value)) {
    if (value.length === 0) return <span className="muted">无规则</span>;
    return (
      <ol className="diff-rules">
        {(value as Rule[]).map((rule) => (
          <li key={rule.id}>
            <span>优先级 {rule.priority} · </span>
            <RuleCondition rule={rule} />
            <p>返回 {String(rule.result)}</p>
          </li>
        ))}
      </ol>
    );
  }
  return (
    <code className="diff-scalar">
      {typeof value === 'string' ? value : raw}
    </code>
  );
}
export function Versions({
  flag,
  flags,
  canWrite,
  onSaved,
}: {
  flag: Flag;
  flags: Flags;
  canWrite: boolean;
  onSaved: (flag: Flag) => Promise<void>;
}) {
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [stale, setStale] = useState(false);
  const [error, setError] = useState<unknown>();
  const [message, setMessage] = useState('');
  const versions = useQuery({
    queryKey: ['versions', flag.id, offset],
    queryFn: ({ signal }) => flags.versions(flag.id, offset, signal),
  });
  const version = useQuery({
    queryKey: ['version', flag.id, selected],
    queryFn: ({ signal }) => flags.version(flag.id, selected ?? 0, signal),
    enabled: selected !== null,
  });
  const preview = useQuery({
    queryKey: ['version-preview', flag.id, selected],
    queryFn: ({ signal }) => flags.preview(flag.id, selected ?? 0, signal),
    enabled: selected !== null,
  });
  const available =
    preview.data &&
    version.data &&
    preview.data.source_revision === selected &&
    version.data.revision === selected;
  const canRestore =
    !!available &&
    selected !== null &&
    selected < preview.data.current_revision &&
    preview.data.changes.length > 0;
  function select(revision: number | null) {
    setSelected(revision);
    setConfirming(false);
    setError(undefined);
    setStale(false);
    setMessage('');
  }
  async function refresh() {
    setConfirming(false);
    const result = await preview.refetch();
    if (result.isSuccess) {
      setStale(false);
      setError(undefined);
    }
  }
  async function restore() {
    if (!preview.data || selected === null || stale || !canWrite) return;
    setBusy(true);
    setError(undefined);
    try {
      const restored = await flags.rollback(
        flag.id,
        selected,
        preview.data.current_revision,
      );
      await onSaved(restored);
      setConfirming(false);
      setMessage(
        `已恢复 r${String(selected)} 的配置，并生成 revision ${String(restored.revision)}。`,
      );
      void versions.refetch();
      void preview.refetch();
    } catch (e) {
      setError(e);
      if (e instanceof ApiError && e.code === 'VERSION_CONFLICT')
        setStale(true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <section className="panel">
        <div className="card-heading">
          <div>
            <h2>配置版本</h2>
            <p className="muted">历史只读；恢复内容会生成一个新版本。</p>
          </div>
          <Button
            variant="outline"
            onClick={() => {
              void versions.refetch();
            }}
            disabled={versions.isFetching}
          >
            刷新版本
          </Button>
        </div>
        {versions.isPending && <p role="status">加载版本中…</p>}
        {versions.isError && (
          <p role="alert" className="error-message">
            {feedback(versions.error)}
          </p>
        )}
        {versions.data && (
          <>
            <label htmlFor="version-selection">选择版本</label>
            <select
              id="version-selection"
              value={selected ?? ''}
              disabled={busy}
              onChange={(e) =>
                select(e.target.value ? Number(e.target.value) : null)
              }
            >
              <option value="">请选择要查看的版本</option>
              {versions.data.items.map((v) => (
                <option key={v.revision} value={v.revision}>
                  r{v.revision} · {v.actor_name} ·{' '}
                  {new Date(v.created_at).toLocaleString()}
                  {v.revision === flag.revision ? ' · 当前' : ''}
                </option>
              ))}
            </select>
            <div className="pagination">
              <span>共 {versions.data.total} 个版本</span>
              <Button
                variant="ghost"
                disabled={busy || offset === 0}
                onClick={() => {
                  setOffset(Math.max(0, offset - 50));
                  select(null);
                }}
              >
                上一页
              </Button>
              <Button
                variant="ghost"
                disabled={busy || offset + 50 >= versions.data.total}
                onClick={() => {
                  setOffset(offset + 50);
                  select(null);
                }}
              >
                下一页
              </Button>
            </div>
          </>
        )}
      </section>
      {selected !== null && (
        <>
          {(version.isPending || preview.isPending) && (
            <p role="status">加载版本内容与差异…</p>
          )}
          {(version.isError || preview.isError) && (
            <div className="error-message" role="alert">
              {feedback(version.error ?? preview.error)}{' '}
              <Button
                variant="ghost"
                onClick={() => {
                  void version.refetch();
                  void preview.refetch();
                }}
              >
                重试版本读取
              </Button>
            </div>
          )}
          {available && (
            <>
              <ConfigurationView flag={version.data.snapshot} />
              <section className="panel">
                <div className="card-heading">
                  <div>
                    <h3>与当前版本的差异</h3>
                    <p className="muted">
                      当前 r{preview.data.current_revision} → 选中 r{selected}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => {
                      void refresh();
                    }}
                    disabled={busy || preview.isFetching}
                  >
                    刷新差异
                  </Button>
                </div>
                {preview.data.changes.length === 0 ? (
                  <p className="muted">选中内容与当前配置一致。</p>
                ) : (
                  <div className="diff-list">
                    {preview.data.changes.map((change) => (
                      <section key={change.field} className="diff-row">
                        <h4>{fields[change.field]}</h4>
                        <div className="diff-columns">
                          <div>
                            <small>当前配置</small>
                            <DifferenceValue
                              field={change.field}
                              raw={change.before_json}
                            />
                          </div>
                          <div>
                            <small>恢复后配置</small>
                            <DifferenceValue
                              field={change.field}
                              raw={change.after_json}
                            />
                          </div>
                        </div>
                      </section>
                    ))}
                  </div>
                )}
                {error !== undefined && (
                  <p role="alert" className="error-message">
                    {feedback(error)}
                  </p>
                )}
                {stale && (
                  <p className="permission-note">
                    所选版本已保留；刷新差异后重新确认。
                  </p>
                )}
                {message && (
                  <p role="status" className="permission-note">
                    {message}
                  </p>
                )}
                {!canWrite && (
                  <p className="permission-note">
                    当前账号只可查看此环境的版本。
                  </p>
                )}
                {confirming ? (
                  <section
                    className="restore-confirm"
                    aria-label="确认版本恢复"
                  >
                    <h3>确认恢复历史配置</h3>
                    <p>
                      目标 {flag.environment} / {flag.key}，用 r{selected}{' '}
                      的完整内容形成新版本。当前预览基于 r
                      {preview.data.current_revision}。
                    </p>
                    <div className="actions">
                      <Button
                        variant="primary"
                        disabled={
                          busy ||
                          stale ||
                          preview.isFetching ||
                          !canRestore ||
                          !canWrite
                        }
                        onClick={() => {
                          void restore();
                        }}
                      >
                        {busy ? '回滚中…' : '确认回滚'}
                      </Button>
                      <Button
                        variant="ghost"
                        disabled={busy}
                        onClick={() => setConfirming(false)}
                      >
                        取消回滚
                      </Button>
                    </div>
                  </section>
                ) : (
                  <Button
                    variant="primary"
                    disabled={
                      !canRestore ||
                      !canWrite ||
                      busy ||
                      stale ||
                      preview.isFetching
                    }
                    onClick={() => setConfirming(true)}
                  >
                    回滚到 r{selected}
                  </Button>
                )}
              </section>
            </>
          )}
        </>
      )}
    </>
  );
}
