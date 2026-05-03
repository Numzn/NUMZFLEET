#!/usr/bin/env python3
"""
Lean monitor cycle: Lusaka window, persisted flags, detect vs publish.
"""
from __future__ import annotations

import json
import logging
import os
import tempfile
from dataclasses import asdict, dataclass
from datetime import datetime, timedelta
from typing import Any, Dict, Optional, Tuple

from zoneinfo import ZoneInfo

from config import Config

logger = logging.getLogger(__name__)


def _parse_hhmm(value: str) -> Tuple[int, int]:
    parts = value.strip().split(":")
    if len(parts) != 2:
        raise ValueError(f"Invalid time (expected HH:MM): {value!r}")
    return int(parts[0]), int(parts[1])


def _normalize_prices(prices: Dict[str, Any]) -> Dict[str, float]:
    out: Dict[str, float] = {}
    cfg = Config()
    for fuel in cfg.FUEL_TYPES:
        raw = prices.get(fuel)
        if raw is None:
            continue
        try:
            out[fuel] = float(str(raw).replace(",", "").strip())
        except (TypeError, ValueError):
            continue
    return out


def prices_differ(a: Optional[Dict[str, Any]], b: Optional[Dict[str, Any]]) -> bool:
    """True if normalized fuel maps differ meaningfully."""
    if not a and not b:
        return False
    if not a or not b:
        return True
    na = _normalize_prices(a)
    nb = _normalize_prices(b)
    cfg = Config()
    for fuel in cfg.FUEL_TYPES:
        va = na.get(fuel)
        vb = nb.get(fuel)
        if va is None and vb is None:
            continue
        if va is None or vb is None:
            return True
        if abs(va - vb) > 0.0001:
            return True
    return False


@dataclass
class MonitorState:
    window_date: Optional[str] = None
    monitor_active: bool = False
    price_detected: bool = False
    intraday_baseline: Optional[Dict[str, float]] = None
    last_poll_iso: Optional[str] = None
    last_midnight_key: Optional[str] = None
    last_error: Optional[str] = None

    def to_json(self) -> Dict[str, Any]:
        d = asdict(self)
        return d

    @classmethod
    def from_json(cls, data: Dict[str, Any]) -> MonitorState:
        return cls(
            window_date=data.get("window_date"),
            monitor_active=bool(data.get("monitor_active", False)),
            price_detected=bool(data.get("price_detected", False)),
            intraday_baseline=data.get("intraday_baseline"),
            last_poll_iso=data.get("last_poll_iso"),
            last_midnight_key=data.get("last_midnight_key"),
            last_error=data.get("last_error"),
        )


def _atomic_write_json(path: str, payload: Dict[str, Any]) -> None:
    os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
    fd, tmp = tempfile.mkstemp(
        dir=os.path.dirname(path) or ".", prefix=".tmp_", suffix=".json"
    )
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            json.dump(payload, f, indent=2, ensure_ascii=False)
        os.replace(tmp, path)
    finally:
        if os.path.exists(tmp):
            try:
                os.remove(tmp)
            except OSError:
                pass


def load_monitor_state(cfg: Optional[Config] = None) -> MonitorState:
    cfg = cfg or Config()
    path = cfg.MONITOR_STATE_FILE
    if not os.path.exists(path):
        return MonitorState()
    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        if not isinstance(data, dict):
            return MonitorState()
        return MonitorState.from_json(data)
    except (json.JSONDecodeError, OSError) as e:
        logger.warning("Could not load monitor state: %s", e)
        return MonitorState()


def save_monitor_state(state: MonitorState, cfg: Optional[Config] = None) -> None:
    cfg = cfg or Config()
    _atomic_write_json(cfg.MONITOR_STATE_FILE, state.to_json())


def load_published_prices_dict(cfg: Optional[Config] = None) -> Optional[Dict[str, Any]]:
    cfg = cfg or Config()
    path = cfg.PRICES_FILE
    if not os.path.exists(path):
        return None
    try:
        with open(path, "r", encoding="utf-8") as f:
            doc = json.load(f)
        if isinstance(doc, dict) and isinstance(doc.get("data"), dict):
            return doc["data"]
    except (json.JSONDecodeError, OSError) as e:
        logger.warning("Could not load published prices: %s", e)
    return None


def save_pending_prices(
    prices: Dict[str, Any],
    cfg: Optional[Config] = None,
    extra: Optional[Dict[str, Any]] = None,
) -> None:
    cfg = cfg or Config()
    normalized = _normalize_prices(prices)
    payload: Dict[str, Any] = {
        "status": "success",
        "data": normalized,
        "timestamp": datetime.now().isoformat(),
        "message": "Pending detection (not yet published to API)",
    }
    if extra:
        payload["_meta"] = extra
    _atomic_write_json(cfg.PENDING_PRICES_FILE, payload)


def promote_pending_to_published(
    price_comparator: Any,
    cfg: Optional[Config] = None,
) -> bool:
    """
    Copy pending file payload into published prices via PriceComparator.save_current_prices.
    Returns True if a promotion occurred.
    """
    cfg = cfg or Config()
    pending_path = cfg.PENDING_PRICES_FILE
    if not os.path.exists(pending_path):
        return False
    try:
        with open(pending_path, "r", encoding="utf-8") as f:
            doc = json.load(f)
    except (json.JSONDecodeError, OSError) as e:
        logger.error("Cannot read pending prices: %s", e)
        return False
    if not isinstance(doc, dict) or not isinstance(doc.get("data"), dict):
        return False
    data = doc["data"]
    # save_current_prices expects stringy or numeric values
    as_strings = {k: str(v) for k, v in data.items()}
    ok = price_comparator.save_current_prices(as_strings)
    if ok:
        try:
            os.remove(pending_path)
        except OSError:
            logger.warning("Could not remove pending file after promotion")
    return ok


class MonitorCycle:
    """One decision step for the lean monitor (call from scheduler or --mode once)."""

    def __init__(self, monitor: Any):
        self.monitor = monitor
        self.cfg = Config()
        self.logger = logging.getLogger(__name__)

    def _now_lusaka(self) -> datetime:
        return datetime.now(tz=ZoneInfo(self.cfg.MONITOR_TZ))

    def _window_start_today(self, d: date) -> datetime:
        h, m = _parse_hhmm(self.cfg.MONITOR_WINDOW_START)
        tz = ZoneInfo(self.cfg.MONITOR_TZ)
        return datetime(d.year, d.month, d.day, h, m, 0, tzinfo=tz)

    def _in_monitoring_evening(self, now: datetime) -> bool:
        """15:00–23:59:59 Lusaka (hour 0 handled separately for midnight)."""
        start = self._window_start_today(now.date())
        return now >= start

    def tick(self) -> Dict[str, Any]:
        """
        Returns a small result dict for logging (status, action).
        """
        force = str(os.getenv("MONITOR_FORCE", "")).strip().lower() in ("1", "true", "yes", "on")
        now = self._now_lusaka()
        today_str = now.date().isoformat()
        state = load_monitor_state(self.cfg)
        state.last_error = None

        # --- Midnight (full hour 0 Lusaka): finalize once per calendar date ---
        if now.hour == self.cfg.MONITOR_WINDOW_END_HOUR:
            if state.last_midnight_key != today_str:
                self._midnight_finalize(state, now)
                state.last_midnight_key = today_str
                state.window_date = None
                state.monitor_active = False
                state.intraday_baseline = None
                state.last_poll_iso = None
                state.price_detected = False
                save_monitor_state(state, self.cfg)
                return {"status": "ok", "action": "midnight_finalize"}

            save_monitor_state(state, self.cfg)
            return {"status": "ok", "action": "midnight_idle"}

        # --- Morning / before window ---
        if not force and not self._in_monitoring_evening(now):
            save_monitor_state(state, self.cfg)
            return {"status": "ok", "action": "outside_window"}

        # --- Soft day-of-month guard ---
        if not force and now.day < self.cfg.MONITOR_MIN_DAY:
            save_monitor_state(state, self.cfg)
            return {"status": "ok", "action": "guard_skip"}

        # --- Already detected this window; wait for midnight ---
        if state.price_detected and not state.monitor_active:
            save_monitor_state(state, self.cfg)
            return {"status": "ok", "action": "await_midnight"}

        published = load_published_prices_dict(self.cfg)

        # --- Open window: first scrape for this Lusaka calendar date ---
        if state.window_date != today_str:
            return self._window_open(state, now, today_str, published)

        # --- Active polling ---
        if state.monitor_active:
            return self._monitor_poll(state, now, published)

        save_monitor_state(state, self.cfg)
        return {"status": "ok", "action": "noop"}

    def _midnight_finalize(self, state: MonitorState, now: datetime) -> None:
        from storage import download_file

        if self.cfg.S3_ENABLED:
            try:
                download_file(self.cfg.PRICES_FILE)
            except Exception:
                self.logger.debug("S3 download at midnight skipped or failed")

        if os.path.exists(self.cfg.PENDING_PRICES_FILE):
            promoted = promote_pending_to_published(
                self.monitor.price_comparator, self.cfg
            )
            if promoted and self.cfg.EMAIL_ENABLED:
                self.monitor.email_notifier.send_publish_notification(
                    load_published_prices_dict(self.cfg) or {}
                )
            elif not promoted:
                self.logger.error("Midnight finalize: promotion failed")
        # If nothing pending, fail-safe no-op for API

    def _window_open(
        self,
        state: MonitorState,
        now: datetime,
        today_str: str,
        published: Optional[Dict[str, Any]],
    ) -> Dict[str, Any]:
        result = self.monitor.scrape_erb_prices()
        if result.get("status") != "success":
            msg = result.get("message", "scrape failed")
            state.last_error = msg
            save_monitor_state(state, self.cfg)
            if self.cfg.EMAIL_ENABLED:
                self.monitor.email_notifier.send_error_notification(msg)
            return {"status": "error", "action": "scrape", "message": msg}

        cur = result["data"]
        state.window_date = today_str

        if prices_differ(cur, published):
            self._on_detection(
                cur, {k: (published or {}).get(k) for k in self.cfg.FUEL_TYPES}, state, "window_open_vs_published"
            )
            save_monitor_state(state, self.cfg)
            return {"status": "ok", "action": "detected_at_open"}

        baseline = _normalize_prices(cur)
        state.intraday_baseline = baseline
        state.monitor_active = True
        state.last_poll_iso = now.isoformat()
        save_monitor_state(state, self.cfg)
        return {"status": "ok", "action": "window_open_monitor"}

    def _monitor_poll(
        self,
        state: MonitorState,
        now: datetime,
        published: Optional[Dict[str, Any]],
    ) -> Dict[str, Any]:
        last = state.last_poll_iso
        if last:
            try:
                last_dt = datetime.fromisoformat(last.replace("Z", "+00:00"))
                if last_dt.tzinfo is None:
                    last_dt = last_dt.replace(tzinfo=ZoneInfo(self.cfg.MONITOR_TZ))
            except ValueError:
                last_dt = now - timedelta(minutes=self.cfg.MONITOR_POLL_MINUTES)
        else:
            last_dt = now - timedelta(minutes=self.cfg.MONITOR_POLL_MINUTES)

        if (now - last_dt) < timedelta(minutes=self.cfg.MONITOR_POLL_MINUTES):
            save_monitor_state(state, self.cfg)
            return {"status": "ok", "action": "poll_wait"}

        result = self.monitor.scrape_erb_prices()
        if result.get("status") != "success":
            msg = result.get("message", "scrape failed")
            state.last_error = msg
            save_monitor_state(state, self.cfg)
            if self.cfg.EMAIL_ENABLED:
                self.monitor.email_notifier.send_error_notification(msg)
            return {"status": "error", "action": "scrape", "message": msg}

        cur = result["data"]
        state.last_poll_iso = now.isoformat()
        if not state.intraday_baseline:
            state.intraday_baseline = _normalize_prices(cur)
            save_monitor_state(state, self.cfg)
            return {"status": "ok", "action": "poll_rebaseline"}

        baseline = state.intraday_baseline

        if prices_differ(_normalize_prices(cur), baseline):
            old_for_email = {k: baseline.get(k) for k in self.cfg.FUEL_TYPES}
            self._on_detection(cur, old_for_email, state, "intraday_vs_baseline")
            save_monitor_state(state, self.cfg)
            return {"status": "ok", "action": "detected_poll"}

        save_monitor_state(state, self.cfg)
        return {"status": "ok", "action": "poll_no_change"}

    def _on_detection(
        self,
        new_prices: Dict[str, Any],
        old_prices: Dict[str, Any],
        state: MonitorState,
        reason: str,
    ) -> None:
        save_pending_prices(
            new_prices,
            self.cfg,
            extra={"reason": reason, "detected_at": datetime.now().isoformat()},
        )
        state.monitor_active = False
        state.price_detected = True
        state.intraday_baseline = None
        if self.cfg.EMAIL_ENABLED:
            self.monitor.email_notifier.send_price_change_notification(
                old_prices, new_prices
            )


def run_monitor_tick(monitor: Any) -> Dict[str, Any]:
    return MonitorCycle(monitor).tick()
