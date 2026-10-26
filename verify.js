// Проверка подписи Telegram. Чистые функции без платформенных зависимостей:
// используется и Edge Function на Deno, и тестом на Node.
// Академия АНИНОТ, «Карта мышления».

const enc = new TextEncoder();

/** Строка проверки: все поля кроме hash, по алфавиту, через перевод строки. */
export function dataCheckString(data) {
  return Object.keys(data)
    .filter((k) => k !== 'hash')
    .sort()
    .map((k) => `${k}=${data[k]}`)
    .join('\n');
}

const hex = (buf) =>
  [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');

async function hmac(key, msg) {
  const k = await crypto.subtle.importKey(
    'raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  return crypto.subtle.sign('HMAC', k, enc.encode(msg));
}

/** Сравнение без утечки времени: длина сверяется отдельно, байты все. */
export function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Подпись Login Widget: ключ это SHA256 от токена бота. */
export async function widgetHash(data, botToken) {
  const secret = await crypto.subtle.digest('SHA-256', enc.encode(botToken));
  return hex(await hmac(secret, dataCheckString(data)));
}

/** Подпись initData мини-приложения: ключ выводится через HMAC от WebAppData. */
export async function miniAppHash(data, botToken) {
  const secret = await hmac(enc.encode('WebAppData'), botToken);
  return hex(await hmac(secret, dataCheckString(data)));
}

export async function checkWidget(data, botToken) {
  return timingSafeEqual(await widgetHash(data, botToken), String(data.hash || ''));
}

export async function checkMiniApp(data, botToken) {
  return timingSafeEqual(await miniAppHash(data, botToken), String(data.hash || ''));
}

/** Подпись не должна быть старше суток. */
export function fresh(authDate, maxAgeSec = 86400, now = Date.now()) {
  const t = Number(authDate || 0);
  if (!t) return false;
  const age = Math.floor(now / 1000) - t;
  return age >= -60 && age <= maxAgeSec;   // минута допуска на расхождение часов
}
