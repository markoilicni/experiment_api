# Add user active flag and block inactive login

[Pull request #16](https://github.com/markoilicni/experiment_api/pull/16)

## Summary

Implements issue #17 — Add an `active` flag on `User`, hide inactive users from non-`SUPER` callers, and reject inactive login.

## Behavior

- `User.active` is a boolean that defaults to `true`.
- Create, update, list, and get responses include `active`.
- `GET /api/v1/users` filters with AND against existing filters. When `active` is omitted, only active users are returned (including for `SUPER`).
- `active=false` is allowed only for `SUPER`; other callers receive 403.
- `GET /api/v1/users/:id` for an inactive user returns 404 unless the caller is `SUPER`.
- `POST /api/v1/auth/login` rejects inactive users and does not issue tokens. Refresh and JWT validation also reject inactive users.
- Only `SUPER` may set `active` back to `true`. `PDP` and `USER` cannot change `active`. A manager may set `active` to `false` in the service layer; tree checks and the deactivate transfer flow are deferred to later issues.

## Endpoints

| Method | Path | Change |
| --- | --- | --- |
| POST | `/api/v1/auth/login` | Rejects inactive users (401) |
| GET | `/api/v1/users` | Optional `active` query; defaults to active only |
| GET | `/api/v1/users/:id` | Inactive users are 404 for non-`SUPER` |
| PATCH | `/api/v1/users/:id` | Accepts `active`; only `SUPER` may set `true` |

## Error cases

- 403 when a non-`SUPER` lists with `active=false`
- 404 when a non-`SUPER` gets an inactive user by id
- 401 when an inactive user logs in or refreshes
- 403 when `PDP`/`USER` change `active`, or a non-`SUPER` sets `active` to `true`
