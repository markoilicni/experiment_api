# Open user reads and enforce who may write

[Pull request #27](https://github.com/markoilicni/experiment_api/pull/27)

## Summary

- `GET /api/v1/users` and `GET /api/v1/users/:id` allow `SUPER`, `MANAGER`, `PDP`, and `USER`. Pagination stays on the list. A caller who is not `SUPER` still cannot see inactive users.
- `POST /api/v1/users`: `SUPER` may create any role under the existing field rules. `MANAGER` may create only `USER` or `PDP`. `managerId` is the caller; a different id returns 400. A `USER` may include an optional `pdpId`. A `PDP` must not include `pdpId`. `PDP` and `USER` receive 403. The client still sends the password.
- `PATCH /api/v1/users/:id`: `SUPER` may change username, name, email, phone, address, role, manager, and PDP, and may set `active` to `true`. Setting `active` to `false` returns 400 and uses `POST /api/v1/users/:id/deactivate`. `MANAGER` may change name, email, phone, and address only for a user in their manager tree. The caller is not in their own tree. `PDP` may change those fields only on their own user. `USER` receives 403. `MANAGER` and `PDP` cannot change username, role, `managerId`, `pdpId`, password, or `active`.
- `POST /api/v1/users/:id/deactivate`: `SUPER` may deactivate any user. `MANAGER` may deactivate a user in their tree and cannot mark that user active again. `PDP` and `USER` receive 403. The existing transfer rules stay in place.
- `DELETE /api/v1/users/:id` stays `SUPER` only.

## Error cases

- 403 when `PDP` or `USER` create a user, when `USER` updates a user, or when `PDP` or `USER` deactivate a user
- 403 when a `MANAGER` creates a role other than `USER` or `PDP`
- 400 when a `MANAGER` sends a `managerId` other than their own id
- 403 when a `MANAGER` updates or deactivates a user outside their tree, including themselves
- 403 when a `PDP` updates another user, or when a `MANAGER` or `PDP` changes a protected field
- 400 when update sets `active` to `false`
- 404 when a caller who is not `SUPER` reads an inactive user
