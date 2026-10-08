import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import type { Environment, Flags } from '../application/contracts';
import { FlagForm } from './flag-form';
import { feedback } from '../../../shared-kernel/errors';
import { Button } from '../../../presentation/components/button';
export function FlagList({
  flags,
  environment,
  canWrite,
}: {
  flags: Flags;
  environment: Environment;
  canWrite: boolean;
}) {
  const [q, setQ] = useState('');
  const [enabled, setEnabled] = useState('');
  const [offset, setOffset] = useState(0);
  const [creating, setCreating] = useState(false);
  const navigate = useNavigate();
  const cache = useQueryClient();
  const data = useQuery({
    queryKey: ['flags', environment, q, enabled, offset],
    queryFn: ({ signal }) =>
      flags.list(environment, q, enabled, offset, signal),
  });
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">工作空间 / {environment}</p>
          <h1>功能配置</h1>
          <p className="page-description">
            管理环境配置，按规则为用户提供不同结果。
          </p>
        </div>
        <Button
          onClick={() => setCreating(true)}
          disabled={!canWrite || creating}
        >
          新建 Flag
        </Button>
      </div>
      {!canWrite && (
        <p className="permission-note">
          当前环境为只读；可以查看配置和运行评估。
        </p>
      )}
      {creating && (
        <FlagForm
          environment={environment}
          save={async (input) => {
            const created = await flags.create(input);
            await cache.invalidateQueries({ queryKey: ['flags'] });
            void navigate(`/flags/${created.id}?environment=${environment}`);
          }}
          cancel={() => setCreating(false)}
        />
      )}
      <section className="panel">
        <div className="toolbar">
          <label className="search-field">
            搜索名称或 Key
            <input
              type="search"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setOffset(0);
              }}
              maxLength={160}
              placeholder="搜索配置…"
            />
          </label>
          <label>
            状态
            <select
              value={enabled}
              onChange={(e) => {
                setEnabled(e.target.value);
                setOffset(0);
              }}
            >
              <option value="">全部状态</option>
              <option value="true">已启用</option>
              <option value="false">已停用</option>
            </select>
          </label>
          <Button
            variant="outline"
            onClick={() => {
              void data.refetch();
            }}
            disabled={data.isFetching}
          >
            刷新列表
          </Button>
        </div>
        {data.isPending && <p role="status">加载配置中…</p>}
        {data.isError && (
          <div role="alert" className="error-message">
            {feedback(data.error)}
          </div>
        )}
        {data.data && (
          <>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>名称 / Key</th>
                    <th>状态</th>
                    <th>默认值</th>
                    <th>版本</th>
                    <th>更新时间</th>
                  </tr>
                </thead>
                <tbody>
                  {data.data.items.map((flag) => (
                    <tr key={flag.id}>
                      <td>
                        <Link
                          className="flag-name"
                          to={`/flags/${flag.id}?environment=${environment}`}
                        >
                          {flag.name}
                        </Link>
                        <code className="block muted">{flag.key}</code>
                      </td>
                      <td>
                        <span
                          className={
                            'badge ' + (flag.enabled ? 'good' : 'neutral')
                          }
                        >
                          {flag.enabled ? '已启用' : '已停用'}
                        </span>
                      </td>
                      <td>
                        <code>{String(flag.default_value)}</code>
                      </td>
                      <td>r{flag.revision}</td>
                      <td className="muted">
                        {new Date(flag.updated_at).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {data.data.items.length === 0 && (
              <p className="empty-state">没有符合条件的配置。</p>
            )}
            <div className="pagination">
              <span>共 {data.data.total} 项</span>
              <Button
                variant="ghost"
                disabled={offset === 0}
                onClick={() => setOffset(Math.max(0, offset - 50))}
              >
                上一页
              </Button>
              <Button
                variant="ghost"
                disabled={offset + 50 >= data.data.total}
                onClick={() => setOffset(offset + 50)}
              >
                下一页
              </Button>
            </div>
          </>
        )}
      </section>
    </>
  );
}
