#!/bin/bash
# Idol Tracker 2026 - Local Crawler Automation Script
# Runs daily to fetch and analyze K-Pop comeback news using Ollama + Qwen3.

# Load environment variables
export PATH=/opt/homebrew/bin:/usr/local/bin:$PATH
cd /Users/gimtaehun/idol_tracker
source .env

echo "[$(date)] Starting Daily Precision Crawler..."
npx tsx scripts/daily_precision_crawler.ts >> .crawler.log 2>&1

# 2 (Tuesday) in `date +%u` means Tuesday
DAY_OF_WEEK=$(date +%u)
if [ "$DAY_OF_WEEK" -eq 2 ]; then
  echo "[$(date)] Starting Weekly Discovery Crawler..."
  npx tsx scripts/weekly_discovery_crawler.ts >> .crawler.log 2>&1
else
  echo "[$(date)] Skipping Weekly Discovery Crawler (runs only on Tuesday)." >> .crawler.log 2>&1
fi

echo "[$(date)] Running Daily DB Integrity Auditor..."
npx tsx scripts/db_auditor.ts >> .crawler.log 2>&1

echo "[$(date)] Crawling and Auditing completed."
