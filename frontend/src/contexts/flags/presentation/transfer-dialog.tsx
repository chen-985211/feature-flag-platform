import { PagePagination } from '../../../presentation/components/page-pagination';
import { Notice } from '../../../presentation/components/notice';
import { Card } from '../../../presentation/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '../../../presentation/components/ui/dialog';
import { X } from 'lucide-react';
import { Label } from '../../../presentation/components/ui/label';
import {
  Dropdown,
  DropdownOption,
} from '../../../presentation/components/dropdown';
import { useRef, useState } from 'react';
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
  const previousFocus = useRef(document.activeElement);
  const pending = useRef(false);
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
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !pending.current) close();
      }}
    >
      <DialogContent
        className="transfer-dialog"
        showCloseButton={false}
        onEscapeKeyDown={(event) => {
          if (pending.current) event.preventDefault();
        }}
        onPointerDownOutside={(event) => event.preventDefault()}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          if (previousFocus.current instanceof HTMLElement)
            previousFocus.current.focus();
        }}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          const element = document.getElementById('transfer-close');
          element?.focus();
        }}
      >
        <DialogHeader className="transfer-header">
          <div>
            <DialogTitle>环境流转</DialogTitle>
            <DialogDescription>
              选择固定源版本，查看差异后确认。
            </DialogDescription>
          </div>
          <Button
            id="transfer-close"
            size="icon"
            variant="ghost"
            disabled={busy}
            onClick={close}
            aria-label="关闭环境流转"
          >
            <X size={16} />
          </Button>
        </DialogHeader>
        <div className="transfer-body">
          <div className="transfer-controls">
            <Label htmlFor="transfer-mode">操作方式</Label>
            <Dropdown
              id="transfer-mode"
              value={mode}
              disabled={busy}
              onValueChange={(nextValue) => {
                setMode(nextValue === 'publish' ? 'publish' : 'copy');
                changed();
              }}
            >
              <DropdownOption value="copy">复制到新环境配置</DropdownOption>
              <DropdownOption value="publish">发布到已有配置</DropdownOption>
            </Dropdown>
            <Label htmlFor="transfer-source">源版本</Label>
            <Dropdown
              id="transfer-source"
              value={selected}
              disabled={busy || !versions.data}
              onValueChange={(nextValue) => {
                setSelected(Number(nextValue));
                changed();
              }}
            >
              {!versions.data?.items.some((v) => v.revision === selected) && (
                <DropdownOption value={selected}>
                  r{selected} · 已选版本
                </DropdownOption>
              )}
              {versions.data?.items.map((v) => (
                <DropdownOption key={v.revision} value={v.revision}>
                  r{v.revision} · {v.actor_name}
                </DropdownOption>
              ))}
            </Dropdown>
            {versions.data && versions.data.total > 50 && (
              <PagePagination
                total={versions.data.total}
                offset={offset}
                unit="个版本"
                label="源版本分页"
                busy={busy}
                previousLabel="上一页版本"
                nextLabel="下一页版本"
                onPage={setOffset}
              />
            )}
            <Label htmlFor="transfer-target">目标环境</Label>
            <Dropdown
              id="transfer-target"
              value={target}
              disabled={busy}
              onValueChange={(nextValue) => {
                const environment = candidates.find(
                  (item) => item === nextValue,
                );
                if (environment) {
                  setTarget(environment);
                  changed();
                }
              }}
            >
              {candidates.map((e) => (
                <DropdownOption key={e} value={e}>
                  {e}
                </DropdownOption>
              ))}
            </Dropdown>
          </div>
          {versions.isError && (
            <Notice role="alert" className="error-message" tone="error">
              {feedback(versions.error)}
              <Button
                onClick={() => {
                  void versions.refetch();
                }}
              >
                重试版本列表
              </Button>
            </Notice>
          )}
          {source.isPending && <p role="status">加载源版本中…</p>}
          {source.isError && (
            <Notice role="alert" className="error-message" tone="error">
              {feedback(source.error)}
              <Button
                onClick={() => {
                  void source.refetch();
                }}
              >
                重试源版本
              </Button>
            </Notice>
          )}
          {source.data && (
            <ConfigurationView
              flag={source.data.snapshot}
              heading="源版本完整配置"
            />
          )}
          {mode === 'copy' ? (
            <Notice className="permission-note">
              将 {flag.environment} 的 r{selected} 复制到 {target}，创建相同 Key
              的新配置。已有配置会返回冲突。
            </Notice>
          ) : (
            <>
              {preview.isPending && <p role="status">加载发布差异中…</p>}
              {preview.isError && (
                <Notice role="alert" className="error-message" tone="error">
                  {feedback(preview.error)}
                  <Button
                    onClick={() => {
                      void refresh();
                    }}
                  >
                    刷新发布差异
                  </Button>
                </Notice>
              )}
              {preview.data && (
                <>
                  <ConfigurationView
                    flag={preview.data.target}
                    heading="目标当前完整配置"
                  />
                  <Card asChild>
                    <section className="panel">
                      <div className="card-heading">
                        <div>
                          <h3>发布差异</h3>
                          <p className="muted">
                            源 r{selected} → {target} /{' '}
                            {preview.data.target.key} · 当前 r
                            {preview.data.target_revision}
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
                  </Card>
                </>
              )}
            </>
          )}
          {error !== undefined && (
            <Notice className="error-message" role="alert" tone="error">
              {feedback(error)}
            </Notice>
          )}
          {stale && (
            <Notice className="permission-note">
              所选源版本与目标已保留，请刷新发布差异后重新确认。
            </Notice>
          )}
          {!allowed && (
            <Notice className="permission-note">
              当前账号只可查看此目标环境。
            </Notice>
          )}
          {result && (
            <Notice role="status" className="permission-note">
              {mode === 'copy' ? '复制' : '发布'}成功，目标 revision{' '}
              {result.revision}。
              <Button asChild variant="link" size="sm">
                <a
                  href={`/flags/${result.id}?environment=${result.environment}`}
                >
                  查看目标配置
                </a>
              </Button>
            </Notice>
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
      </DialogContent>
    </Dialog>
  );
}
