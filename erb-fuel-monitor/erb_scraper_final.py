#!/usr/bin/env python3
"""
ERB Fuel Price Scraper - Zambian Fuel Price Monitoring System
Copyright (c) 2024 [Your Name] - Zambian Fuel Price Monitoring
All rights reserved.

This software is designed to monitor fuel prices from the Energy Regulation Board (ERB) of Zambia.
It fetches current prices and sends email notifications.

Author: [Your Name]
Country: Zambia
Purpose: Automated fuel price monitoring and notification system
"""

import requests
from bs4 import BeautifulSoup
import re
import os
from datetime import datetime
import urllib3
import logging
import sys
import time
from config import Config
from price_comparator import PriceComparator
from email_notifier import EmailNotifier
from scheduler import ERBScheduler
from monitor_cycle import run_monitor_tick

# Disable SSL warnings
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# Setup logging
Config.create_data_directory()
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(Config.LOG_FILE),
        logging.StreamHandler(sys.stdout)
    ]
)

class ERBFuelPriceMonitor:
    """Main class for ERB Fuel Price Monitoring System."""
    
    def __init__(self):
        self.config = Config()
        self.price_comparator = PriceComparator()
        self.email_notifier = EmailNotifier()
        self.logger = logging.getLogger(__name__)
        self.config.create_data_directory()
    
    def scrape_erb_prices(self):
        """
        Scrapes the current fuel prices from the Energy Regulation Board (ERB) of Zambia website.
        Returns a dictionary with the status and the extracted data or error message.
        """
        url = self.config.ERB_URL
        headers = {'User-Agent': self.config.USER_AGENT}

        result = {
            "status": "success",
            "data": {},
            "timestamp": datetime.now().isoformat(),
            "message": ""
        }

        try:
            # 1. Fetch the Web Page
            self.logger.info(f"Fetching page: {url}")
            try:
                response = requests.get(
                    url,
                    headers=headers,
                    timeout=self.config.REQUEST_TIMEOUT,
                    verify=self.config.SSL_VERIFY,
                )
            except requests.exceptions.SSLError as ssl_error:
                if self.config.SSL_VERIFY and self.config.SSL_ALLOW_INSECURE_FALLBACK:
                    self.logger.warning(
                        "SSL verification failed for ERB site; retrying without certificate verification"
                    )
                    response = requests.get(
                        url,
                        headers=headers,
                        timeout=self.config.REQUEST_TIMEOUT,
                        verify=False,
                    )
                else:
                    raise ssl_error
            response.raise_for_status()

            # 2. Parse the HTML
            soup = BeautifulSoup(response.text, 'html.parser')
            
            # 3. Extract all text and use regex to find fuel prices
            all_text = soup.get_text()
            
            # Look for patterns like "29.18 Petrol" or "Petrol 29.18"
            patterns = [
                r'Petrol[^\d]*([\d]+\.[\d]+)',
                r'Diesel[^\d]*([\d]+\.[\d]+)',
                r'Kerosene[^\d]*([\d]+\.[\d]+)',
                r'Jet A-1[^\d]*([\d]+\.[\d]+)',
                r'([\d]+\.[\d]+)[^\w]*Petrol',
                r'([\d]+\.[\d]+)[^\w]*Diesel',
                r'([\d]+\.[\d]+)[^\w]*Kerosene',
                r'([\d]+\.[\d]+)[^\w]*Jet A-1',
            ]
            
            fuel_prices = {}
            
            for pattern in patterns:
                matches = re.findall(pattern, all_text, re.IGNORECASE)
                if matches:
                    # Normalize numeric string: remove commas, spaces and ensure two decimal places
                    raw = matches[0]
                    try:
                        # Clean common thousands separators and whitespace
                        cleaned = raw.replace(',', '').strip()
                        num = float(cleaned)
                        normalized = f"{num:.2f}"
                    except Exception:
                        normalized = raw.strip()

                    if "Petrol" in pattern:
                        fuel_prices["Petrol"] = normalized
                    elif "Diesel" in pattern:
                        fuel_prices["Diesel"] = normalized
                    elif "Kerosene" in pattern:
                        fuel_prices["Kerosene"] = normalized
                    elif "Jet A-1" in pattern:
                        fuel_prices["Jet A-1"] = normalized

            # 4. CHECK IF WE FOUND ANY DATA
            if fuel_prices:
                result["data"] = fuel_prices
                result["message"] = f"Successfully extracted {len(fuel_prices)} fuel prices"
                self.logger.info(f"Successfully extracted {len(fuel_prices)} fuel prices")
            else:
                result["status"] = "error"
                result["message"] = "No fuel prices found using regex patterns."
                with open('erb_page_dump.txt', 'w', encoding='utf-8') as f:
                    f.write(all_text)
                self.logger.error("No data found. Dumped page text to 'erb_page_dump.txt'")

        except requests.exceptions.RequestException as e:
            result["status"] = "error"
            result["message"] = f"Network/HTTP error occurred: {str(e)}"
            self.logger.error(f"Network error: {e}")
        except Exception as e:
            result["status"] = "error"
            result["message"] = f"An unexpected error occurred: {str(e)}"
            self.logger.error(f"Unexpected error: {e}")

        return result
    
    def tick(self):
        """Single lean-monitor step (Lusaka window, detect vs publish)."""
        return run_monitor_tick(self)

    def refresh_published_cache_from_erb(self) -> dict:
        """
        Scrape ERB once and write published fuel_prices.json (erb-api reads this file).
        Bypasses the Lusaka monitoring window. Does not send email — for deploy/restart refresh.
        """
        self.logger.info("Refreshing published price cache from ERB (startup refresh)...")
        result = self.scrape_erb_prices()
        if result.get("status") != "success":
            msg = result.get("message", "scrape failed")
            self.logger.warning("Startup cache refresh: scrape did not succeed: %s", msg)
            return result
        cur = result.get("data") or {}
        if not cur:
            self.logger.warning("Startup cache refresh: scrape returned no price data")
            return {"status": "error", "message": "no price data in scrape result"}
        # save_current_prices accepts stringy or numeric values
        as_strings = {k: str(v) for k, v in cur.items()}
        if not self.price_comparator.save_current_prices(as_strings):
            return {"status": "error", "message": "save_current_prices failed"}
        self.logger.info("Startup cache refresh: fuel_prices.json updated for API")
        return {"status": "success", "message": "cache_refreshed", "data": cur}

    def monitor_prices(self):
        """Fetch current ERB prices, save to published file, and email (legacy one-shot)."""
        try:
            self.logger.info("Fetching ERB fuel prices...")

            result = self.scrape_erb_prices()

            if result['status'] != 'success':
                self.logger.error(f"Scrape failed: {result['message']}")
                if self.config.EMAIL_ENABLED:
                    self.email_notifier.send_error_notification(result['message'])
                return result

            current_prices = result['data']
            self.price_comparator.save_current_prices(current_prices)

            if self.config.EMAIL_ENABLED:
                self.logger.info("Sending price email...")
                self.email_notifier.send_current_prices(current_prices)

            self.logger.info(self.price_comparator.get_price_summary(current_prices))
            return result

        except Exception as e:
            self.logger.error(f"Error: {e}")
            if self.config.EMAIL_ENABLED:
                self.email_notifier.send_error_notification(str(e))
            return {"status": "error", "message": str(e)}
    
    def start_scheduled_monitoring(self):
        """Start the scheduled monitoring system."""
        try:
            if self.config.ERB_STARTUP_REFRESH:
                self.refresh_published_cache_from_erb()
            else:
                self.logger.info("ERB_STARTUP_REFRESH disabled; skipping startup cache scrape")

            scheduler = ERBScheduler(self.tick)
            scheduler.start_scheduler()

            self.logger.info("Scheduled monitoring started")
            self.logger.info(f"Next run: {scheduler.get_next_run()}")

            self.logger.info("Running recovery tick on startup...")
            self.tick()

            return scheduler
            
        except Exception as e:
            self.logger.error(f"Error starting scheduled monitoring: {e}")
            return None

if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description='ERB Fuel Price Monitoring System - Zambia')
    parser.add_argument(
        '--mode',
        choices=['once', 'schedule'],
        default='once',
        help='once = one lean-monitor tick; schedule = 1-min tick loop (Lusaka window in code)',
    )
    
    args = parser.parse_args()
    
    # Initialize the monitoring system
    monitor = ERBFuelPriceMonitor()
    
    print("ERB Fuel Price Monitoring System - Zambia")
    print("=" * 50)
    
    if args.mode == 'once':
        print("Running single lean-monitor tick...")
        # One-off runs should be able to scrape immediately (bypass Lusaka window guard).
        os.environ["MONITOR_FORCE"] = "true"
        result = monitor.tick()
        print(f"Tick result: {result}")
        # One-off runs should publish immediately if a pending file exists (don't wait for midnight).
        try:
            from monitor_cycle import promote_pending_to_published
            promoted = promote_pending_to_published(monitor.price_comparator)
            if promoted:
                print("✅ Published prices immediately (promoted pending → published).")
        except Exception as e:
            print(f"⚠️ Could not promote pending prices: {e}")
        if result.get('status') == 'error':
            print(f"\n❌ Error: {result.get('message', result)}")
    
    elif args.mode == 'schedule':
        print("Starting scheduled monitoring...")
        print("1-minute scheduler tick; ERB scrapes only inside Lusaka window (see README / Config)")
        print("Press Ctrl+C to stop...")
        
        scheduler = monitor.start_scheduled_monitoring()
        if scheduler:
            try:
                last_heartbeat = 0.0
                while True:
                    time.sleep(60)  # Keep running
                    now_ts = time.time()
                    if now_ts - last_heartbeat >= 300:
                        print(f"Still running. Next run: {scheduler.get_next_run()}")
                        last_heartbeat = now_ts
            except KeyboardInterrupt:
                print("\nStopping scheduled monitoring...")
                scheduler.stop_scheduler()
                print("Monitoring stopped.")
        else:
            print("Failed to start scheduled monitoring.")
    
