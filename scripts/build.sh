#!/bin/bash
# Create a browser extension release package
set -e

# Checks if jq is installed
if ! command -v jq >/dev/null 2>&1; then
  echo "jq is not installed. Please install jq before continuing."
  exit 1
fi

# 1. Capture browser type from argument
browserType=$1

# 2. Construct release zip filename
zipName=$browserType-release.zip

# 3. Ensure release directory exists (create if needed)
mkdir -p build/release/

# 4. Clean up any existing release zip
rm build/release/$browserType-release.zip

# 5. Rename base manifest file
cd src/ && mv manifest.json manifest.base.json
if [[ "$browserType" == "firefox" ]]; then
    faviconUrl='assets/images/favicon.icon'
    # Remove unnecessary properties for Firefox manifest
    jq 'del(.background.service_worker, .background.type)' manifest.base.json >manifest.json
else
    faviconUrl='https://www.courtlistener.com/static/ico/favicon.ico'
    # Remove unnecessary property for Chrome/Chromium manifest
    jq 'del(.background.scripts, .applications)' manifest.base.json >manifest.json
fi

# 6. Add search provider configuration to manifest
jq --arg favicon "$faviconUrl" '.chrome_settings_overrides.search_provider += {
  "name": "RECAP Archive",
  "search_url": "https://www.courtlistener.com/?type=r&q={searchTerms}&order_by=score+desc",
  "favicon_url": $favicon,
  "keyword": "recap",
  "encoding": "UTF-8",
  "is_default": false
}' manifest.json >manifest.tmp && mv manifest.tmp manifest.json

# 7. Create release package
# - Include all files except the base manifest
zip -rq $zipName * -x "*.base.json"

# 8. Move package to release directory
mv $zipName ../build/release

# 9. Remove Browser-Specific Manifest File
rm manifest.json
# Rename base manifest back to main manifest
mv manifest.base.json manifest.json
