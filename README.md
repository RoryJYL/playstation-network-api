# PlayStation Network API Worker

Cloudflare Worker for fetching PSN profile data with caching support.

## Features

- Fetch PSN user profile and trophy statistics
- KV-based caching (24h TTL by default)
- Force refresh with `?refresh=true` parameter
- Auto-refresh via Cron Triggers (every 6 hours)
- **Referer-based access control** (only allow requests from specific domains)
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

This API is protected by **Referer/Origin whitelist**. You can configure access control with the `ALLOWED_DOMAINS` environment variable.

**Configuration options:**

- `ALLOWED_DOMAINS="*"` - **Public mode**: Allow all origins (disables access control)
- `ALLOWED_DOMAINS="yourblog.com,anotherdomain.com"` - **Restricted mode**: Only allow specific domains
- Not configured - **Secure default**: Reject all requests with 500 error

**How it works:**

- Checks the `Referer` or `Origin` header of incoming requests
- Blocks requests that don't match any allowed domain
- Returns `403 Forbidden` for unauthorized access

**Example configurations:**

```bash
# Public API (no restrictions)
ALLOWED_DOMAINS=*

# Single domain
ALLOWED_DOMAINS=yourblog.com

# Multiple domains
ALLOWED_DOMAINS=yourblog.com,www.yourblog.com,localhost:3000
```

**Note:** This is suitable for static site blogs (SSG). The protection prevents direct access to your Workers URL but can be bypassed by spoofing headers. For stronger security, combine with Cloudflare Rate Limiting in the dashboard.

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
# Test 1: Direct access (will be blocked if ALLOWED_DOMAINS is configured)
curl http://localhost:8787/api/psn

# Test 2: With matching referer (will succeed)
curl -H "Referer: http://localhost:3000/" http://localhost:8787/api/psn

# Test 3: Public mode (set ALLOWED_DOMAINS=* in .dev.vars)
# Direct access will succeed
```

## Cache Configuration

- Default TTL: 24 hours (86400 seconds)
- Auto-refresh: Every 6 hours via Cron Trigger
- Storage: Cloudflare KV

Modify `CACHE_TTL_SECONDS` in [wrangler.jsonc](wrangler.jsonc) to change cache duration.

## Project Structure

```text
src/
├── index.ts              # Main router + scheduled handler
├── types.ts              # Type definitions
├── endpoints/
│   └── psnProfile.ts     # PSN API endpoint
└── services/
    ├── psn.ts            # PSN data fetching
    └── cache.ts          # KV cache layer
```
