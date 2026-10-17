# nestnew

Create a production-ready NestJS API with one command:

```bash
bunx nestnew@latest my-api
```

Choose Prisma with PostgreSQL or a database-free template. The interactive
setup can also configure Redis, email, and file storage.

## Requirements

- Bun 1.0 or newer
- Node.js 20 or newer
- Docker only when you choose local PostgreSQL or Redis

## Options

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

## Examples

Local PostgreSQL and Redis:

```bash
bunx nestnew@latest my-api \
  --prisma \
  --db=docker \
  --redis=docker \
  --email=test \
  --files=fs
```

Database-free:

```bash
bunx nestnew@latest my-api \
  --no-database \
  --redis=skip \
  --email=test \
  --files=fs
```

The generator copies `env.sample` to `.env`, writes your selected settings,
installs tested dependency versions, and starts selected Docker services. If
Docker is missing, it offers the official installation guide, an external URL,
or manual setup.

After generation:

```bash
cd my-api
bun run start:dev
```

Read the [complete guide](https://github.com/grtsnx/create-nest-boilerplate#readme)
for provider variables, deployment notes, troubleshooting, and contribution
instructions.

## License

[MIT](https://github.com/grtsnx/create-nest-boilerplate/blob/main/LICENSE)
