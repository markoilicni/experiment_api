# Filter users by manager tree and name

[Pull request #26](https://github.com/markoilicni/experiment_api/pull/26)

## Summary

- `GET /api/v1/users` accepts optional `managerTreeId` and `name`. The existing filters stay in place.
- `managerTreeId=<id>` returns the direct reports of that manager and everyone further down the chain. The manager named by `managerTreeId` is not included. An id with no reports returns an empty page.
- Exact `managerId` is unchanged. The two can be sent together, and then both apply.
- `name=<text>` returns users whose `name` contains that text, case-insensitive.
- `managerTreeId`, `name`, `role`, `managerId`, `pdpId`, `hasPdp`, and `active` combine with AND. `managerTreeId` and `name` are documented in Swagger.
- An empty `managerTreeId` or `name` returns 400.
