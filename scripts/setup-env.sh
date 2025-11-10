#!/bin/bash

# ReelyRated Environment Setup Script
# This script helps developers set up their local .env file

set -e

echo "=== ReelyRated Environment Setup ==="
echo ""

# Check if .env already exists
if [ -f .env ]; then
    echo "✓ .env file already exists"
    read -p "Do you want to reconfigure it? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Keeping existing .env"
        exit 0
    fi
fi

# Ensure template exists
if [ ! -f .env.example ]; then
    echo "✗ Missing .env.example template. Please pull the latest repo or create it manually."
    exit 1
fi

# Create .env from template
echo "Creating .env from template..."
cp .env.example .env
echo "✓ Created .env file"
echo ""

# Prompt for Supabase credentials
echo "Please enter your Supabase credentials:"
echo "(You can find these in your Supabase dashboard under Settings → API Keys)"
echo ""

read -p "Supabase Project URL (https://...supabase.co): " SUPABASE_URL
read -p "Supabase Anon Key (eyJ...): " SUPABASE_ANON_KEY
read -p "Supabase Admin ID (optional, press Enter to skip): " SUPABASE_ADMIN_ID

# Update .env with user input
sed -i.bak "s|https://your-project-ref.supabase.co|$SUPABASE_URL|g" .env
sed -i.bak "s|eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...|$SUPABASE_ANON_KEY|g" .env
if [ -n "$SUPABASE_ADMIN_ID" ]; then
    sed -i.bak "s|VITE_SUPABASE_ADMIN_ID=|VITE_SUPABASE_ADMIN_ID=$SUPABASE_ADMIN_ID|g" .env
fi
rm -f .env.bak

echo ""
echo "✓ .env configured with your credentials"
echo ""

# Test connection (optional)
echo "Testing Supabase connection..."
node <<'NODE'
const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_ANON_KEY;

if (!url || !key) {
    console.error("✗ Missing Supabase credentials");
    process.exit(1);
}

if (!url.includes('supabase.co')) {
    console.error("✗ Invalid Supabase URL format");
    process.exit(1);
}

if (!key.startsWith('eyJ')) {
    console.error("✗ Invalid Supabase anon key format (should start with eyJ)");
    process.exit(1);
}

console.log("✓ Credentials format looks valid");
console.log(`✓ Project: ${url}`);
NODE

if [ $? -eq 0 ]; then
    echo ""
    echo "=== Setup Complete ==="
    echo "Your .env file is ready. You can now run: npm run dev"
else
    echo ""
    echo "⚠ There was an issue with your credentials. Please check them and try again."
    exit 1
fi
