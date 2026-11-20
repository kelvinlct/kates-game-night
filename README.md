# Kate's Game Night

A small calendar for about ten friends to claim a seat at Kate's board game table.

The homepage is one month. Gray days are closed. Green days are open and show how many seats are taken, like `1/4`. A full night turns red, shows `4/4`, and says **Game confirmed**. Kate is always seat 1, so she is not stored as a booking: the count is `1 + guests`, and spots left are `capacity - 1 - guests`.

Anyone can book. They type a name and answer "What is Kate's last name?". The answer is checked only on the server against `SECURITY_ANSWER`. That variable can list several accepted answers separated by commas, for example `Smith,李`. Each one is NFKC-normalized, trimmed, and compared case-insensitively. A verified account, or an admin, can book in one click. Admins are the emails in `ADMIN_EMAILS`.

Dates are plain calendar dates in `America/Toronto`, stored as `YYYY-MM-DD`, so a late evening does not slip into the next day.

![November calendar](docs/screenshots/calendar.webp)

![Booking dialog](docs/screenshots/booking.webp)

![Admin](docs/screenshots/admin.webp)

Screenshots are from a local Postgres, with a few nights opened by hand. The booking shot is the guest form after a wrong answer.

## Stack

- Next.js App Router, TypeScript, Tailwind CSS, shadcn/ui
- Better Auth: Google sign-in only. Guest booking does not need an account.
- Neon Postgres in production, via `@neondatabase/serverless` (WebSocket pool, so a booking can lock the night row)
- Drizzle ORM and SQL migrations in `drizzle/`
- A local Postgres URL uses `node-postgres` instead, with the same transaction API
- Deploy target: Vercel Hobby

## Local setup

Requires Node 22 and a Postgres database. Neon works too. These steps use Postgres on your machine.

```bash
npm install
cp .env.example .env.local
```

Fill `.env.local`:

```bash
# any local Postgres database you can migrate
DATABASE_URL=postgres://USER:PASSWORD@127.0.0.1:5432/kates_game_night
# openssl rand -base64 32
BETTER_AUTH_SECRET=
BETTER_AUTH_URL=http://localhost:3000
ADMIN_EMAILS=kate@example.com
SECURITY_ANSWER=Smith,李
# Required to sign in. Without both, /login says sign-in isn't configured.
# The app still builds.
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
# Optional. Join/remove mail is skipped when either is empty.
GMAIL_USER=
GMAIL_APP_PASSWORD=
```

Create the tables and start the app:

```bash
npm run db:migrate
npm run dev
```

Open http://localhost:3000. `GET /api/auth/ok` returns `{"ok":true}` when auth is mounted.

Sign in with Google, then add that email to `ADMIN_EMAILS` and restart the dev server if you changed the env. Open a night from the calendar (admins can click a gray day) or from `/admin`. Guests still book with a name and the security answer, with no account. After you mark someone **Verified**, their next booking skips the question. An older password account is not a separate login: Google sign-in with the same email links to that user.

## Production setup

Do these three things before the first real deploy. Nothing here is created for you.

### 1. Neon

1. Create a free account at [https://neon.tech](https://neon.tech).
2. Create a project. The free plan scales to zero and does not pause the project.
3. Copy the **pooled** connection string (the host contains `-pooler`) and keep `sslmode=require`.
4. On your machine, put that string in `.env.local` as `DATABASE_URL` and run:

```bash
npm run db:migrate
```

That applies `drizzle/0000_init.sql` (auth tables, `game_night`, `booking`, and `answer_attempt`).

### 2. Google sign-in

Accounts sign in with Google. The app still builds if the client id or secret is missing, and `/login` then says sign-in isn't configured. Guest booking keeps working.

1. In [Google Cloud Console](https://console.cloud.google.com/), create or pick a project.
2. **APIs & Services → OAuth consent screen**. Fill in the app name and support email. Add the scopes `openid`, `email`, and `profile` if asked. **Publish** the app so it leaves Testing. While it is in Testing, only listed test users can sign in, and refresh tokens expire after 7 days.
3. **APIs & Services → Credentials → Create credentials → OAuth client ID → Web application**.
4. Authorized redirect URIs, exactly:

```text
http://localhost:3000/api/auth/callback/google
https://<prod-domain>/api/auth/callback/google
```

Replace `<prod-domain>` with the Vercel domain, for example `kates-game-night.vercel.app`. No trailing slash.

5. Copy the client ID and client secret into `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.

### 3. Vercel

1. Import this GitHub repo as a new project. Framework preset: Next.js. Hobby is enough.
2. **Settings → Environment Variables → Production**. Add:

| Name | Value |
| --- | --- |
| `DATABASE_URL` | The Neon pooled connection string. The Vercel Neon integration sets this. If only `POSTGRES_URL` is set, the app uses that instead. |
| `BETTER_AUTH_SECRET` | `openssl rand -base64 32` |
| `BETTER_AUTH_URL` | `https://<prod-domain>` with no trailing slash |
| `GOOGLE_CLIENT_ID` | From the OAuth client, or leave unset |
| `GOOGLE_CLIENT_SECRET` | From the OAuth client, or leave unset |
| `ADMIN_EMAILS` | Comma-separated admin emails, for example `kate@example.com`. These addresses also receive join and removal mail. |
| `GMAIL_USER` | Gmail address that sends the notices. Leave unset to skip email. |
| `GMAIL_APP_PASSWORD` | Google app password for that account. SMTP is `smtp.gmail.com` port 465. Leave unset to skip email. |
| `SECURITY_ANSWER` | One or more accepted last names, comma-separated, for example `Smith,李`. Never put this in a `NEXT_PUBLIC_` variable. |

3. Leave `BETTER_AUTH_URL` unset for Preview if you use preview deployments. Better Auth then uses the request host. Google will not work on a preview URL unless that exact callback is registered.
4. Deploy. A production build runs `npm run vercel-build`: when `VERCEL_ENV` is `production` and `DATABASE_URL` or `POSTGRES_URL` is set, it applies the Drizzle migrations, then runs `next build`. Preview builds, local `npm run build`, and a build with no database URL skip the migration and still compile. Run `npm run db:migrate` yourself for a local or preview database.
5. Open the production URL, sign in with Google, and confirm `/admin` loads for an address in `ADMIN_EMAILS`.

## Rules the app enforces

- Closed nights and past nights (before today in Toronto) reject bookings.
- A transaction takes `FOR UPDATE` on the night row, then inserts only if a seat is left, so two people cannot take the last seat.
- The same logged-in user cannot join a night twice. Their booking uses their display name. Guests type a name, and that browser can remove their own spot. A signed-in person who is not verified answers Kate's last name once; a right answer marks them verified, and after that they join in one click.
- A wrong security answer is stored by IP. Five failures in an hour lock that IP for the rest of the hour. The limit lives in `answer_attempt`, so it works across serverless instances. Any comma-separated value in `SECURITY_ANSWER` is accepted.
- Capacity defaults to 4, including Kate. Admins can set it from 1 to 20. A capacity of 1 is already full.
- An open night starts at 7:00pm on weekdays and 2:30pm on Saturday and Sunday, Toronto local time. The time shows in the day detail, not on the month grid. Admins can also name the board game for that night. It defaults to TBD.
- Every admin mutation checks the session email against `ADMIN_EMAILS`. The verified flag is set only by an admin. Email and password sign-in is disabled on the server.
- Joins and removals are appended to `booking_event` and shown to admins at `/admin/history` (latest 200). The same helper emails `ADMIN_EMAILS` through Gmail. If `GMAIL_USER` or `GMAIL_APP_PASSWORD` is unset, the email is skipped and the booking still succeeds.
- From the day dialog, an admin can join themselves without the last-name question, add a registered person (their email is shown so two similar names stay distinct), or type a 1–40 character name for someone without an account. That typed name is a guest booking with no removal cookie. A full or closed night still refuses the seat. History records it as joined, added by that admin. Admins rename accounts at `/admin/users` (1–40 characters). That name updates every booking for the account. A guest booking can be renamed from the day dialog.

## Scripts

```bash
npm run dev
npm run lint
npm run typecheck
npm test
npm run build          # next build, no migration
npm run vercel-build  # migrate on Vercel production, then next build
npm run db:generate   # after a schema change
npm run db:migrate
```

GitHub Actions runs lint, typecheck, test, and build on pull requests and on `main`.

Tests cover the seat math, the security-answer compare, and the admin email check. They do not need a database.
