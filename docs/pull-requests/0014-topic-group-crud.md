# Add topic group CRUD

[Pull request #14](https://github.com/markoilicni/experiment_api/pull/14)

## Summary

- Add topic group create, list, get, update, and delete under `/api/v1`.
- Names are unique inside a discipline. Delete returns 409 while topics still belong to the group.
- Reads are open to any logged-in role. Writes are SUPER only.

### Endpoints

| Method | Path | Access |
| --- | --- | --- |
| POST | `/api/v1/disciplines/:disciplineId/topic-groups` | SUPER only |
| GET | `/api/v1/disciplines/:disciplineId/topic-groups` | Any logged-in |
| GET | `/api/v1/topic-groups/:id` | Any logged-in |
| PATCH | `/api/v1/topic-groups/:id` | SUPER only |
| DELETE | `/api/v1/topic-groups/:id` | SUPER only |

PATCH can rename the group or move it by changing `disciplineId`. A missing discipline returns 404. A name already used inside that discipline returns 409.
