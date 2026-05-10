FROM python:3.11-slim

WORKDIR /app

# Copy requirements first for caching
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy app
COPY . /app

# Ensure runtime data directory exists
RUN mkdir -p /app/data

ENV PYTHONUNBUFFERED=1

CMD ["python", "erb_scraper_final.py", "--mode", "schedule"]
