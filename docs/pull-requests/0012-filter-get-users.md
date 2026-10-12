# Filter GET users by role and manager

[Pull request #12](https://github.com/markoilicni/experiment_api/pull/12)

## Summary

- `GET /api/v1/users` accepts optional `role` and `managerId` query parameters.
- When both are set, the list returns users that match both. When neither is set, it returns every user.
- An unknown role returns 400.
