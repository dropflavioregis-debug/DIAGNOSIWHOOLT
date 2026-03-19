#!/bin/bash
# DEPLOYMENT CHECKLIST — EV Diagnostic System
# Execute steps manually; do not run this script as-is.
#
# 1. Create Supabase project at https://supabase.com
# 2. Run migrations:
#    npx supabase link --project-ref YOUR_PROJECT_REF
#    npx supabase db push
# 3. Import vehicle libraries (optional):
#    cd scripts && npm install && npm run sync && npm run convert-csv && npm run convert-dbc && npm run import
# 4. Install Vercel CLI: npm i -g vercel
# 5. Link Vercel project (from repo root): vercel link
# 6. Set environment variables in Vercel dashboard:
#    NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY,
#    ANTHROPIC_API_KEY, API_KEY
# 7. Deploy: vercel --prod

echo "See comments in this file for the deployment checklist."
