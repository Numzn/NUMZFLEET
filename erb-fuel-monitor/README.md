# 🇿🇲 ERB Fuel Price Monitoring System - Zambia

[![Python](https://img.shields.io/badge/Python-3.7+-blue.svg)](https://python.org)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Zambia](https://img.shields.io/badge/Country-Zambia-red.svg)](https://en.wikipedia.org/wiki/Zambia)

An automated fuel price monitoring system for the Energy Regulation Board (ERB) of Zambia. It uses a **lean monitor** (Lusaka window, soft day-of-month guard) to detect price changes, notify promptly, and **publish** to the API file at midnight.

**Production source of truth (OCI and GitHub):** this app lives inside the **NUMZGPS** monorepo at [`erb-fuel-monitor`](https://github.com/Numzn/NUMZGPS/tree/main/erb-fuel-monitor). Deploy servers should pull that path on `main`; ship updates by committing under `erb-fuel-monitor/` in **Numzn/NUMZGPS**, not only in a separate standalone repo.

## ✨ Features

- 🔍 **Automated Price Scraping** - Extracts current fuel prices from ERB website
- 📅 **Smart Scheduling** - Lusaka afternoon window from `MONITOR_MIN_DAY` with bounded polling
- 📧 **Email Notifications** - Sends alerts when prices change or are maintained
- 📊 **Price Comparison** - Tracks changes between monitoring sessions
- 📝 **Comprehensive Logging** - Detailed logs for debugging and monitoring
- 🛡️ **Error Handling** - Robust error handling with email alerts
- ⚙️ **Configurable** - Easy configuration for email and scheduling settings

## 🚀 Quick Start

### Installation

1. **Clone the monorepo and enter this app**
   ```powershell
   git clone https://github.com/Numzn/NUMZGPS.git
   cd NUMZGPS\erb-fuel-monitor
   ```

2. **Install dependencies**
   ```powershell
   pip install -r requirements.txt
   ```

3. **Configure environment**
   ```powershell
   copy .env.example .env
   # Edit .env (email, MONITOR_*, API_TOKEN, S3_* as needed)
   ```

### Usage

#### Single lean-monitor tick
Runs one decision step (Lusaka window, soft day-of-month guard, pending vs published). Safe for GitHub Actions cron.

```powershell
python erb_scraper_final.py --mode once
```

#### Start scheduled worker
Runs a 1-minute scheduler loop; each tick applies window logic so the ERB site is only scraped during the monitoring window.

```powershell
python erb_scraper_final.py --mode schedule
```

## 📁 Project Structure

```
erb-fuel-monitor/
├── erb_scraper_final.py      # Main monitoring system
├── monitor_cycle.py          # Lean window state machine (Lusaka), detect vs publish
├── config.py                 # Configuration settings
├── price_comparator.py       # Price comparison logic
├── email_notifier.py         # Email notification system
├── scheduler.py              # 1-minute tick driver
├── requirements.txt          # Python dependencies
├── README.md                 # This file
└── data/                     # Data directory (created automatically)
    ├── fuel_prices.json      # Published prices (API reads this file)
    ├── fuel_prices_pending.json  # Detected prices until midnight publish
    ├── monitor_state.json    # Persisted window / monitor flags
    └── monitoring.log        # System logs
```

## ⚙️ Configuration

### Email Settings

1. Copy `config_template.py` to `config_local.py`
2. Update the following settings:

```python
EMAIL_FROM = "your-email@gmail.com"
EMAIL_PASSWORD = "your-app-password"  # Use Gmail App Password
EMAIL_TO = "recipient@example.com"
```

### Gmail Setup

1. Enable 2-Factor Authentication on your Gmail account
2. Generate an App Password:
   - Go to Google Account settings
   - Security → 2-Step Verification → App passwords
   - Generate password for "Mail"
3. Use the App Password in `config_local.py`

## 📊 Monitored Fuel Types

- **Petrol** - Regular gasoline
- **Diesel** - Diesel fuel
- **Kerosene** - Kerosene fuel
- **Jet A-1** - Aviation fuel (KKIA)

## 🕐 Scheduling (lean monitor)

All window boundaries use **`MONITOR_TZ`** (default **Africa/Lusaka**).

- **Soft day-of-month guard**: from the **`MONITOR_MIN_DAY`** of each month (default **25**), after **15:00** local, the first successful scrape establishes an intraday baseline. If prices already differ from the **published** file, a change is recorded immediately (pending + email), and aggressive polling stops.
- **Polling**: while in monitor mode, the ERB site is scraped at most every **`MONITOR_POLL_MINUTES`** (default **10**), only until **midnight** local.
- **Before 15:00** or on calendar days **before `MONITOR_MIN_DAY`**: no scrapes (idle or guard skip).
- **Midnight (hour 0)**: pending detection (if any) is promoted to **`fuel_prices.json`** (the file the API serves), then optional **publish** email. State resets for the next day.
- **Worker**: `python erb_scraper_final.py --mode schedule` runs a **1-minute** scheduler loop; each tick is cheap when outside the window.
- **Cron / Actions**: `python erb_scraper_final.py --mode once` runs a **single** tick; use a modest cron if multiple runners might overlap—prefer one primary runner and shared persistence (**S3**) if more than one host exists.

## 📧 Email Notifications

### Change detected (pending)
- Sent when scraped prices differ from the published snapshot at window open, or from the intraday baseline during polling.
- Explains that values are **pending** until midnight publish.

### Published at midnight
- Sent after pending prices are successfully promoted to the live **`fuel_prices.json`** (optional; respects `EMAIL_ENABLED`).

### Legacy “current prices” email
- The `monitor_prices()` helper (not used by the lean tick) can still send a one-off snapshot if you call it from custom code.

### Error Notifications
- Sent when a scrape fails or other errors occur (unchanged).

## 🔧 Advanced Usage

### Command Line Options

```powershell
# Single lean-monitor tick (cron-friendly)
python erb_scraper_final.py --mode once

# Continuous worker (1-minute scheduler loop)
python erb_scraper_final.py --mode schedule
```

### Running as a Service

#### Windows (Task Scheduler)
1. Open Task Scheduler
2. Create Basic Task
3. Set trigger to "At startup"
4. Action: Start a program
5. Program: `python`
6. Arguments: `C:\path\to\erb_scraper_final.py --mode schedule`

#### Linux (systemd)
```bash
# Create service file
sudo nano /etc/systemd/system/erb-monitor.service

# Add content:
[Unit]
Description=ERB Fuel Price Monitor
After=network.target

[Service]
Type=simple
User=yourusername
WorkingDirectory=/path/to/erb-fuel-monitor
ExecStart=/usr/bin/python3 erb_scraper_final.py --mode schedule
Restart=always

[Install]
WantedBy=multi-user.target

# Enable and start
sudo systemctl enable erb-monitor.service
sudo systemctl start erb-monitor.service
```

## 🐛 Troubleshooting

### Common Issues

1. **SSL Certificate Error**
   - System automatically handles SSL verification
   - Check internet connection

2. **Email Not Sending**
   - Verify email configuration
   - Check Gmail App Password
   - Confirm `EMAIL_ENABLED` and SMTP settings in the environment

3. **No Prices Found**
   - Check ERB website accessibility
   - Review debug files in data directory
   - Website structure may have changed

4. **Scheduling Not Working**
   - Confirm `MONITOR_TZ` (default Africa/Lusaka) matches your intent
   - Check `MONITOR_MIN_DAY`, `MONITOR_WINDOW_START`, and logs for `Tick: ...` actions
   - Review logs for errors

## ☁️ Deploying to Render (recommended)

You can deploy this project to Render either as a Background Worker (continuous scheduler) or as a Cron Job (recommended for scheduled runs). Below are instructions and recommended environment variables.

Recommended Render setup:
- Service type: "Background Worker" if you want an always-on scheduler, or "Cron Job" if you prefer Render to trigger `--mode once` on a schedule.
- Start command for Worker: `python erb_scraper_final.py --mode schedule`
- Cron command: `python erb_scraper_final.py --mode once`

Environment variables to set in Render (Dashboard → Environment):
- `EMAIL_FROM` - email address used to send notifications
- `EMAIL_PASSWORD` - SMTP password (use Gmail App Password)
- `EMAIL_TO` - recipient address for alerts
- `SMTP_SERVER` - SMTP host (default: smtp.gmail.com)
- `SMTP_PORT` - SMTP port (default: 587)
- `SSL_VERIFY` - set to `true` (default) to enable SSL verification
- `S3_ENABLED` - set to `true` if you want to persist `fuel_prices.json` to S3
- `S3_BUCKET` - name of the S3 bucket (if S3_ENABLED)
- `S3_KEY` - object key for prices file (default: fuel_prices.json)
- `MONITOR_TZ` - IANA timezone for the window (default: `Africa/Lusaka`)
- `MONITOR_WINDOW_START` - local start of window (default: `15:00`)
- `MONITOR_WINDOW_END_HOUR` - hour that starts the finalize window (default: `0` = midnight)
- `MONITOR_POLL_MINUTES` - minimum minutes between scrapes while monitoring (default: `10`)
- `MONITOR_MIN_DAY` - first calendar day of month to allow the afternoon window (default: `25`)

Deploy steps (from GitHub):
1. Push your changes under `erb-fuel-monitor/` in repo **`Numzn/NUMZGPS`** (`main`).
2. In Render, create a new service:
   - Connect GitHub repo **`Numzn/NUMZGPS`**
   - Set **Root directory** (or equivalent) to **`erb-fuel-monitor`** so build and start commands run from this folder.
   - Choose "Background Worker" (start command above) or "Cron Job" (command above).
   - Set environment variables in the Render Dashboard.
3. Deploy and watch the logs in Render.

### OCI (Oracle Cloud) and other VMs

Use the same code path: deploy from **`NUMZGPS`** at `erb-fuel-monitor/` (see [`deploy/systemd/`](deploy/systemd/) for example unit files). After `git pull` on the instance, restart the worker and API services so they pick up changes.

Notes:
- The repository now supports optional S3 persistence via `boto3` (install via `requirements.txt`). If `S3_ENABLED=true`, the app will try to download the latest `fuel_prices.json` at startup and upload it after saves.
- Logs are written to stdout/stderr so Render will capture them.
- Do NOT commit real credentials to `config_local.py`; always use Render Environment variables.

If you do NOT want to use AWS/S3 (for example, you plan to run purely on Render and don't wish to supply AWS credentials):

- Set `S3_ENABLED=false` (the default) in Render environment variables.
- The app will continue to store `data/fuel_prices.json` locally on the instance, but note that Render's filesystem is ephemeral — file contents may be lost on redeploys. For long-term persistence keep `S3_ENABLED=true` and configure an S3 bucket.



### Debug Files

- `data/monitoring.log` - System logs
- `erb_page_dump.txt` - Website content (if scraping fails)
- `data/fuel_prices.json` - Current price data

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 👨‍💻 Author

**[Your Name]** - Zambian Fuel Price Monitoring
- Country: Zambia
- Purpose: Automated fuel price monitoring and notification

## 🙏 Acknowledgments

- Energy Regulation Board (ERB) of Zambia for providing fuel price data
- Python community for excellent libraries
- Zambian developers for inspiration

## 📞 Support

For support, email [your-email@example.com] or create an issue on GitHub.

---

**🇿🇲 Made with ❤️ for Zambia**

## 🚀 Quick GitHub + Hosting guide

If you want to host this with minimal fuss, use GitHub + GitHub Actions to run the monitor and optionally build/push a container for AWS ECS.

1) **NUMZGPS monorepo (recommended):** clone **`Numzn/NUMZGPS`**, edit `erb-fuel-monitor/`, commit, and push to `main` (same tree OCI should pull):

```bash
git clone https://github.com/Numzn/NUMZGPS.git
cd NUMZGPS
# apply your changes under erb-fuel-monitor/
git add erb-fuel-monitor
git commit -m "erb-fuel-monitor: describe your update"
git push origin main
```

2) Add Secrets in repository **Numzn/NUMZGPS** (Settings → Secrets and variables → Actions) if workflows under `erb-fuel-monitor/.github` or repo root Actions need them:
- EMAIL_FROM
- EMAIL_PASSWORD (Gmail App Password if using Gmail)
- EMAIL_TO
- SMTP_SERVER (smtp.gmail.com)
- SMTP_PORT (587)
- GHCR_TOKEN (personal access token with write:packages) — for GHCR publishing

Optional (for AWS ECS deploy workflow):
- AWS_ACCESS_KEY_ID
- AWS_SECRET_ACCESS_KEY
- AWS_REGION
- ECR_REPOSITORY
- ECS_CLUSTER
- ECS_SERVICE

3) Enable Actions: the repo already contains workflows in `.github/workflows/`:
- `schedule-monitor.yml` — runs every 30 minutes and runs the script; commits `data/fuel_prices.json` to a `data` branch when it changes.
- `build-and-push-image.yml` — builds and pushes a Docker image to GHCR on push to `main`.
- `deploy-to-ecs.yml` — optional workflow that pushes to ECR and forces a new ECS deployment (requires AWS secrets).

4) Test workflows manually:
- Go to Actions -> select `ERB Monitor - scheduled` -> Run workflow (workflow_dispatch) to test a single run.

5) (Optional) Move persistence off-repo for production:
- For production, consider storing `fuel_prices.json` in S3 instead of committing to the repo. This avoids many small commits and keeps data out of git.

If you want, I can create the workflows and also prepare a short CloudFormation / Terraform snippet to create the ECR repo and ECS task definition.

### GitHub Actions: Scheduler and secrets

The repository includes a GitHub Actions workflow at `.github/workflows/scrape-schedule.yml` that can run the scraper on a cron schedule (default: daily at 15:00 UTC). To use it:

1. Add the following repository Secrets (Settings → Secrets & variables → Actions):
   - `EMAIL_ENABLED` (true/false)
   - `SMTP_HOST` (e.g. smtp.gmail.com)
   - `SMTP_PORT` (e.g. 587)
   - `SMTP_USER` (SMTP username)
   - `SMTP_PASS` (SMTP password or app password)

2. Trigger schedule manually from Actions or wait for the cron trigger.

3. Persistence: the workflow attempts to commit `data/fuel_prices.json` back to the repo when changed. For private repositories ensure the GITHUB_TOKEN has repo write permissions or provide a PAT with repo scope.

4. To change schedule time, edit the cron expression in `.github/workflows/scrape-schedule.yml`.

#### Reverting after testing

If you temporarily set the workflow to run every 30 minutes for testing, revert it for production by editing the cron entry in `.github/workflows/scrape-schedule.yml` back to the month-end schedule you prefer. For example:

```yaml
# Example: daily at 15:00 UTC (replace with month-end logic in your script)
- cron: '0 15 * * *'
```

Or implement month-end detection inside `erb_scraper_final.py` and keep the workflow daily but let the script decide whether to act.


