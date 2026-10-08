import { useRef, useState } from 'react';
import type { Flag, Flags } from '../application/contracts';
import { moveRule } from '../domain/ordering';
import { ApiError, feedback } from '../../../shared-kernel/errors';
import { Button } from '../../../presentation/components/button';
import { RuleCondition } from './rule-condition';
export function RuleOrder({
  flag,
  flags,
  canWrite,
  onSaved,
  reload,
}: {
  flag: Flag;
  flags: Flags;
  canWrite: boolean;
  onSaved: (flag: Flag) => Promise<void>;
  reload: () => Promise<void>;
}) {
  const [editing, setEditing] = useState(false),
    [draft, setDraft] = useState<string[] | null>(null),
    [busy, setBusy] = useState(false),
    [stale, setStale] = useState(false),
    [error, setError] = useState<unknown>(),
    [message, setMessage] = useState('');
  const [dragging, setDragging] = useState<string | null>(null),
    [offsets, setOffsets] = useState<Record<string, number>>({});
  const geometry = useRef<Record<string, { top: number; height: number }>>({});
  const dragged = useRef<string | null>(null),
    pending = useRef(false),
    order = useRef<string[] | null>(null);
  const savedIDs = flag.rules.map((r) => r.id),
    ids = draft ?? savedIDs;
  function preview(next: string[]) {
    order.current = next;
    setDraft(next);
    if (dragged.current) layout(next, true);
  }
  function layout(next: string[], keepSource: boolean) {
    let top = geometry.current[savedIDs[0]]?.top;
    if (top === undefined) return;
    const moved: Record<string, number> = {};
    for (const id of next) {
      const row = geometry.current[id];
      if (!row) return;
      moved[id] = keepSource && id === dragged.current ? 0 : top - row.top;
      top += row.height;
    }
    setOffsets(moved);
  }
  async function commit(next: string[]) {
    if (
      !canWrite ||
      pending.current ||
      stale ||
      next.every((id, i) => id === savedIDs[i])
    )
      return;
    pending.current = true;
    setBusy(true);
    setError(undefined);
    setMessage('');
    preview(next);
    try {
      await onSaved(await flags.reorder(flag.id, next, flag.revision));
      setMessage('规则顺序已保存。');
    } catch (e) {
      setError(e);
      if (e instanceof ApiError && e.code === 'VERSION_CONFLICT')
        setStale(true);
    } finally {
      pending.current = false;
      setBusy(false);
      order.current = null;
      setDraft(null);
      dragged.current = null;
      setDragging(null);
      setOffsets({});
    }
  }
  return (
    <section className="rule-order">
      <Button
        variant="outline"
        disabled={!canWrite || flag.rules.length < 2 || busy}
        onClick={() => setEditing(!editing)}
      >
        {editing ? '收起排序' : '调整规则顺序'}
      </Button>
      {editing && (
        <>
          <p className="muted">
            拖动规则，或聚焦移动按钮后按 ↑ /
            ↓；也可使用上移、下移。释放后保存完整顺序。
          </p>
          {error !== undefined && (
            <p className="error-message" role="alert">
              排序失败，已恢复已保存顺序。{feedback(error)}
            </p>
          )}
          {stale && (
            <Button
              onClick={() => {
                void reload().then(() => {
                  setStale(false);
                  setError(undefined);
                });
              }}
            >
              刷新当前规则
            </Button>
          )}
          {message && <p role="status">{message}</p>}
          <ol
            className="rule-list sortable-rules"
            aria-label="规则排序"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (dragged.current) void commit(order.current ?? savedIDs);
            }}
          >
            {savedIDs.map((id) => {
              const index = ids.indexOf(id);
              const rule = flag.rules.find((r) => r.id === id);
              if (!rule) return null;
              return (
                <li
                  key={id}
                  style={{
                    transform: `translateY(${String(offsets[id] ?? 0)}px)`,
                    opacity: dragging === id ? 0 : 1,
                  }}
                  draggable={canWrite && !busy && !stale}
                  onDragStart={(e) => {
                    if (!canWrite || busy || stale) {
                      e.preventDefault();
                      return;
                    }
                    dragged.current = id;
                    setDragging(id);
                    const rows = e.currentTarget.parentElement?.children;
                    const measured: Record<
                      string,
                      { top: number; height: number }
                    > = {};
                    if (rows)
                      Array.from(rows).forEach((row, i) => {
                        const rect = row.getBoundingClientRect();
                        measured[savedIDs[i]] = {
                          top: rect.top,
                          height: rect.height,
                        };
                      });
                    geometry.current = measured;
                    e.dataTransfer.setData('text/plain', id);
                    e.dataTransfer.effectAllowed = 'move';
                    order.current = [...savedIDs];
                  }}
                  onDragOver={(e) => e.preventDefault()}
                  onDragEnter={() => {
                    if (
                      dragged.current &&
                      dragged.current !== id &&
                      !pending.current
                    )
                      preview(
                        moveRule(
                          order.current ?? savedIDs,
                          dragged.current,
                          index,
                        ),
                      );
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (dragged.current)
                      void commit(
                        order.current ??
                          moveRule(savedIDs, dragged.current, index),
                      );
                  }}
                  onDragEnd={() => {
                    setDragging(null);
                    if (pending.current) {
                      layout(order.current ?? savedIDs, false);
                      return;
                    }
                    if (!pending.current) {
                      dragged.current = null;
                      order.current = null;
                      setDraft(null);
                      setOffsets({});
                    }
                  }}
                >
                  <div className="rule-description">
                    <Button
                      variant="ghost"
                      aria-label={`移动第 ${String(index + 1)} 条规则`}
                      disabled={busy || stale || !canWrite}
                      onKeyDown={(e) => {
                        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                          e.preventDefault();
                          void commit(
                            moveRule(
                              savedIDs,
                              id,
                              index + (e.key === 'ArrowUp' ? -1 : 1),
                            ),
                          );
                        }
                      }}
                    >
                      ↕
                    </Button>
                    <div>
                      <span className="muted">{index + 1} · </span>
                      <RuleCondition rule={rule} />
                      <p>命中返回 {String(rule.result)}</p>
                    </div>
                  </div>
                  <div className="actions">
                    <Button
                      variant="ghost"
                      aria-label={`上移第 ${String(index + 1)} 条规则`}
                      disabled={index === 0 || busy || stale || !canWrite}
                      onClick={() => {
                        void commit(moveRule(savedIDs, id, index - 1));
                      }}
                    >
                      上移
                    </Button>
                    <Button
                      variant="ghost"
                      aria-label={`下移第 ${String(index + 1)} 条规则`}
                      disabled={
                        index === ids.length - 1 || busy || stale || !canWrite
                      }
                      onClick={() => {
                        void commit(moveRule(savedIDs, id, index + 1));
                      }}
                    >
                      下移
                    </Button>
                  </div>
                </li>
              );
            })}
          </ol>
          {busy && <p role="status">保存规则顺序中…</p>}
        </>
      )}
    </section>
  );
}
