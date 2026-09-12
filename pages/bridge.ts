// This URL is public. Passwords and server signing keys must never be bundled here.
const endpoint = 'https://script.google.com/macros/s/AKfycbwknThqRHIIj-HKupYL06YeV95bXlcGqv-isvzW9KINR9sQTKI-p5ZvO27Pj8HWj45fzA/exec';
type Envelope<T> = { status: number; data: T & { error?: string } };
export class ApiError extends Error { constructor(message: string, public status: number) { super(message); } }
let token = '';
export function clearSession() { token = ''; }
export function setSession(value: string) { token = value; }
let ready: Promise<void> | undefined;
let bridgeWindow: Window | null = null;
let bridgeOrigin = '';
const channel = crypto.randomUUID();
const pending = new Map<string, { resolve: (value: Envelope<unknown>) => void; reject: (reason: Error) => void; timer: ReturnType<typeof setTimeout> }>();
function connect() {
  if (ready) return ready;
  ready = new Promise<void>((resolve, reject) => {
    const frame = document.createElement('iframe');
    frame.hidden = true;
    frame.title = '日記安全連線';
    frame.referrerPolicy = 'no-referrer';
    const timer = setTimeout(() => {
      window.removeEventListener('message', receive);
      frame.remove(); ready = undefined;
      reject(new Error('尚未連上 Google。請確認已更新 Apps Script 部署，或稍後再試。'));
    }, 25000);
    function receive(event: MessageEvent) {
      if (!/^https:\/\/(?:[a-z0-9-]+-)?script\.googleusercontent\.com$/.test(event.origin) && event.origin !== 'https://script.google.com') return;
      if (!event.data || event.data.channel !== channel || !event.source) return;
      if (event.data.type === 'cottage-ready' && !bridgeWindow) {
        bridgeWindow = event.source as Window;
        bridgeOrigin = event.origin;
        clearTimeout(timer); resolve();
      }
      if (event.source !== bridgeWindow || event.origin !== bridgeOrigin || event.data.type !== 'cottage-result') return;
      const item = pending.get(event.data.id);
      if (item) { clearTimeout(item.timer); pending.delete(event.data.id); item.resolve(event.data.result); }
    }
    window.addEventListener('message', receive);
    frame.src = `${endpoint}?channel=${encodeURIComponent(channel)}`;
    document.body.appendChild(frame);
  });
  return ready;
}
export async function api<T>(action: string, fields: Record<string, unknown> = {}): Promise<T> {
  await connect();
  const id = crypto.randomUUID();
  const result = await new Promise<Envelope<T>>((resolve, reject) => {
    const timer = setTimeout(() => { pending.delete(id); reject(new Error('Google 回應逾時。寫入結果未確認，請保留草稿並重新載入比對。')); }, 45000);
    pending.set(id, { resolve: value => resolve(value as Envelope<T>), reject, timer });
    bridgeWindow!.postMessage({ type: 'cottage-request', channel, id, input: { ...fields, action, token } }, bridgeOrigin);
  });
  if (!result || typeof result.status !== 'number') throw new Error('Google 回應格式不正確。');
  if (result.status !== 200) {
    if (result.status === 401 && token) { clearSession(); window.dispatchEvent(new Event('cottage-expired')); }
    throw new ApiError(result.data.error || '暫時無法連線。', result.status);
  }
  return result.data;
}
