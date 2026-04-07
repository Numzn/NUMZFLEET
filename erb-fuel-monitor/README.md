# 🇿🇲 ERB Fuel Price Monitoring System - Zambia

[![Python](https://img.shields.io/badge/Python-3.7+-blue.svg)](https://python.org)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Zambia](https://img.shields.io/badge/Country-Zambia-red.svg)](https://en.wikipedia.org/wiki/Zambia)

An automated fuel price monitoring system for the Energy Regulation Board (ERB) of Zambia. This system automatically checks for fuel price changes at month-end and sends email notifications.

## ✨ Features

- 🔍 **Automated Price Scraping** - Extracts current fuel prices from ERB website
- 📅 **Smart Scheduling** - Monitors prices on month-end days (15:00-00:00)
- 📧 **Email Notifications** - Sends alerts when prices change or are maintained
- 📊 **Price Comparison** - Tracks changes between monitoring sessions
- 📝 **Comprehensive Logging** - Detailed logs for debugging and monitoring
- 🛡️ **Error Handling** - Robust error handling with email alerts
- ⚙️ **Configurable** - Easy configuration for email and scheduling settings

## 🚀 Quick Start

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/erb-fuel-monitor.git
   cd erb-fuel-monitor
   ```

2. **Install dependencies**
   ```bash
   pip install -r requirements.txt
   ```

3. **Configure email settings**
   ```bash
   cp config_template.py config_local.py
   # Edit config_local.py with your email settings
   ```

### Usage

#### Single Price Check
```bash
python erb_scraper_final.py --mode once
```

#### Start Scheduled Monitoring
```bash
python erb_scraper_final.py --mode schedule
```

#### Test Email Configuration
```bash
python erb_scraper_final.py --email-test
```

## 📁 Project Structure

```
erb-fuel-monitor/
├── erb_scraper_final.py      # Main monitoring system
├── config.py                 # Configuration settings
├── price_comparator.py       # Price comparison logic
├── email_notifier.py         # Email notification system
├── scheduler.py              # Scheduling system
├── config_template.py        # Email configuration template
├── requirements.txt          # Python dependencies
├── README.md                 # This file
└── data/                     # Data directory (created automatically)
    ├── fuel_prices.json      # Current price data
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

## 🕐 Scheduling

The system automatically monitors prices on:
- **Month-end days** (30th for 31-day months, 29th for 30-day months, etc.)
- **Time window**: 15:00 to 00:00 (3 PM to midnight)
- **Frequency**: Every 30 minutes during monitoring window

## 📧 Email Notifications

### Price Change Notification
- Sent when fuel prices change
- Includes old vs new prices
- Shows price differences
- Beautiful HTML formatting

### No Change Notification
- Sent when prices are maintained
- Confirms system is working
- Shows current prices

### Error Notifications
- Sent when system errors occur
- Includes error details
- Helps with troubleshooting

## 🔧 Advanced Usage

### Command Line Options

```bash
# Single check
python erb_scraper_final.py --mode once

# Continuous monitoring
python erb_scraper_final.py --mode schedule

# Test mode
python erb_scraper_final.py --mode test

# Test email
python erb_scraper_final.py --email-test
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
   - Test with `--email-test` flag

3. **No Prices Found**
   - Check ERB website accessibility
   - Review debug files in data directory
   - Website structure may have changed

4. **Scheduling Not Working**
   - Check system time and timezone
   - Verify month-end date calculation
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

Deploy steps (from GitHub repo):
1. Push your changes to GitHub.
2. In Render, create a new service:
   - Connect your GitHub repo `Numzn/NumzERB`
   - Choose "Background Worker" (start command above) or "Cron Job" (command above).
   - Set environment variables in the Render Dashboard.
3. Deploy and watch the logs in Render.

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

1) Create a GitHub repository and push this project:

```bash
git init
git add .
git commit -m "Initial import"
git branch -M main
git remote add origin https://github.com/<your-username>/<repo-name>.git
git push -u origin main
```

2) Add Secrets in your repository (Settings → Secrets and variables → Actions):
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


