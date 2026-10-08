import { useState } from 'react';
import type { Identity, Session } from '../application/contracts';
import { feedback } from '../../../shared-kernel/errors';
import { Button } from '../../../presentation/components/button';
export function Login({
  identity,
  onLogin,
}: {
  identity: Identity;
  onLogin: (session: Session) => void;
}) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>();
  async function submit() {
    setBusy(true);
    setError(undefined);
    try {
      const session = await identity.login(username, password);
      setPassword('');
      onLogin(session);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="login-page">
      <form
        className="panel form-grid login-card"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <p className="eyebrow">FLAG 工作台</p>
        <h1>登录工作空间</h1>
        <p className="muted">使用已分配的账号管理配置与评估规则。</p>
        <label>
          账号
          <input
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            maxLength={80}
            disabled={busy}
            autoFocus
          />
        </label>
        <label>
          密码
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={busy}
          />
        </label>
        {error !== undefined && (
          <p role="alert" className="error-message">
            {feedback(error)}
          </p>
        )}
        <Button type="submit" disabled={busy}>
          {busy ? '登录中…' : '登录'}
        </Button>
      </form>
    </main>
  );
}
