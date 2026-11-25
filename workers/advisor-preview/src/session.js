// Session cookie helpers matching rokwilder-api (rw_s, HMAC-SHA256).
// signSession is for tests with a fake secret only. This worker must never
// mint a real member session and must never log a secret value.
const enc = new TextEncoder();
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
async function hmacKey(secret) {
  return crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
}
export async function hmacHex(secret, msg) {
  return hex(await crypto.subtle.sign('HMAC', await hmacKey(secret), enc.encode(msg)));
}
export function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}
const b64u = (s) => btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const ub64u = (s) => atob(s.replace(/-/g, '+').replace(/_/g, '/'));
export async function signSession(secret, email, exp) {
  const body = b64u(JSON.stringify({ e: email, x: exp }));
  return `${body}.${await hmacHex(secret, 'sess:' + body)}`;
}
export async function readSession(secret, token, now) {
  if (!token || !token.includes('.')) return null;
  const [body, sig] = token.split('.');
  if (!safeEqual(sig, await hmacHex(secret, 'sess:' + body))) return null;
  try {
    const p = JSON.parse(ub64u(body));
    return p.x > now ? p.e : null;
  } catch {
    return null;
  }
}
export function cookieValue(req, name) {
  const c = (req && req.headers && req.headers.get && req.headers.get('cookie')) || '';
  const m = c.match(new RegExp('(?:^|; )' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '=([^;]*)'));
  return m ? decodeURIComponent(m[1]) : '';
}
