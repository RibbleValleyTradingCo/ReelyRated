#!/bin/bash

set -e

echo "Running TypeScript strict mode migration..."
echo "========================================\n"

rm -f type-errors.log

echo "Identifying type errors (log: type-errors.log)..."
npx tsc --noEmit 2>&1 | tee type-errors.log || true

echo "\nError Summary"
echo "-------------"
printf "TS2345 (argument type mismatches): %s\n" "$(grep -c 'TS2345' type-errors.log || echo 0)"
printf "TS7006 (implicit any params): %s\n" "$(grep -c 'TS7006' type-errors.log || echo 0)"
printf "TS2531 (possibly null/undefined): %s\n" "$(grep -c 'TS2531' type-errors.log || echo 0)"

echo "\nTop files with errors"
echo "---------------------"
grep "error TS" type-errors.log | cut -d'(' -f1 | sort | uniq -c | sort -rn | head -10 || echo "No errors logged."

echo "\nNext steps"
echo "-----------"
cat <<EOF
1. Fix utility/shared modules first (reduces downstream errors).
2. Update data layers (Supabase queries) with proper types.
3. Address component props and hooks.
4. Re-run this script to track progress.
EOF
