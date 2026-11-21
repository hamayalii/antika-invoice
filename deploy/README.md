# Deploying Antika Docs on a VPS (Docker + HTTPS)

This deployment targets a Linux VPS with a real subdomain, for example
`docs.antika.iq`. Netlify is not used: the app needs a long-running API,
PostgreSQL, Chromium for PDF rendering, and persistent uploads.

```
Internet
  │  HTTPS 443
  ▼
Host nginx (TLS, Certbot)
  │  http://127.0.0.1:8080
  ▼
web container (nginx: static React + reverse proxy /api)
  │  http://api:4000
  ▼
api container (Express + Puppeteer/Chromium)
  │  postgres:5432
  ▼
postgres container (PostgreSQL 16)  ── volumes: pgdata, uploads
```

## 1. DNS

Create an `A` record (and `AAAA` if you have IPv6) for the subdomain:

```
docs.example.com  →  <VPS public IPv4>
```

Wait for propagation: `dig +short docs.example.com`.

## 2. Server prerequisites

Ubuntu 24.04 LTS, 2 vCPU / 4 GB RAM or more (Chromium needs memory), 20 GB disk.

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y ca-certificates curl git ufw nginx certbot python3-certbot-nginx

# Docker Engine + Compose plugin (official repository)
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | \
  sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo $VERSION_CODENAME) stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list >/dev/null
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker "$USER"   # log out/in afterwards
```

Firewall:

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

Do **not** expose ports 4000 (API) or 5432 (PostgreSQL) publicly.

## 3. Get the code and configure secrets

```bash
sudo mkdir -p /opt/antika && sudo chown "$USER":"$USER" /opt/antika
git clone <your-repository-url> /opt/antika
cd /opt/antika
cp .env.docker.example .env.docker
```

Edit `.env.docker`:

```dotenv
POSTGRES_USER=antika
POSTGRES_PASSWORD=<long-random-password>
POSTGRES_DB=antika_docs

JWT_SECRET=<openssl rand -base64 48>
JWT_EXPIRES_DAYS=7
COOKIE_SECURE=true
TRUST_PROXY=1

APP_ORIGIN=https://docs.example.com
DOMAIN=docs.example.com
WEB_PORT=8080

VOUCHER_PAGE=A5_landscape

ADMIN_USERNAME=admin
ADMIN_PASSWORD=<strong-first-login-password>
ADMIN_FULL_NAME=Antika Administrator
```

Generate secrets:

```bash
openssl rand -base64 48   # JWT_SECRET
openssl rand -base64 24   # POSTGRES_PASSWORD
```

`COOKIE_SECURE=true` requires HTTPS; use `false` only for a quick local HTTP
test. The seed admin must change the password on first login.

## 4. Build and start

```bash
cd /opt/antika
docker compose --env-file .env.docker up --build -d
docker compose --env-file .env.docker ps
docker compose --env-file .env.docker logs -f api   # watch migrations + seed
```

Check the containers:

```bash
curl -fsS http://127.0.0.1:8080/healthz
curl -fsS http://127.0.0.1:8080/api/health
```

The API container runs `prisma migrate deploy` and the idempotent seed on every
start. It is safe to restart; existing documents are not overwritten.

## 5. Host nginx + HTTPS

```bash
sudo mkdir -p /var/www/certbot
sudo cp /opt/antika/deploy/nginx-antika-docs.conf /etc/nginx/sites-available/antika-docs.conf
sudo sed -i 's/docs\.example\.com/your-real-subdomain/g' /etc/nginx/sites-available/antika-docs.conf
sudo ln -s /etc/nginx/sites-available/antika-docs.conf /etc/nginx/sites-enabled/antika-docs.conf
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
```

Issue the certificate:

```bash
sudo certbot certonly --webroot -w /var/www/certbot -d your-real-subdomain
sudo nginx -t && sudo systemctl reload nginx
```

Or let Certbot edit the host block automatically:

```bash
sudo certbot --nginx -d your-real-subdomain
```

Renewal is automatic via the `certbot.timer`. Verify with
`sudo certbot renew --dry-run`.

Open `https://your-real-subdomain`, log in with `ADMIN_USERNAME` /
`ADMIN_PASSWORD`, and complete the forced password change.

## 6. Backups

`scripts/backup.sh` writes a compressed custom-format dump plus SHA-256
checksum to `backups/` and keeps 14 days by default.

```bash
cd /opt/antika
./scripts/backup.sh
# custom location / retention:
BACKUP_DIR=/var/backups/antika KEEP_DAYS=30 ./scripts/backup.sh
```

Daily cron at 02:15:

```cron
15 2 * * * cd /opt/antika && BACKUP_DIR=/var/backups/antika ./scripts/backup.sh >> /var/log/antika-backup.log 2>&1
```

Copy backups off the VPS (object storage or another host). A backup that only
lives on the same disk is not a backup.

Restore (stops the API, takes a safety backup, restores, restarts the API):

```bash
cd /opt/antika
./scripts/restore.sh /var/backups/antika/antika_docs-20261120T021500Z.dump
```

Test a restore on a staging server at least once before you need it.

## 7. Upgrades

```bash
cd /opt/antika
./scripts/backup.sh
git pull
docker compose --env-file .env.docker up --build -d
docker compose --env-file .env.docker ps
```

Migrations run automatically when the API container starts. Roll back by
checking out the previous commit and restoring the dump if a migration is not
backwards compatible.

## 8. Operations

```bash
# logs
docker compose --env-file .env.docker logs -f api
docker compose --env-file .env.docker logs -f web

# restart
docker compose --env-file .env.docker restart

# database shell
docker compose --env-file .env.docker exec postgres psql -U antika -d antika_docs

# disk usage
docker system df
```

Keep the host patched (`unattended-upgrades`), restrict SSH to keys, and store
secrets only in `.env.docker` (never commit it).
