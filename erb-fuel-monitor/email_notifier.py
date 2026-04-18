#!/usr/bin/env python3
"""
Email notification module for ERB Fuel Price Monitoring System.
"""

import smtplib
from datetime import datetime
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Any, Dict, Mapping
import logging

from config import Config


class EmailNotifier:
    """Handles email notifications for fuel prices and errors."""

    def __init__(self):
        self.config = Config()
        self.logger = logging.getLogger(__name__)

    def send_current_prices(self, prices: Dict[str, str]) -> bool:
        """Send current fuel prices to the configured recipient."""
        try:
            msg = MIMEMultipart()
            msg['From'] = self.config.EMAIL_FROM
            msg['To'] = self.config.EMAIL_TO
            msg['Subject'] = "ERB Fuel Prices - Zambia"

            timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
            rows = "".join(
                f"<tr><td style='padding:10px;border:1px solid #bdc3c7;font-weight:bold'>{fuel}</td>"
                f"<td style='padding:10px;text-align:center;border:1px solid #bdc3c7'>{prices.get(fuel, 'N/A')} ZMW</td></tr>"
                for fuel in self.config.FUEL_TYPES
            )

            body = f"""
            <html>
            <body style='font-family:Arial,sans-serif;max-width:600px;margin:0 auto'>
              <div style='background:#f8f9fa;padding:20px;border-radius:10px'>
                <h2 style='color:#2c3e50;text-align:center'>ERB Fuel Prices</h2>
                <p style='text-align:center;color:#7f8c8d'>{timestamp}</p>
                <table style='width:100%;border-collapse:collapse;margin:15px 0'>
                  <tr style='background:#ecf0f1'>
                    <th style='padding:10px;text-align:left;border:1px solid #bdc3c7'>Fuel Type</th>
                    <th style='padding:10px;text-align:center;border:1px solid #bdc3c7'>Price (ZMW)</th>
                  </tr>
                  {rows}
                </table>
                <p style='color:#27ae60'><strong>Source:</strong> erb.org.zm</p>
              </div>
            </body>
            </html>
            """

            msg.attach(MIMEText(body, 'html'))
            return self._send_email(msg)
        except Exception as e:
            self.logger.error(f"Error sending current prices email: {e}")
            return False

    def send_error_notification(self, error_message: str) -> bool:
        """Send email notification for system errors."""
        try:
            msg = MIMEMultipart()
            msg['From'] = self.config.EMAIL_FROM
            msg['To'] = self.config.EMAIL_TO
            msg['Subject'] = "ERB Monitoring Error - Zambia"

            body = f"""
            <html>
            <body>
                <h2>ERB Fuel Price Monitoring Error</h2>
                <p><strong>Time:</strong> {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}</p>
                <p><strong>Error:</strong> {error_message}</p>
            </body>
            </html>
            """
            msg.attach(MIMEText(body, 'html'))
            return self._send_email(msg)
        except Exception as e:
            self.logger.error(f"Error sending error notification: {e}")
            return False

    def send_price_change_notification(
        self,
        old_prices: Mapping[str, Any],
        new_prices: Mapping[str, Any],
    ) -> bool:
        """Alert when ERB prices differ from baseline or published snapshot (pending until midnight)."""
        try:
            msg = MIMEMultipart()
            msg["From"] = self.config.EMAIL_FROM
            msg["To"] = self.config.EMAIL_TO
            msg["Subject"] = "ERB Fuel Prices — Change detected (pending API publish)"

            timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

            def fmt(v: Any) -> str:
                if v is None:
                    return "N/A"
                try:
                    return f"{float(v):.2f}"
                except (TypeError, ValueError):
                    return str(v)

            rows = "".join(
                f"<tr><td style='padding:10px;border:1px solid #bdc3c7;font-weight:bold'>{fuel}</td>"
                f"<td style='padding:10px;text-align:center;border:1px solid #bdc3c7'>{fmt(old_prices.get(fuel))}</td>"
                f"<td style='padding:10px;text-align:center;border:1px solid #bdc3c7'>{fmt(new_prices.get(fuel))}</td></tr>"
                for fuel in self.config.FUEL_TYPES
            )

            body = f"""
            <html>
            <body style='font-family:Arial,sans-serif;max-width:640px;margin:0 auto'>
              <div style='background:#fff8e6;padding:20px;border-radius:10px;border:1px solid #f0ad4e'>
                <h2 style='color:#8a6d3b;text-align:center'>ERB price change detected</h2>
                <p style='text-align:center;color:#7f8c8d'>{timestamp}</p>
                <p style='color:#856404'>New prices are saved as <strong>pending</strong> and will be
                published to the API after midnight (Lusaka).</p>
                <table style='width:100%;border-collapse:collapse;margin:15px 0'>
                  <tr style='background:#fcf8e3'>
                    <th style='padding:10px;text-align:left;border:1px solid #e0c97f'>Fuel</th>
                    <th style='padding:10px;text-align:center;border:1px solid #e0c97f'>Previous</th>
                    <th style='padding:10px;text-align:center;border:1px solid #e0c97f'>Detected (ZMW)</th>
                  </tr>
                  {rows}
                </table>
                <p style='color:#27ae60'><strong>Source:</strong> erb.org.zm</p>
              </div>
            </body>
            </html>
            """

            msg.attach(MIMEText(body, "html"))
            return self._send_email(msg)
        except Exception as e:
            self.logger.error(f"Error sending change notification: {e}")
            return False

    def send_publish_notification(self, published_prices: Mapping[str, Any]) -> bool:
        """Sent after pending prices are promoted to the published file at midnight."""
        try:
            msg = MIMEMultipart()
            msg["From"] = self.config.EMAIL_FROM
            msg["To"] = self.config.EMAIL_TO
            msg["Subject"] = "ERB Fuel Prices — Published to API"

            timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

            def fmt(v: Any) -> str:
                if v is None:
                    return "N/A"
                try:
                    return f"{float(v):.2f}"
                except (TypeError, ValueError):
                    return str(v)

            rows = "".join(
                f"<tr><td style='padding:10px;border:1px solid #bdc3c7;font-weight:bold'>{fuel}</td>"
                f"<td style='padding:10px;text-align:center;border:1px solid #bdc3c7'>{fmt(published_prices.get(fuel))} ZMW</td></tr>"
                for fuel in self.config.FUEL_TYPES
            )

            body = f"""
            <html>
            <body style='font-family:Arial,sans-serif;max-width:600px;margin:0 auto'>
              <div style='background:#e8f8f0;padding:20px;border-radius:10px;border:1px solid #2ecc71'>
                <h2 style='color:#1e8449;text-align:center'>Published fuel prices</h2>
                <p style='text-align:center;color:#7f8c8d'>{timestamp}</p>
                <p style='color:#1e8449'>Pending prices were promoted to the live API file at midnight.</p>
                <table style='width:100%;border-collapse:collapse;margin:15px 0'>
                  <tr style='background:#d5f5e3'>
                    <th style='padding:10px;text-align:left;border:1px solid #a9dfbf'>Fuel Type</th>
                    <th style='padding:10px;text-align:center;border:1px solid #a9dfbf'>Price (ZMW)</th>
                  </tr>
                  {rows}
                </table>
              </div>
            </body>
            </html>
            """

            msg.attach(MIMEText(body, "html"))
            return self._send_email(msg)
        except Exception as e:
            self.logger.error(f"Error sending publish notification: {e}")
            return False

    def _send_email(self, msg: MIMEMultipart) -> bool:
        """Send email using SMTP."""
        try:
            server = smtplib.SMTP(self.config.SMTP_SERVER, self.config.SMTP_PORT)
            server.starttls()
            server.login(self.config.EMAIL_FROM, self.config.EMAIL_PASSWORD)
            server.sendmail(self.config.EMAIL_FROM, self.config.EMAIL_TO, msg.as_string())
            server.quit()
            self.logger.info(f"Email sent successfully to {self.config.EMAIL_TO}")
            return True
        except Exception as e:
            self.logger.error(f"Failed to send email: {e}")
            return False
