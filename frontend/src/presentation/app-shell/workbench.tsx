import { WorkspaceNavigation } from '../components/workspace-navigation';
import { PageHeader } from '../components/page-header';
import { Notice } from '../components/notice';
import { Card } from '../components/ui/card';
import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Link,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useSearchParams,
} from 'react-router-dom';
import {
  Flag as FlagIcon,
  Moon,
  Sun,
  FlaskConical,
  Activity,
  LogOut,
} from 'lucide-react';
import { Dropdown, DropdownOption } from '../components/dropdown';
import { Label } from '../components/ui/label';
import type {
  Identity,
  Session,
} from '../../contexts/identity/application/contracts';
import type {
  Environment,
  Flags,
} from '../../contexts/flags/application/contracts';
import type { Audit } from '../../contexts/audit/application/contracts';
import type { CheckReadiness } from '../../platform/health/application/check-readiness';
import { Login } from '../../contexts/identity/presentation/login';
import { FlagList } from '../../contexts/flags/presentation/list';
import { FlagDetail } from '../../contexts/flags/presentation/detail';
import { EvaluationConsole } from '../../contexts/flags/presentation/evaluation';
import { History } from '../../contexts/audit/presentation/history';
import { ApiError, feedback } from '../../shared-kernel/errors';
import { RuntimeStatus } from './runtime-status';
import { Button } from '../components/button';
export function Workbench({
  identity,
  flags,
  audit,
  checkReadiness,
}: {
  identity: Identity;
  flags: Flags;
  audit: Audit;
  checkReadiness: CheckReadiness;
}) {
  const navigate = useNavigate();
  const cache = useQueryClient();
  const [search] = useSearchParams();
  const rawEnv = search.get('environment');
  const environment: Environment =
    rawEnv === 'staging' || rawEnv === 'production' ? rawEnv : 'development';
  const location = useLocation();
  const [dark, setDark] = useState(false);
  const [logoutError, setLogoutError] = useState<unknown>();
  const [loggingOut, setLoggingOut] = useState(false);
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  }, [dark]);
  const session = useQuery<Session | null>({
    queryKey: ['session'],
    queryFn: ({ signal }) => identity.session(signal),
    retry: false,
    refetchOnWindowFocus: true,
  });
  if (session.isPending)
    return (
      <main className="login-page">
        <p role="status">正在恢复会话…</p>
      </main>
    );
  if (
    session.isError &&
    !(
      session.error instanceof ApiError &&
      session.error.code === 'UNAUTHENTICATED'
    )
  )
    return (
      <main className="login-page">
        <Card asChild>
          <section className="panel">
            <Notice tone="error">{feedback(session.error)}</Notice>
            <Button
              onClick={() => {
                void session.refetch();
              }}
            >
              重试连接
            </Button>
          </section>
        </Card>
      </main>
    );
  if (!session.data || session.isError)
    return (
      <Login
        identity={identity}
        onLogin={(value) => {
          cache.removeQueries({
            predicate: (query) => query.queryKey[0] !== 'session',
          });
          cache.setQueryData(['session'], value);
        }}
      />
    );
  const current = session.data;
  const canWrite = current.write_environments.includes(environment);
  async function logout() {
    setLoggingOut(true);
    setLogoutError(undefined);
    try {
      await identity.logout();
      cache.removeQueries({
        predicate: (query) => query.queryKey[0] !== 'session',
      });
      cache.setQueryData(['session'], null);
    } catch (e) {
      setLogoutError(e);
    } finally {
      setLoggingOut(false);
    }
  }
  const nav = [
    ['/flags', '功能配置', FlagIcon],
    ['/evaluate', '评估控制台', FlaskConical],
    ['/overview', '服务概览', Activity],
  ] as const;
  return (
    <div className="workspace">
      <header className="topbar">
        <Link className="brand" to={'/flags?environment=' + environment}>
          <span className="brand-mark">
            <FlagIcon size={18} />
          </span>
          <strong>Flag 工作台</strong>
        </Link>
        <div className="header-actions">
          <Label className="environment-control">
            环境
            <Dropdown
              aria-label="当前环境"
              value={environment}
              onValueChange={(nextValue) => {
                const next = new URLSearchParams(search);
                next.set('environment', nextValue);
                const path = location.pathname.startsWith('/flags/')
                  ? '/flags'
                  : location.pathname;
                void navigate(path + '?' + next.toString());
              }}
            >
              <DropdownOption value="development">Development</DropdownOption>
              <DropdownOption value="staging">Staging</DropdownOption>
              <DropdownOption value="production">Production</DropdownOption>
            </Dropdown>
          </Label>
          <span className="user-label">
            {current.user.display_name}
            <small>{current.user.role}</small>
          </span>
          <Button
            variant="ghost"
            size="icon"
            title={dark ? '切换为浅色主题' : '切换为深色主题'}
            aria-label={dark ? '切换为浅色主题' : '切换为深色主题'}
            onClick={() => setDark(!dark)}
          >
            {dark ? <Sun size={17} /> : <Moon size={17} />}
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              void logout();
            }}
            disabled={loggingOut}
          >
            <LogOut size={15} />
            退出
          </Button>
        </div>
      </header>
      <WorkspaceNavigation
        mobile
        items={nav.map(([path, label, icon]) => ({
          path,
          label,
          icon,
          href: path + '?environment=' + environment,
        }))}
      />
      <div className="shell">
        <aside className="sidebar">
          <span className="nav-caption">工作空间</span>
          <WorkspaceNavigation
            items={nav.map(([path, label, icon]) => ({
              path,
              label,
              icon,
              href: path + '?environment=' + environment,
            }))}
          />
        </aside>
        <main className="content">
          {logoutError !== undefined && (
            <Notice role="alert" className="error-message" tone="error">
              {feedback(logoutError)}
            </Notice>
          )}
          <Routes>
            <Route
              path="/flags"
              element={
                <FlagList
                  key={environment}
                  flags={flags}
                  environment={environment}
                  canWrite={canWrite}
                />
              }
            />
            <Route
              path="/flags/:id"
              element={
                <FlagDetail
                  flags={flags}
                  writeEnvironments={current.write_environments}
                  history={(id) => <History audit={audit} id={id} />}
                />
              }
            />
            <Route
              path="/evaluate"
              element={
                <EvaluationConsole
                  key={environment}
                  flags={flags}
                  environment={environment}
                />
              }
            />
            <Route
              path="/overview"
              element={
                <>
                  <PageHeader
                    title="服务概览"
                    description="查看当前服务连接状态。"
                  ></PageHeader>
                  <RuntimeStatus checkReadiness={checkReadiness} />
                </>
              }
            />
            <Route
              path="*"
              element={
                <Navigate to={'/flags?environment=' + environment} replace />
              }
            />
          </Routes>
        </main>
      </div>
    </div>
  );
}
