# OpenWA on Oracle Cloud Always Free

Deployment files for running one Campus Innovate WhatsApp session on an Oracle Cloud Infrastructure (OCI) Always Free Ampere VM.

## What this deploys

- OpenWA's official multi-architecture GHCR image, so the OCI ARM VM does not need to build Chromium from source.
- OpenWA's production Docker Compose stack with SQLite and persistent Docker volumes.
- Caddy reverse proxy for HTTPS. Only ports 80 and 443 need to be public; OpenWA's port 2785 stays bound to localhost.
- OpenWA's Docker socket proxy is disabled for this installation. SQLite is enough for the initial single-number setup; Docker-based datastore orchestration is not needed.

## Create the OCI VM

In OCI, create a VM.Standard.A1.Flex instance in your home region and keep it inside the Always Free allowance (up to 2 OCPU and 12 GB RAM total across A1 instances). For one WhatsApp session, start with 1 OCPU and 4 GB RAM. Pick Ubuntu 24.04 ARM64, assign a public IPv4 address, and use SSH public-key authentication.

In the VCN security list or network security group, allow inbound:
- TCP 22 from your own IP only.
- TCP 80 and 443 from the internet.

Do not expose TCP 2785 publicly. OCI can run out of free A1 capacity in a region, and Always Free VMs can be reclaimed when Oracle classifies them as idle; keep a copy of this configuration and back up the OpenWA data volume.

## Point a hostname to the VM

Create an A record such as `wa-api.campusinnovate.com` pointing to the VM's public IPv4. Wait until DNS resolves, then put the same hostname in the VM's `.env` as `OPENWA_DOMAIN`. If you use a different hostname, use it consistently.

## Install and start

SSH into the Ubuntu VM and install Docker, Compose, and Git:

```bash
sudo apt-get update
sudo apt-get install -y docker.io docker-compose-v2 git
sudo systemctl enable --now docker
```

Clone the official OpenWA repository and the Campus Innovate repository:

```bash
sudo mkdir -p /opt/openwa
sudo chown "$USER":"$USER" /opt/openwa
cd /opt/openwa
git clone https://github.com/rmyndharis/OpenWA.git app
git clone --depth 1 --branch codex/web-handoff https://github.com/campusinnovate/campusinnovate.com.git campus
cp campus/deploy/openwa-oci/docker-compose.override.yml app/docker-compose.override.yml
cp campus/deploy/openwa-oci/Caddyfile app/Caddyfile
cp campus/deploy/openwa-oci/.env.example app/.env
```

Edit `app/.env` and set `OPENWA_DOMAIN` to the DNS name pointed to this VM. Then run:

```bash
cd /opt/openwa/app
docker compose pull openwa-api caddy
docker compose up -d --no-build
docker compose ps
```

The OpenWA image generates its admin API key on first boot and stores it in `/app/data/.api-key` inside the container. Read it on the server and store it in an approved secret manager; do not commit it to GitHub or send it in chat:

```bash
sudo docker exec openwa-api cat /app/data/.api-key
```

Open `https://<OPENWA_DOMAIN>` to access the dashboard. Create a session, start it, and scan its QR from WhatsApp Business → Linked devices. The session data is kept in the named `openwa-data` volume and will auto-start after reboot.

## Current limit

These files deploy OpenWA but do not yet make Kawan Inovasi send WhatsApp messages through it. Once the VM URL exists, the API key should be stored as a server-side secret and the Kawan Edge Function can call OpenWA's `/api/sessions/{sessionId}/messages/send-text` endpoint.