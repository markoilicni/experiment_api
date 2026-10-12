# Add sort query parameters to GET users

[Pull request #11](https://github.com/markoilicni/experiment_api/pull/11)

## Summary

- `GET /api/v1/users` accepts `sortBy` (`username`, `name`, `email`, `role`, `createdAt`) and `sortOrder` (`ASC` or `DESC`).
- Missing parameters keep the current order: `createdAt` ascending. Unknown values return 400.
