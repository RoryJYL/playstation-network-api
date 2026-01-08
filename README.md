# PlayStation Network API Worker

Cloudflare Worker for fetching PSN profile data with caching support.

## Features

- Fetch PSN user profile and trophy statistics
- KV-based caching (24h TTL by default)
- Force refresh with `?refresh=true` parameter
- Auto-refresh via Cron Triggers (every 6 hours)
- OpenAPI 3.1 documentation

## Setup

### 1. Install dependencies

```bash
pnpm install
```

### 2. Configure secrets

Set your PSN NPSSO token:

```bash
# For local development, create .dev.vars
echo "PSN_NPSSO=your_npsso_token_here" > .dev.vars

# For production, use wrangler secrets
wrangler secret put PSN_NPSSO
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

Open http://localhost:8787 for API documentation.

## Cache Configuration

- Default TTL: 24 hours (86400 seconds)
- Auto-refresh: Every 6 hours via Cron Trigger
- Storage: Cloudflare KV

Modify `CACHE_TTL_SECONDS` in [wrangler.jsonc](wrangler.jsonc) to change cache duration.

## Project Structure

```
src/
├── index.ts              # Main router + scheduled handler
├── types.ts              # Type definitions
├── endpoints/
│   └── psnProfile.ts     # PSN API endpoint
└── services/
    ├── psn.ts            # PSN data fetching
    └── cache.ts          # KV cache layer
```

