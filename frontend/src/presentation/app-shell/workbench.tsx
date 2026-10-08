import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Link,
  NavLink,
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
  UserRound,
  LogOut,
} from 'lucide-react';
import { NativeSelect } from '../components/ui/native-select';
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
        <section className="panel">
          <p role="alert">{feedback(session.error)}</p>
          <Button
            onClick={() => {
              void session.refetch();
            }}
          >
            重试连接
          </Button>
        </section>
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
            <NativeSelect
              aria-label="当前环境"
              value={environment}
              onChange={(e) => {
                const next = new URLSearchParams(search);
                next.set('environment', e.target.value);
                const path = location.pathname.startsWith('/flags/')
                  ? '/flags'
                  : location.pathname;
                void navigate(path + '?' + next.toString());
              }}
            >
              <option value="development">Development</option>
              <option value="staging">Staging</option>
              <option value="production">Production</option>
            </NativeSelect>
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
      <nav className="mobile-nav" aria-label="工作空间导航">
        {nav.map(([path, label, Icon]) => (
          <NavLink key={path} to={path + '?environment=' + environment}>
            <Icon aria-hidden="true" />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
      <div className="shell">
        <aside className="sidebar">
          <span className="nav-caption">工作空间</span>
          {nav.map(([path, label, Icon]) => (
            <NavLink
              className={({ isActive }) =>
                'nav-item' + (isActive ? ' active' : '')
              }
              title={label}
              key={path}
              to={path + '?environment=' + environment}
            >
              <Icon aria-hidden="true" />
              <span>{label}</span>
            </NavLink>
          ))}
          <div className="sidebar-footer">
            <span className="user-avatar" title={current.user.display_name}>
              <UserRound size={16} />
            </span>
            <span className="user-label">
              {current.user.display_name}
              <small>{current.user.role}</small>
            </span>
          </div>
        </aside>
        <main className="content">
          {logoutError !== undefined && (
            <p role="alert" className="error-message">
              {feedback(logoutError)}
            </p>
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
                  <div className="page-heading">
                    <div>
                      <h1>服务概览</h1>
                      <p className="page-description">查看当前服务连接状态。</p>
                    </div>
                  </div>
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
