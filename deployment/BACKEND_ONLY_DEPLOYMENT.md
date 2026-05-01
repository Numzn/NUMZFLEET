# Backend-Only Deployment Guide

Quick guide for deploying only the backend services to OCI (frontend will be hosted separately).

## Quick Start

### Option 1: Using Git Bash

```bash
# From project root
bash deployment/deploy-backend-only.sh
```

Or with custom parameters:
```bash
bash deployment/deploy-backend-only.sh 129.151.163.95 ~/.ssh/oci_instance_key ubuntu
```

### Option 2: Using PowerShell

```powershell
# From project root
.\deployment\deploy-backend-only.ps1
```

Or with custom parameters:
```powershell
.\deployment\deploy-backend-only.ps1 -ServerIP 129.151.163.95 -SSHKey $env:USERPROFILE\.ssh\oci_instance_key
```

## Manual Steps

If you prefer to deploy manually:

### 1. Connect to Server

```bash
ssh -i ~/.ssh/oci_instance_key ubuntu@129.151.163.95
```

### 2. Initial Server Setup (First Time Only)

```bash
# Run the setup script
bash ~/NUMZGPS/deployment/oci-server-setup.sh

# Log out and back in for Docker group changes
exit
# Then SSH back in
```

### 3. Configure Environment

```bash
cd ~/NUMZGPS/backend
cp env.template .env
nano .env
```

**Set these important values:**
```env
MYSQL_ROOT_PASSWORD=YourStrongPassword123!
MYSQL_PASSWORD=YourStrongPassword123!
POSTGRES_PASSWORD=YourStrongPassword123!
```

### 4. Set Up SSL Certificates

**Option A: Self-Signed (Testing)**
```bash
cd ~/NUMZGPS/backend
openssl req -x509 -newkey rsa:4096 -nodes \
  -keyout key.pem \
  -out cert.pem \
  -days 365 \
  -subj "/CN=localhost"
```

**Option B: Let's Encrypt (Production)**
```bash
sudo certbot certonly --standalone -d yourdomain.com
sudo cp /etc/letsencrypt/live/yourdomain.com/fullchain.pem ~/NUMZGPS/backend/cert.pem
sudo cp /etc/letsencrypt/live/yourdomain.com/privkey.pem ~/NUMZGPS/backend/key.pem
sudo chown $USER:$USER ~/NUMZGPS/backend/cert.pem ~/NUMZGPS/backend/key.pem
```

### 5. Deploy Services

```bash
cd ~/NUMZGPS
# Legacy script removed. Use the canonical Windows entrypoint from repo root:
#   .\release-prod.ps1
```

### 6. Verify Deployment

```bash
# Check containers
docker ps

# Test APIs
curl http://localhost:8082/api/server
curl http://localhost:3001/health

# View logs
docker-compose logs -f
```

## Backend API Endpoints

After deployment, your backend will be available at:

- **Traccar API**: `http://YOUR_SERVER_IP:8082`
- **Fuel API**: `http://YOUR_SERVER_IP:3001`

## Frontend Configuration

When you deploy your frontend separately (Netlify, Vercel, etc.), configure these environment variables:

```env
VITE_API_URL=http://YOUR_SERVER_IP:8082
# or with domain:
VITE_API_URL=https://yourdomain.com:8082

VITE_FUEL_API_URL=http://YOUR_SERVER_IP:3001
# or with domain:
VITE_FUEL_API_URL=https://yourdomain.com:3001

VITE_SOCKET_URL=ws://YOUR_SERVER_IP:8082
# or with domain and SSL:
VITE_SOCKET_URL=wss://yourdomain.com:8082
```

## CORS Configuration

Make sure your backend allows requests from your frontend domain. Update your backend CORS settings to include your frontend URL.

## Security Checklist

- [ ] Changed all default passwords in `.env`
- [ ] Configured firewall (UFW) - ports 8082, 3001, 3306, 5432
- [ ] Set up SSL certificates
- [ ] Configured OCI Security Lists
- [ ] Set up CORS for frontend domain
- [ ] Enabled automatic security updates

## Troubleshooting

### Services Won't Start

```bash
# Check logs
cd ~/NUMZGPS/backend
docker-compose logs

# Check disk space
df -h

# Check if ports are in use
sudo netstat -tlnp | grep -E '8082|3001|3306|5432'
```

### Can't Access APIs from Internet

1. Check OCI Security Lists (allow ports 8082, 3001)
2. Check UFW firewall: `sudo ufw status`
3. Verify services are running: `docker ps`

### Database Connection Issues

```bash
# Test MySQL
docker exec -it numztrak-mysql mysql -u traccar -p

# Test PostgreSQL
docker exec -it numztrak-postgres psql -U numztrak -d numztrak_fuel
```

## Maintenance

### Update Services

```bash
cd ~/NUMZGPS
git pull origin main
cd backend
docker-compose pull
docker-compose up -d
```

### View Logs

```bash
cd ~/NUMZGPS/backend
docker-compose logs -f                    # All services
docker-compose logs -f traccar-server     # Traccar only
docker-compose logs -f fuel-api          # Fuel API only
```

### Restart Services

```bash
cd ~/NUMZGPS/backend
docker-compose restart                    # Restart all
docker-compose restart traccar-server    # Restart specific
```

### Stop Services

```bash
cd ~/NUMZGPS/backend
docker-compose down                       # Stop and remove containers
```

## Next Steps

1. Deploy frontend to your chosen platform (Netlify, Vercel, etc.)
2. Configure frontend environment variables with backend URLs
3. Set up CORS on backend to allow frontend domain
4. Test the full application



