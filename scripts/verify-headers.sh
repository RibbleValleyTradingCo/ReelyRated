#!/bin/bash

echo "\U0001F512 Verifying Security Headers"
echo "=============================="

URL="${1:-https://reelyrated.vercel.app}"

echo "Testing: $URL"
echo ""

headers=(
  "Content-Security-Policy"
  "X-Frame-Options"
  "X-Content-Type-Options"
  "X-XSS-Protection"
  "Referrer-Policy"
  "Permissions-Policy"
  "Strict-Transport-Security"
)

missing=0
for header in "${headers[@]}"; do
  value=$(curl -sI "$URL" | grep -i "^$header:" | cut -d' ' -f2-)
  if [ -n "$value" ]; then
    echo "✅ $header: Present"
  else
    echo "❌ $header: MISSING"
    missing=$((missing + 1))
  fi
done

echo ""
if [ $missing -eq 0 ]; then
  echo "✅ All security headers present!"
else
  echo "⚠️  $missing headers missing"
fi
