import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import Home from '../app/page';
import { api, clearSession, setSession } from './bridge';
import '../app/globals.css';
import '../app/writer.css';
import './password.css';

type Access = {token: string; role: 'reader' | 'owner'; expiresAt: number};
const accessKey = 'cottage-access-v1';

function restoreAccess(): Access | null {
  try {
    const value = JSON.parse(localStorage.getItem(accessKey) || 'null') as Access | null;
    if (!value || typeof value.token !== 'string' || !['reader', 'owner'].includes(value.role) || !Number.isFinite(value.expiresAt) || value.expiresAt <= Date.now()) {
      localStorage.removeItem(accessKey);
      return null;
    }
    setSession(value.token);
    return value;
  } catch {
    localStorage.removeItem(accessKey);
    return null;
  }
}

function App() {
  const [session, setAccess] = useState<Access | null>(restoreAccess);
  const [role, setRole] = useState<'reader' | 'owner'>('reader');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  function lock() { clearSession(); localStorage.removeItem(accessKey); setAccess(null); setPassword(''); }
  useEffect(() => {
    const expired = () => { lock(); setError('小屋已上鎖，請重新輸入密碼。未完成的草稿仍在這個分頁的記憶體中。'); };
    window.addEventListener('cottage-expired', expired);
    let timer: ReturnType<typeof setTimeout> | undefined;
    const scheduleExpiry = () => {
      if (!session) return;
      const remaining = session.expiresAt - Date.now();
      if (remaining <= 0) { expired(); return; }
      timer = setTimeout(scheduleExpiry, Math.min(remaining, 2147483647));
    };
    scheduleExpiry();
    return () => { window.removeEventListener('cottage-expired', expired); clearTimeout(timer); };
  }, [session]);
  if (session) return <Home canWrite={session.role === 'owner'} onLock={lock} />;
  return <main className="password-screen"><form className="password-card" onSubmit={async e => {
    e.preventDefault(); if (busy) return; setBusy(true); setError('');
    try {
      const result = await api<{token: string; role: 'reader' | 'owner'; expiresAt: number}>('login', { role, password });
      setSession(result.token); localStorage.setItem(accessKey, JSON.stringify(result)); setPassword(''); setAccess(result);
    } catch (err) { setError(err instanceof Error ? err.message : '暫時無法開門，請稍後再試。'); }
    finally { setBusy(false); }
  }}>
    <span className="password-symbol" aria-hidden="true">⌂</span><h1>日記小屋</h1><p>留一盞燈，等知道密語的你。</p>
    <label htmlFor="cottage-password">{role === 'owner' ? '主人密碼' : '閱讀密碼'}</label>
    <input id="cottage-password" type="password" autoComplete="current-password" required maxLength={256} value={password} onChange={e => setPassword(e.target.value)} disabled={busy} />
    <button className="unlock-button" disabled={busy}>{busy ? '正在確認密語…' : '打開小屋'}</button>
    {error && <p className="password-error" role="alert">{error}</p>}
    <button className="owner-switch" type="button" disabled={busy} onClick={() => { setRole(role === 'reader' ? 'owner' : 'reader'); setPassword(''); setError(''); }}>{role === 'reader' ? '我是主人，要寫日記' : '回到訪客閱讀'}</button>
    <small>日記會在密碼驗證成功後才載入。<br />此裝置會保持登入 30 天；手動鎖上小屋會立即清除憑證。</small>
  </form></main>;
}
createRoot(document.getElementById('root')!).render(<App />);
