# PlayStation Network API Worker

Cloudflare Worker for fetching PSN profile data with caching support.

## Features

- Fetch PSN user profile and trophy statistics
- KV-based caching (24h TTL by default)
- Force refresh with `?refresh=true` parameter
- Auto-refresh via Cron Triggers (every 6 hours)
- **CORS-based access control** (configurable domain whitelist)
- OpenAPI 3.1 documentation

## Setup

### 1. Install dependencies

```bash
pnpm install
```

### 2. Configure secrets and environment variables

#### For local development

Create `.dev.vars` file:

```bash
PSN_NPSSO=your_npsso_token_here
ALLOWED_DOMAINS=localhost:3000,localhost:5173
```

#### For production

Set secrets and environment variables using Wrangler:

```bash
# Secret: PSN NPSSO token
wrangler secret put PSN_NPSSO

# Public var: Allowed domains (can also be set in wrangler.jsonc)
wrangler secret put ALLOWED_DOMAINS
# Or in Cloudflare Dashboard: Workers & Pages > your-worker > Settings > Variables
```

Update `ALLOWED_DOMAINS` in [wrangler.jsonc](wrangler.jsonc:15) for production:

```jsonc
"vars": {
  "CACHE_TTL_SECONDS": "86400",
  "ALLOWED_DOMAINS": "yourblog.com,anotherdomain.com"
}
```

### 3. Create KV namespace

```bash
wrangler kv:namespace create PSN_CACHE
```

Update `wrangler.jsonc` with the returned KV namespace ID.

### 4. Deploy

```bash
wrangler deploy
```

## Access Control

This API uses **CORS-based access control** to restrict which domains can access the API from browsers.

**Configuration options:**

- `ALLOWED_DOMAINS="*"` - **Public mode**: Allow all origins (no restrictions)
- `ALLOWED_DOMAINS="yourblog.com,anotherdomain.com"` - **Restricted mode**: Only allow specific domains
- Not configured - **Secure default**: Reject all cross-origin requests

**How it works:**

- Uses standard CORS mechanism with `Access-Control-Allow-Origin` headers
- Browsers automatically enforce the policy
- Only requests from allowed origins can access the API
- Preflight (OPTIONS) requests are handled automatically

**Example configurations:**

```bash
# Public API (no restrictions)
ALLOWED_DOMAINS=*

# Single domain
ALLOWED_DOMAINS=yourblog.com

# Multiple domains
ALLOWED_DOMAINS=yourblog.com,www.yourblog.com,localhost:3000
```

**Note:** CORS is enforced by browsers. Tools like curl or Postman can bypass this by setting custom headers. For production APIs requiring strict security, consider adding Cloudflare Access or API key authentication.

## API Endpoints

### GET /api/psn

Fetch PSN profile with trophy statistics.

**Query Parameters:**

- `refresh` (optional): Set to `true` to force cache refresh

**Response:**

```json
{
  "onlineId": "string",
  "avatarUrl": "string",
  "totalTrophies": 1234,
  "bronzeTrophies": 800,
  "silverTrophies": 300,
  "goldTrophies": 100,
  "platinumTrophies": 34,
  "platinumGames": [
    {
      "title": "Game Title",
      "iconUrl": "https://...",
      "earnedDate": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

## Development

Start local dev server:

```bash
pnpm dev
```

Open <http://localhost:8787> for API documentation.

### Testing Access Control

You can test different access control modes:

```bash
# Test 1: Direct browser access
# Open http://localhost:8787/api/psn in browser
# Will work if ALLOWED_DOMAINS=* or if opened from allowed domain

# Test 2: CORS preflight (from browser console)
fetch('http://localhost:8787/api/psn')
  .then(r => r.json())
  .then(console.log)

# Test 3: curl (bypasses CORS - works regardless of ALLOWED_DOMAINS)
curl http://localhost:8787/api/psn
```

## Cache Configuration

- Default TTL: 24 hours (86400 seconds)
- Auto-refresh: Every 6 hours via Cron Trigger
- Storage: Cloudflare KV

Modify `CACHE_TTL_SECONDS` in [wrangler.jsonc](wrangler.jsonc) to change cache duration.

## Project Structure

```text
src/
├── index.ts              # Main router with CORS configuration
├── types.ts              # Type definitions
├── endpoints/
│   └── psnProfile.ts     # PSN API endpoint
└── services/
    ├── psn.ts            # PSN data fetching
    ├── cache.ts          # KV cache layer
    └── email.ts          # Email alert service
```
