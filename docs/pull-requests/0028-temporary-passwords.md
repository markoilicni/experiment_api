# Temporary passwords

[Pull request #28](https://github.com/markoilicni/experiment_api/pull/28)

## Summary

- `POST /api/v1/users` no longer accepts a password. The server generates one, returns it once as `temporaryPassword`, stores it so `SUPER` can read it again, and sets `mustChangePassword` to `true` on the user.
- Login and refresh include `mustChangePassword` on the user. An inactive user is still rejected.
- `GET /api/v1/users/:id/temporary-password` is `SUPER` only. While `mustChangePassword` is `true`, it returns the current temporary password. After the user replaces it, the value is gone and the endpoint returns 404.
- `POST /api/v1/users/me/password` is the signed-in user. `password` and `passwordConfirmation` must match and be at least 4 characters. This clears `mustChangePassword` and discards the readable temporary password. No other role can set this permanent password. Update no longer accepts a password.
- `POST /api/v1/users/:id/temporary-password` is `SUPER` only. It generates a new temporary password, stores it, sets `mustChangePassword` to `true`, and returns `temporaryPassword` once.
- Existing users, including the seeded superadmin, keep `mustChangePassword` false and have no readable temporary password.

## Error cases

- 400 when create or update sends a password
- 400 when `password` and `passwordConfirmation` do not match, or either is shorter than 4 characters
- 403 when a caller who is not `SUPER` reads or issues a temporary password
- 404 when the temporary password has been replaced, or the user does not exist
- 401 when an inactive user logs in
