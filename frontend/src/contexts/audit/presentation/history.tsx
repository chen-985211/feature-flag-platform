import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Audit } from '../application/contracts';
import { feedback } from '../../../shared-kernel/errors';
import { Button } from '../../../presentation/components/button';
const names: Record<string, string> = {
  flag_created: '创建配置',
  flag_edited: '编辑基本信息',
  flag_enabled: '调整启用状态',
  rule_created: '添加规则',
  rule_edited: '编辑规则',
  rule_deleted: '删除规则',
  flag_rolled_back: '恢复历史版本',
};
export function History({ audit, id }: { audit: Audit; id: string }) {
  const [offset, setOffset] = useState(0);
  const query = useQuery({
    queryKey: ['history', id, offset],
    queryFn: ({ signal }) => audit.history(id, offset, signal),
  });
  return (
    <section className="panel">
      <h2>操作历史</h2>
      {query.isPending && <p role="status">加载历史中…</p>}
      {query.isError && (
        <p role="alert" className="error-message">
          {feedback(query.error)}
        </p>
      )}
      {query.data && (
        <>
          {query.data.items.length === 0 && <p>暂无操作历史。</p>}
          <ol className="history-list">
            {query.data.items.map((entry) => (
              <li key={entry.id}>
                <div className="actions">
                  <strong>{names[entry.action] ?? entry.action}</strong>
                  <span className="badge neutral">r{entry.revision}</span>
                </div>
                <p>
                  {entry.actor_name} ·{' '}
                  {new Date(entry.created_at).toLocaleString()} ·{' '}
                  {entry.environment} / {entry.key}
                </p>
                <details>
                  <summary>查看变更详情</summary>
                  <pre className="json-output">{entry.changes_json}</pre>
                </details>
              </li>
            ))}
          </ol>
          <div className="pagination">
            <span>共 {query.data.total} 条</span>
            <Button
              variant="ghost"
              disabled={offset === 0}
              onClick={() => setOffset(Math.max(0, offset - 50))}
            >
              上一页
            </Button>
            <Button
              variant="ghost"
              disabled={offset + 50 >= query.data.total}
              onClick={() => setOffset(offset + 50)}
            >
              下一页
            </Button>
          </div>
        </>
      )}
    </section>
  );
}
