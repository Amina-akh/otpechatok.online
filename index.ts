// Приём результата теста ЭмИн. Supabase Edge Function (Deno).
// Академия АНИНОТ.
//
// Принимает ответы, проверяет подпись Telegram, сам пересчитывает баллы
// по ключу из core.js и пишет строку в emin_results. Если задан чат для
// уведомлений, бот присылает туда ник и итог.
//
// Подпись: когда тест открыт как мини-приложение, Telegram передаёт
// initData с ником и подписью токеном бота. Подделать ник в такой строке
// нельзя, она сохраняется с verified = true. Если тест открыли обычной
// ссылкой в браузере, подписи нет: ник берётся из поля, которое человек
// заполнил сам, и строка сохраняется с verified = false.
//
// verify.js это копия из karta-myshleniya/server/functions/telegram-auth.
// core.js кладёт сюда setup.sh из emin/core.js, руками не правится.
//
// Секреты функции:
//   EMIN_BOT_TOKEN             токен бота, от которого открывается тест.
//                              Отдельное имя, чтобы не перетереть токен
//                              «Карты мышления»: секреты общие на проект.
//                              Если бот тот же, хватит TELEGRAM_BOT_TOKEN.
//   EMIN_ORIGIN                адрес сайта с тестом, для CORS
//   EMIN_ADMIN_CHAT            id чата для уведомлений, необязательно
//   SUPABASE_URL               подставляется платформой
//   SUPABASE_SERVICE_ROLE_KEY  подставляется платформой

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { checkMiniApp, fresh } from './verify.js';
import { score, validAnswers, typeOf, SUB, LEVELS, TYPES } from './core.js';

const ORIGIN = Deno.env.get('EMIN_ORIGIN') ?? '*';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json',
      'access-control-allow-origin': ORIGIN,
      'access-control-allow-headers': 'content-type, authorization, apikey, x-client-info',
      'access-control-allow-methods': 'POST, OPTIONS',
    },
  });

const clean = (v: unknown, n = 64) =>
  typeof v === 'string' && v.trim() ? v.trim().slice(0, n) : null;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return json({}, 204);
  if (req.method !== 'POST') return json({ error: 'нужен POST' }, 405);

  const botToken = Deno.env.get('EMIN_BOT_TOKEN') || Deno.env.get('TELEGRAM_BOT_TOKEN');
  if (!botToken) return json({ error: 'функция не настроена' }, 500);

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ error: 'тело запроса не разобрано' }, 400); }

  const answers = body.answers;
  if (!validAnswers(answers)) return json({ error: 'нужно 46 ответов от 0 до 3' }, 400);

  // ------------------------------------------------------------ кто это
  let who: { tg_id: number | null; username: string | null; first_name: string | null; last_name: string | null; verified: boolean };
  let start = clean(body.start);
  const initData = typeof body.initData === 'string' ? body.initData : '';

  if (initData) {
    const data = Object.fromEntries(new URLSearchParams(initData));
    if (!(await checkMiniApp(data, botToken))) return json({ error: 'подпись не сходится' }, 401);
    // Тест проходят минут десять, иногда с перерывом: даём неделю.
    if (!fresh(data.auth_date, 7 * 86400)) return json({ error: 'подпись просрочена' }, 401);
    let u: Record<string, unknown>;
    try { u = JSON.parse(data.user ?? ''); } catch { return json({ error: 'поле user не разобрано' }, 400); }
    const id = Number(u.id);
    if (!Number.isSafeInteger(id) || id <= 0) return json({ error: 'нет идентификатора' }, 400);
    who = { tg_id: id, username: clean(u.username), first_name: clean(u.first_name), last_name: clean(u.last_name), verified: true };
    start = clean(data.start_param) ?? start;
  } else {
    const nick = clean(body.nick)?.replace(/^@+/, '') ?? null;
    who = { tg_id: null, username: nick, first_name: null, last_name: null, verified: false };
  }

  // -------------------------------------------------------------- баллы
  const r = score(answers as number[]);
  const row = {
    ...who,
    start_param: start,
    answers,
    mp: r.MP.score, mu: r.MU.score, vp: r.VP.score, vu: r.VU.score, ve: r.VE.score,
    mei: r.MEI.score, vei: r.VEI.score, pe: r.PE.score, ue: r.UE.score,
    oei: r.OEI.score,
    oei_level: LEVELS[r.OEI.level],
    weak: SUB[r.weak].name,
    strong: SUB[r.strong].name,
    ptype: TYPES[typeOf(r)].name,
  };

  const db = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const { error } = await db.from('emin_results').insert(row);
  if (error) return json({ error: 'не записалось', detail: error.message }, 500);

  // ------------------------------------------------------- уведомление
  const chat = Deno.env.get('EMIN_ADMIN_CHAT');
  if (chat) {
    const nick = who.username ? '@' + who.username : 'без ника';
    const name = [who.first_name, who.last_name].filter(Boolean).join(' ');
    const text = [
      `Тест ЭмИн пройден: ${nick}${name ? ` (${name})` : ''}${who.verified ? '' : ', ник введён вручную'}`,
      `Тип: ${TYPES[typeOf(r)].name}`,
      `Общий уровень: ${r.OEI.score} из 138, ${LEVELS[r.OEI.level]}`,
      `Точка роста: ${SUB[r.weak].name}`,
      `Опора: ${SUB[r.strong].name}`,
      start ? `Метка: ${start}` : '',
    ].filter(Boolean).join('\n');
    // Уведомление не должно ронять сохранение, поэтому ошибки глушим.
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: chat, text, disable_web_page_preview: true }),
    }).catch(() => {});
  }

  return json({ ok: true });
});
