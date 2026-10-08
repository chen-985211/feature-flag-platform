import { PagePagination } from '../../../presentation/components/page-pagination';
import { PageHeader } from '../../../presentation/components/page-header';
import { Notice } from '../../../presentation/components/notice';
import { Card } from '../../../presentation/components/ui/card';
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
import {
  Dropdown,
  DropdownOption,
} from '../../../presentation/components/dropdown';
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
      <PageHeader title="功能配置" description="集中管理功能开关与灰度规则。">
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
      </PageHeader>
      {!canWrite && (
        <Notice className="permission-note">
          当前环境为只读；可以查看配置和运行评估。
        </Notice>
      )}
      <Card asChild>
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
            <Dropdown
              aria-label="状态"
              value={enabled}
              onValueChange={(nextValue) => {
                setEnabled(nextValue);
                setOffset(0);
              }}
            >
              <DropdownOption value="">全部状态</DropdownOption>
              <DropdownOption value="true">已启用</DropdownOption>
              <DropdownOption value="false">已停用</DropdownOption>
            </Dropdown>
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
            <Notice role="alert" className="error-message" tone="error">
              {feedback(data.error)}
            </Notice>
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
                        <Button
                          asChild
                          variant="ghost"
                          size="icon"
                          title={'查看 ' + flag.name}
                        >
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
              <PagePagination
                total={data.data.total}
                offset={offset}
                unit="项"
                label="配置分页"
                onPage={setOffset}
              />
            </>
          )}
        </section>
      </Card>
    </>
  );
}
