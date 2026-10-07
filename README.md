# API (Point 1)

NestJS + Prisma + SQLite learning webservice.

## Quick start

```bash
npm install
npx prisma migrate dev --name init
npx prisma db seed
npm run start:dev
```

- API base: `http://localhost:3000/api/v1`
- Swagger: `http://localhost:3000/docs`
- Seed login: `superadmin` / `super/1234`

## Config (`.env`)

| Variable | Default | Meaning |
| --- | --- | --- |
| `DATABASE_URL` | `file:./dev.db` | SQLite file (relative to `prisma/`) |
| `JWT_ACCESS_SECRET` | — | Access token secret |
| `JWT_REFRESH_SECRET` | — | Refresh token secret |
| `JWT_ACCESS_EXPIRES_IN` | `1h` | Access TTL |
| `JWT_REFRESH_EXPIRES_IN` | `1d` | Refresh TTL |
| `PORT` | `3000` | HTTP port |

Architecture notes: see `../docs/architecture-decisions-webservice.md`.
