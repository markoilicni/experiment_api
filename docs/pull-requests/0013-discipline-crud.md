# Add Discipline CRUD endpoints

[Pull request #13](https://github.com/markoilicni/experiment_api/pull/13)

## Summary

Implements issue #3 — Add Discipline CRUD endpoints.

## Changes

### Database schema

- Added `Discipline` model with `name` (unique) and `description` fields.
- Added `TopicGroup` model for the hierarchy (Discipline → TopicGroup → Topic).
- Added `Topic` model to complete the tree structure.
- Created migration `20261011191814_add_discipline_models`.

### New module: `DisciplinesModule`

- **Controller** (`disciplines.controller.ts`): REST endpoints with Swagger documentation.
- **Service** (`disciplines.service.ts`): business logic and error handling.
- **DTOs**: `CreateDisciplineDto` and `UpdateDisciplineDto` with validation.

### Endpoints

| Method | Path | Access | Description |
| --- | --- | --- | --- |
| POST | `/api/v1/disciplines` | SUPER only | Create discipline |
| GET | `/api/v1/disciplines` | Any logged-in | List all disciplines |
| GET | `/api/v1/disciplines/:id` | Any logged-in | Get discipline by ID |
| PATCH | `/api/v1/disciplines/:id` | SUPER only | Update discipline |
| DELETE | `/api/v1/disciplines/:id` | SUPER only | Delete discipline |

### Error handling

- 409 Conflict when the discipline name already exists.
- 409 Conflict when deleting a discipline that still has topic groups.
- 404 Not Found when the discipline ID does not exist.
