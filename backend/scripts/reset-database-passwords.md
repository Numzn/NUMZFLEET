# Procedure to Reset Database Passwords

This guide explains how to reset database passwords when you have forgotten them, but have access to Docker containers.

All commands use `docker compose` **service names** from the repo-root `docker-compose.yml` (`db` = PostgreSQL, `traccar-mysql` = MySQL, `backend` = fuel-api, `traccar` = Traccar), so they work regardless of the generated container names. Run them from the repo root. If you must target a container directly, get its name from `docker compose ps` first.

## Prerequisites
- Docker containers must be running
- Access to the host machine where Docker is running
- Administrative access to the Docker host

---

## Method 1: Reset PostgreSQL Password

### Step 1: Stop the fuel-api container (to avoid connection issues)
```powershell
docker compose stop backend
```

### Step 2: Access PostgreSQL container and reset password
```powershell
# Connect to PostgreSQL as superuser (or use trust authentication)
docker compose exec -it db psql -U postgres

# In the PostgreSQL prompt, reset the password (match POSTGRES_PASSWORD in backend/.env):
ALTER USER numztrak WITH PASSWORD 'YOUR_POSTGRES_PASSWORD';

# Exit PostgreSQL
\q
```

**Alternative method if postgres user doesn't work:**
```powershell
# Check current user
docker compose exec db psql -U numztrak -d numztrak_fuel -c "\du"

# If you can't connect, you may need to:
# 1. Stop the container
docker compose stop db

# 2. Start it in single-user mode (requires modifying docker-compose temporarily)
# Or use docker run with environment variable override
```

### Step 3: Verify the password reset
```powershell
docker compose exec db psql -U numztrak -d numztrak_fuel -c "SELECT current_user;"
```

### Step 4: Restart fuel-api
```powershell
docker compose start backend
```

---

## Method 2: Reset MySQL Password

### Option A: Using root access (if root password is known)

```powershell
# Connect as root
docker compose exec -it traccar-mysql mysql -u root -p
# Enter root password when prompted

# Reset traccar user password (match MYSQL_PASSWORD in backend/.env and backend/conf/traccar.xml)
ALTER USER 'traccar'@'%' IDENTIFIED BY 'YOUR_MYSQL_PASSWORD';
FLUSH PRIVILEGES;

# Exit
EXIT;
```

### Option B: Reset via skip-grant-tables (most reliable when root password is also forgotten)

```powershell
# Step 1: Stop MySQL container
docker compose stop traccar-mysql

# Step 2: Back up the data volume (optional but recommended)
docker run --rm -v numzfleet_traccar_mysql_data:/data -v ${PWD}/backup:/backup alpine tar czf /backup/mysql-backup.tar.gz /data

# Step 3: Start a temporary MySQL on the same data volume with skip-grant-tables
docker run -d --name mysql-reset-temp `
  -v numzfleet_traccar_mysql_data:/var/lib/mysql `
  mysql:8.0 `
  --skip-grant-tables

# Step 4: Connect without password
docker exec -it mysql-reset-temp mysql -u root

# Step 5: Reset passwords (match backend/.env values)
USE mysql;
FLUSH PRIVILEGES;
ALTER USER 'root'@'localhost' IDENTIFIED BY 'YOUR_MYSQL_ROOT_PASSWORD';
ALTER USER 'traccar'@'%' IDENTIFIED BY 'YOUR_MYSQL_PASSWORD';
FLUSH PRIVILEGES;
EXIT;

# Step 6: Stop temp container and restart the real service
docker stop mysql-reset-temp
docker rm mysql-reset-temp
docker compose up -d traccar-mysql
```

---

## Method 3: Complete Reset (Nuclear Option - Deletes All Data)

**WARNING: This will delete all database data!** The databases live in named volumes (`numzfleet_postgres_data`, `numzfleet_traccar_mysql_data`), not bind-mounted folders.

### For PostgreSQL:
```powershell
# Stop containers
docker compose stop backend db
docker compose rm -f db

# Remove data volume
docker volume rm numzfleet_postgres_data

# Restart PostgreSQL (re-initializes with POSTGRES_PASSWORD from backend/.env)
docker compose up -d db
```

### For MySQL:
```powershell
# Stop containers
docker compose stop traccar traccar-mysql
docker compose rm -f traccar-mysql

# Remove data volume
docker volume rm numzfleet_traccar_mysql_data

# Restart MySQL (re-initializes with MYSQL_* passwords from backend/.env)
docker compose up -d traccar-mysql
```

---

## Method 4: Check Current Passwords from Environment Variables

Before resetting, check what passwords are currently configured:

```powershell
# Check PostgreSQL password
docker inspect $(docker compose ps -q db) | Select-String "POSTGRES_PASSWORD"

# Check MySQL passwords
docker inspect $(docker compose ps -q traccar-mysql) | Select-String "MYSQL.*PASSWORD"
```

Or simply read `backend/.env` — both compose stacks load it via `env_file`.

---

## Recommended Approach

Since the containers are running but passwords seem mismatched, try this:

### Step 1: Check actual passwords in use
See Method 4 above (or read `backend/.env`).

### Step 2: Try PostgreSQL password reset (usually easier)
```powershell
docker compose exec db psql -U postgres -c "ALTER USER numztrak WITH PASSWORD 'YOUR_POSTGRES_PASSWORD';"
```

### Step 3: For MySQL, if root access fails, check if Traccar container has the right password
Since the Traccar container connects successfully, the password might be correct but there's a permissions issue. Check:
```powershell
docker compose logs traccar | Select-String -Pattern "database|mysql|error" -Context 2
```

### Step 4: If MySQL user doesn't exist or password is wrong, recreate user
```powershell
# This requires root access - if root password doesn't work, use Method 2 Option B
docker compose exec -it traccar-mysql mysql -u root -p
```

Then in MySQL:
```sql
CREATE USER IF NOT EXISTS 'traccar'@'%' IDENTIFIED BY 'YOUR_MYSQL_PASSWORD';
GRANT ALL PRIVILEGES ON traccar.* TO 'traccar'@'%';
FLUSH PRIVILEGES;
```

---

## Verification After Reset

After resetting passwords, verify connections:

```powershell
# Test PostgreSQL
docker compose exec db psql -U numztrak -d numztrak_fuel -c "SELECT version();"

# Test MySQL (interactive prompt avoids leaking the password into shell history)
docker compose exec -it traccar-mysql mysql -u traccar -p -e "SELECT VERSION();"

# Check fuel-api logs
docker compose logs backend --tail 20
```

---

## Prevention for Future

1. **Document passwords**: Keep passwords in a secure password manager
2. **Use .env file**: Create `backend/.env` from `backend/.env.example` and store passwords there
3. **Version control**: Never commit `.env` file to git (it's already in .gitignore)
4. **Backup regularly**: Backup database volumes so you can restore if needed
