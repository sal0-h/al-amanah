docker-compose up -d
tunnel: msa-tracker
ingress:
# Cloudflare Tunnel Deployment (msa-tracker → tasks.cmuqmsa.org)

This repo defaults to Cloudflare Tunnel for HTTPS. Use the quick tunnel for testing, the named tunnel for production on `tasks.cmuqmsa.org` (tunnel name `msa-tracker`).

## Prereqs
- Cloudflare account with `cmuqmsa.org` in your zone
- Docker running and stack up (`./server-setup.sh` or `docker compose up -d`)
- `cloudflared` installed:

```bash
wget -q https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
sudo dpkg -i cloudflared-linux-amd64.deb
# ARM: use cloudflared-linux-arm64.deb
```

## Configure via env (recommended)

Edit `.env` (already has defaults):

```bash
CF_TUNNEL_NAME=msa-tracker
CF_TUNNEL_HOSTNAME=tasks.cmuqmsa.org
CF_LOCAL_SERVICE=http://localhost:80
```

Run with `./deploy-cloudflare.sh` (or set `CLOUDFLARE_ENV` to point elsewhere).

## Option A: Quick tunnel (temporary URL)

```bash
./deploy-cloudflare.sh
# starts the stack, verifies /api/health, and opens a random https://*.trycloudflare.com
```

Stops when you Ctrl+C. Use only for ad-hoc demos.

## Option B: Permanent tunnel on tasks.cmuqmsa.org

```bash
# 1) Authenticate
cloudflared tunnel login

# 2) Create or reuse the named tunnel
cloudflared tunnel create msa-tracker

# 3) Generate config
cat > ~/.cloudflared/config.yml <<'EOF'
tunnel: msa-tracker
credentials-file: ~/.cloudflared/msa-tracker.json
ingress:
  - hostname: tasks.cmuqmsa.org
    service: http://localhost:80
  - service: http_status:404
EOF

# 4) Route DNS to the tunnel
cloudflared tunnel route dns msa-tracker tasks.cmuqmsa.org

# 5) Run as a service (keeps it alive)
sudo cloudflared service install
sudo systemctl enable --now cloudflared
```

Check status:

```bash
cloudflared tunnel info msa-tracker
sudo journalctl -u cloudflared -f
```

## Health checks

```bash
curl -s https://tasks.cmuqmsa.org/api/health
# -> {"status":"healthy"}
```

If auth loops, ensure you are on https and cookies are enabled. Tunnel must be running.

## Tips
- Redeploy code without downtime: `./redeploy.sh`
- Local logs: `docker compose logs -f backend` / `nginx`
- Tunnel logs: `sudo journalctl -u cloudflared -f`
- Changing hostnames: edit `~/.cloudflared/config.yml` and rerun `cloudflared service install`
