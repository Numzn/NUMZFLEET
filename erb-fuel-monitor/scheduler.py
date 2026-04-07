#!/usr/bin/env python3
"""
Scheduler module for ERB Fuel Price Monitoring System
Copyright (c) 2024 [Your Name] - Zambian Fuel Price Monitoring
"""

import time
import schedule
import threading
from typing import Callable
import logging

class ERBScheduler:
    """Handles scheduling of ERB price monitoring tasks."""
    
    def __init__(self, scraper_function: Callable):
        self.logger = logging.getLogger(__name__)
        self.scraper_function = scraper_function
        self.is_running = False
        self.scheduler_thread = None
    
    def setup_schedule(self):
        """Schedule a daily price fetch and email at 08:00."""
        schedule.every().day.at("08:00").do(self._run).tag("daily")
        self.logger.info("Scheduled daily price check at 08:00")

    def _run(self):
        """Fetch prices and send email."""
        try:
            self.logger.info("Running scheduled ERB price check...")
            result = self.scraper_function()
            if result and result.get('status') == 'success':
                self.logger.info("Scheduled price check completed successfully")
            else:
                self.logger.warning(f"Scheduled price check failed: {result.get('message', 'Unknown error')}")
        except Exception as e:
            self.logger.error(f"Error in scheduled check: {e}")
    
    def start_scheduler(self):
        """Start the scheduler in a separate thread."""
        if self.is_running:
            self.logger.warning("Scheduler is already running")
            return
        
        self.setup_schedule()
        self.is_running = True
        
        def run_scheduler():
            while self.is_running:
                schedule.run_pending()
                time.sleep(60)  # Check every minute
        
        self.scheduler_thread = threading.Thread(target=run_scheduler, daemon=True)
        self.scheduler_thread.start()
        
        self.logger.info("ERB scheduler started successfully")
    
    def stop_scheduler(self):
        """Stop the scheduler."""
        self.is_running = False
        if self.scheduler_thread:
            self.scheduler_thread.join(timeout=5)
        
        schedule.clear()
        self.logger.info("ERB scheduler stopped")
    
    def run_immediate_check(self):
        """Run an immediate price check (for testing or manual execution)."""
        self.logger.info("Running immediate ERB price check...")
        return self.scraper_function()
    
    def get_next_run(self) -> str:
        """Return the next scheduled run time as a readable string."""
        upcoming = [j.next_run for j in schedule.jobs if j.next_run]
        if not upcoming:
            return "No jobs scheduled"
        return min(upcoming).strftime('%Y-%m-%d %H:%M:%S')
    
    def get_scheduler_status(self) -> dict:
        """Get current scheduler status."""
        return {
            'is_running': self.is_running,
            'scheduled_jobs': len(schedule.jobs),
            'next_run': self.get_next_run(),
        }
