#!/usr/bin/env python3
"""
Configuration module for ERB Fuel Price Monitoring System
Copyright (c) 2024 [Your Name] - Zambian Fuel Price Monitoring
"""

import os

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    # python-dotenv is optional at import time; os env vars still work.
    pass

class Config:
    """Configuration settings for the ERB monitoring system."""
    
    # ERB Website Configuration
    ERB_URL = "https://www.erb.org.zm"
    USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    REQUEST_TIMEOUT = 30
    # SSL verification is controlled by environment variable and defaults to True.
    SSL_VERIFY = os.getenv('SSL_VERIFY', 'true').lower() in ('1', 'true', 'yes')
    # If certificate verification fails, optionally retry insecurely.
    SSL_ALLOW_INSECURE_FALLBACK = os.getenv('SSL_ALLOW_INSECURE_FALLBACK', 'true').lower() in ('1', 'true', 'yes')
    
    # Email Configuration
    EMAIL_ENABLED = os.getenv('EMAIL_ENABLED', 'true').lower() in ('1', 'true', 'yes')
    SMTP_SERVER = os.getenv("SMTP_SERVER", "smtp.gmail.com")
    SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
    EMAIL_FROM = os.getenv("EMAIL_FROM", "your-email@gmail.com")
    EMAIL_PASSWORD = os.getenv("EMAIL_PASSWORD", "your-app-password")
    EMAIL_TO = os.getenv("EMAIL_TO", "recipient@example.com")
    
    # File Paths
    DATA_DIR = "data"
    PRICES_FILE = os.path.join(DATA_DIR, "fuel_prices.json")
    PENDING_PRICES_FILE = os.path.join(DATA_DIR, "fuel_prices_pending.json")
    MONITOR_STATE_FILE = os.path.join(DATA_DIR, "monitor_state.json")
    LOG_FILE = os.path.join(DATA_DIR, "monitoring.log")

    # Lean monitor: Africa/Lusaka window, soft day-of-month guard, poll cadence
    MONITOR_TZ = os.getenv("MONITOR_TZ", "Africa/Lusaka")
    MONITOR_WINDOW_START = os.getenv("MONITOR_WINDOW_START", "15:00")
    MONITOR_WINDOW_END_HOUR = int(os.getenv("MONITOR_WINDOW_END_HOUR", "0"))  # midnight = 0
    MONITOR_POLL_MINUTES = int(os.getenv("MONITOR_POLL_MINUTES", "10"))
    MONITOR_MIN_DAY = int(os.getenv("MONITOR_MIN_DAY", "25"))
    # S3 / external storage configuration (optional)
    S3_ENABLED = os.getenv('S3_ENABLED', 'false').lower() in ('1', 'true', 'yes')
    S3_BUCKET = os.getenv('S3_BUCKET', '')
    S3_KEY = os.getenv('S3_KEY', 'fuel_prices.json')

    # When true (default), `--mode schedule` scrapes once at worker startup and refreshes
    # data/fuel_prices.json so erb-api serves current ERB prices after every container rebuild.
    ERB_STARTUP_REFRESH = os.getenv('ERB_STARTUP_REFRESH', 'true').lower() in ('1', 'true', 'yes')
    
    # Fuel Types to Monitor
    FUEL_TYPES = ["Petrol", "Diesel", "Kerosene", "Jet A-1"]
    
    @classmethod
    def create_data_directory(cls):
        """Create data directory if it doesn't exist."""
        if not os.path.exists(cls.DATA_DIR):
            os.makedirs(cls.DATA_DIR)
            print(f"Created data directory: {cls.DATA_DIR}")
    

