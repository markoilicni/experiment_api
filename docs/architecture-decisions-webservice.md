# Architecture decisions — Webservice (Point 1)

Status: **Accepted (phase 1 webservice)**  
Related: `exp-request.txt`  
Scope: Phase 1 API only (CV / tests / SSR are out of scope)

---

## Context

Build a single learning-oriented web service that later frontends (React, Angular, Next.js, Vue) will share. Prefer a simple, expandable modular monolith over microservices now. Focus stays on clear boundaries so CV and test capabilities can be extracted later.

---

## Decisions

### AD-01 — Application shape

| Choice | NestJS **modular monolith** (TypeScript) |
| --- | --- |
| Alternatives | Fastify/Express folders; microservices from day one |
| Why | Clear modules, DI, guards, DTOs, validation; Nest maps well to later extraction without forcing distributed complexity now |

**Phase 1 modules (logical):** `auth`, `users`, `disciplines`, `topic-groups`, `topics`, `pdps`, `user-topics` (associations / lock).

**Later extractable (document only, not separate deploys yet):** CV service, test service.

---

### AD-02 — Database

| Choice | **SQLite** for phase 1 |
| --- | --- |
| Alternatives | PostgreSQL, MongoDB |
| Why | Fast local setup for learning; one file DB; migrate to PostgreSQL when production-readiness becomes the focus |

Constraint: prefer an ORM/schema approach that does not lock us into SQLite-only APIs (see AD-03).

---

### AD-03 — ORM / data layer

| Choice | **Prisma** |
| --- | --- |
| Alternatives | TypeORM |
| Why | Schema-first source of truth, strong generated TypeScript client, simpler migrations with SQLite, straightforward path to PostgreSQL later; less Nest ceremony so focus stays on domain + API |

**Trade-offs accepted**

- Not Nest’s “official” ORM story (`@nestjs/typeorm`)
- Manager-subtree visibility may use application-level traversal or raw SQL where Prisma’s API is awkward

**Rejected: TypeORM** — stronger Nest integration, but more footguns and weaker generated type safety for this learning setup.

---

### AD-04 — API style

| Choice | **REST** + **OpenAPI/Swagger from day one** |
| --- | --- |
| Versioning | URL prefix **`/api/v1/...`** |
| Why | Shared contract for React/Angular/Next/Vue; Swagger reduces guessing and drift |

Non-goals for phase 1: GraphQL, public third-party API productization.

---

### AD-05 — Authentication

| Choice | **JWT access token + refresh token** |
| --- | --- |
| Why | Fits SPA clients; refresh avoids short-lived access UX pain; standard learning pattern |

**Login (phase 1)**

| Item | Decision |
| --- | --- |
| Identifier | **`username` + `password`** (`POST /api/v1/auth/login`) |
| Password hashing | **bcrypt** |
| Access token TTL | **Configurable**; **default 1 hour** (`1h`) — e.g. `JWT_ACCESS_EXPIRES_IN` |
| Refresh token TTL | **Configurable**; **default 1 day** (`1d`) — e.g. `JWT_REFRESH_EXPIRES_IN` |
| Refresh storage | **Stateless JWT refresh only** (no refresh-token table in phase 1) |
| Secrets | Configurable in API project (e.g. `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`) |

**Out of scope for now (later)**

- Forgot password (email flow)
- Email verification
- Other email-based account workflows  

Keep auth simple until core CRUD + frontends need more.

**Companion endpoints (phase 1)**

- `POST /api/v1/auth/login` — username/password → access + refresh + user summary  
- `POST /api/v1/auth/refresh` — refresh JWT → new access (and optionally rotated refresh)  
- `POST /api/v1/auth/logout` — client discards tokens (server cannot fully revoke with L3b; optional later blacklist)

**Access JWT claims (minimum):** `sub` (user id), `role`, standard `iat` / `exp`.  
**Refresh JWT:** distinct secret or `type: refresh` claim; validate expiry against configured TTL.

**Default seed user (local / learning)**

| Field | Value |
| --- | --- |
| `username` | `superadmin` |
| `password` | `super/1234` (bcrypt hash in DB only) |
| `role` | `SUPER` |
| `name` | `Super Admin` |
| `email` | `superadmin@localhost` (placeholder for later email flows; **not** used for login in phase 1) |

Seed via Prisma seed script on a fresh DB. Learning/dev only.

**Trade-off (refresh = stateless JWT)**

- Simpler phase 1: no refresh rows, no revoke list  
- Logout / forced invalidate is limited until we add storage or a denylist later  

---

### AD-06 — Authorization model (roles)

| Choice | **Exactly one role per user** |
| --- | --- |
| Roles | `SUPER` · `MANAGER` · `PDP` · `USER` |

**“Managed” is not a role.** It is a **relationship/type**: a user who has a manager assigned (typically a `USER`, and possibly others as the product allows).

High-level capabilities (from product brief; enforce in guards/policies):

| Role | Phase 1 focus |
| --- | --- |
| `SUPER` | Full CRUD: users, disciplines, topic groups, topics, user relations; plus everything managers can do |
| `MANAGER` | Manage associated users (and visibility rules in AD-07); lock/unlock topic edits; assign disciplines; associate PDP role holder; otherwise as `USER` / `PDP` where applicable |
| `PDP` | Read associated users/disciplines; CRUD PDPs for associated users; edit topic descriptions |
| `USER` | Login; edit own profile; check/uncheck own topics when unlocked |

---

### AD-07 — Manager visibility

| Choice | Each user has **at most one manager** (single parent). Visibility is **transitive along the manager chain**. |
| --- | --- |

Clarification vs “flat”:

- **Assignment model:** flat edge — `user.managerId → one manager` (no multi-manager, no cycles).
- **Visibility model:** if Manager A manages Manager B, A can see **B’s users** (and further descendants) as well as users directly under A.

Implementation note: resolve visible user IDs by walking the manager tree (app-level BFS/DFS or recursive SQL). Document and test cycle prevention on assign.

---

### AD-08 — Discipline / topic structure

| Choice | **Strict tree:** Discipline → TopicGroup → Topic |
| --- | --- |
| Why | Simpler admin UX and permissions; matches phase 1 learning scope |

A topic belongs to **one** topic group; a topic group belongs to **one** discipline.

---

### AD-09 — User ↔ topics

| Choice | Separate association entity (working name: **`UserTopic`**) |
| --- | --- |
| Fields (conceptual) | `userId`, `topicId`, `checked` (bool), `locked` (bool) — exact naming TBD |

Managers (per product rules) lock/unlock; users check/uncheck only when unlocked.

---

### AD-10 — PDP

| Choice | **Multiple PDP documents per user** (history over time) |
| --- | --- |
| Why | Matches real PDP workflows; avoids overwrite-only model |

API should support listing history and identifying current/active PDP if needed (e.g. `isActive` or “latest by date” — exact rule TBD at implementation).

---

### AD-11 — Repository layout

| Choice | **Separate folders/repos per application** (not a monorepo) |
| --- | --- |
| Why | Matches preferred workflow; API first, then independent frontends |

Suggested sibling layout (illustrative, not mandatory names):

```text
experiment/                 # or parent folder
  api/                      # this webservice
  web-react/                # Point 2
  web-angular/              # Point 3
  web-next/                 # Point 4
  ...
```

This notes file lives with the experiment workspace until the API project is created; move or copy into `api/docs` when the service repo/folder exists.

---

### AD-12 — Microservices stance

| Choice | **No separate services in phase 1** |
| --- | --- |
| Approach | Keep one deployable; keep module boundaries clean so CV/tests can become services later |

---

### AD-13 — Phase 1 non-goals

Confirmed out of scope for the first webservice slice:

- CV module / CV microservice
- Tests generation and assignment
- SSR / hydration concerns (frontend concern)
- Multi-tenant SaaS / complex IAM product

---

## Conceptual domain (phase 1)

```text
User
  - username (unique; login identifier)
  - passwordHash (bcrypt)
  - name, address, email, phone, ...
  - role: SUPER | MANAGER | PDP | USER
  - managerId? (optional; “managed” = has manager)
  - pdpId? / link to user with role PDP (association rules TBD at API design)
  - disciplines (M2M or explicit join)
  - userTopics[]

Discipline
  - name, description
  - topicGroups[]

TopicGroup
  - name
  - disciplineId
  - topics[]

Topic
  - name, description
  - topicGroupId

UserTopic
  - userId, topicId
  - checked, locked

Pdp
  - description
  - userId (subject of the PDP)
  - topics[]
  - history: many rows per user over time
```

Exact join tables and PDP ownership fields will be fixed in an API resource design pass.

---

## Open items

1. PDP “current” document rule (`isActive` vs latest timestamp)  
2. How a user with role `PDP` is linked to subject users (field on `User` vs join table)  
3. Later: forgot password / email verification (email field reserved; not used for login yet)  
4. Tighten manager visibility on user list (currently SUPER/MANAGER see all — AD-07 not enforced yet)

---

## Change log

| Date | Change |
| --- | --- |
| 2026-09-28 | Initial decisions from collaborative Q&A; ORM left open with recommendation |
| 2026-09-28 | AD-03 decided: Prisma; document status → Accepted |
| 2026-09-28 | Role `PDP_USER` → `PDP`; refresh token TTL configurable, default 1 day |
| 2026-09-28 | Seed SUPER user `superadmin` / `super/1234` (hashed); login endpoint design under discussion |
| 2026-09-28 | Login: username+password, bcrypt, access default 1h (config), refresh JWT only; email flows deferred |
| 2026-09-28 | API scaffolded under `api/` (Nest + Prisma + auth + user CRUD) |
