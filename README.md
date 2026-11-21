# Kate's Game Night

A monthly calendar where friends claim a seat at Kate's board game table.

Live site: [https://kates-game-night.vercel.app](https://kates-game-night.vercel.app)

The homepage is one month in `America/Toronto`. Dates are stored as `YYYY-MM-DD`, so a late evening does not slip into the next day. Gray days are closed. Green days are open and show how many seats are taken, like `1/4`. A full night turns red and shows `4/4`. On wider screens the cell also says **Game confirmed**. Kate holds seat 1 and is never stored as a booking: the count is `1 + guests`, and spots left are `capacity - 1 - guests`. Capacity defaults to 4, including Kate, and an admin can set it from 1 to 20.

Click a day to open it. The dialog shows the start time (`Friday, November 20 · 7:00pm`), the board game (`Game: TBD`), and the location (`Location: Kate's place`). The month grid does not show the time, the game, or the location. Weeknights default to 7:00pm and weekend nights to 2:30pm, Toronto local time. Admins can change the time, the game (plain text, up to 80 characters, default `TBD`), and the location (plain text, up to 80 characters, default `Kate's place`).

![November calendar](docs/screenshots/calendar.webp)

![Booking dialog](docs/screenshots/booking.webp)

![Admin](docs/screenshots/admin.webp)

Screenshots are from a local Postgres, with a few nights opened by hand. The booking shot is the guest form after a wrong answer.

## Joining

The button says **JOIN!**.

- Without an account, type your name and answer the security question. The browser gets an httpOnly cookie. **Remove me** on that spot works only in that browser.
- Signed in, you join under your display name (1–40 characters, editable from the header). A verified account, or an admin, joins in one click. Anyone else signed in answers the security question once; a right answer marks them verified.
- The same account cannot take two seats on one night. Closed nights and nights before today in Toronto reject a join. The booking transaction locks the night row, so two people cannot take the last seat.

### Security question

The label is "What is Kate's last name? (security question)". The answer is checked only on the server against `SECURITY_ANSWER`. Several answers can be listed, separated by commas, for example `Smith,Lee`. Each one is NFKC-normalized, trimmed, and compared case-insensitively. Never put the answer in a `NEXT_PUBLIC_` variable.

Wrong answers are stored by IP in `answer_attempt`, so the lock works across serverless instances. Five wrong answers lock that IP. The next batches last longer:

1. 5 minutes
2. 15 minutes
3. 30 minutes
4. 1 hour, and every batch after that stays at 1 hour

A correct answer resets the ladder. So does 24 hours with no wrong answers. The error says how long is left. Tries sent during a lockout do not count toward the next batch.

### Waiting list

On a full night, **JOIN!** becomes **Join waiting list**. The same rules apply: display name for a signed-in person, or a typed name plus the security question and cookie for a guest. Under the seat count the dialog says: "Full. If someone drops out, the first person on the waiting list takes their spot." The list is numbered in join order and hidden when empty.

When a seat opens, the first person waiting is promoted in the same transaction. That happens when someone is removed (themselves, their guest cookie, or an admin), when an admin raises capacity, or when an admin reopens a night that has free seats. The same person cannot be both booked and waiting, and cannot be on the list twice.

Each night has a waiting-list switch, default on. Admins turn it off in the day dialog or on `/admin`. While it is off, a full night shows no join button and no note, and the server rejects a new wait. People already waiting stay listed. An admin can still remove them, and they are still promoted when a seat opens.

## Admins

Admins are the addresses in `ADMIN_EMAILS`, checked on the server for every admin action. They are not a role stored on the user. Email and password sign-in is disabled. An older password account is not a separate login: Google sign-in with the same email links to that user.

From a gray day or from `/admin`, an admin can open or close a night, set capacity, start time, board game, location, and the waiting-list switch. In the day dialog they can also:

- Join themselves, without the security question.
- Add a registered person, picked by display name with the email shown so similar names stay distinct.
- Type a 1–40 character name for someone with no account. That booking has no removal cookie.
- On a full night with the waiting list on, those adds go onto the waiting list.
- Rename a guest booking.

`/admin/users` lists every account. An admin can change a display name (1–40 characters). That name is written onto the person's bookings and waiting-list rows, so the calendar and dialog show it.

`/admin/history` lists the latest 200 booking events, newest first, with times in America/Toronto. The events are Joined, Removed (including who removed them), Joined waiting list, Left waiting list, and Promoted from waiting list.

Each of those events emails every address in `ADMIN_EMAILS` through Gmail SMTP (`smtp.gmail.com`, port 465). Set `GMAIL_USER` and `GMAIL_APP_PASSWORD` (a Google app password, not the account password). If either is unset, the email is skipped and the booking still succeeds. Sending runs after the response, so a mail error cannot fail the join or removal.

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
SECURITY_ANSWER=Smith,Lee
# Required to sign in. Without both, /login says sign-in isn't configured.
# The app still builds.
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
# Optional. Join and removal mail is skipped when either is empty.
GMAIL_USER=
GMAIL_APP_PASSWORD=
```

Create the tables and start the app:

```bash
npm run db:migrate
npm run dev
```

Open http://localhost:3000. `GET /api/auth/ok` returns `{"ok":true}` when auth is mounted.

Sign in with Google, then add that email to `ADMIN_EMAILS` and restart the dev server if you changed the env. Open a night from the calendar (admins can click a gray day) or from `/admin`. Guests still join with a name and the security answer, with no account. After you mark someone **Verified**, their next join skips the question.

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

That applies the SQL in `drizzle/`, including auth tables, `game_night`, `booking`, `waitlist`, `booking_event`, and `answer_attempt`.

### 2. Google sign-in

Accounts sign in with Google. The app still builds if the client id or secret is missing, and `/login` then says sign-in isn't configured. Guest booking keeps working. `/privacy` and `/terms` are linked from the footer for the OAuth consent screen.

1. In [Google Cloud Console](https://console.cloud.google.com/), create or pick a project.
2. **APIs & Services → OAuth consent screen**. Fill in the app name and support email. Add the scopes `openid`, `email`, and `profile` if asked. **Publish** the app so it leaves Testing. While it is in Testing, only listed test users can sign in, and refresh tokens expire after 7 days.
3. **APIs & Services → Credentials → Create credentials → OAuth client ID → Web application**.
4. Authorized redirect URIs, exactly:

```text
http://localhost:3000/api/auth/callback/google
https://kates-game-night.vercel.app/api/auth/callback/google
```

No trailing slash.

5. Copy the client ID and client secret into `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.

### 3. Vercel

1. Import this GitHub repo as a new project. Framework preset: Next.js. Hobby is enough.
2. **Settings → Environment Variables → Production**. Add:

| Name | Value |
| --- | --- |
| `DATABASE_URL` | The Neon pooled connection string. The Vercel Neon integration sets this. If only `POSTGRES_URL` is set, the app uses that instead. |
| `BETTER_AUTH_SECRET` | `openssl rand -base64 32` |
| `BETTER_AUTH_URL` | `https://kates-game-night.vercel.app` with no trailing slash |
| `GOOGLE_CLIENT_ID` | From the OAuth client, or leave unset |
| `GOOGLE_CLIENT_SECRET` | From the OAuth client, or leave unset |
| `ADMIN_EMAILS` | Comma-separated admin emails, for example `kate@example.com`. These addresses also receive join and removal mail. |
| `GMAIL_USER` | Gmail address that sends the notices. Leave unset to skip email. |
| `GMAIL_APP_PASSWORD` | Google app password for that account. SMTP is `smtp.gmail.com` port 465. Leave unset to skip email. |
| `SECURITY_ANSWER` | One or more accepted last names, comma-separated, for example `Smith,Lee`. Never put this in a `NEXT_PUBLIC_` variable. |

3. Leave `BETTER_AUTH_URL` unset for Preview if you use preview deployments. Better Auth then uses the request host. Google will not work on a preview URL unless that exact callback is registered.
4. Deploy. A production build runs `npm run vercel-build`: when `VERCEL_ENV` is `production` and `DATABASE_URL` or `POSTGRES_URL` is set, it applies the Drizzle migrations, then runs `next build`. Preview builds, local `npm run build`, and a build with no database URL skip the migration and still compile. Run `npm run db:migrate` yourself for a local or preview database.
5. Open [https://kates-game-night.vercel.app](https://kates-game-night.vercel.app), sign in with Google, and confirm `/admin` loads for an address in `ADMIN_EMAILS`.

## Scripts

```bash
npm run dev
npm run lint
npm run typecheck
npm test
npm run build          # next build, no migration
npm run vercel-build   # migrate on Vercel production, then next build
npm run db:generate    # after a schema change
npm run db:migrate
```


GitHub Actions runs lint, typecheck, test, and build on pull requests and on `main`.

Tests cover the seat math, the security-answer compare, the lockout ladder, the waiting-list promotion, and the admin email check. They do not need a database.
