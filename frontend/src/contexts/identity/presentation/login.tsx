import { Flag } from 'lucide-react';
import { Label } from '../../../presentation/components/ui/label';
import { Input } from '../../../presentation/components/ui/input';
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
        <span className="brand-mark">
          <Flag size={20} />
        </span>
        <h1>登录工作空间</h1>
        <p className="muted">使用已分配的账号管理配置与评估规则。</p>
        <Label>
          账号
          <Input
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            maxLength={80}
            disabled={busy}
            autoFocus
          />
        </Label>
        <Label>
          密码
          <Input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={busy}
          />
        </Label>
        {error !== undefined && (
          <p role="alert" className="error-message">
            {feedback(error)}
          </p>
        )}
        <Button type="submit" variant="primary" disabled={busy}>
          {busy ? '登录中…' : '登录'}
        </Button>
      </form>
    </main>
  );
}
