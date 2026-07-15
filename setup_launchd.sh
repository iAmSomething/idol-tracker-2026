#!/bin/bash

PLIST_NAME="com.idoltracker.crawlers.plist"
PLIST_SRC="/Users/gimtaehun/idol_tracker/$PLIST_NAME"
LAUNCH_AGENTS_DIR="$HOME/Library/LaunchAgents"
PLIST_DEST="$LAUNCH_AGENTS_DIR/$PLIST_NAME"

echo "Copying $PLIST_NAME to $LAUNCH_AGENTS_DIR..."
mkdir -p "$LAUNCH_AGENTS_DIR"
cp "$PLIST_SRC" "$PLIST_DEST"

echo "Unloading existing launchd job if it exists..."
launchctl unload "$PLIST_DEST" 2>/dev/null

echo "Loading launchd job..."
launchctl load "$PLIST_DEST"

echo "✅ launchd setup complete! The crawlers will now run automatically at 18:30 every day and on boot."
echo "Logs can be found at /Users/gimtaehun/idol_tracker/.crawler.stdout.log and .crawler.stderr.log"
