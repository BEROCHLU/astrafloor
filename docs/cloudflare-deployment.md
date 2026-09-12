# Cloudflare Workers deployment

Deploys Worker `astrafloor` on pushes to main, or manual runs on main.
An existing same-name Worker is updated.

## Setup

1. Create a Cloudflare API token with the Edit Cloudflare Workers template,
   scoped to your target account.
2. GitHub Settings > Secrets and variables > Actions: add repository secrets
   `CLOUDFLARE_API_TOKEN` (API token, not password) and
   `CLOUDFLARE_ACCOUNT_ID` (target Account ID).
3. Initialize your workers.dev subdomain in Cloudflare Workers & Pages.
4. Review and push to main. GitHub Actions deployment logs show the public URL.

Do not also enable Cloudflare Workers Builds auto-deployment for this branch:
that would duplicate the GitHub Actions deployment.

## Build

Node.js 24 runs npm ci and npm run build. DEPLOY_TARGET=cloudflare disables
the Sites Vite plugin for this build only. Wrangler deploys the generated
dist/server/wrangler.json, server and client assets. Do not commit dist or
node_modules. Secrets are passed only to the deploy step. Failed builds do not
deploy. GitHub Actions and Cloudflare usage limits both apply.

Official guide: https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/
