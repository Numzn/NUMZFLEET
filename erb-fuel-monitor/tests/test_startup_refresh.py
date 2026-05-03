"""Startup cache refresh: scrape + fuel_prices.json for erb-api after worker restart."""
import json
import os
import tempfile
import unittest
from unittest.mock import MagicMock

from config import Config
from erb_scraper_final import ERBFuelPriceMonitor
from price_comparator import PriceComparator


class TestStartupRefresh(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp()
        Config.DATA_DIR = self.tmp
        Config.PRICES_FILE = os.path.join(self.tmp, "fuel_prices.json")
        Config.PENDING_PRICES_FILE = os.path.join(self.tmp, "fuel_prices_pending.json")
        Config.MONITOR_STATE_FILE = os.path.join(self.tmp, "monitor_state.json")
        Config.S3_ENABLED = False
        for p in (Config.PRICES_FILE, Config.PENDING_PRICES_FILE, Config.MONITOR_STATE_FILE):
            if os.path.exists(p):
                os.remove(p)

    def tearDown(self):
        for p in (Config.PRICES_FILE, Config.PENDING_PRICES_FILE, Config.MONITOR_STATE_FILE):
            if os.path.exists(p):
                os.remove(p)
        try:
            os.rmdir(self.tmp)
        except OSError:
            pass

    def test_refresh_published_cache_writes_file(self):
        monitor = ERBFuelPriceMonitor()
        monitor.scrape_erb_prices = MagicMock(
            return_value={
                "status": "success",
                "data": {"Petrol": "29.18", "Diesel": "28.00", "Kerosene": "15.00", "Jet A-1": "12.00"},
            }
        )
        monitor.price_comparator = PriceComparator()
        result = monitor.refresh_published_cache_from_erb()
        self.assertEqual(result["status"], "success")
        self.assertTrue(os.path.isfile(Config.PRICES_FILE))
        with open(Config.PRICES_FILE, encoding="utf-8") as f:
            doc = json.load(f)
        self.assertEqual(doc["data"]["Petrol"], 29.18)
        self.assertEqual(doc["data"]["Diesel"], 28.0)


if __name__ == "__main__":
    unittest.main()
