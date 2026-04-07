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
    LOG_FILE = os.path.join(DATA_DIR, "monitoring.log")
    # S3 / external storage configuration (optional)
    S3_ENABLED = os.getenv('S3_ENABLED', 'false').lower() in ('1', 'true', 'yes')
    S3_BUCKET = os.getenv('S3_BUCKET', '')
    S3_KEY = os.getenv('S3_KEY', 'fuel_prices.json')
    
    # Fuel Types to Monitor
    FUEL_TYPES = ["Petrol", "Diesel", "Kerosene", "Jet A-1"]
    
    @classmethod
    def create_data_directory(cls):
        """Create data directory if it doesn't exist."""
        if not os.path.exists(cls.DATA_DIR):
            os.makedirs(cls.DATA_DIR)
            print(f"Created data directory: {cls.DATA_DIR}")
    

