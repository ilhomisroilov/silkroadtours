# Deploying National Tours (Docker + nginx on Oracle Cloud Always Free)

The site runs as one Docker container (Next.js + SQLite on a persistent volume) behind **nginx** on the host,
with free Let's Encrypt certificates. Everything fits the Oracle Cloud **Always Free** tier (Ampere A1 ARM or
AMD micro VM). No paid resources are needed.

```
Internet ──► nginx :80/:443 (host, HTTPS, www→apex, gzip, caching, rate limit)
                 └─► 127.0.0.1:3100  Docker container "silkroadtours"
                        ├─ Next.js server (site, admin, API, AI assistant)
                        └─ /data (volume app-data): silkroad.db + backups/
```

## Why SQLite (libSQL) instead of PostgreSQL
The original application was built on Cloudflare D1, which **is SQLite**. Keeping SQLite (through libSQL)
preserved the exact schema, all 3 migrations, every query and the transactional batches 1:1, with no
data-type conversions. For one server and a tour agency's traffic it is simpler and more reliable than a
separate database server: no database port exists at all (nothing to expose), backups are one consistent
file (`VACUUM INTO`), and WAL mode handles concurrent reads. If traffic ever needs several app servers,
`DATABASE_URL` can point to a libSQL/Turso server without code changes.

## 1. Server (once)
1. Oracle Cloud → Compute → Instances → Create: **Ubuntu 22.04 or 24.04**, shape **VM.Standard.A1.Flex**
   (Always Free, e.g. 2 OCPU / 12 GB) or VM.Standard.E2.1.Micro. Add your SSH public key.
2. Networking → the instance's subnet → Security List → **Add ingress rules**: TCP **80** and **443** from `0.0.0.0/0`.
3. DNS at the domain registrar (only these two records; leave everything else unchanged):
   | Type | Name | Value |
   |---|---|---|
   | A | `@` (nationaltours.uz) | server public IP |
   | A | `www` | server public IP |

## 2. Deploy
```bash
ssh ubuntu@SERVER_IP
sudo apt-get update && sudo apt-get install -y git
git clone https://github.com/ilhomisroilov/silkroadtours.git && cd silkroadtours
sudo DOMAIN=nationaltours.uz EMAIL=you@example.com bash deploy/setup-server.sh   # asks for the Gemini key; creates .env with random secrets

```
`deploy/setup-server.sh` installs Docker, nginx and certbot, opens ports 80/443 in the host firewall (Oracle
Ubuntu images block them by default), builds and starts the container, waits for `/api/health`, obtains the
certificate for `nationaltours.uz` + `www.nationaltours.uz`, installs `deploy/nginx/silkroadtours.conf`
(HTTP→HTTPS, www→apex, HSTS, gzip, static caching, `/api/` rate limit) and a daily backup cron job.
It is safe to run again. `DOMAIN` sets the site address everywhere (nginx, certificate, canonical links,
sitemap); www is added to the certificate only when `www.DOMAIN` already points to the server, so re-run
the script after adding the www record.

**Servers that already host other sites** (for example yoshlikedu.uz and bilimjon.uz): the script never
edits or removes other nginx sites or the default site, adds only `silkroadtours.conf`, runs `nginx -t`
before every reload and rolls back its own file if the test fails, asks certbot only for this domain, and
uses a free local port (`APP_PORT`, default 3100). If port 80 belongs to something other than host nginx
(Apache, Caddy, a Docker proxy), it stops and tells you instead of installing a second web server.

### Two brands on one server (National Tours + Gulistan Travel)
The same code runs as separate sites; each brand is its own deployment with its own clone, `.env`, container,
database volume, local port, nginx file, certificate, cron job and backups. Nothing is shared but the code.

| | National Tours | Gulistan Travel |
|---|---|---|
| `BRAND` / `NEXT_PUBLIC_BRAND` | `national` (default) | `gulistan` |
| Domain | nationaltours.uz | gulistantravel.uz |
| Directory | `~/silkroadtours` | `~/gulistantravel` |
| Container / nginx file / backups | `silkroadtours` | `gulistantravel` |
| Local port (`APP_PORT`) | 3100 | 3102 (3101 is the backend API) |

Add Gulistan Travel next to the running National Tours site:
1. DNS: `A @` and `A www` for gulistantravel.uz → the server IP.
2. On the server:
   ```bash
   git clone https://github.com/ilhomisroilov/silkroadtours.git ~/gulistantravel
   cd ~/gulistantravel && sudo BRAND=gulistan bash deploy/setup-server.sh
   sudo bash deploy/create-admin.sh          # its own administrators
   sudo bash deploy/set-ai-key.sh            # its own AI keys (or copy the AI_* lines from ~/silkroadtours/.env)
   ```
   The new site starts with the starter catalogue and `SEARCH_INDEXING=off`; set it to `on` in its `.env` at launch.
3. Update National Tours as before: `cd ~/silkroadtours && git pull && sudo bash deploy/setup-server.sh`.

The script refuses to switch a directory to another brand, refuses a domain another nginx site already serves,
and gives every site its own rate-limit zone, so the brands, yoshlikedu.uz and bilimjon.uz never collide.
Each container is capped at `APP_MEM_LIMIT` (default 768m). Texts are written with the canonical name
"Gulistan Travel" and swapped for the deployment's brand at load time (`src/lib/brand.ts`, `scripts/brand.mjs`);
migration `0004_brand.sql` aligns names already stored in a database with its brand.

## 3. First administrator (no default password exists)
```bash
sudo bash deploy/create-admin.sh   # asks email, name and a hidden password (12+ characters)
```
Or by hand:
```bash
curl -X POST https://nationaltours.uz/api/admin/auth/bootstrap \
  -H "x-admin-secret: $(grep ^ADMIN_SECRET= .env | cut -d= -f2-)" \
  -H "origin: https://nationaltours.uz" -H "content-type: application/json" \
  -d '{"email":"owner@your-domain","name":"Owner","password":"a long unique password"}'
```
This works only while no admin exists; afterwards it is permanently disabled. Sign in at `/admin`,
then add staff under Settings → Users (roles: owner, editor).

## 4. Operations
| Task | Command (in the project folder on the server) |
|---|---|
| Status / health | `docker compose ps` · `curl -s localhost:3100/api/health` |
| Logs | `docker compose logs -f --tail 100 app` · `/var/log/nginx/` |
| Update to latest code | `git pull && docker compose up -d --build` (migrations run automatically on start) |
| Restart | `docker compose restart app` |
| Backup now | `sudo bash deploy/backup.sh` → `/var/backups/silkroadtours/*.db.gz` (daily 03:15, keeps 14) |
| Restore | `sudo bash deploy/restore.sh /var/backups/silkroadtours/silkroad-….db.gz` |
| DB status | `docker exec silkroadtours node scripts/db.mjs status` |
| AI log retention | `docker exec silkroadtours node scripts/db.mjs prune` (daily 03:45; days set in Admin → AI) |
| Certificate renewal | automatic (`systemctl list-timers certbot*`); nginx reloads after renewal |
| Rollback | `git checkout <previous-commit> && docker compose up -d --build` |

Copy `/var/backups/silkroadtours` off the server regularly (for example to OCI Object Storage, 20 GB free).

## 5. AI configuration
Keys live only in the server's `.env` (never in Git, never sent to the browser; the admin shows only the
last 4 characters). Chain: `AI_PROVIDER`/`AI_MODEL` → `AI_SECONDARY_MODEL` (same provider, absorbs
"high demand" errors) → `AI_FALLBACK_PROVIDER` (Groq, optional) → database-only answers. With no key at all
the assistant and planner still work from the catalogue. Tone, welcome texts, limits and retention are
edited in **Admin → AI**; the protected safety rules are in code (`src/lib/ai/agent.ts`, `src/lib/ai/guard.ts`).

Evaluate after changes: `BASE_URL=https://nationaltours.uz npm run ai:eval` (UZ/EN/RU questions; fails if
the assistant confirms a booking, claims availability, asks for payment, links a non-existent tour or shows
a price without "indicative").
