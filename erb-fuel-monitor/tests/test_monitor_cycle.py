import json
import os
import unittest
from datetime import datetime
from unittest.mock import MagicMock, patch

from zoneinfo import ZoneInfo

from config import Config
from monitor_cycle import (
    MonitorCycle,
    MonitorState,
    load_monitor_state,
    promote_pending_to_published,
    save_monitor_state,
)
from price_comparator import PriceComparator


def _touch_published(path: str, data: dict) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    payload = {
        "status": "success",
        "data": data,
        "timestamp": "2020-01-01T00:00:00",
        "message": "test",
    }
    with open(path, "w", encoding="utf-8") as f:
        json.dump(payload, f)


class FakeMonitor:
    def __init__(self, scrape_sequence):
        self._seq = list(scrape_sequence)
        self.price_comparator = None  # set by test
        self.email_notifier = MagicMock()

    def scrape_erb_prices(self):
        if not self._seq:
            return {"status": "error", "message": "empty queue"}
        return self._seq.pop(0)


class TestMonitorCycle(unittest.TestCase):
    def setUp(self):
        self.tmp = os.path.join(os.path.dirname(__file__), "tmp_monitor")
        os.makedirs(self.tmp, exist_ok=True)
        Config.DATA_DIR = self.tmp
        Config.PRICES_FILE = os.path.join(self.tmp, "fuel_prices.json")
        Config.PENDING_PRICES_FILE = os.path.join(self.tmp, "fuel_prices_pending.json")
        Config.MONITOR_STATE_FILE = os.path.join(self.tmp, "monitor_state.json")
        Config.S3_ENABLED = False
        Config.MONITOR_TZ = "Africa/Lusaka"
        Config.MONITOR_MIN_DAY = 25
        Config.MONITOR_POLL_MINUTES = 10
        Config.MONITOR_WINDOW_START = "15:00"
        Config.MONITOR_WINDOW_END_HOUR = 0
        for p in (
            Config.PRICES_FILE,
            Config.PENDING_PRICES_FILE,
            Config.MONITOR_STATE_FILE,
        ):
            if os.path.exists(p):
                os.remove(p)

    def tearDown(self):
        for p in (
            Config.PRICES_FILE,
            Config.PENDING_PRICES_FILE,
            Config.MONITOR_STATE_FILE,
        ):
            if os.path.exists(p):
                os.remove(p)

    def _make(self, scrapes):
        m = FakeMonitor(scrapes)
        m.price_comparator = PriceComparator()
        return MonitorCycle(m)

    def test_outside_window_morning(self):
        cycle = self._make([])
        fixed = datetime(2026, 4, 18, 10, 0, tzinfo=ZoneInfo("Africa/Lusaka"))
        with patch.object(MonitorCycle, "_now_lusaka", return_value=fixed):
            r = cycle.tick()
        self.assertEqual(r.get("action"), "outside_window")

    def test_guard_skip_before_day_25(self):
        cycle = self._make([])
        fixed = datetime(2026, 4, 10, 16, 0, tzinfo=ZoneInfo("Africa/Lusaka"))
        with patch.object(MonitorCycle, "_now_lusaka", return_value=fixed):
            r = cycle.tick()
        self.assertEqual(r.get("action"), "guard_skip")

    def test_window_open_then_monitor_no_change(self):
        published = {"Petrol": 29.18, "Diesel": 25.02, "Kerosene": 23.64, "Jet A-1": 25.83}
        _touch_published(Config.PRICES_FILE, published)
        same = {k: f"{v:.2f}" for k, v in published.items()}
        cycle = self._make(
            [
                {"status": "success", "data": same},
            ]
        )
        cycle.monitor.price_comparator = PriceComparator()
        t_open = datetime(2026, 4, 28, 15, 5, tzinfo=ZoneInfo("Africa/Lusaka"))
        with patch.object(MonitorCycle, "_now_lusaka", return_value=t_open):
            r = cycle.tick()
        self.assertEqual(r.get("action"), "window_open_monitor")
        st = load_monitor_state()
        self.assertTrue(st.monitor_active)
        self.assertEqual(st.window_date, "2026-04-28")

    def test_detection_writes_pending(self):
        published = {"Petrol": 29.18, "Diesel": 25.02, "Kerosene": 23.64, "Jet A-1": 25.83}
        _touch_published(Config.PRICES_FILE, published)
        newp = {k: published[k] for k in published}
        newp["Petrol"] = 30.0
        new_strings = {k: f"{v:.2f}" for k, v in newp.items()}
        cycle = self._make([{"status": "success", "data": new_strings}])
        cycle.monitor.price_comparator = PriceComparator()
        t_open = datetime(2026, 4, 28, 15, 5, tzinfo=ZoneInfo("Africa/Lusaka"))
        with patch.object(MonitorCycle, "_now_lusaka", return_value=t_open):
            r = cycle.tick()
        self.assertEqual(r.get("action"), "detected_at_open")
        self.assertTrue(os.path.exists(Config.PENDING_PRICES_FILE))
        st = load_monitor_state()
        self.assertTrue(st.price_detected)
        self.assertFalse(st.monitor_active)
        cycle.monitor.email_notifier.send_price_change_notification.assert_called()

    def test_midnight_promotes_pending(self):
        published = {"Petrol": 29.18, "Diesel": 25.02, "Kerosene": 23.64, "Jet A-1": 25.83}
        _touch_published(Config.PRICES_FILE, published)
        pending_data = {**published, "Petrol": 31.0}
        with open(Config.PENDING_PRICES_FILE, "w", encoding="utf-8") as f:
            json.dump(
                {
                    "status": "success",
                    "data": pending_data,
                    "timestamp": "2026-04-28T18:00:00",
                    "message": "pending",
                },
                f,
            )
        save_monitor_state(
            MonitorState(
                window_date="2026-04-28",
                price_detected=True,
                monitor_active=False,
                last_midnight_key=None,
            )
        )
        comp = PriceComparator()
        cycle = self._make([])
        cycle.monitor.price_comparator = comp
        t_mid = datetime(2026, 4, 29, 0, 5, tzinfo=ZoneInfo("Africa/Lusaka"))
        with patch.object(MonitorCycle, "_now_lusaka", return_value=t_mid):
            r = cycle.tick()
        self.assertEqual(r.get("action"), "midnight_finalize")
        self.assertFalse(os.path.exists(Config.PENDING_PRICES_FILE))
        with open(Config.PRICES_FILE, "r", encoding="utf-8") as f:
            doc = json.load(f)
        self.assertAlmostEqual(doc["data"]["Petrol"], 31.0, places=2)
        cycle.monitor.email_notifier.send_publish_notification.assert_called()

    def test_intraday_poll_detects_change(self):
        published = {"Petrol": 29.18, "Diesel": 25.02, "Kerosene": 23.64, "Jet A-1": 25.83}
        _touch_published(Config.PRICES_FILE, published)
        same = {k: f"{v:.2f}" for k, v in published.items()}
        newp = {**published, "Petrol": 30.0}
        new_strings = {k: f"{v:.2f}" for k, v in newp.items()}
        cycle = self._make(
            [
                {"status": "success", "data": same},
                {"status": "success", "data": new_strings},
            ]
        )
        cycle.monitor.price_comparator = PriceComparator()
        t1 = datetime(2026, 4, 28, 15, 5, tzinfo=ZoneInfo("Africa/Lusaka"))
        with patch.object(MonitorCycle, "_now_lusaka", return_value=t1):
            self.assertEqual(cycle.tick().get("action"), "window_open_monitor")
        t2 = datetime(2026, 4, 28, 15, 20, tzinfo=ZoneInfo("Africa/Lusaka"))
        with patch.object(MonitorCycle, "_now_lusaka", return_value=t2):
            r2 = cycle.tick()
        self.assertEqual(r2.get("action"), "detected_poll")
        self.assertTrue(os.path.exists(Config.PENDING_PRICES_FILE))

    def test_poll_wait_within_interval(self):
        published = {"Petrol": 29.18, "Diesel": 25.02, "Kerosene": 23.64, "Jet A-1": 25.83}
        _touch_published(Config.PRICES_FILE, published)
        same = {k: f"{v:.2f}" for k, v in published.items()}
        cycle = self._make([{"status": "success", "data": same}])
        cycle.monitor.price_comparator = PriceComparator()
        t1 = datetime(2026, 4, 28, 15, 5, tzinfo=ZoneInfo("Africa/Lusaka"))
        with patch.object(MonitorCycle, "_now_lusaka", return_value=t1):
            cycle.tick()
        t2 = datetime(2026, 4, 28, 15, 8, tzinfo=ZoneInfo("Africa/Lusaka"))
        with patch.object(MonitorCycle, "_now_lusaka", return_value=t2):
            r2 = cycle.tick()
        self.assertEqual(r2.get("action"), "poll_wait")

    def test_promote_helper(self):
        published = {"Petrol": 1.0, "Diesel": 2.0, "Kerosene": 3.0, "Jet A-1": 4.0}
        _touch_published(Config.PRICES_FILE, published)
        with open(Config.PENDING_PRICES_FILE, "w", encoding="utf-8") as f:
            json.dump(
                {"status": "success", "data": {**published, "Petrol": 9.0}, "message": "x"},
                f,
            )
        comp = PriceComparator()
        self.assertTrue(promote_pending_to_published(comp))
        with open(Config.PRICES_FILE, "r", encoding="utf-8") as f:
            doc = json.load(f)
        self.assertAlmostEqual(doc["data"]["Petrol"], 9.0, places=2)


if __name__ == "__main__":
    unittest.main()
