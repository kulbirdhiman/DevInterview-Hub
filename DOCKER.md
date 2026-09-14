# Running DevInterview-Hub with Docker

Three services: `frontend` (Next.js 16), `backend` (Express + Socket.IO), `mongo`.

## 1. Configure

```bash
cp .env.example .env
```

Fill in your Clerk keys. `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` is **baked into the
frontend image at build time** (Clerk inlines it into the client bundle), so after
changing it you must rebuild: `docker compose build frontend`.

## 2. Production-like run

```bash
docker compose up --build
```

- Frontend → http://localhost:3000
- Backend  → http://localhost:5001
- MongoDB  → localhost:27017 (data persisted in the `mongo-data` volume)

The backend waits for Mongo's healthcheck before starting.

## 3. Development (hot reload)

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```

This swaps both images to their `dev` stage, bind-mounts `./backend` and
`./frontend`, and runs `ts-node-dev` / `next dev`. `node_modules` and `.next` live
in anonymous volumes so the container's Linux-native installs aren't shadowed by
the host bind mount.

After changing `package.json`, you must pass `--renew-anon-volumes`, or the
container keeps the old dependencies and the new import fails to resolve:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build --renew-anon-volumes
```

## Common commands

```bash
docker compose logs -f backend        # tail one service
docker compose down                   # stop, keep the database
docker compose down -v                # stop and wipe the database volume
docker compose exec mongo mongosh     # Mongo shell
```

## Using MongoDB Atlas instead of the bundled container

Set `MONGODB_URI` in `.env` to your Atlas connection string, then start only the
app services:

```bash
docker compose up frontend backend
```

## Troubleshooting

**`port is already allocated` on 5000** — macOS Control Center (AirPlay Receiver)
listens on 5000. `.env` defaults `BACKEND_PORT` to 5001 for this reason; either keep
that, or turn AirPlay Receiver off in System Settings → General → AirDrop & Handoff.

**`Publishable key not valid`** — `.env` still has the `pk_test_xxx` placeholders.
Put your real Clerk keys in, then restart (`docker compose up -d`). The frontend also
needs a rebuild after this, since the key is compiled into the browser bundle.

**Switched between dev and prod and got the wrong one** — the two modes build
different image tags (`:dev` vs `:prod`), so pass `--build` when switching.

## Notes

- `mongo` is pinned to `8.2`; earlier 8.0 images fail to boot on Docker Desktop
  VM kernels 6.19+ (MongoDB SERVER-121912).
- Images are multi-stage: the backend ships only `dist/` plus production
  dependencies, and the frontend ships Next.js `standalone` output. Both run as
  the non-root `node` user and have healthchecks.
