import { useRef, useState } from 'react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
import type { Flag, Flags, Rule } from '../application/contracts';
import { moveRule } from '../domain/ordering';
import { ApiError, feedback } from '../../../shared-kernel/errors';
import { Button } from '../../../presentation/components/button';
import { Notice } from '../../../presentation/components/notice';
import { RuleCondition } from './rule-condition';
function SortableRule({
  rule,
  index,
  count,
  disabled,
  move,
}: {
  rule: Rule;
  index: number;
  count: number;
  disabled: boolean;
  move: (to: number) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
    isOver,
  } = useSortable({
    id: rule.id,
    disabled,
    transition: { duration: 150, easing: 'ease' },
  });
  return (
    <li
      ref={setNodeRef}
      data-rule-id={rule.id}
      data-dragging={isDragging}
      data-over={isOver}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 1 : undefined,
      }}
    >
      <div className="rule-description">
        <Button
          ref={setActivatorNodeRef}
          className="sort-handle"
          variant="ghost"
          {...attributes}
          {...listeners}
          aria-label={`移动第 ${index + 1} 条规则`}
          disabled={disabled}
          onKeyDown={(event) => {
            if (
              !isDragging &&
              (event.key === 'ArrowUp' || event.key === 'ArrowDown')
            ) {
              event.preventDefault();
              move(index + (event.key === 'ArrowUp' ? -1 : 1));
            } else listeners?.onKeyDown?.(event);
          }}
        >
          <GripVertical size={16} />
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
          aria-label={`上移第 ${index + 1} 条规则`}
          disabled={disabled || index === 0}
          onClick={() => move(index - 1)}
        >
          上移
        </Button>
        <Button
          variant="ghost"
          aria-label={`下移第 ${index + 1} 条规则`}
          disabled={disabled || index === count - 1}
          onClick={() => move(index + 1)}
        >
          下移
        </Button>
      </div>
    </li>
  );
}
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
  const pending = useRef(false);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );
  const savedIDs = flag.rules.map((rule) => rule.id),
    ids = draft ?? savedIDs;
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
    setDraft(next);
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
      setDraft(null);
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
            拖动移动按钮，或聚焦后按 ↑ /
            ↓；也可使用上移、下移。释放后保存完整顺序。
          </p>
          {error !== undefined && (
            <Notice className="error-message" tone="error">
              排序失败，已恢复已保存顺序。{feedback(error)}
            </Notice>
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
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            accessibility={{
              screenReaderInstructions: {
                draggable:
                  '按空格开始拖动，方向键移动，空格确认，Escape 取消。',
              },
              announcements: {
                onDragStart: () => '正在移动规则。',
                onDragOver: ({ over }) =>
                  over ? '拖动到目标位置。' : '未选择目标位置。',
                onDragEnd: () => '拖动已结束。',
                onDragCancel: () => '已取消移动。',
              },
            }}
            onDragEnd={({ active, over }) => {
              if (over)
                void commit(
                  moveRule(
                    savedIDs,
                    String(active.id),
                    savedIDs.indexOf(String(over.id)),
                  ),
                );
            }}
          >
            <SortableContext items={ids} strategy={verticalListSortingStrategy}>
              <ol className="rule-list sortable-rules" aria-label="规则排序">
                {ids.map((id, index) => {
                  const rule = flag.rules.find((item) => item.id === id);
                  return rule ? (
                    <SortableRule
                      key={id}
                      rule={rule}
                      index={index}
                      count={ids.length}
                      disabled={!canWrite || busy || stale}
                      move={(to) => {
                        void commit(moveRule(savedIDs, id, to));
                      }}
                    />
                  ) : null;
                })}
              </ol>
            </SortableContext>
          </DndContext>
          {busy && <p role="status">保存规则顺序中…</p>}
        </>
      )}
    </section>
  );
}
