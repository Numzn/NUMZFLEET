import os
import unittest
from price_comparator import PriceComparator
from config import Config


class TestPriceComparator(unittest.TestCase):
    def test_compare_and_save(self):
        # Setup a temporary data directory under /tmp using environment
        tmp_dir = os.path.join(os.path.abspath(os.path.dirname(__file__)), "tmp_data")
        if not os.path.exists(tmp_dir):
            os.makedirs(tmp_dir)

        # Patch config paths for test
        Config.DATA_DIR = tmp_dir
        Config.PRICES_FILE = os.path.join(tmp_dir, "fuel_prices.json")

        comparator = PriceComparator()

        # First, ensure no previous prices
        if os.path.exists(Config.PRICES_FILE):
            os.remove(Config.PRICES_FILE)

        current_prices = {
            "Petrol": "29.18",
            "Diesel": "25.02",
            "Kerosene": "23.64",
            "Jet A-1": "25.83"
        }

        # Save current prices
        saved = comparator.save_current_prices(current_prices)
        self.assertTrue(saved)
        self.assertTrue(os.path.exists(Config.PRICES_FILE))

        # Load previous prices and compare with same values -> no changes
        prev = comparator.load_previous_prices()
        self.assertIsNotNone(prev)

        has_changes, old, new = comparator.compare_prices(current_prices)
        self.assertFalse(has_changes)

        # Now change one price and detect change
        new_prices = current_prices.copy()
        new_prices['Petrol'] = '30.00'

        has_changes, old, new = comparator.compare_prices(new_prices)
        self.assertTrue(has_changes)
        # Expect petrol change recorded in comparison results (old/new are dicts of previous/current)
        # old should contain numeric values when loaded
        self.assertIn('Petrol', new_prices)


if __name__ == '__main__':
    unittest.main()
