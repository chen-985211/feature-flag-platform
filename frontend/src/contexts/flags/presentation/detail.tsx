import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '../../../presentation/components/ui/tabs';
import { Badge } from '../../../presentation/components/ui/badge';
import { FormDialog } from '../../../presentation/components/form-dialog';
import { Plus, ArrowLeft, Play, ArrowRightLeft } from 'lucide-react';
import { useState, useRef, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import type { Flag, Flags } from '../application/contracts';
import { FlagForm } from './flag-form';
import { RuleForm } from './rule-form';
import { RuleCondition } from './rule-condition';
import { Versions } from './versions';
import { RuleOrder } from './rule-order';
import { TransferDialog } from './transfer-dialog';
import { feedback } from '../../../shared-kernel/errors';
import { Button } from '../../../presentation/components/button';
export function FlagDetail({
  flags,
  writeEnvironments,
  history,
}: {
  flags: Flags;
  writeEnvironments: string[];
  history: (id: string) => ReactNode;
}) {
  const { id = '' } = useParams();
  const [search, setSearch] = useSearchParams();
  const tab = search.get('tab') ?? 'rules';
  const cache = useQueryClient();
  const query = useQuery({
    queryKey: ['flag', id],
    queryFn: ({ signal }) => flags.get(id, signal),
  });
  const ruleTrigger = useRef<HTMLButtonElement | null>(null);
  const [formBusy, setFormBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [ruleID, setRuleID] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>();
  const [transferOpen, setTransferOpen] = useState(false);
  async function transferred(target: Flag) {
    cache.setQueryData(['flag', target.id], target);
    await Promise.all([
      cache.invalidateQueries({ queryKey: ['flags'] }),
      cache.invalidateQueries({ queryKey: ['history', target.id] }),
      cache.invalidateQueries({ queryKey: ['versions', target.id] }),
      cache.invalidateQueries({ queryKey: ['version-preview', target.id] }),
    ]);
  }
  async function saved(flag: Flag) {
    cache.setQueryData(['flag', id], flag);
    await Promise.all([
      cache.invalidateQueries({ queryKey: ['flags'] }),
      cache.invalidateQueries({ queryKey: ['history', id] }),
      cache.invalidateQueries({ queryKey: ['versions', id] }),
      cache.invalidateQueries({ queryKey: ['version-preview', id] }),
    ]);
  }
  async function change(operation: () => Promise<Flag>) {
    setBusy(true);
    setError(undefined);
    try {
      await saved(await operation());
      setDeleting(null);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  async function reload() {
    const current = await query.refetch();
    if (current.data) {
      setNonce((n) => n + 1);
    }
  }
  if (query.isPending) return <p role="status">加载配置中…</p>;
  if (query.isError)
    return (
      <section className="panel">
        <p role="alert" className="error-message">
          {feedback(query.error)}
        </p>
        <Button
          onClick={() => {
            void query.refetch();
          }}
        >
          重试
        </Button>
      </section>
    );
  const flag = query.data;
  const canWrite = writeEnvironments.includes(flag.environment);
  const selected = flag.rules.find((rule) => rule.id === ruleID);
  return (
    <>
      <Link className="back-link" to={'/flags?environment=' + flag.environment}>
        <ArrowLeft size={14} />
        返回配置列表
      </Link>
      <div className="page-heading">
        <div>
          <p className="eyebrow">
            {flag.environment} · revision {flag.revision}
          </p>
          <h1>{flag.name}</h1>
          <code className="page-key">{flag.key}</code>
        </div>
        <div className="actions">
          <Button variant="outline" onClick={() => setTransferOpen(true)}>
            <ArrowRightLeft size={14} />
            环境流转
          </Button>
          <Badge
            variant="secondary"
            className={flag.enabled ? 'good' : 'neutral'}
          >
            {flag.enabled ? '已启用' : '已停用'}
          </Badge>
          <Button
            variant="outline"
            disabled={!canWrite || busy}
            onClick={() => {
              void change(() =>
                flags.enabled(id, !flag.enabled, flag.revision),
              );
            }}
          >
            {flag.enabled ? '停用配置' : '启用配置'}
          </Button>
          <Button asChild variant="primary">
            <Link
              to={`/evaluate?environment=${flag.environment}&key=${encodeURIComponent(flag.key)}`}
            >
              <Play size={14} />
              运行评估
            </Link>
          </Button>
        </div>
      </div>
      {!canWrite && (
        <p className="permission-note">
          当前环境为只读；可以查看配置和运行评估。
        </p>
      )}
      {error !== undefined && (
        <div className="error-message" role="alert">
          {feedback(error)}{' '}
          <Button
            variant="ghost"
            onClick={() => {
              void query.refetch();
            }}
          >
            查看最新配置
          </Button>
        </div>
      )}
      <Tabs
        value={tab}
        onValueChange={(value) => {
          const next = new URLSearchParams(search);
          next.set('tab', value);
          setSearch(next);
        }}
      >
        <TabsList aria-label="配置详情" className="detail-tabs">
          {[
            ['basic', '基本信息'],
            ['rules', '规则'],
            ['versions', '版本'],
            ['history', '操作历史'],
          ].map(([value, label]) => (
            <TabsTrigger key={value} value={value}>
              {label}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="basic">
          <section className="panel">
            <div className="card-heading">
              <h2>基本信息</h2>
              <FormDialog
                open={editing}
                onOpenChange={setEditing}
                busy={formBusy}
                title="编辑配置"
                description={'编辑 ' + flag.key + ' 的基本信息。'}
                trigger={<Button disabled={!canWrite}>编辑基本信息</Button>}
              >
                <FlagForm
                  embedded
                  onBusyChange={setFormBusy}
                  key={'base' + String(nonce)}
                  initial={flag}
                  environment={flag.environment}
                  save={async (input, revision) => {
                    await saved(
                      await flags.edit(id, {
                        name: input.name,
                        key: input.key,
                        default_value: input.default_value,
                        expected_revision: revision ?? flag.revision,
                      }),
                    );
                    setEditing(false);
                  }}
                  cancel={() => setEditing(false)}
                  reload={() => {
                    void reload();
                  }}
                />
              </FormDialog>
            </div>
            <dl className="facts">
              <dt>Key</dt>
              <dd>
                <code>{flag.key}</code>
              </dd>
              <dt>环境</dt>
              <dd>{flag.environment}</dd>
              <dt>默认结果</dt>
              <dd>
                <code>{String(flag.default_value)}</code>
              </dd>
              <dt>创建时间</dt>
              <dd>{new Date(flag.created_at).toLocaleString()}</dd>
              <dt>更新时间</dt>
              <dd>{new Date(flag.updated_at).toLocaleString()}</dd>
            </dl>
          </section>
        </TabsContent>
        <TabsContent value="rules">
          <section className="panel">
            <div className="card-heading">
              <div>
                <h2>评估规则</h2>
                <p className="muted">
                  按优先级从小到大匹配，首条命中决定结果。
                </p>
              </div>
              <Button
                variant="primary"
                onClick={(event) => {
                  ruleTrigger.current = event.currentTarget;
                  setRuleID('');
                }}
                disabled={!canWrite || ruleID !== null}
              >
                <Plus size={14} />
                添加规则
              </Button>
            </div>
            {flag.rules.length === 0 ? (
              <p className="empty-state">
                尚未配置规则。未命中时返回{' '}
                <code>{String(flag.default_value)}</code>。
              </p>
            ) : (
              <ol className="rule-list">
                {flag.rules.map((rule) => (
                  <li key={rule.id}>
                    <div className="rule-description">
                      <span className="priority">{rule.priority}</span>
                      <div>
                        <RuleCondition rule={rule} />
                        <p className="muted">
                          命中返回 <strong>{String(rule.result)}</strong>
                        </p>
                      </div>
                    </div>
                    <div className="actions">
                      {deleting === rule.id ? (
                        <>
                          <span>确认删除此规则？</span>
                          <Button
                            variant="outline"
                            onClick={() => {
                              void change(() =>
                                flags.deleteRule(id, rule.id, flag.revision),
                              );
                            }}
                            disabled={busy}
                          >
                            确认删除
                          </Button>
                          <Button
                            variant="ghost"
                            onClick={() => setDeleting(null)}
                            disabled={busy}
                          >
                            取消删除
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button
                            variant="ghost"
                            disabled={!canWrite || busy}
                            onClick={(event) => {
                              ruleTrigger.current = event.currentTarget;
                              setRuleID(rule.id);
                            }}
                          >
                            编辑规则
                          </Button>
                          <Button
                            variant="ghost"
                            disabled={!canWrite || busy}
                            onClick={() => setDeleting(rule.id)}
                          >
                            删除规则
                          </Button>
                        </>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            )}
            <RuleOrder
              flag={flag}
              flags={flags}
              canWrite={canWrite && ruleID === null}
              onSaved={saved}
              reload={reload}
            />
          </section>
          {ruleID !== null && (
            <FormDialog
              open
              onOpenChange={(open) => {
                if (!open) setRuleID(null);
              }}
              busy={formBusy}
              title={selected ? '编辑规则' : '添加规则'}
              description={'为 ' + flag.key + ' 配置匹配条件与返回结果。'}
              focusTarget={ruleTrigger}
            >
              <RuleForm
                embedded
                onBusyChange={setFormBusy}
                key={ruleID + String(nonce)}
                initial={selected}
                revision={flag.revision}
                nextPriority={Math.min(
                  2147483647,
                  Math.max(0, ...flag.rules.map((r) => r.priority)) + 1,
                )}
                save={async (input) => {
                  await saved(
                    await flags.saveRule(id, ruleID || undefined, input),
                  );
                  setRuleID(null);
                }}
                cancel={() => setRuleID(null)}
                reload={() => {
                  void reload();
                }}
              />
            </FormDialog>
          )}
        </TabsContent>
        <TabsContent value="versions">
          <Versions
            flag={flag}
            flags={flags}
            canWrite={canWrite}
            onSaved={saved}
          />
        </TabsContent>
        <TabsContent value="history">{history(id)}</TabsContent>
      </Tabs>
      {transferOpen && (
        <TransferDialog
          flag={flag}
          flags={flags}
          writeEnvironments={writeEnvironments}
          onSaved={transferred}
          close={() => setTransferOpen(false)}
        />
      )}
    </>
  );
}
