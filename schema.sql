-- Тест ЭмИн. Таблица результатов.
-- Академия АНИНОТ. Выполняется в SQL Editor того же проекта Supabase,
-- что и «Карта мышления», или ставится через server/setup.sh.
--
-- Пишет сюда только функция emin-submit ключом service_role. У браузера
-- прав на таблицу нет совсем: ни читать, ни писать. Смотреть результаты
-- можно в Table Editor или через представление emin_people.

create table if not exists emin_results (
  id          uuid primary key default gen_random_uuid(),
  taken_at    timestamptz not null default now(),
  -- кто проходил
  tg_id       bigint,                 -- пусто, если открыли не из Telegram
  username    text,                   -- ник без @
  first_name  text,
  last_name   text,
  verified    boolean not null,       -- true: данные подписаны Telegram
  start_param text,                   -- метка поста из ссылки ?startapp=
  -- ответы и баллы
  answers     smallint[] not null,
  mp smallint not null, mu smallint not null, vp smallint not null,
  vu smallint not null, ve smallint not null,
  mei smallint not null, vei smallint not null, pe smallint not null, ue smallint not null,
  oei smallint not null,
  oei_level   text not null,          -- очень низкий … очень высокий
  weak        text not null,          -- точка роста, название субшкалы
  strong      text not null,          -- опора
  ptype       text,                   -- тип по карте: Дирижёр, Эмпат…
  constraint emin_answers_len check (array_length(answers, 1) = 46)
);

create index if not exists emin_results_taken_idx on emin_results (taken_at desc);
create index if not exists emin_results_tg_idx on emin_results (tg_id, taken_at desc);

alter table emin_results enable row level security;
revoke all on emin_results from anon, authenticated;

-- Последний результат каждого человека. Удобно выгружать в CSV.
create or replace view emin_people with (security_invoker = true) as
select distinct on (coalesce(tg_id::text, username, id::text))
  taken_at,
  case when username is not null then '@' || username end as nick,
  trim(coalesce(first_name, '') || ' ' || coalesce(last_name, '')) as name,
  tg_id, verified, start_param,
  ptype, oei, oei_level, weak, strong,
  mp, mu, vp, vu, ve,
  (select count(*) from emin_results r2
    where r2.tg_id is not distinct from r.tg_id and r2.username is not distinct from r.username) as attempts
from emin_results r
order by coalesce(tg_id::text, username, id::text), taken_at desc;

revoke all on emin_people from anon, authenticated;
