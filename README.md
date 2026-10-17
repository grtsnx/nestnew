# nestnew

[![npm version](https://img.shields.io/npm/v/nestnew.svg)](https://www.npmjs.com/package/nestnew)
[![CI](https://github.com/grtsnx/create-nest-boilerplate/actions/workflows/ci.yml/badge.svg)](https://github.com/grtsnx/create-nest-boilerplate/actions/workflows/ci.yml)
[![license](https://img.shields.io/npm/l/nestnew.svg)](LICENSE)

Create a production-ready NestJS API with one command. Choose Prisma and
PostgreSQL or start without a database, then add Redis, email, and file storage
only when you need them.

```bash
bunx nestnew@latest my-api
```

`nestnew` copies a complete template, creates `.env` from `env.sample`, installs
its tested dependency versions, and starts the Docker services you select.

## Requirements

- [Bun](https://bun.sh/) 1.0 or newer
- Node.js 20 or newer
- [Docker](https://docs.docker.com/get-started/get-docker/) only when you choose
  local PostgreSQL or Redis

Docker is optional. If it is missing, `nestnew` offers to open Docker's official
installation guide, accept an external service URL, or skip that service.

## Quick start

Run the interactive setup:

```bash
bunx nestnew@latest my-api
```

The setup asks you to choose:

1. Prisma with PostgreSQL, or no database.
2. Docker, Neon, an existing PostgreSQL URL, or later setup.
3. Docker Redis, an external Redis URL, or no Redis.
4. Test email, Gmail, generic SMTP, or Resend.
5. Local files, Cloudflare R2, or Amazon S3-compatible storage.

When setup finishes:

```bash
cd my-api
bun run start:dev
```

Open `http://localhost:3000`. API documentation is enabled by default in
development.

## Command options

```text
bunx nestnew@latest [project-name] [options]

--prisma              Use Prisma and PostgreSQL
--no-database         Create the template without Prisma or PostgreSQL
--db=<choice>         docker | neon | external | later
--redis=<choice>      docker | external | skip
--email=<choice>      test | smtp | google | resend
--files=<choice>      fs | r2 | s3
--skip-install        Create the project without running bun install
-h, --help            Show command help
```

Passing every choice as a flag skips the selection menus. Providers that need
credentials still prompt for those credentials.

## Examples

Prisma, PostgreSQL, and Redis in Docker:

```bash
bunx nestnew@latest my-api \
  --prisma \
  --db=docker \
  --redis=docker \
  --email=test \
  --files=fs
```

Prisma with Neon and Cloudflare R2:

```bash
bunx nestnew@latest my-api \
  --prisma \
  --db=neon \
  --redis=skip \
  --email=resend \
  --files=r2
```

A database-free API with no optional infrastructure:

```bash
bunx nestnew@latest my-api \
  --no-database \
  --redis=skip \
  --email=test \
  --files=fs
```

Use existing PostgreSQL and Redis services without entering their URLs at the
prompts:

```bash
export DATABASE_URL='postgresql://user:password@host:5432/app?sslmode=require'
export REDIS_URL='rediss://user:password@host:6379'

bunx nestnew@latest my-api \
  --prisma \
  --db=external \
  --redis=external \
  --email=test \
  --files=fs
```

## Database and Redis

### PostgreSQL

The Prisma template supports four database setups:

| Choice | What happens |
| --- | --- |
| `docker` | Creates `compose.yaml`, starts PostgreSQL, and applies Prisma migrations. |
| `neon` | Opens Neon, asks for `DATABASE_URL`, and saves it in `.env`. |
| `external` | Uses `DATABASE_URL` from your shell or asks for it. |
| `later` | Leaves database setup for you. Add `DATABASE_URL` before running migrations. |

For hosted PostgreSQL, run migrations after the database is reachable:

```bash
bun run prisma:migrate:deploy
```

### Redis

Redis is optional in development and required by the included queue and cache
features in production.

| Choice | What happens |
| --- | --- |
| `docker` | Adds Redis to `compose.yaml`, starts it, and sets `REDIS_URL`. |
| `external` | Uses `REDIS_URL` from your shell or asks for it. |
| `skip` | Leaves Redis unconfigured. |

Manage generated Docker services from the project directory:

```bash
docker compose up -d
docker compose down
```

Docker data stays in named volumes when containers stop.

## Email

Every generated project includes the email SDK. The default `test` provider is
safe for local development and sends no real email.

| Provider | Environment variables |
| --- | --- |
| `test` | No credentials |
| `google` | `EMAIL_ADDRESS`, `EMAIL_PASSWORD` |
| `smtp` | `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS` |
| `resend` | `RESEND_API_KEY` |

Set `PLATFORM_SUPPORT` to the sender or support address. Production rejects the
`test` provider.

## File storage

Every generated project includes the file SDK.

| Provider | Environment variables |
| --- | --- |
| `fs` | `FILES_FS_ROOT` |
| `r2` | `FILES_R2_ACCOUNT_ID`, `FILES_R2_BUCKET`, `FILES_R2_ACCESS_KEY_ID`, `FILES_R2_SECRET_ACCESS_KEY` |
| `s3` | `FILES_S3_BUCKET`, `FILES_S3_REGION`, `FILES_S3_ACCESS_KEY_ID`, `FILES_S3_SECRET_ACCESS_KEY` |

Set `FILES_S3_ENDPOINT` for an S3-compatible provider. Leave it unset for
Amazon S3. Production requires `r2` or `s3`; local filesystem storage is a
development default.

## Environment files

`nestnew` keeps `env.sample` as documentation and creates a private `.env` file
with mode `0600`. It also:

- sets `PLATFORM_NAME` to the project name;
- writes the selected provider names and credentials;
- generates `BETTER_AUTH_SECRET` for the Prisma template;
- writes local Docker URLs when Docker services are selected;
- refuses to overwrite an existing target directory or `.env` file.

Review `.env` before deploying. At minimum, replace example public URLs,
support addresses, OAuth credentials, and provider secrets. Never commit `.env`;
the generated `.gitignore` already excludes it.

The complete variable references live in:

- [Prisma/PostgreSQL env.sample](packages/cli/templates/prisma-postgres/env.sample)
- [Database-free env.sample](packages/cli/templates/no-database/env.sample)

## What the templates include

Both templates include:

- NestJS application and worker entry points;
- environment validation;
- CORS, rate limiting, health checks, and API documentation;
- structured logging;
- Redis-backed queues;
- email and file-storage adapters;
- unit and end-to-end tests.

The Prisma/PostgreSQL template also includes Prisma migrations, Better Auth,
organization and team modules, user management, billing foundations, and an
optional admin seed.

## Useful scripts

Run these commands inside a generated project:

```bash
bun run start:dev             # Start the API in watch mode
bun run build                 # Build for production
bun run test                  # Run unit tests
bun run test:e2e              # Run end-to-end tests
bun run typecheck             # Check TypeScript
bun run prisma:generate       # Generate the Prisma client (Prisma template)
bun run prisma:migrate:deploy # Apply committed migrations (Prisma template)
```

See the generated project's README for its full script list and application
details.

## Troubleshooting

### Docker is installed but the command cannot use it

Start Docker Desktop or the Docker daemon, then confirm it works:

```bash
docker version
docker compose version
```

### A port is already in use

PostgreSQL uses `5432`, Redis uses `6379`, and the API uses `3000` by default.
Stop the conflicting service or edit `compose.yaml` and `.env`.

### Prisma cannot connect

Check `DATABASE_URL`, confirm PostgreSQL is reachable, then run:

```bash
bun run prisma:generate
bun run prisma:migrate:deploy
```

### Skip dependency installation

Create only the project files:

```bash
bunx nestnew@latest my-api --skip-install
cd my-api
bun install
```

## Contributing

```bash
git clone https://github.com/grtsnx/create-nest-boilerplate.git
cd create-nest-boilerplate
bun install
bun run check
```

Open an issue before a large change. Pull requests should keep both templates
working and include tests for CLI behavior changes.

## License

[MIT](LICENSE)
