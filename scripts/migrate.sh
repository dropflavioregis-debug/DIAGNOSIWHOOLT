#!/bin/bash
# Supabase migration (run from project root).
# 1. Link project: npx supabase link --project-ref YOUR_PROJECT_REF
# 2. Apply migrations: npx supabase db push

set -e
cd "$(dirname "$0")/.."
echo "Run: npx supabase link --project-ref YOUR_PROJECT_REF"
echo "Then: npx supabase db push"
