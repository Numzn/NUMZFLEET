# OCI server access (Windows + automated checks)

Use this when you need a **repeatable** login fix or a **non-interactive** health check from Cursor/PowerShell (same mechanics as Git Bash).

## One-time or “key permission broke” (PowerShell)

```powershell
$key = "$env:USERPROFILE\.ssh\oci_instance_key.pem"
icacls $key /inheritance:r
icacls $key /remove "Everyone" "Users" "Authenticated Users" "BUILTIN\Administrators" "NT AUTHORITY\SYSTEM" 2>$null
icacls $key /grant:r "$(whoami):(R)"
```

Expected on the key file: only your user with `(R)` (read).

## Interactive shell (Git Bash — daily use)

Replace host if your instance IP changes.

```bash
ssh -o StrictHostKeyChecking=accept-new -i ~/.ssh/oci_instance_key.pem ubuntu@YOUR_OCI_PUBLIC_IP
```

## Saved shortcut (recommended)

This repo includes a reusable shortcut script for production login:

```bash
bash deployment/ssh-prod.sh
```

Defaults in the script:

- Host: `129.151.163.95`
- User: `ubuntu`
- Key: `~/.ssh/oci_instance_key.pem`

Optional overrides:

```bash
OCI_PROD_HOST=YOUR_OCI_PUBLIC_IP OCI_PROD_USER=ubuntu OCI_PROD_KEY=~/.ssh/oci_instance_key.pem bash deployment/ssh-prod.sh
```

## Non-interactive check (PowerShell — confirms SSH + quick server state)

Uses Git for Windows OpenSSH. Fails fast if the key is wrong (`BatchMode=yes`).

```powershell
$ssh = "C:\Program Files\Git\usr\bin\ssh.exe"
$ip = "YOUR_OCI_PUBLIC_IP"
& $ssh -o StrictHostKeyChecking=accept-new -o BatchMode=yes -o ConnectTimeout=15 `
  -i "$env:USERPROFILE\.ssh\oci_instance_key.pem" "ubuntu@$ip" `
  "echo CONNECTED; whoami; hostname; docker ps --format '{{.Names}}' 2>/dev/null | head -8"
```

**Success:** prints `CONNECTED`, `ubuntu`, hostname, and some container names.  
**Failure:** fix ACLs (above), confirm IP and security list allows SSH from your network, confirm key path.

## Forward link (deploy)

Registry production flow (pull/up, env files): [REGISTRY_DEPLOY.md](REGISTRY_DEPLOY.md).
