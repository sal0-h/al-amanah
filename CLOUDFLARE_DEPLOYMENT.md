# Cloudflare Tunnel Deployment Guide

**Free, No Domain Required, Works Anywhere!**

Cloudflare Tunnel gives you a free `https://random-name.trycloudflare.com` domain and automatically handles HTTPS. Works with any architecture (x86, ARM, etc.) since it just tunnels to your Docker containers.

---

## 🚀 Quick Start (5 minutes)

### Step 1: Install Cloudflare Tunnel

```bash
# Download cloudflared (one-time setup)
wget -q https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
sudo dpkg -i cloudflared-linux-amd64.deb

# Or for ARM (Raspberry Pi, etc.):
# wget https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64.deb
# sudo dpkg -i cloudflared-linux-arm64.deb
```

### Step 2: Start Your App

```bash
cd /path/to/al-amanah
docker-compose up -d
```

### Step 3: Create Tunnel (Get Free Domain)

```bash
# Run this - it will give you a free HTTPS URL!
cloudflared tunnel --url http://localhost:80
```

**You'll see output like:**
```
2026-01-21 | Your quick Tunnel has been created! Visit it at:
2026-01-21 | https://random-words-1234.trycloudflare.com
```

**That's it!** Your app is now live at that URL. ✅

**No `.env` changes needed** - the app automatically handles HTTPS through Cloudflare and allows requests from your tunnel URL.

---

## 🔒 Permanent Tunnel (Optional)

The quick tunnel above gives you a **random URL each time**. For a consistent URL:

### 1. Login to Cloudflare

```bash
cloudflared tunnel login
```

This opens a browser - login with your Cloudflare account (free).

### 2. Create Named Tunnel

```bash
cloudflared tunnel create msa-tracker
```

### 3. Create Config File

Create `~/.cloudflared/config.yml`:

```yaml
tunnel: msa-tracker
credentials-file: /home/YOUR_USERNAME/.cloudflared/YOUR_TUNNEL_ID.json

ingress:
  - hostname: msa-tracker.YOUR_DOMAIN.com
    service: http://localhost:80
  - service: http_status:404
```

### 4. Route DNS

```bash
cloudflared tunnel route dns msa-tracker msa-tracker.YOUR_DOMAIN.com
```

### 5. Run as Service

```bash
sudo cloudflared service install
sudo systemctl start cloudflared
sudo systemctl enable cloudflared
```

Now your tunnel runs permanently in the background!

---

## 📱 Testing Your Deployment

### Quick Health Check

```bash
# Replace with your actual tunnel URL
curl https://your-tunnel-url.trycloudflare.com/api/health
# Should return: {"status":"healthy"}
```

### Test Login

1. Open your tunnel URL in a browser
2. Login with your admin credentials
3. You're done! The app automatically handles HTTPS and CORS.

### Troubleshooting

**❌ CORS errors (JSON fails to load)**
- Make sure you're visiting the **exact tunnel URL** from Cloudflare output
- It should be `https://something.trycloudflare.com`, not `http://`

**❌ Login works but immediately logs out**
- This means cookies aren't being sent - check:
  - Are you using `https://` URL (not `http://`)?
  - Is the Cloudflare tunnel running?
  - Try clearing browser cookies and login again

**❌ Tunnel disconnects**
- Quick tunnels (`--url`) are temporary - they disconnect when you close terminal
- Use permanent tunnel setup below for 24/7 uptime

**❌ Rate limit errors**
- Wait 1 minute after 5 failed login attempts
- This is intentional security (prevents password guessing)

---

## 🏗️ Architecture-Agnostic Deployment

This setup works **anywhere** Docker runs:

| Platform | Works? | Notes |
|----------|--------|-------|
| **x86_64 Linux** | ✅ | Native support |
| **ARM64 (Pi)** | ✅ | Use ARM cloudflared build |
| **WSL2** | ✅ | Works from Windows |
| **Mac (Intel/M1)** | ✅ | Docker Desktop |
| **Cloud VPS** | ✅ | AWS, DigitalOcean, etc. |
| **Home Server** | ✅ | Behind NAT, no port forwarding needed! |

**Why it works everywhere:**
- Cloudflare Tunnel connects **outbound** (no firewall issues)
- Docker handles platform differences
- No need to configure routers/firewalls
- Works behind CGNAT

---

## 🆓 Cost Breakdown

| Component | Cost |
|-----------|------|
| Cloudflare Tunnel | **FREE** |
| Random .trycloudflare.com domain | **FREE** |
| HTTPS Certificate | **FREE** (auto) |
| Bandwidth | **FREE** (unlimited) |
| Custom domain (optional) | ~$10/year |
| **Total** | **$0** |

---

## 🔐 Security Notes

With this setup you get:

✅ **Automatic HTTPS** (TLS 1.3)  
✅ **DDoS protection** (Cloudflare's network)  
✅ **Rate limiting** (login: 5/min)  
✅ **Secure cookies** (HTTPOnly, Secure, SameSite)  
✅ **No exposed ports** (tunnel = outbound only)

**For production with sensitive data:**
- Use a custom domain (not .trycloudflare.com)
- Enable Cloudflare Access for authentication
- Set up database backups
- Add monitoring/alerting

---

## 🎯 Quick Commands Reference

```bash
# Start quick tunnel (testing)
cloudflared tunnel --url http://localhost:80

# Create permanent tunnel
cloudflared tunnel create my-tunnel

# List tunnels
cloudflared tunnel list

# Delete tunnel
cloudflared tunnel delete my-tunnel

# Check tunnel status
cloudflared tunnel info my-tunnel

# View tunnel logs
sudo journalctl -u cloudflared -f
```

---

## 🤝 Community Support

- [Cloudflare Tunnel Docs](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/)
- [MSA Task Tracker GitHub](https://github.com/sal0-h/al-amanah)

---

**Note**: The random `.trycloudflare.com` URLs change each time you restart the tunnel. For a permanent URL, follow the "Permanent Tunnel" section above.
