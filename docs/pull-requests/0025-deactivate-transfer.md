# Transfer people before deactivating a manager or PDP

[Pull request #25](https://github.com/markoilicni/experiment_api/pull/25)

## Summary

- `POST /api/v1/users/:id/deactivate` marks a user inactive. `SUPER` and `MANAGER` may call it.
- A `MANAGER` with direct reports must send `replacementManagerId`. Those reports move to that active manager, who must sit outside the closed tree. People further down stay with their current manager.
- A `PDP` with assigned users must send `replacementPdpId`. An id moves every assigned user to that other active PDP, who must share each assigned user's manager. `null` clears `pdpId`.
- A `USER`, a `SUPER`, or a manager or PDP with nobody attached can be deactivated with an empty body.
- Setting `active` to `false` on update returns 400 when a replacement is required. Reactivation stays on the existing update rules and does not move anyone back.

## Endpoints

| Method | Path | Change |
| --- | --- | --- |
| POST | `/api/v1/users/:id/deactivate` | Deactivate a user and transfer direct reports or PDP assignments when required |

## Error cases

- 400 when a manager with direct reports omits `replacementManagerId`, or a PDP with assigned users omits `replacementPdpId`
- 400 when `replacementManagerId` is not an active `MANAGER` outside the closed tree
- 400 when `replacementPdpId` is not another active `PDP` who shares each assigned user's manager
- 400 when a replacement is sent but nobody needs to move, or the user is already inactive
- 400 when update sets `active` to `false` and a transfer is required
- 403 when the caller is `PDP` or `USER`
