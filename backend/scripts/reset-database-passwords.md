# Procedure to Reset Database Passwords

> **Stack drift:** commands below use legacy container names (`numztrak-postgres`, `numztrak-fuel-api`, `numztrak-network`). On **repo root** compose, use **`db`** for Postgres, **`backend`** for fuel-api, and inspect `docker compose ps` for exact container names.

This guide explains how to reset database passwords when you have forgotten them, but have access to Docker containers.

## Prerequisites
- Docker containers must be running
- Access to the host machine where Docker is running
- Administrative access to the Docker host

---

## Method 1: Reset PostgreSQL Password

### Step 1: Stop the fuel-api container (to avoid connection issues)
```powershell
docker stop numztrak-fuel-api
```

### Step 2: Access PostgreSQL container and reset password
```powershell
# Connect to PostgreSQL as superuser (or use trust authentication)
docker exec -it numztrak-postgres psql -U postgres

# In the PostgreSQL prompt, reset the password:
ALTER USER numztrak WITH PASSWORD 'NumzFuel2025';

# Exit PostgreSQL
\q
```

**Alternative method if postgres user doesn't work:**
```powershell
# Check current user
docker exec numztrak-postgres psql -U numztrak -d numztrak_fuel -c "\du"

# If you can't connect, you may need to:
# 1. Stop the container
docker stop numztrak-postgres

# 2. Start it in single-user mode (requires modifying docker-compose temporarily)
# Or use docker run with environment variable override
```

### Step 3: Verify the password reset
```powershell
docker exec numztrak-postgres psql -U numztrak -d numztrak_fuel -c "SELECT current_user;"
```

### Step 4: Restart fuel-api
```powershell
docker start numztrak-fuel-api
```

---

## Method 2: Reset MySQL Password

### Option A: Using root access (if root password is known)

```powershell
# Connect as root
docker exec -it numztrak-mysql mysql -u root -p
# Enter root password when prompted

# Reset traccar user password
ALTER USER 'traccar'@'%' IDENTIFIED BY 'traccar123';
FLUSH PRIVILEGES;

# Exit
EXIT;
```

### Option B: If root password is also forgotten (using init container)

```powershell
# Step 1: Stop MySQL container
docker stop numztrak-mysql

# Step 2: Create a temporary container with MySQL client
docker run --rm -it --network numztrak-network --link numztrak-mysql:mysql mysql:8.0 mysql -h numztrak-mysql -u root -p

# If that doesn't work, we need to modify the container's authentication
```

### Option C: Reset via MySQL init file (most reliable)

```powershell
# Step 1: Stop MySQL container
docker stop numztrak-mysql

# Step 2: Back up the data volume (optional but recommended)
docker run --rm -v numztrak_mysql_data:/data -v ${PWD}/backup:/backup alpine tar czf /backup/mysql-backup.tar.gz /data

# Step 3: Start MySQL with skip-grant-tables (allows password-free access)
docker run -d --name numztrak-mysql-temp \
  -e MYSQL_ROOT_PASSWORD=temp \
  -v ../data/mysql:/var/lib/mysql \
  --network numztrak-network \
  mysql:8.0 \
  --skip-grant-tables

# Step 4: Connect without password
docker exec -it numztrak-mysql-temp mysql -u root

# Step 5: Reset passwords
USE mysql;
ALTER USER 'root'@'localhost' IDENTIFIED BY 'NumzTrak2025Root';
ALTER USER 'traccar'@'%' IDENTIFIED BY 'traccar123';
FLUSH PRIVILEGES;
EXIT;

# Step 6: Stop temp container and restart original
docker stop numztrak-mysql-temp
docker rm numztrak-mysql-temp
docker-compose up -d traccar-mysql
```

---

## Method 3: Complete Reset (Nuclear Option - Deletes All Data)

**WARNING: This will delete all database data!**

### For PostgreSQL:
```powershell
# Stop containers
docker stop numztrak-fuel-api numztrak-postgres

# Remove data volume
Remove-Item -Recurse -Force ..\data\fuel-postgres\*

# Restart PostgreSQL (will initialize with default password)
docker-compose up -d fuel-postgres
```

### For MySQL:
```powershell
# Stop containers
docker stop numztrak-traccar numztrak-mysql

# Remove data volume
Remove-Item -Recurse -Force ..\data\mysql\*

# Restart MySQL (will initialize with default password from docker-compose.yml)
docker-compose up -d traccar-mysql
```

---

## Method 4: Check Current Passwords from Environment Variables

Before resetting, check what passwords are currently configured:

```powershell
# Check PostgreSQL password
docker inspect numztrak-postgres | Select-String "POSTGRES_PASSWORD"

# Check MySQL passwords
docker inspect numztrak-mysql | Select-String "MYSQL.*PASSWORD"
```

---

## Recommended Approach for Your Situation

Since the containers are running but passwords seem mismatched, try this:

### Step 1: Check actual passwords in use
```powershell
docker inspect numztrak-postgres | Select-String "POSTGRES_PASSWORD"
docker inspect numztrak-mysql | Select-String "MYSQL.*PASSWORD"
```

### Step 2: Try PostgreSQL password reset (usually easier)
```powershell
docker exec numztrak-postgres psql -U postgres -c "ALTER USER numztrak WITH PASSWORD 'NumzFuel2025';"
```

### Step 3: For MySQL, if root access fails, check if Traccar container has the right password
Since Traccar container connects successfully, the password might be correct but there's a permissions issue. Check:
```powershell
docker logs numztrak-traccar | Select-String -Pattern "database|mysql|error" -Context 2
```

### Step 4: If MySQL user doesn't exist or password is wrong, recreate user
```powershell
# This requires root access - if root password doesn't work, use Method 3C
docker exec -it numztrak-mysql mysql -u root -pNumzTrak2025Root
```

Then in MySQL:
```sql
CREATE USER IF NOT EXISTS 'traccar'@'%' IDENTIFIED BY 'traccar123';
GRANT ALL PRIVILEGES ON traccar.* TO 'traccar'@'%';
FLUSH PRIVILEGES;
```

---

## Verification After Reset

After resetting passwords, verify connections:

```powershell
# Test PostgreSQL
docker exec numztrak-postgres psql -U numztrak -d numztrak_fuel -c "SELECT version();"

# Test MySQL
docker exec numztrak-mysql mysql -u traccar -ptraccar123 -e "SELECT VERSION();"

# Check fuel-api logs
docker logs numztrak-fuel-api --tail 20
```

---

## Prevention for Future

1. **Document passwords**: Keep passwords in a secure password manager
2. **Use .env file**: Create `.env` file from `env.template` and store passwords there
3. **Version control**: Never commit `.env` file to git (it's already in .gitignore)
4. **Backup regularly**: Backup database volumes so you can restore if needed

---

## Quick Reference: Default Passwords from docker-compose.yml

- **PostgreSQL**: `NumzFuel2025` (user: `numztrak`)
- **MySQL Root**: `NumzTrak2025Root`
- **MySQL Traccar User**: `traccar123` (user: `traccar`, database: `traccar`)

