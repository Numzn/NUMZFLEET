#!/usr/bin/env python3
"""
Email notification module for ERB Fuel Price Monitoring System.
"""

import smtplib
from datetime import datetime
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Dict
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
