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
    
    def __init__(self, tick_function: Callable):
        self.logger = logging.getLogger(__name__)
        self.tick_function = tick_function
        self.is_running = False
        self.scheduler_thread = None
    
    def setup_schedule(self):
        """
        Drive the lean monitor with a 1-minute cadence.
        Window, day-of-month guard, and poll spacing are enforced inside tick() (Lusaka TZ).
        """
        schedule.every(1).minutes.do(self._run_tick).tag("tick")
        self.logger.info(
            "Scheduled monitor: 1-minute tick (lean window logic, see MONITOR_* env / Config)"
        )

    def _run_tick(self):
        try:
            result = self.tick_function()
            if isinstance(result, dict):
                action = result.get("action", "")
                if result.get("status") == "error":
                    self.logger.warning("Tick error: %s", result.get("message", result))
                elif action and action != "poll_wait":
                    self.logger.info("Tick: %s", action)
        except Exception as e:
            self.logger.error("Error in scheduled tick: %s", e)
    
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
                time.sleep(1)
        
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
        return self.tick_function()
    
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
