# Add a PDP on the user

[Pull request #24](https://github.com/markoilicni/experiment_api/pull/24)

## Summary

- `User` has an optional `pdpId`, a relation to another user. Create, update, list, and get return `pdpId` next to `managerId`.
- Create and update apply these rules and return 400 when a save breaks them:
  - Role `USER`: `managerId` is required. `pdpId` is optional.
  - Role `PDP`: `managerId` is required. `pdpId` must be empty.
  - Role `MANAGER` and `SUPER`: `pdpId` must be empty. `managerId` stays optional.
  - When `pdpId` is set, that user must exist, must have role `PDP`, and that PDP's `managerId` must equal this user's `managerId`.
- `GET /api/v1/users` accepts `pdpId=<id>` (users assigned to that PDP) and `hasPdp=false` (users whose `pdpId` is empty). They combine with `role` and exact `managerId` using AND.
- Passing both `pdpId` and `hasPdp=false` returns 400. Any `hasPdp` value other than `false` returns 400.
