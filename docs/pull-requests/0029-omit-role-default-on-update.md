# Keep omitted role off the update body

[Pull request #29](https://github.com/markoilicni/experiment_api/pull/29)

## Summary

- `CreateUserDto.role` no longer uses a property initializer. `PartialType` was copying `Role.USER` onto every update that omitted `role`, so the service treated the call as a role change.
- Create still defaults to `USER` in `UsersService.create` when the body omits `role`. Update leaves the stored role alone when the body omits it.
- A manager or PDP can again patch only name, email, phone, or address. SUPER can set `active` to `true` without also sending `role`.

## Error cases

- No new error cases. The previous false 403 `Cannot change role` and 400 `managerId is required for this role` on profile-only or activate-only patches no longer occur.
