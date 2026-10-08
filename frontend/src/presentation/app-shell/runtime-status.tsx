import { useQuery } from '@tanstack/react-query';
import { Check, LoaderCircle, Unplug, RefreshCw } from 'lucide-react';
import type { CheckReadiness } from '../../platform/health/application/check-readiness';
import { Button } from '../components/button';
export function RuntimeStatus({
  checkReadiness,
}: {
  checkReadiness: CheckReadiness;
}) {
  const status = useQuery({
    queryKey: ['runtime', 'readiness'],
    queryFn: ({ signal }) => checkReadiness(signal),
    retry: false,
    refetchOnWindowFocus: false,
  });
  const state = status.isPending
    ? 'loading'
    : status.isError
      ? 'error'
      : status.data.status;
  const title = {
    loading: '检查中…',
    ready: '服务已就绪',
    unavailable: '服务暂不可用',
    error: '无法连接服务',
  }[state];
  const detail = {
    loading: '正在获取服务状态。',
    ready: '服务连接正常，可以继续。',
    unavailable: '服务正在恢复，请稍后刷新状态。',
    error: '请确认服务已启动，然后重试。',
  }[state];
  const StateIcon =
    state === 'loading' ? LoaderCircle : state === 'ready' ? Check : Unplug;
  return (
    <section className="status-card" aria-labelledby="connection-title">
      <div className="card-heading">
        <span className="card-label" id="connection-title">
          服务连接
        </span>
        <span className="endpoint">实时状态</span>
      </div>
      <div className="connection-body">
        <span className={'state-icon state-' + state}>
          <StateIcon
            size={22}
            className={state === 'loading' ? 'spin' : ''}
            aria-hidden="true"
          />
        </span>
        <div className="connection-copy">
          <div role="status" aria-live="polite">
            <h2>{title}</h2>
          </div>
          <p>{detail}</p>
        </div>
        <Button
          onClick={() => {
            void status.refetch();
          }}
          disabled={status.isFetching}
          aria-label="刷新状态"
        >
          <RefreshCw
            size={15}
            className={status.isFetching ? 'spin' : ''}
            aria-hidden="true"
          />
          刷新状态
        </Button>
      </div>
      {state === 'unavailable' && status.data?.status === 'unavailable' && (
        <div className="request-id">
          请求编号 <code>{status.data.requestId}</code>
        </div>
      )}
      <div className="card-footer">
        <span className={'status-dot state-' + state} aria-hidden="true" />
        <span>每次刷新都会重新查询服务状态</span>
      </div>
    </section>
  );
}
