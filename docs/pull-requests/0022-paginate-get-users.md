# Add pagination to GET users

[Pull request #22](https://github.com/markoilicni/experiment_api/pull/22)

## Summary

- `GET /api/v1/users` accepts optional `page` (default 1) and `pageSize` (default 100) query parameters.
- Pagination runs after existing `sortBy`/`sortOrder` and `role`/`managerId` filters.
- Response is `{ data, page, pageSize, total }` instead of a bare array.
- Non-positive or non-integer `page`/`pageSize` values return 400.
- Auth stays JWT with `SUPER` and `MANAGER` (same as the current list endpoint).
