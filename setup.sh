#!/usr/bin/env bash
# Разворачивание приёма результатов теста ЭмИн на Supabase.
# Академия АНИНОТ. Запускать из папки emin:
#
#   bash server/setup.sh
#
# Таблицу ставим отдельно, через SQL Editor (см. README): у проекта уже
# есть история миграций «Карты мышления», и смешивать её не нужно.
# Скрипт кладёт свежий core.js в функцию, записывает секреты и
# разворачивает функцию. Токен бота на экране не показывается.

set -euo pipefail

PROJECT_REF="${PROJECT_REF:-jrrmuxlatszrlmrnzxfv}"
SUPA="npx --yes supabase@latest"

here=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
cd "$here"

printf 'Адрес сайта с тестом, например https://emin.vercel.app: '
read -r ORIGIN
ORIGIN="${ORIGIN%/}"

echo "1/4  Раскладка для Supabase CLI"
mkdir -p supabase/functions
cp core.js server/functions/emin-submit/core.js
rm -rf supabase/functions/emin-submit
cp -R server/functions/emin-submit supabase/functions/emin-submit
[ -f supabase/config.toml ] || cat > supabase/config.toml <<TOML
project_id = "$PROJECT_REF"

[functions.emin-submit]
verify_jwt = false
TOML

echo "2/4  Вход в Supabase. Откроется браузер"
$SUPA login

echo "3/4  Секреты"
printf '     Токен бота от @BotFather (не отображается): '
read -rs BOT_TOKEN; echo
[ -n "$BOT_TOKEN" ] || { echo "     Токен пустой." >&2; exit 1; }
printf '     id чата для уведомлений (Enter, чтобы пропустить): '
read -r ADMIN_CHAT
$SUPA secrets set --project-ref "$PROJECT_REF" \
  EMIN_BOT_TOKEN="$BOT_TOKEN" EMIN_ORIGIN="$ORIGIN" \
  ${ADMIN_CHAT:+EMIN_ADMIN_CHAT="$ADMIN_CHAT"} >/dev/null
unset BOT_TOKEN
echo "     Записаны"

echo "4/4  Разворачиваю функцию"
$SUPA functions deploy emin-submit --project-ref "$PROJECT_REF" --no-verify-jwt

echo
echo "Готово. Функция: https://$PROJECT_REF.supabase.co/functions/v1/emin-submit"
