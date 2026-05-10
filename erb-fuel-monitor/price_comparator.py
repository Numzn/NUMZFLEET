#!/usr/bin/env python3
"""
Price comparison module for ERB Fuel Price Monitoring System
Copyright (c) 2024 [Your Name] - Zambian Fuel Price Monitoring
"""

import json
import os
from datetime import datetime
from typing import Dict, Any, Optional, Tuple
import logging
from config import Config
from storage import upload_file, download_file

class PriceComparator:
    """Handles price comparison and change detection."""
    
    def __init__(self):
        self.config = Config()
        self.logger = logging.getLogger(__name__)
        self.config.create_data_directory()
        # If S3 persistence enabled, try to download latest prices to local file
        try:
            if self.config.S3_ENABLED:
                download_file(self.config.PRICES_FILE)
        except Exception:
            self.logger.debug("S3 download skipped or failed")
    
    def load_previous_prices(self) -> Optional[Dict[str, str]]:
        """Load previously saved prices from file."""
        try:
            if os.path.exists(self.config.PRICES_FILE):
                with open(self.config.PRICES_FILE, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    return data.get('data', {})
            return None
        except Exception as e:
            self.logger.error(f"Error loading previous prices: {e}")
            return None
    
    def save_current_prices(self, prices: Dict[str, str]) -> bool:
        """Save current prices to file."""
        try:
            # Normalize and convert price strings to numeric values (floats) for consistent storage
            normalized = {}
            for k, v in prices.items():
                try:
                    normalized[k] = float(str(v).replace(',', '').strip())
                except Exception:
                    # Keep original if conversion fails
                    normalized[k] = v

            data = {
                "status": "success",
                "data": normalized,
                "timestamp": datetime.now().isoformat(),
                "message": "Prices saved successfully"
            }
            
            with open(self.config.PRICES_FILE, 'w', encoding='utf-8') as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
            
            self.logger.info("Current prices saved successfully")
            # Optionally upload to S3 for persistence
            try:
                if self.config.S3_ENABLED:
                    upload_file(self.config.PRICES_FILE)
            except Exception:
                self.logger.warning("S3 upload failed or skipped")
            return True
            
        except Exception as e:
            self.logger.error(f"Error saving current prices: {e}")
            return False
    
    def compare_prices(self, current_prices: Dict[str, str]) -> Tuple[bool, Dict[str, str], Dict[str, str]]:
        """
        Compare current prices with previous prices.
        Returns: (has_changes, old_prices, new_prices)
        """
        try:
            previous_prices = self.load_previous_prices()
            
            if previous_prices is None:
                self.logger.info("No previous prices found - first run")
                return False, {}, current_prices
            
            # Check for changes
            has_changes = False
            changes = {}
            
            for fuel_type in self.config.FUEL_TYPES:
                current_price_raw = current_prices.get(fuel_type)
                previous_price_raw = previous_prices.get(fuel_type)

                # Normalize to numeric for comparison
                try:
                    current_price = float(str(current_price_raw).replace(',', '').strip()) if current_price_raw is not None else None
                except Exception:
                    current_price = None

                try:
                    previous_price = float(str(previous_price_raw).replace(',', '').strip()) if previous_price_raw is not None else None
                except Exception:
                    previous_price = None

                if current_price is not None and previous_price is not None:
                    if abs(current_price - previous_price) > 0.0001:
                        has_changes = True
                        changes[fuel_type] = {
                            'old': previous_price,
                            'new': current_price,
                            'change': round(current_price - previous_price, 2)
                        }
                        self.logger.info(f"Price change detected for {fuel_type}: {previous_price} -> {current_price}")
            
            if has_changes:
                self.logger.info(f"Price changes detected: {len(changes)} fuel types")
                return True, previous_prices, current_prices
            else:
                self.logger.info("No price changes detected")
                return False, previous_prices, current_prices
                
        except Exception as e:
            self.logger.error(f"Error comparing prices: {e}")
            return False, {}, current_prices
    
    def _calculate_change(self, old_price: str, new_price: str) -> float:
        """Calculate the change in price."""
        try:
            old_val = float(old_price)
            new_val = float(new_price)
            return new_val - old_val
        except ValueError:
            return 0.0
    
    def get_price_summary(self, prices: Dict[str, str]) -> str:
        """Get a formatted summary of current prices."""
        summary = "Current ERB Fuel Prices:\n"
        summary += "=" * 30 + "\n"
        
        for fuel_type in self.config.FUEL_TYPES:
            price = prices.get(fuel_type, "N/A")
            summary += f"{fuel_type:12}: {price} ZMW\n"
        
        summary += f"\nLast updated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"
        return summary
    
    def get_change_summary(self, old_prices: Dict[str, str], new_prices: Dict[str, str]) -> str:
        """Get a formatted summary of price changes."""
        summary = "ERB Fuel Price Changes:\n"
        summary += "=" * 30 + "\n"
        
        for fuel_type in self.config.FUEL_TYPES:
            old_price = old_prices.get(fuel_type, "N/A")
            new_price = new_prices.get(fuel_type, "N/A")
            
            if old_price != "N/A" and new_price != "N/A":
                try:
                    old_val = float(old_price)
                    new_val = float(new_price)
                    change = new_val - old_val
                    change_str = f"{change:+.2f}"
                except ValueError:
                    change_str = "N/A"
            else:
                change_str = "N/A"
            
            summary += f"{fuel_type:12}: {old_price} -> {new_price} ({change_str})\n"
        
        summary += f"\nUpdated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"
        return summary
