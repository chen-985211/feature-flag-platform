import { PagePagination } from '../../../presentation/components/page-pagination';
import { Notice } from '../../../presentation/components/notice';
import { Card } from '../../../presentation/components/ui/card';
import { FormDialog } from '../../../presentation/components/form-dialog';
import { Label } from '../../../presentation/components/ui/label';
import {
  Dropdown,
  DropdownOption,
} from '../../../presentation/components/dropdown';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Flag, Flags } from '../application/contracts';
import { ApiError, feedback } from '../../../shared-kernel/errors';
import { Button } from '../../../presentation/components/button';
import { ConfigurationView } from './configuration-view';
import { ConfigurationDiff } from './configuration-diff';
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
      <Card asChild>
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
            <Notice role="alert" className="error-message" tone="error">
              {feedback(versions.error)}
            </Notice>
          )}
          {versions.data && (
            <>
              <div className="field">
                <Label htmlFor="version-selection">选择版本</Label>
                <Dropdown
                  id="version-selection"
                  value={selected ?? ''}
                  disabled={busy}
                  onValueChange={(nextValue) =>
                    select(nextValue ? Number(nextValue) : null)
                  }
                >
                  <DropdownOption value="">请选择要查看的版本</DropdownOption>
                  {versions.data.items.map((v) => (
                    <DropdownOption key={v.revision} value={v.revision}>
                      r{v.revision} · {v.actor_name} ·{' '}
                      {new Date(v.created_at).toLocaleString()}
                      {v.revision === flag.revision ? ' · 当前' : ''}
                    </DropdownOption>
                  ))}
                </Dropdown>
              </div>
              <PagePagination
                total={versions.data.total}
                offset={offset}
                unit="个版本"
                label="版本分页"
                busy={busy}
                onPage={(next) => {
                  setOffset(next);
                  select(null);
                }}
              />
            </>
          )}
        </section>
      </Card>
      {selected !== null && (
        <>
          {(version.isPending || preview.isPending) && (
            <p role="status">加载版本内容与差异…</p>
          )}
          {(version.isError || preview.isError) && (
            <Notice className="error-message" role="alert" tone="error">
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
            </Notice>
          )}
          {available && (
            <>
              <ConfigurationView flag={version.data.snapshot} />
              <Card asChild>
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
                    <ConfigurationDiff changes={preview.data.changes} />
                  )}
                  {error !== undefined && (
                    <Notice role="alert" className="error-message" tone="error">
                      {feedback(error)}
                    </Notice>
                  )}
                  {stale && (
                    <Notice className="permission-note">
                      所选版本已保留；刷新差异后重新确认。
                    </Notice>
                  )}
                  {message && (
                    <Notice role="status" className="permission-note">
                      {message}
                    </Notice>
                  )}
                  {!canWrite && (
                    <Notice className="permission-note">
                      当前账号只可查看此环境的版本。
                    </Notice>
                  )}
                  <FormDialog
                    open={confirming}
                    onOpenChange={setConfirming}
                    busy={busy}
                    title="确认恢复历史配置"
                    description={
                      '将 ' +
                      flag.environment +
                      ' / ' +
                      flag.key +
                      ' 恢复为 r' +
                      String(selected) +
                      ' 的完整内容，当前预览基于 r' +
                      String(preview.data.current_revision) +
                      '。'
                    }
                    trigger={
                      <Button
                        variant="primary"
                        disabled={
                          !canRestore ||
                          !canWrite ||
                          busy ||
                          stale ||
                          preview.isFetching
                        }
                      >
                        回滚到 r{selected}
                      </Button>
                    }
                  >
                    {error !== undefined && (
                      <Notice
                        role="alert"
                        className="error-message"
                        tone="error"
                      >
                        {feedback(error)}
                      </Notice>
                    )}
                    {stale && (
                      <>
                        <Notice className="permission-note">
                          所选版本已保留；刷新差异后重新确认。
                        </Notice>
                        <Button
                          onClick={() => {
                            void refresh();
                          }}
                        >
                          刷新差异
                        </Button>
                      </>
                    )}
                    <section className="confirmation-impact">
                      <h3>本次将修改</h3>
                      <ConfigurationDiff changes={preview.data.changes} />
                    </section>
                    <p className="muted text-xs">
                      将生成 r{preview.data.current_revision + 1}，恢复所选 r
                      {selected} 的完整配置，原有版本和操作历史会保留。
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
                  </FormDialog>
                </section>
              </Card>
            </>
          )}
        </>
      )}
    </>
  );
}
