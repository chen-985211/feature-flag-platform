import { useState } from 'react';
import { ChevronDown, Copy } from 'lucide-react';
import { Button } from './button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from './ui/collapsible';
import { formatJSON } from './configuration-language';

export function RawJSON({
  raw,
  label = '原始数据',
}: {
  raw: string;
  label?: string;
}) {
  const [feedback, setFeedback] = useState<'copied' | 'failed'>();
  const [busy, setBusy] = useState(false);
  async function copy() {
    setBusy(true);
    setFeedback(undefined);
    try {
      await navigator.clipboard.writeText(raw);
      setFeedback('copied');
    } catch {
      setFeedback('failed');
    } finally {
      setBusy(false);
    }
  }
  return (
    <Collapsible className="raw-data">
      <CollapsibleTrigger asChild>
        <Button variant="ghost" size="sm" className="history-disclosure">
          查看原始数据 <ChevronDown size={14} />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <section role="region" aria-label={label}>
          <div className="raw-data-toolbar">
            <span className="muted">{label}</span>
            <Button
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => {
                void copy();
              }}
            >
              <Copy size={14} />
              {busy ? '复制中…' : '复制原始数据'}
            </Button>
          </div>
          {feedback === 'copied' && (
            <p role="status" className="muted">
              已复制完整原始数据。
            </p>
          )}
          {feedback === 'failed' && (
            <p role="alert" className="error-message">
              复制失败，请重试或手动选取下方文本。
            </p>
          )}
          <pre className="json-output">{formatJSON(raw)}</pre>
        </section>
      </CollapsibleContent>
    </Collapsible>
  );
}
