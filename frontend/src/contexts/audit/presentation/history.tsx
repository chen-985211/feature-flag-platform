import { PagePagination } from '../../../presentation/components/page-pagination';
import { Notice } from '../../../presentation/components/notice';
import { Card } from '../../../presentation/components/ui/card';
import { Badge } from '../../../presentation/components/ui/badge';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Audit } from '../application/contracts';
import { feedback } from '../../../shared-kernel/errors';
import { Button } from '../../../presentation/components/button';
import { ChevronDown } from 'lucide-react';
import { RawJSON } from '../../../presentation/components/raw-json';
import { describeChange } from './change-description';
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from '../../../presentation/components/ui/collapsible';
const names: Record<string, string> = {
  flag_created: '创建配置',
  flag_edited: '编辑基本信息',
  flag_enabled: '调整启用状态',
  rule_created: '添加规则',
  rule_edited: '编辑规则',
  rule_deleted: '删除规则',
  flag_rolled_back: '恢复历史版本',
  rules_reordered: '调整规则顺序',
  flag_copied: '复制配置',
  flag_published: '发布配置',
};
export function History({ audit, id }: { audit: Audit; id: string }) {
  const [offset, setOffset] = useState(0);
  const query = useQuery({
    queryKey: ['history', id, offset],
    queryFn: ({ signal }) => audit.history(id, offset, signal),
  });
  return (
    <Card asChild>
      <section className="panel">
        <h2>操作历史</h2>
        {query.isPending && <p role="status">加载历史中…</p>}
        {query.isError && (
          <Notice role="alert" className="error-message" tone="error">
            {feedback(query.error)}
          </Notice>
        )}
        {query.data && (
          <>
            {query.data.items.length === 0 && <p>暂无操作历史。</p>}
            <ol className="history-list">
              {query.data.items.map((entry) => {
                const description = describeChange(entry);
                return (
                  <li key={entry.id}>
                    <div className="actions">
                      <strong>{names[entry.action] ?? entry.action}</strong>
                      <Badge variant="outline" className="font-mono">
                        {description?.fromRevision !== undefined
                          ? `r${String(description.fromRevision)} → `
                          : ''}
                        r{entry.revision}
                      </Badge>
                    </div>
                    <p className="history-summary">
                      {description?.summary ??
                        '此记录暂无法生成变更摘要，可查看完整原始数据。'}
                    </p>
                    <div className="history-meta">
                      <span>{entry.actor_name}</span>
                      <time dateTime={entry.created_at}>
                        {new Date(entry.created_at).toLocaleString()}
                      </time>
                      <code>
                        {entry.environment} / {entry.key}
                      </code>
                    </div>
                    <Collapsible className="history-details">
                      <CollapsibleTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="history-disclosure"
                        >
                          查看变更详情
                          <ChevronDown size={14} />
                        </Button>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <section role="region" aria-label="变更前后对比">
                          {description ? (
                            description.rows.length === 0 ? (
                              <p className="muted">业务配置内容未改变。</p>
                            ) : (
                              description.rows.map((row, index) => (
                                <div className="diff-row" key={index}>
                                  <h4>{row.label}</h4>
                                  <div className="diff-columns">
                                    <div>
                                      <small>变更前</small>
                                      <p>{row.before}</p>
                                    </div>
                                    <div>
                                      <small>变更后</small>
                                      <p>{row.after}</p>
                                    </div>
                                  </div>
                                </div>
                              ))
                            )
                          ) : (
                            <p className="muted">
                              原始记录已保留，以下可展开查看。
                            </p>
                          )}
                          <RawJSON
                            raw={entry.changes_json}
                            label="原始审计数据"
                          />
                        </section>
                      </CollapsibleContent>
                    </Collapsible>
                  </li>
                );
              })}
            </ol>
            <PagePagination
              total={query.data.total}
              offset={offset}
              unit="条"
              label="历史分页"
              onPage={setOffset}
            />
          </>
        )}
      </section>
    </Card>
  );
}
