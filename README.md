# PlayStation Network API Worker

Cloudflare Worker for fetching PSN profile data with caching support.

## Features

- Fetch PSN user profile and trophy statistics
- **Incremental trophy details caching** - Only fetches new platinum games
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

### GET /api/profile-summary

Fetch PSN profile with trophy statistics and platinum games list.

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
      "earnedDate": "2024-01-01T00:00:00.000Z",
      "earnedTrophies": {
        "bronze": 20,
        "silver": 10,
        "gold": 5,
        "platinum": 1
      },
      "platform": "PS5",
      "progress": 100,
      "npCommunicationId": "NPWR12345_00"
    }
  ]
}
```

### GET /api/trophy-details/:npCommunicationId

Get detailed trophy information for a specific platinum game.

**Parameters:**

- `npCommunicationId`: The game's unique identifier from the profile response

**Response:**

```json
{
  "trophies": {
    // Full trophy data from PSN API
    // Contains all trophies (bronze, silver, gold, platinum)
  },
  "gameInfo": {
    "title": "Game Title",
    "iconUrl": "https://...",
    "earnedDate": "2024-01-01T00:00:00.000Z"
  },
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

**Example:**

```bash
# First, get the profile to obtain npCommunicationId
curl http://localhost:8787/api/profile-summary

# Then, fetch trophy details for a specific game
curl http://localhost:8787/api/trophy-details/NPWR12345_00
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

### Trophy Details Caching

Trophy details are cached incrementally to avoid PSN API rate limiting:

**How it works:**

1. **First-time setup**: Run the initialization script to populate trophy details for all existing platinum games
2. **Incremental updates**: The cron job (every 6 hours) automatically detects new platinum games and only fetches details for those
3. **Rate limiting**: 300ms delay between each trophy detail request to avoid being blocked by PSN

**Initial setup (one-time):**

The initial trophy cache population should be done manually to avoid timeout issues with Cloudflare Worker's free tier limits.

**Option A: Run as a local script (recommended)**

```bash
# Set your PSN_NPSSO environment variable
export PSN_NPSSO=your_npsso_token

# Configure wrangler to connect to remote KV
# Then run the initialization script (needs manual KV integration)
npx tsx scripts/init-trophy-cache.ts
```

**Option B: Trigger via scheduled event**

Let the first cron execution populate the cache naturally. This works if you have a small number of platinum games (<10).

**Option C: Manually add to KV**

Use `wrangler kv:key put` to manually populate the cache:

```bash
# Example: Add trophy details for a game
wrangler kv:key put --binding=PSN_CACHE "trophy_details:NPWR12345_00" '{"trophies":{...},"gameInfo":{...},"updatedAt":"..."}'

# Add the index
wrangler kv:key put --binding=PSN_CACHE "platinum_games_index" '{"games":[...],"lastUpdated":"..."}'
```

**After initialization:**

The cron job will automatically maintain the cache:
- Detects new platinum games every 6 hours
- Only fetches trophy details for new games (not existing ones)
- Updates the index to track all platinum games

**Monitoring:**

Check Worker logs to see incremental updates:

```bash
wrangler tail
```

You should see messages like:
```
发现 2 个新白金游戏，开始获取详情...
正在获取 Game Title 的奖杯详情...
索引已更新，共 34 个白金游戏
```

## Project Structure

```text
src/
├── index.ts                    # Main router with CORS configuration
├── types.ts                    # Type definitions
├── endpoints/
│   ├── psn-profile.ts         # PSN profile summary endpoint
│   └── trophy-details.ts      # Trophy details endpoint
├── services/
│   ├── psn.ts                 # PSN data fetching with incremental updates
│   ├── cache.ts               # KV cache layer
│   ├── trophy-cache.ts        # Trophy details KV operations
│   └── email.ts               # Email alert service
└── utils/
    └── rate-limiter.ts        # Rate limiting utilities

scripts/
└── init-trophy-cache.ts       # One-time trophy cache initialization
```
