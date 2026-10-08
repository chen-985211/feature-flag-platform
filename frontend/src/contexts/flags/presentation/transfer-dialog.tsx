import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Environment, Flag, Flags } from '../application/contracts';
import { ApiError, feedback } from '../../../shared-kernel/errors';
import { Button } from '../../../presentation/components/button';
import { ConfigurationView } from './configuration-view';
import { ConfigurationDiff } from './configuration-diff';
export function TransferDialog({
  flag,
  flags,
  writeEnvironments,
  onSaved,
  close,
}: {
  flag: Flag;
  flags: Flags;
  writeEnvironments: string[];
  onSaved: (flag: Flag) => Promise<void>;
  close: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null),
    pending = useRef(false);
  const candidates: Environment[] = (
    ['development', 'staging', 'production'] as const
  ).filter((e) => e !== flag.environment);
  const [selected, setSelected] = useState(flag.revision),
    [target, setTarget] = useState<Environment>(candidates[0]),
    [mode, setMode] = useState<'copy' | 'publish'>('copy'),
    [offset, setOffset] = useState(0),
    [busy, setBusy] = useState(false),
    [stale, setStale] = useState(false),
    [error, setError] = useState<unknown>(),
    [result, setResult] = useState<Flag | null>(null);
  useEffect(() => {
    const element = dialog.current,
      previous = document.activeElement;
    element?.showModal();
    return () => {
      element?.close();
      if (previous instanceof HTMLElement) previous.focus();
    };
  }, []);
  const versions = useQuery({
    queryKey: ['versions', flag.id, offset],
    queryFn: ({ signal }) => flags.versions(flag.id, offset, signal),
  });
  const source = useQuery({
    queryKey: ['version', flag.id, selected],
    queryFn: ({ signal }) => flags.version(flag.id, selected, signal),
  });
  const preview = useQuery({
    queryKey: ['publication', flag.id, selected, target],
    queryFn: ({ signal }) =>
      flags.publication(flag.id, selected, target, signal),
    enabled: mode === 'publish',
  });
  const allowed = writeEnvironments.includes(target),
    available =
      source.data?.revision === selected &&
      (mode === 'copy' ||
        (preview.data?.source_revision === selected &&
          preview.data.target.environment === target));
  function changed() {
    setError(undefined);
    setStale(false);
    setResult(null);
  }
  async function refresh() {
    setError(undefined);
    const read = await preview.refetch();
    if (read.isSuccess) setStale(false);
  }
  async function execute() {
    if (!available || !allowed || stale || pending.current || result) return;
    pending.current = true;
    setBusy(true);
    setError(undefined);
    try {
      const saved =
        mode === 'copy'
          ? await flags.copy(flag.id, selected, target)
          : await flags.publish(
              flag.id,
              selected,
              preview.data?.target.id ?? '',
              preview.data?.target_revision ?? 0,
            );
      await onSaved(saved);
      setResult(saved);
      if (mode === 'publish') void preview.refetch();
    } catch (e) {
      setError(e);
      if (e instanceof ApiError && e.code === 'VERSION_CONFLICT')
        setStale(true);
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  return (
    <dialog
      ref={dialog}
      className="transfer-dialog"
      aria-labelledby="transfer-title"
      onKeyDown={(e) => {
        if (e.key !== 'Tab') return;
        const controls = Array.from(
          e.currentTarget.querySelectorAll<HTMLElement>(
            'button:not([disabled]), select:not([disabled]), a[href]',
          ),
        ).filter((el) => el.getClientRects().length > 0);
        const first = controls[0],
          last = controls.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }}
      onCancel={(e) => {
        e.preventDefault();
        if (!pending.current) close();
      }}
    >
      <div className="card-heading">
        <div>
          <h2 id="transfer-title">环境流转</h2>
          <p className="muted">选择固定源版本，查看目标后确认。</p>
        </div>
        <Button
          variant="ghost"
          disabled={busy}
          onClick={close}
          aria-label="关闭环境流转"
        >
          关闭
        </Button>
      </div>
      <div className="transfer-body">
        <div className="transfer-controls">
          <label htmlFor="transfer-mode">操作方式</label>
          <select
            id="transfer-mode"
            value={mode}
            disabled={busy}
            onChange={(e) => {
              setMode(e.target.value === 'publish' ? 'publish' : 'copy');
              changed();
            }}
          >
            <option value="copy">复制到新环境配置</option>
            <option value="publish">发布到已有配置</option>
          </select>
          <label htmlFor="transfer-source">源版本</label>
          <select
            id="transfer-source"
            value={selected}
            disabled={busy || !versions.data}
            onChange={(e) => {
              setSelected(Number(e.target.value));
              changed();
            }}
          >
            {!versions.data?.items.some((v) => v.revision === selected) && (
              <option value={selected}>r{selected} · 已选版本</option>
            )}
            {versions.data?.items.map((v) => (
              <option key={v.revision} value={v.revision}>
                r{v.revision} · {v.actor_name}
              </option>
            ))}
          </select>
          {versions.data && versions.data.total > 50 && (
            <div className="pagination">
              <Button
                disabled={busy || offset === 0}
                onClick={() => setOffset(Math.max(0, offset - 50))}
              >
                上一页版本
              </Button>
              <span>
                {offset + 1}～{Math.min(offset + 50, versions.data.total)}
              </span>
              <Button
                disabled={busy || offset + 50 >= versions.data.total}
                onClick={() => setOffset(offset + 50)}
              >
                下一页版本
              </Button>
            </div>
          )}
          <label htmlFor="transfer-target">目标环境</label>
          <select
            id="transfer-target"
            value={target}
            disabled={busy}
            onChange={(e) => {
              const environment = candidates.find(
                (item) => item === e.target.value,
              );
              if (environment) {
                setTarget(environment);
                changed();
              }
            }}
          >
            {candidates.map((e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
          </select>
        </div>
        {versions.isError && (
          <p role="alert" className="error-message">
            {feedback(versions.error)}
            <Button
              onClick={() => {
                void versions.refetch();
              }}
            >
              重试版本列表
            </Button>
          </p>
        )}
        {source.isPending && <p role="status">加载源版本中…</p>}
        {source.isError && (
          <p role="alert" className="error-message">
            {feedback(source.error)}
            <Button
              onClick={() => {
                void source.refetch();
              }}
            >
              重试源版本
            </Button>
          </p>
        )}
        {source.data && (
          <ConfigurationView
            flag={source.data.snapshot}
            heading="源版本完整配置"
          />
        )}
        {mode === 'copy' ? (
          <p className="permission-note">
            将 {flag.environment} 的 r{selected} 复制到 {target}，创建相同 Key
            的新配置。已有配置会返回冲突。
          </p>
        ) : (
          <>
            {preview.isPending && <p role="status">加载发布差异中…</p>}
            {preview.isError && (
              <p role="alert" className="error-message">
                {feedback(preview.error)}
                <Button
                  onClick={() => {
                    void refresh();
                  }}
                >
                  刷新发布差异
                </Button>
              </p>
            )}
            {preview.data && (
              <>
                <ConfigurationView
                  flag={preview.data.target}
                  heading="目标当前完整配置"
                />
                <section className="panel">
                  <div className="card-heading">
                    <div>
                      <h3>发布差异</h3>
                      <p className="muted">
                        源 r{selected} → {target} / {preview.data.target.key} ·
                        当前 r{preview.data.target_revision}
                      </p>
                    </div>
                    <Button
                      disabled={busy || preview.isFetching}
                      onClick={() => {
                        void refresh();
                      }}
                    >
                      刷新发布差异
                    </Button>
                  </div>
                  <ConfigurationDiff changes={preview.data.changes} />
                </section>
              </>
            )}
          </>
        )}
        {error !== undefined && (
          <p className="error-message" role="alert">
            {feedback(error)}
          </p>
        )}
        {stale && (
          <p className="permission-note">
            所选源版本与目标已保留，请刷新发布差异后重新确认。
          </p>
        )}
        {!allowed && (
          <p className="permission-note">当前账号只可查看此目标环境。</p>
        )}
        {result && (
          <p role="status" className="permission-note">
            {mode === 'copy' ? '复制' : '发布'}成功，目标 revision{' '}
            {result.revision}。
            <a
              className="flag-name"
              href={`/flags/${result.id}?environment=${result.environment}`}
            >
              查看目标配置
            </a>
          </p>
        )}
      </div>
      <div className="actions transfer-actions">
        <span className="muted">
          r{selected} → {target}
        </span>
        <Button
          variant="primary"
          disabled={
            !available ||
            !allowed ||
            busy ||
            stale ||
            !!result ||
            (mode === 'publish' && (preview.isFetching || preview.isError))
          }
          onClick={() => {
            void execute();
          }}
        >
          {busy ? '提交中…' : mode === 'copy' ? '确认复制' : '确认发布'}
        </Button>
        <Button variant="ghost" onClick={close} disabled={busy}>
          取消
        </Button>
      </div>
    </dialog>
  );
}
