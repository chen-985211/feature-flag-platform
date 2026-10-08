import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  ArrowRight,
  Check,
  Flag,
  LoaderCircle,
  Moon,
  RefreshCw,
  Sun,
  Unplug,
} from 'lucide-react';
import type { CheckReadiness } from '../../platform/health/application/check-readiness';
import { Button } from '../components/button';

export function App({ checkReadiness }: { checkReadiness: CheckReadiness }) {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  }, [dark]);
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
    <div className="workspace">
      <header className="topbar">
        <a className="brand" href="/" aria-label="Flag 工作台首页">
          <span className="brand-mark">
            <Flag size={18} aria-hidden="true" />
          </span>
          <strong>Flag 工作台</strong>
        </a>
        <div className="header-actions">
          <span className="stage-label">开发环境</span>
          <Button
            variant="ghost"
            aria-label={dark ? '切换为浅色主题' : '切换为深色主题'}
            onClick={() => setDark(!dark)}
          >
            {dark ? (
              <Sun size={18} aria-hidden="true" />
            ) : (
              <Moon size={18} aria-hidden="true" />
            )}
          </Button>
        </div>
      </header>
      <div className="shell">
        <aside className="sidebar">
          <span className="nav-caption">工作空间</span>
          <a className="nav-item active" href="/" aria-current="page">
            <Activity size={17} aria-hidden="true" />
            概览
          </a>
          <div className="sidebar-note">
            配置管理、规则评估和操作历史将从这里开始。
          </div>
        </aside>
        <main className="content">
          <div className="page-heading">
            <div>
              <p className="eyebrow">工作空间 / 概览</p>
              <h1>准备开始</h1>
              <p className="page-description">
                查看服务状态，确认工作台可以正常连接。
              </p>
            </div>
            <span className="phase-tag">工程基础</span>
          </div>
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
            {state === 'unavailable' &&
              status.data?.status === 'unavailable' && (
                <div className="request-id">
                  请求编号 <code>{status.data.requestId}</code>
                </div>
              )}
            <div className="card-footer">
              <span
                className={'status-dot state-' + state}
                aria-hidden="true"
              />
              <span>每次刷新都会重新查询服务状态</span>
            </div>
          </section>
          <section className="next-card" aria-labelledby="next-title">
            <span className="next-icon">
              <Flag size={19} aria-hidden="true" />
            </span>
            <div>
              <h2 id="next-title">配置管理即将接入</h2>
              <p>下一阶段将提供登录、Flag 配置、规则和评估。</p>
            </div>
            <ArrowRight size={18} className="muted" aria-hidden="true" />
          </section>
          <p className="footnote">当前为工程基础阶段，业务功能尚未开放。</p>
        </main>
      </div>
    </div>
  );
}
