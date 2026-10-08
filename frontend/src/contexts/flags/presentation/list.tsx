import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import {
  Plus,
  Search,
  RefreshCw,
  Flag as FlagIcon,
  ArrowUpRight,
} from 'lucide-react';
import type { Environment, Flags } from '../application/contracts';
import { FlagForm } from './flag-form';
import { feedback } from '../../../shared-kernel/errors';
import { Button } from '../../../presentation/components/button';
import { FormDialog } from '../../../presentation/components/form-dialog';
import { Input } from '../../../presentation/components/ui/input';
import { NativeSelect } from '../../../presentation/components/ui/native-select';
import { Badge } from '../../../presentation/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../../presentation/components/ui/table';
export function FlagList({
  flags,
  environment,
  canWrite,
}: {
  flags: Flags;
  environment: Environment;
  canWrite: boolean;
}) {
  const [q, setQ] = useState(''),
    [enabled, setEnabled] = useState(''),
    [offset, setOffset] = useState(0),
    [creating, setCreating] = useState(false),
    [pending, setPending] = useState(false);
  const navigate = useNavigate(),
    cache = useQueryClient();
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
          <p className="page-description">集中管理功能开关与灰度规则。</p>
        </div>
        <FormDialog
          open={creating}
          onOpenChange={setCreating}
          busy={pending}
          title="新建 Flag"
          description={'在 ' + environment + ' 创建独立的功能配置。'}
          trigger={
            <Button variant="primary" disabled={!canWrite}>
              <Plus size={15} />
              新建 Flag
            </Button>
          }
        >
          <FlagForm
            embedded
            environment={environment}
            onBusyChange={setPending}
            save={async (input) => {
              const created = await flags.create(input);
              await cache.invalidateQueries({ queryKey: ['flags'] });
              setCreating(false);
              void navigate(`/flags/${created.id}?environment=${environment}`);
            }}
            cancel={() => setCreating(false)}
          />
        </FormDialog>
      </div>
      {!canWrite && (
        <p className="permission-note">
          当前环境为只读；可以查看配置和运行评估。
        </p>
      )}
      <section className="panel list-panel">
        <div className="toolbar">
          <div className="search-field">
            <Search />
            <Input
              aria-label="搜索名称或 Key"
              type="search"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setOffset(0);
              }}
              maxLength={160}
              placeholder="搜索名称或 Key…"
            />
          </div>
          <NativeSelect
            aria-label="状态"
            value={enabled}
            onChange={(e) => {
              setEnabled(e.target.value);
              setOffset(0);
            }}
          >
            <option value="">全部状态</option>
            <option value="true">已启用</option>
            <option value="false">已停用</option>
          </NativeSelect>
          <Button
            variant="ghost"
            size="icon"
            aria-label="刷新列表"
            title="刷新列表"
            onClick={() => {
              void data.refetch();
            }}
            disabled={data.isFetching}
          >
            <RefreshCw size={15} className={data.isFetching ? 'spin' : ''} />
          </Button>
        </div>
        {data.isPending && (
          <p className="empty-state" role="status">
            加载配置中…
          </p>
        )}
        {data.isError && (
          <div role="alert" className="error-message">
            {feedback(data.error)}
          </div>
        )}
        {data.data && (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>名称 / Key</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>默认值</TableHead>
                  <TableHead>版本</TableHead>
                  <TableHead>更新时间</TableHead>
                  <TableHead>
                    <span className="sr-only">查看配置</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.data.items.map((flag) => (
                  <TableRow key={flag.id}>
                    <TableCell className="flag-cell">
                      <Link
                        className="flag-name"
                        to={`/flags/${flag.id}?environment=${environment}`}
                      >
                        {flag.name}
                      </Link>
                      <code className="flag-key" title={flag.key}>
                        {flag.key}
                      </code>
                    </TableCell>
                    <TableCell className="cell-nowrap">
                      <Badge
                        variant="secondary"
                        className={flag.enabled ? 'good' : 'neutral'}
                      >
                        {flag.enabled ? '已启用' : '已停用'}
                      </Badge>
                    </TableCell>
                    <TableCell className="cell-nowrap">
                      <code>{String(flag.default_value)}</code>
                    </TableCell>
                    <TableCell className="cell-nowrap">
                      <Badge variant="outline" className="font-mono">
                        r{flag.revision}
                      </Badge>
                    </TableCell>
                    <TableCell className="cell-date">
                      {new Date(flag.updated_at).toLocaleDateString()}
                      <span>
                        {new Date(flag.updated_at).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Button asChild variant="ghost" size="icon">
                        <Link
                          aria-label={'查看 ' + flag.name}
                          to={`/flags/${flag.id}?environment=${environment}`}
                        >
                          <ArrowUpRight size={14} />
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {data.data.items.length === 0 && (
              <div className="empty-state">
                <FlagIcon />
                <p>没有符合条件的配置。</p>
              </div>
            )}
            <div className="pagination">
              <span>共 {data.data.total} 项</span>
              <Button
                variant="ghost"
                size="sm"
                disabled={offset === 0}
                onClick={() => setOffset(Math.max(0, offset - 50))}
              >
                上一页
              </Button>
              <Button
                variant="ghost"
                size="sm"
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
