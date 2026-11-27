# Add isPdp on topic groups

[Pull request #30](https://github.com/markoilicni/experiment_api/pull/30)

## Summary

- `TopicGroup` has a boolean `isPdp` field that defaults to `false`. Create and update accept optional `isPdp`; responses include it.
- `GET /api/v1/disciplines/:disciplineId/topic-groups` sorts PDP topic groups first (`isPdp` desc), then by `createdAt` desc.
