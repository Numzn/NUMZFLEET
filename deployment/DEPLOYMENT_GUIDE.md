# NumzTrak OCI Deployment Guide

Complete guide for deploying NumzTrak Fleet Management System on Oracle Cloud Infrastructure (OCI).

## Prerequisites

- OCI Ubuntu instance (Ubuntu 20.04 or 22.04 recommended)
- SSH access to the instance
- Domain name (optional, for SSL certificates)
- Git repository access

## Quick Start

### 1. Connect to Your OCI Instance

```bash
ssh -i ~/.ssh/oci_instance_key ubuntu@129.151.163.95
```

### 2. Initial Server Setup

Run the automated setup script:

```bash
# From this repo checkout (recommended layout: ~/NUMZFLEET on the server):
bash deployment/oci-server-setup.sh
```

Or manually follow the steps in the script.

**Important:** After Docker installation, log out and back in (or run `newgrp docker`) for group changes to take effect.

### 3. Clone Repository

```bash
cd ~
git clone https://github.com/Numzn/NUMZGPS.git
cd NUMZGPS
```

Note: legacy `deployment/oci-deploy.sh` has been removed to avoid conflicting deploy paths. Use `.\release-prod.ps1` (Windows) for production releases.

### 4. Configure Environment

```bash
cd backend
cp env.template .env
nano .env
```

**Critical environment variables to set:**

```env
# Use STRONG passwords in production!
MYSQL_ROOT_PASSWORD=YourStrongRootPassword123!
MYSQL_PASSWORD=YourStrongTraccarPassword123!
POSTGRES_PASSWORD=YourStrongPostgresPassword123!
```

### 5. Set Up SSL Certificates

**Option A: Let's Encrypt (Production)**

```bash
# Install certbot if not already installed
sudo apt install -y certbot python3-certbot-nginx

# Get certificate (replace with your domain)
sudo certbot certonly --standalone -d yourdomain.com -d www.yourdomain.com

# Copy certificates to backend directory
sudo cp /etc/letsencrypt/live/yourdomain.com/fullchain.pem backend/cert.pem
sudo cp /etc/letsencrypt/live/yourdomain.com/privkey.pem backend/key.pem
sudo chown $USER:$USER backend/cert.pem backend/key.pem
```

**Option B: Self-Signed (Testing)**

```bash
cd backend
openssl req -x509 -newkey rsa:4096 -nodes \
  -keyout key.pem \
  -out cert.pem \
  -days 365 \
  -subj "/CN=yourdomain.com"
```

### 6. Deploy Backend Services

```bash
# Legacy script removed. Use the canonical Windows entrypoint from repo root:
#   .\release-prod.ps1
```

Or manually:

```bash
cd backend
docker-compose up -d
docker-compose ps
docker-compose logs -f
```

### 7. Verify Deployment

```bash
# Check containers
docker ps

# Test APIs
curl http://localhost:8082/api/server
curl http://localhost:3001/health

# Check logs
docker-compose logs traccar-server
docker-compose logs fuel-api
```

## Frontend Deployment

See [FRONTEND_DEPLOYMENT.md](./FRONTEND_DEPLOYMENT.md) for detailed frontend deployment options.

### Quick Frontend Deployment (Same Server)

```bash
cd ~/NUMZGPS/traccar-fleet-system/frontend
npm install
npm run build

# Copy to nginx
sudo cp -r dist/* /var/www/html/
sudo systemctl restart nginx
```

## Network Configuration

### OCI Security Lists

Ensure these ports are open in your OCI Security List:

- **22** - SSH
- **80** - HTTP
- **443** - HTTPS
- **8082** - Traccar HTTP API
- **8443** - Traccar HTTPS API
- **5001-5020** - GPS Protocol ports (if needed)
- **5055** - OsmAnd protocol

### Firewall (UFW)

The setup script configures UFW automatically. To manually configure:

```bash
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 8082/tcp
sudo ufw allow 8443/tcp
sudo ufw enable
```

## Nginx Reverse Proxy (Optional)

For production, set up Nginx as a reverse proxy:

```nginx
# /etc/nginx/sites-available/numztrak
server {
    listen 80;
    server_name yourdomain.com;
    
    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    # Frontend
    location / {
        root /var/www/html;
        try_files $uri $uri/ /index.html;
    }

    # Traccar API
    location /api/ {
        proxy_pass http://localhost:8082;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # WebSocket support
    location /socket.io/ {
        proxy_pass http://localhost:8082;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }

    # Fuel API
    location /fuel-api/ {
        proxy_pass http://localhost:3001/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

Enable the site:

```bash
sudo ln -s /etc/nginx/sites-available/numztrak /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
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
cd backend
docker-compose logs -f                    # All services
docker-compose logs -f traccar-server     # Traccar only
docker-compose logs -f fuel-api          # Fuel API only
```

### Restart Services

```bash
cd backend
docker-compose restart                    # Restart all
docker-compose restart traccar-server    # Restart specific service
```

### Stop Services

```bash
cd backend
docker-compose down                       # Stop and remove containers
docker-compose down -v                    # Also remove volumes (⚠️ deletes data!)
```

### Backup Databases

```bash
# MySQL backup
docker exec numztrak-mysql mysqldump -u traccar -p traccar > backup_mysql_$(date +%Y%m%d).sql

# PostgreSQL backup
docker exec numztrak-postgres pg_dump -U numztrak numztrak_fuel > backup_postgres_$(date +%Y%m%d).sql
```

## Troubleshooting

### Services Won't Start

```bash
# Check logs
docker-compose logs

# Check disk space
df -h

# Check memory
free -h

# Check if ports are in use
sudo netstat -tlnp | grep -E '8082|3001|3306|5432'
```

### Can't Access from Internet

1. Check OCI Security Lists (allow ports)
2. Check UFW firewall: `sudo ufw status`
3. Check if services are listening: `sudo netstat -tlnp`
4. Verify service is running: `docker ps`

### Database Connection Issues

```bash
# Test MySQL connection
docker exec -it numztrak-mysql mysql -u traccar -p

# Test PostgreSQL connection
docker exec -it numztrak-postgres psql -U numztrak -d numztrak_fuel

# Check database logs
docker-compose logs traccar-mysql
docker-compose logs fuel-postgres
```

### SSL Certificate Issues

```bash
# Renew Let's Encrypt certificate
sudo certbot renew

# Test certificate
openssl x509 -in backend/cert.pem -text -noout
```

## Security Checklist

- [ ] Changed all default passwords in `.env`
- [ ] Configured firewall (UFW)
- [ ] Set up SSL certificates
- [ ] Enabled automatic security updates
- [ ] Configured fail2ban
- [ ] Disabled root SSH login
- [ ] Set up SSH key authentication only
- [ ] Configured OCI Security Lists
- [ ] Set up regular backups
- [ ] Reviewed and restricted exposed ports

## Monitoring

### System Resources

```bash
# CPU and memory
htop

# Disk usage
df -h
du -sh ~/NUMZGPS/data/*

# Docker stats
docker stats
```

### Service Health

```bash
# Check all services
docker-compose ps

# Health checks
docker inspect numztrak-mysql | grep -A 10 Health
docker inspect numztrak-postgres | grep -A 10 Health
```

## Support

For issues or questions:
- Check logs: `docker-compose logs`
- Review documentation in project root
- Check GitHub issues: https://github.com/Numzn/NUMZGPS/issues

