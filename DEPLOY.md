# Деплой «Чей трек?» — пошаговая инструкция

Приложение: **Next.js + PostgreSQL**. Архитектура без состояния на сервере —
вся синхронизация игры хранится в базе (`game_state`, `live_answers`),
поэтому его можно хостить на любом serverless/VPS с одной общей БД.
Состояние комнаты одно: все, кто открыл сайт, видят одно лобби и одну игру.

---

## Вариант 1 (рекомендуемый): Vercel + Neon — бесплатно, без сервера

### 1. Код на GitHub

```bash
git init
git add .
git commit -m "guess-the-track party game"
# создайте репозиторий на github.com и запушьте:
git remote add origin https://github.com/<you>/<repo>.git
git push -u origin main
```

`.env` уже в `.gitignore` — секреты не уедут.

### 2. База данных (Neon)

1. Зайдите на <https://neon.tech> → Sign up (через GitHub).
2. Create project → регион **Frankfurt** (ближе к России).
3. Скопируйте строку подключения вида
   `postgresql://user:pass@ep-xxx.eu-central-1.aws.neon.tech/neondb?sslmode=require`.

### 3. Разверните схему в облачной базе

Один раз с вашего компьютера, из папки проекта:

```bash
npm install
DATABASE_URL="postgresql://user:pass@ep-xxx...neondb" npx drizzle-kit push --force
```

### 4. Деплой на Vercel

1. <https://vercel.com/new> → Import Git Repository → ваш репозиторий.
2. В разделе **Environment Variables** добавьте:
   `DATABASE_URL` = строка из шага 2.
3. Deploy. Через ~2 минуты сайт живёт на `https://<project>.vercel.app`.

### 5. Готово

Отправьте ссылку друзьям — все попадают в общее лобби, заходят под своими
PIN-кодами, добавляют треки. Работает и с телефонов.

> Обновления: `git push` — Vercel сам пересоберёт. При изменении схемы БД
> повторите шаг 3.

---

## Вариант 2: VPS (Timeweb / Selectel / Hetzner) — полный контроль

Нужны: Node.js 20+, PostgreSQL 15+ (или managed БД), pm2 и nginx.

```bash
git clone https://github.com/<you>/<repo>.git && cd <repo>
npm ci
echo "DATABASE_URL=postgresql://user:pass@<host>:5432/app_db" > .env
npx drizzle-kit push --force   # развернуть схему
npm run build
pm2 start npm --name "chetrek" -- start   # порт 3000
```

Nginx проксирует `yourdomain.ru` → `127.0.0.1:3000`, HTTPS — через
`certbot --nginx`. Важно: сайт должен быть по HTTPS, иначе браузеры
блокируют автоплей звука и встроенные плееры.

---

## FAQ

- **Много групп друзей?** Сейчас комната глобальная и одна — идеально для
  одной тусовки. Для параллельных комнат по ссылке-приглашению нужна
  доработка (система кодов комнат).
- **Лимиты бесплатных тарифов**: для игрового вечера с запасом хватает
  (Neon: 0,5 ГБ; Vercel Hobby: сотни тысяч запросов в день).
- **Ничего никуда платить не нужно**, карта не требуется ни на Vercel, ни на
  Neon.
