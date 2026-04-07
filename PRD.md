# AlbionCompass — Product Requirements Document

> **Status:** Draft
> **Date:** 2026-04-04
> **Version:** 1.0
> **Purpose:** Blueprint for rebuilding this app from scratch

---

## 1. Concept & Vision

**Albion Market Insight** is a precision trading cockpit for **Albion Online** players — a real-time economy analysis tool that eliminates guesswork from every in-game market decision. The app positions itself as the Bloomberg Terminal of Albion: data-dense, fast, authoritative, and visually unmistakable as a premium gaming tool.

The core emotional promise: *"You will never make a bad trade again."* Every screen answers the same question in different contexts — **where should I buy, where should I sell, and is it worth my time?**

The personality is **dark, sharp, and confident** — not flashy or gamified, but serious like a trader's workstation. Gold accents signal value and premium quality. Animations are purposeful and fast, never decorative.

---

## 2. Design Language

### 2.1 Aesthetic Direction
Dark trading terminal meets premium gaming UI. Think Bloomberg Terminal crossed with a luxury watch interface — every pixel earns its place. No rounded-corner bubbly aesthetics. Sharp, data-forward, with gold as the sole accent color.

Reference targets: trading platforms, esports dashboards, premium dark-mode fintech apps.

### 2.2 Color Palette

```
Background (deep):    #0A0D12   (near-black, slightly blue-tinted)
Background (panel):  #141820   (slightly lighter, for cards/surfaces)
Background (glass):  rgba(32, 38, 47, 0.6)  (overlay panels)
Border (default):     rgba(255, 255, 255, 0.06)
Border (active):      rgba(251, 191, 36, 0.4)  (gold tint)

Primary (gold):       #FBBF24   (amber-400 / oklch 85% 15% 85°)
Primary (muted):      rgba(251, 191, 36, 0.15)  (gold tint for backgrounds)
Primary (hover):      #F59E0B   (amber-500)

Text (primary):       #F1F5F9   (slate-100)
Text (secondary):     #94A3B8   (slate-400)
Text (muted):         #475569   (slate-600)

Success:              #22C55E   (green-500)
Warning:              #F97316   (orange-500)
Danger:               #EF4444   (red-500)
Info:                 #3B82F6   (blue-500)

Freshness colors:
  < 1 hour:           green-500
  < 6 hours:          blue-500
  < 24 hours:         yellow-500
  > 24 hours:         red-500
```

### 2.3 Typography

- **Headings:** `Inter` (weight 600-700), fallback `system-ui`
- **Body:** `Geist Variable` (loaded via `@fontsource-variable/geist` or CDN), fallback `system-ui`
- **Monospace / data:** `JetBrains Mono` — for prices, IDs, code-like strings
- **Scale:** 12px (muted labels) → 14px (body) → 16px (card titles) → 20px (section heads) → 28px (hero numbers)

### 2.4 Spatial System

- Base unit: 4px
- Panel padding: 16px–24px
- Card gap: 12px–16px
- Section gap: 32px–48px
- Max content width: `71rem` (7xl)
- Mobile-first with breakpoints at `640px`, `1024px`

### 2.5 Motion Philosophy

Purposeful and fast. Animations communicate state changes, not decoration.

- **Page transitions:** `AnimatePresence` (Framer Motion), opacity + slight X translate, 200ms ease-out
- **Staggered lists:** 30–50ms delay per item, max 300ms total
- **Hover states:** 150ms ease-out for scale/border/glow changes
- **Loading skeletons:** pulse animation, no spinners for content areas
- **Toast notifications:** slide in from top-right, auto-dismiss 4s
- No bounce, no spring physics — sharp ease-out only

### 2.6 Visual Assets

- **Icons:** Lucide React — consistent 20px stroke-1.5 throughout
- **Item icons:** `https://render.albiononline.com/v1/item/{ITEM_ID}.png` — fetched from Albion's render service
- **Logo:** Inline SVG — a stylized candlestick/chart mark combined with a compass needle
- **Decorative:** Subtle grid pattern on backgrounds, gold gradient borders on premium panels

---

## 3. Layout & Structure

### 3.1 Shell Architecture

```
┌─────────────────────────────────────────────────────┐
│  Header Bar (h-14, fixed)                            │
│  [Logo] [Server Selector] [Search Global] [Avatar]  │
├──────────────┬──────────────────────────────────────┤
│              │                                      │
│  Sidebar     │  Content Area                        │
│  (w-64,      │  (flex-1, scrollable, max-w-7xl)     │
│  collapsible)│                                     │
│              │                                      │
└──────────────┴──────────────────────────────────────┘
```

### 3.2 Sidebar Navigation Groups

**Market:**
- Price Checker — icon: Search
- Top Flipping — icon: TrendingUp — badge: "New!"
- Profit Scanner — icon: Zap
- Market Pulse — icon: Activity

**Crafting:**
- My Crafting — icon: Bookmark
- Crafting — icon: Hammer
- Refining — icon: Gem
- Cooking — icon: Flame

**Resources:**
- Library — icon: BookOpen

**Account:**
- Notifications — icon: Bell — badge: unread count
- My Profile — icon: User

### 3.3 Sidebar Behavior

- **Desktop:** Collapsible (icon-only mode at 64px, full at 256px). Persists preference in localStorage.
- **Mobile:** Full overlay sheet (drawer) triggered by hamburger button in header.
- Sidebar header: logo, user avatar/initials circle, clickable → login or profile.

### 3.4 Content Area

- Animated tab switching (Framer Motion AnimatePresence)
- `max-w-7xl mx-auto` with responsive horizontal padding
- Scrollable independently from sidebar

---

## 4. Features & Interactions

### 4.1 Global Server Selector

- Dropdown in header: **West** (Americas), **East** (Asia), **Europe**
- Persists in localStorage: `albion_server`
- Changing server clears price cache and re-fetches all data
- All API calls route to the appropriate AODP subdomain based on selection

---

### 4.2 Price Checker

**Purpose:** Look up any item's current prices across all cities.

**Search Bar:**
- Fuzzy search via **Fuse.js** (threshold 0.3, keys: name, id)
- Category dropdown (All, Weapon, Armor, Consumable, Material, etc.)
- Sub-category dropdown (filtered by category selection)
- Max 50 results shown in dropdown
- Keyboard navigation: Arrow Up/Down to navigate, Enter to select, Escape to close
- ARIA combobox role for accessibility
- On select → fetches prices for all selected cities and qualities

**Item Header Card:**
- Item icon (48px from render.albiononline.com)
- Item name, tier, enchantment level, item ID
- Category / sub-category badge

**City Price Cards (one per city):**
- Hero number: sell price min (large, gold, monospace)
- Calculated profit/loss from a "buy city" (user-selected)
  - Formula: `(sellPrice * (1 - tax - 0.01)) - buyPrice`
  - Tax: 4% for premium members, 8% for non-premium
  - Displayed in green (profit) or red (loss)
- ROI percentage: `profit / buyPrice * 100`
- Data freshness border color (green/blue/yellow/red by age)
- **Expandable detail section:**
  - Buy price min/max
  - Sell price max
  - Historical average price
  - Max buy price (what players are paying)
  - Last updated timestamp
- "Set as Buy City" button (gold highlight when selected)
- Data freshness: compare `sell_price_min_date` against current time

**Controls (above cards):**
- City filter (multi-select, all selected by default)
- Quality checkboxes (1–5, all selected by default)
- Premium toggle (affects tax calculation)

---

### 4.3 Top Flipping

**Purpose:** Automatically scan for profitable city-to-city trade routes.

**Controls:**
- City filter (multi-select)
- Quality checkboxes (1–5)
- Max age filter (show only results where data is fresh within N hours)
- Hide suspicious toggle (hides results flagged as potentially bad data)
- Display limit: 10 / 20 / 50 / 100 / All
- Sort by: Profit, ROI, Freshness, Demand

**Scanning Logic:**
1. Load `HOT_ITEMS` array (~120 item IDs: T4-T8 weapons, armor sets, mounts, consumables, gathering tools)
2. Filter by selected qualities and categories
3. Fetch prices for all items across all selected cities in parallel
4. Generate all `(buyCity, sellCity)` pairs where buyCity ≠ sellCity
5. Calculate profit: `(sellPrice * (1 - tax - 0.01)) - buyPrice`
6. Exclude routes where buyPrice === 0 or sellPrice === 0
7. Exclude routes where data is older than maxAge threshold
8. Sort by selected sort criteria
9. For top 30 results, fetch 72-hour history and verify against historical average

**Verification Logic:**
- Fetch 72h history → compute `historicalAvg`
- `diff = |sellPrice - historicalAvg| / historicalAvg`
- `diff < 0.30` → **Verified** (green shield icon)
- `diff >= 0.50` OR `profit > 100% ROI` → **Suspicious** (red warning icon)
- Otherwise → **Unknown** (gray question mark)

**Results Table (Desktop):**
| Item | Buy City | Sell City | Buy | Sell | Profit | ROI | Age | Verified |
|------|----------|-----------|-----|------|--------|-----|-----|----------|
| Icon+Name | Badge | Badge | Gold | Gold | +/- | % | h | Icon |

**Results Cards (Mobile):** Stacked cards, each showing the above fields vertically.

**Stale-While-Revalidate Caching:**
- Display cached results immediately if available
- In background: re-fetch items older than 15 minutes
- Merge new data into existing results without full re-render

**Interactions:**
- Row hover → highlight
- Click → expand inline detail panel (72h history sparkline if available)
- "Watchlist" button → adds item ID to user's watchlist (requires login)
- "Trade" button → navigates to Price Checker with that item pre-loaded

**Cache:** 15–20 minute TTL in localStorage (`albion_price_cache_v1`)

---

### 4.4 Profit Scanner

**Purpose:** Find the most profitable crafting routes by accounting for ingredient costs.

**Controls:**
- City filter, quality checkboxes, max age
- Tier range: min/max (default T4–T6)
- RRR toggle panel (see BaseCalculator section for RRR details)
- Mode switch: **Global Routes** vs **Single City**

**Global Routes Mode:**
- For each craftable hot item:
  - Find best sell city (highest sell price)
  - For each ingredient: find cheapest buy city across selected cities
  - Apply RRR to material costs
  - Calculate total profit and ROI
- Shows the full "golden route": buy each ingredient from its cheapest city, sell in best city

**Single City Mode:**
- All transactions (buy ingredients + sell crafted item) happen in one city
- User selects the city
- Useful for crafting in premium cities with crafting bonuses

**Profit Calculation (see crafting-utils.ts):**
```
materialCost = Σ(ingredientPrice × netQuantity)   // netQuantity = required - RRR_returned
netRevenue = sellPrice × quantity × (1 - tax - 0.01)
profit = netRevenue - materialCost - stationFee
ROI = profit / materialCost × 100
```

**Interactions:**
- "Analyse" button → dispatches `albion_add_craft_item` event, opens Crafting Calculator with this item pre-loaded
- Sort by: Profit, ROI
- Verified/Suspicious badges (same logic as Top Flipping)

---

### 4.5 Market Pulse

**Purpose:** Surface items with unusual trading activity — volume spikes, cooling trends, surging demand.

**Controls:**
- Quality checkboxes (1–5)
- Time window: 24h / 48h (affects volume calculation)
- Category filter (optional, to narrow scan)
- Tier filter (optional)
- Scan button (manual trigger)

**Scanning Logic:**
1. Iterate over all craftable hot items
2. Fetch 72h history for each (batch: 5 items, 350ms delay between batches)
3. Split history into two 12h windows: recent vs previous
4. For each item:
   - `recentVolume = Σ(recent12h item_count)`
   - `prevVolume = Σ(prev12h item_count)`
   - `trend = (recentVolume - prevVolume) / prevVolume`
   - `avgPrice = weighted average of recent12h avg_prices`
   - `highCity / lowCity` from individual price data
   - `demandScore = volume × trendMultiplier × cityDiversityFactor`
   - `cityDiversity = uniqueCitiesTradingThisItem / 7`

**Trend Classification:**
| trend value | label | color |
|---|---|---|
| `> +0.50` | Surging | orange |
| `+0.10 to +0.50` | Rising | green |
| `-0.10 to +0.10` | Stable | blue |
| `< -0.10` | Cooling | red |

**Results:**
- Sorted by `demandScore` descending
- Card shows: item name/icon, total volume, trend badge, avg price, high/low city, city diversity %
- Per-city volume breakdown in expandable detail
- "Trade" button → opens Price Checker

**Cache:** 45-minute TTL, localStorage (`albion_pulse_cache_v1`)

---

### 4.6 Crafting Calculator (BaseCalculator)

> The Crafting, Refining, and Cooking calculators all share the same component with a `filterPredicate` prop.

**Purpose:** Calculate net crafting profit accounting for material costs, RRR, focus, station fees, and market prices.

#### Item Selection

- Search bar with category/sub-category filters (only craftable items, filtered by the calculator's `filterPredicate`)
- **"Recent Items" dropdown:** last 10 items the user searched in this calculator tab (persisted per tab: `albion_recent_crafting`, `albion_recent_refining`, `albion_recent_cooking`)
- Clicking an item adds it to the craft list
- Craft list items: name + quantity spinner + station fee input (silver/craft) + remove button

#### RRR (Resource Return Rate) System

Three toggles:

| Toggle | Options | Description |
|---|---|---|
| **Station Bonus** | Normal (10%) / Event (20%) | Crafting bonus from premium/event buff |
| **City Bonus** | Off / City | Whether crafting in the item's bonus city |
| **Focus** | Off / On | Whether using focus points |

RRR lookup table (exact game values):

```
Normal + NoCity + NoFocus = 15.2%
Normal + City  + NoFocus = 24.8%
Normal + City  + Focus   = 47.9%
Normal + NoCity + Focus  = 38.3%
Event  + City  + Focus   = 53.9%
Event  + NoCity + NoFocus = 21.2%
Event  + City  + NoFocus = 30.8%
Event  + NoCity + Focus  = 44.3%
```

RRR is applied per ingredient on the "return" side — you get back a % of materials when crafting.

#### Ingredient Management (Shopping List)

- **Computed from craft list:** automatically resolves all ingredients recursively to raw materials
- Columns: Item | Bring | RRR Return | Have | Net Buy | Source City | Price | Total
- **Have** column: manual inventory input (how many you already own)
- **Net Buy:** `max(0, bring - have - rrr_return)`
- **Per-ingredient source city:** dropdown override per row (defaults to global source city)
- **Manual price override:** click price cell → enter custom price (persisted in state)
- **"Live Price" refresh:** every 60 seconds, re-fetches all ingredient prices
- **"Add to craft list"** button on ingredient rows: crafts ingredients recursively (adds sub-ingredients to the craft list)
- **"Exclude RRR Return"** checkbox per ingredient (for situations where you don't want to count returned materials, e.g. if you're gifting them)

#### Sell Configuration

- **Output multiplier:** for cooking, some items craft multiple per batch (normal food: 10x, potions: 5x)
- **Sell price:** fetched from market, editable override per city
- **Sell city:** dropdown
- **Tax:** 4% (premium) or 8% (non-premium) + 1% setup fee → `(1 - tax - 0.01)`

#### City Price Comparison Table

- One row per craft list item
- Columns: City | Price | Selected (checkbox)
- Highest price highlighted green
- Used to determine best sell city per item

#### Profit Summary (sticky panel)

- Material cost total
- Station fee total
- Sell revenue (at selected sell prices)
- Net profit
- ROI %
- Per-item profit breakdown

#### Persistence

- **Auto-save draft:** debounced 2s after any state change → saves to AuthContext (server/localStorage for logged-in users, or session storage for guests)
- **Finalize Plan:** modal with name input + optional notes textarea → converts draft to saved plan
- **Share via URL:** "Copy Link" button → compresses full calculator state to base64 string in URL hash `state=` parameter
  - State schema: `{ l: craftList, h: haveList, m: manualPrices, s: sellPrices, c: sourceCities, g: globalCity, r: rrrConfig }`
  - Compressed format uses single-letter keys to minimize URL length
- **Load from URL:** on component mount, check for `state=` hash → decompress and hydrate

---

### 4.7 Refining Calculator

- Identical to Crafting Calculator
- `filterPredicate = (item) => item.subCategory === 'refinedresources'`
- Same RRR system, same UI
- Recent items stored separately: `albion_recent_refining`

---

### 4.8 Cooking Calculator

- Identical to Crafting Calculator
- `filterPredicate = (item) => item.category === 'consumables'`
- Output multipliers by sub-category:
  - `normalfood` → 10x per craft
  - `meal` → 5x per craft
  - `potion` (healing, energy, gigantify, resistance, sticky, poison) → 5x per craft
- Recent items: `albion_recent_cooking`

---

### 4.9 Library

**Purpose:** Reference tool — look up any item's crafting recipe and find what else uses it.

**Search:**
- Full-text search across all items in `items-lite.json`
- Same fuzzy search UI as Price Checker

**Item Detail View:**

**"How to Craft" tab:**
- Full ingredient tree (recursive resolution)
- Each ingredient shown with: icon, name, quantity required
- Sub-ingredients expandable
- "Calculate Profit" button → opens appropriate calculator (crafting/refining/cooking) with this item

**"Used To Craft" tab:**
- Reverse lookup: which items have this item as an ingredient
- Shows parent item + quantity used
- Clickable → navigates to that parent item

---

### 4.10 My Crafting (Saved Plans)

**Purpose:** Persistent storage of finalized crafting plans.

**List View:**
- Cards sorted by `updatedAt` descending by default
- Each card: up to 5 item icon previews, plan name, type badge (crafting/refining/cooking), last profit amount, "Draft" badge if `isDraft: true`, note snippet
- Search by plan name
- Filter: type (All / Crafting / Refining / Cooking)
- Toggle: Show Drafts
- Sort: Date (default) / Profit / Name

**Interactions:**
- "Open" → dispatches `albion_load_crafting_plan` event → target calculator tab loads the plan state
- "Delete" → two-step confirmation (first click: "Are you sure?", second click: confirms deletion)
- "Share" → copies the URL with embedded state

**Quota System:**
- Free users: max 5 finalized plans
- Drafts don't count against the limit
- Superusers: unlimited
- UI shows quota bar: "3 / 5 plans used"

---

### 4.11 Notifications

**Purpose:** Alert history from watchlist monitoring.

**Types:**
- `price_drop` — green badge
- `price_spike` — red badge
- `system` — blue badge

**Display:**
- Chronological list (newest first)
- Each item: icon, item name, notification type, timestamp, message
- Click → marks as read (removes unread dot)
- Max 50 notifications stored in `albion_notifications` localStorage key

**Trigger:** (Mock) WatchlistContext polls every 5 minutes and generates a mock notification when prices change.

---

### 4.12 My Profile

**Tabs:**

**Simulations:** Legacy saved simulations (older feature), shows saved `SavedSimulation` objects.

**Watchlist:** All items the user has starred from Top Flipping.
- Shows item icons fetched from render.albiononline.com
- Item name, tier, last known price
- Remove button per item

**Account Settings:**
- Username display
- Email display
- Subscription tier badge
- Role badge (User / Superuser)
- Stats: saved plans count, watchlist count, points, contributor level
- Join date
- "Upgrade to Premium" button (mock — sets `expiresAt: +30 days`, no real payment)
- Logout button

---

## 5. Component Inventory

### 5.1 AppShell

- **Purpose:** Root layout — sidebar + header + content area
- **States:** sidebar open/collapsed/icon-only; mobile overlay open/closed
- **Behavior:** AnimatePresence for content tab transitions; sidebar collapse persists to localStorage

### 5.2 SearchBar

- **States:** idle, focused, has-query (shows dropdown), loading, error
- **Keyboard:** ArrowUp/Down navigate, Enter selects, Escape closes
- **Accessibility:** ARIA combobox, listbox, options roles
- **Dropdown:** max-height 400px, scrollable, shows category badge per result

### 5.3 PriceCard

- **States:** collapsed (default), expanded, loading skeleton, error, selected-as-buy-city
- **Freshness indicator:** border-left 3px colored bar + icon
- **Expand animation:** Framer Motion height animation, 200ms

### 5.4 CityFilter

- **Type:** Multi-select dropdown
- **Display:** pill buttons per city with checkmarks, "All" / "None" quick toggles
- **Persistence:** localStorage key per feature

### 5.5 PrimaryFilters

- **Contains:** CityFilter + enchantment level toggles (0–4) + quality checkboxes (1–5)
- **Persistence:** all filter states to localStorage

### 5.6 SecondaryFilters

- **Contains:** verification status (Verified / Suspicious / All), category select, sub-category select, max age slider
- **Only rendered for:** Top Flipping, Market Pulse, Profit Scanner

### 5.7 BaseCalculator

- **States:** empty (no items), has-items, loading-prices, calculating, saved, draft-modified
- **Sub-components:** CraftListPanel, RRRPanel, ShoppingListPanel, SellConfigPanel, CityPriceTable, ProfitSummary
- **Auto-save indicator:** "Saved" / "Saving..." / "Unsaved changes" pill in header

### 5.8 MarketPulseCard

- **States:** loading, trending-up (green), trending-down (red), stable (blue), surging (orange)
- **Expandable:** shows per-city volume breakdown on expand

### 5.9 CraftingPlanCard

- **States:** default, draft (dimmed), confirm-delete (red border)
- **Content:** icon thumbnails, name, type badge, profit, note preview

---

## 6. Technical Approach

### 6.1 Monorepo Structure

```
/
├── server/
│   ├── server.ts          # Express proxy + cache
│   └── tsconfig.json
├── src/
│   ├── components/
│   │   ├── layout/        # AppShell, Header, Sidebar
│   │   ├── market/        # PriceChecker, TopFlipping, ProfitScanner, MarketPulse
│   │   ├── crafting/      # CraftingCalc, RefiningCalc, CookingCalc
│   │   ├── resources/     # Library
│   │   ├── shared/        # BaseCalculator, SearchBar, PriceCard, filters
│   │   └── ui/            # shadcn/ui primitives
│   ├── contexts/
│   │   ├── AuthContext.tsx
│   │   └── WatchlistContext.tsx
│   ├── hooks/
│   │   ├── useTopFlips.ts
│   │   ├── useMarketPulse.ts
│   │   ├── useProfitScanner.ts
│   │   └── useDebounce.ts
│   ├── lib/
│   │   ├── albion-data.ts      # API client + localStorage cache
│   │   ├── crafting-utils.ts   # Profit calculation math
│   │   ├── price-utils.ts      # Price helpers, freshness, routes
│   │   └── hot-items.ts        # HOT_ITEMS array definition
│   ├── types/
│   │   └── albion.ts           # All shared TypeScript types
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
├── public/
│   └── data/
│       └── items-lite.json     # Static item database
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.ts
└── components.json             # shadcn/ui config
```

### 6.2 Tech Stack

| Layer | Technology | Version |
|---|---|---|
| Framework | React | 19 |
| Language | TypeScript | 5 |
| Build tool | Vite | 6 |
| CSS | Tailwind CSS | 4 |
| UI primitives | Radix UI (shadcn/ui) | latest |
| Animation | Framer Motion | 11 |
| Icons | Lucide React | latest |
| Fuzzy search | Fuse.js | 7 |
| Class utilities | clsx + tailwind-merge | latest |
| Backend | Express.js | 4 |
| Server caching | NodeCache | latest |
| Server runtime | tsx | latest |
| Fonts | @fontsource-variable/geist | latest |

### 6.3 Backend Design

**Framework:** Express.js co-hosted with Vite in development.

**Development:**
```bash
npm run dev → tsx server/server.ts
```

**Production:**
```bash
npm run build → vite build (static files)
node server/server.js (serve static + API proxy)
```

**Endpoints:**

| Method | Path | Description | Cache |
|---|---|---|---|
| GET | `/api/prices/:itemId` | Proxy to AODP prices | NodeCache 5min |
| GET | `/api/history/:itemId` | Proxy to AODP history | NodeCache 5min |
| GET | `/*` | Serve static Vite build | No |

**Request deduplication:**
```typescript
const pendingRequests = new Map<string, Promise<any>>()
// If request already in-flight, await the existing promise instead of making a new one
```

**Vite integration (dev only):**
```typescript
if (process.env.NODE_ENV !== 'production') {
  const vite = await createVite()
  app.use(vite.middlewares)
} else {
  app.use(express.static('dist'))
}
```

### 6.4 API Client Design

**AODP Base URLs:**
- West: `https://www.albion-online-data.com/api/v2/stats/`
- East: `https://east.albion-online-data.com/api/v2/stats/`
- Europe: `https://europe.albion-online-data.com/api/v2/stats/`

**Item IDs:** `{TIER}_{CATEGORY}_{NAME}@{QUALITY}` e.g. `T4_MAIN_SPEAR@1`

**Price endpoint:**
```
GET /prices/{itemIds}
  ?locations={city1,city2}
  &qualities={1,2,3}
  &server={server}
```

**History endpoint:**
```
GET /history/{itemIds}
  ?locations={city1,city2}
  &qualities={1,2,3}
  &server={server}
  &date={YYYY-MM-DD}
  &time-scale=hour
```

**Client-side caching layer (`albion-data.ts`):**
```typescript
// Check localStorage first
// If cache miss or stale → fetch from /api/prices/:id
// Merge new data into cache
// Return merged result
```

### 6.5 Data Model

**Item Database (static, `items-lite.json`):**
```typescript
interface AlbionItem {
  id: string           // e.g. "T4_MAIN_SPEAR@1"
  name: string
  tier: number         // 1–8
  enchantment: number  // 0–3
  weight: number
  itemValue: number
  category: string
  subCategory: string
  craftingRecipe?: { id: string; count: number }[]
  icon: string         // render.albiononline.com URL
}
```

**Price Response:**
```typescript
interface AlbionPrice {
  item_id: string
  city: string
  quality: 1 | 2 | 3 | 4 | 5
  sell_price_min: number
  sell_price_max: number
  buy_price_min: number
  buy_price_max: number
  sell_price_min_date: string  // ISO timestamp
  historical_avg?: number
  historical_count?: number
}
```

**History Response:**
```typescript
interface AlbionHistory {
  location: string
  item_id: string
  quality: number
  data: Array<{
    item_count: number
    avg_price: number
    timestamp: string
  }>
}
```

**User:**
```typescript
interface User {
  id: string
  email: string
  username: string
  passwordHash: string  // SHA-256 + salt
  role: 'user' | 'superuser'
  subscription: {
    tier: 'free' | 'premium'
    expiresAt?: string
  }
  stats: {
    contributorLevel: number
    points: number
    joinDate: string
  }
  craftingPlans: CraftingPlan[]
  savedSimulations: SavedSimulation[]
  watchlist: string[]
}
```

**CraftingPlan:**
```typescript
interface CraftingPlan {
  id: string
  name: string
  type: 'crafting' | 'refining' | 'cooking'
  isDraft: boolean
  createdAt: string
  updatedAt: string
  notes?: string
  lastProfit?: number
  craftList: CraftListItem[]
  manualPrices: Record<string, Record<string, number>>  // itemId → cityId → price
  sellPrices: Record<string, number>                     // itemId → price
  sourceCities: Record<string, string>                    // itemId → cityId
  globalCity: string
  rrrConfig: RrrConfig
  haveList: Record<string, number>                        // itemId → quantity
  noRrrItems: string[]
}

interface RrrConfig {
  stationBonus: 'normal' | 'event'
  cityBonus: boolean
  useFocus: boolean
}

interface CraftListItem {
  itemId: string
  quantity: number
  stationFee: number  // silver per craft
}
```

### 6.6 Authentication Flow

**Register:**
1. Validate: email format, username ≥ 3 chars, password ≥ 6 chars
2. Check reserved email (`admin@albionnavigator.com`) not taken
3. Check email not already in `albion_accounts_v3`
4. Hash: `SHA-256(password + 'albion_nav_salt_v2')`
5. Create user object → append to `albion_accounts_v3`
6. Set `albion_session_v3` to new user

**Login:**
1. Hash input password
2. If email === `admin@albionnavigator.com` and password === `AlbionMaster2025!` → load from `albion_master_data`, set session
3. Otherwise: find in `albion_accounts_v3`, compare hash
4. Set `albion_session_v3`

**Master Superuser:**
- Hardcoded in `AuthContext.tsx`
- `email: admin@albionnavigator.com`
- `password: AlbionMaster2025!`
- `role: superuser`
- `subscription: premium`
- All permissions: unlimited plans, unlimited watchlist
- Separate from `albion_accounts_v3` (stored in `albion_master_data`)

### 6.7 Caching Strategy

| Data | Client Storage | TTL | Key |
|---|---|---|---|
| Multi-item prices | localStorage | 15–20 min | `albion_price_cache_v1` |
| Single-item prices | localStorage | 5 min | `albion_single_item_cache_v1` |
| Market Pulse results | localStorage | 45 min | `albion_pulse_cache_v1` |
| User session | localStorage | persistent | `albion_session_v3` |
| User accounts | localStorage | persistent | `albion_accounts_v3` |
| Server price cache | NodeCache | 5 min | in-memory |

### 6.8 URL State Encoding

Calculator state encoded in URL hash `state=` parameter using a compact binary-like format:

```typescript
// Encode: state = base64url(JSON.stringify({ l, h, m, s, c, g, r }))
// l = craftList (array)
// h = haveList (object)
// m = manualPrices (nested object)
// s = sellPrices (object)
// c = sourceCities (object)
// g = globalCity (string)
// r = rrrConfig (object)

// Short keys minimize URL length
// Decode on mount, hydrate calculator state
```

---

## 7. The HOT_ITEMS List

The app scans a curated list of ~120 high-volume items. These should be defined in `src/lib/hot-items.ts`.

**Categories to include:**

| Category | Items |
|---|---|
| Weapons (T4–T8) | All 1H weapons, 2H weapons, mainhands, offhands per tier |
| Armor (T4–T8) | Head, chest, legs, boots, capes per tier |
| Consumables | Healing potions, energy potions, food, poison |
| Mounts | T4–T8 mounts (regular + swift) |
| Gathering | T4–T8 gathering tools (axes, picks, hammers, sickles) |
|Artefacts | T4–T8 artifact weapons and armor |

**Format:**
```typescript
export const HOT_ITEMS: string[] = [
  'T4_MAIN_SPEAR', 'T4_MAIN_SWORD', 'T4_2H_WARGLUMS',
  // ... ~120 items
]
```

Each should be combined with quality suffix in code: `${itemId}@${quality}`.

---

## 8. City Data

**All cities:**

```typescript
export const ALBION_CITIES = [
  'Martlock',      // Armor bonus city
  'Bridgewatch',  // Weapon bonus city
  'Lymhurst',      // Wood/Planks bonus city
  'Fort Sterling', // Ore/Metal bonus city
  'Thetford',      // Cloth/Leather bonus city
  'Caerleon',      // No tax, PvP zone, central hub
  'Brecilien',     // New city
] as const
```

**Crafting bonus cities by sub-category:**
```typescript
export const CRAFTING_BONUS_CITIES: Record<string, string> = {
  // Weapons
  'weapons': 'Bridgewatch',
  // Armor
  'armor': 'Martlock',
  // Wood/Planks
  'wood': 'Lymhurst',
  // Ore/Metal
  'metal': 'Fort Sterling',
  // Cloth/Leather
  'cloth': 'Thetford',
  'leather': 'Thetford',
  // Accessories
  'accessories': 'Caerleon',
}
```

---

## 9. Quality Reference

| Quality | Name | Multiplier |
|---|---|---|
| 1 | Normal | 1.0× |
| 2 | Good | 1.4× |
| 3 | Outstanding | 2.0× |
| 4 | Excellent | 3.0× |
| 5 | Masterpiece | 5.0× |

Prices at higher qualities are proportionally higher. Quality multipliers should be applied when fetching/displaying prices at quality > 1.

---

## 10. Market Tax Reference

| Status | Market Tax | Notes |
|---|---|---|
| Premium | 4% | 8% total with 1% setup |
| Non-premium | 8% | 9% total with 1% setup |

**Formula:**
```typescript
const NET_REVENUE = SELL_PRICE × QUANTITY × (1 - TAX_RATE - 0.01)
// TAX_RATE = isPremium ? 0.04 : 0.08
```

---

## 11. RRR Reference Table (Full)

```
Station    City    Focus   RRR%
Normal     No      No      15.2
Normal     No      Yes     38.3
Normal     Yes     No      24.8
Normal     Yes     Yes     47.9
Event      No      No      21.2
Event      No      Yes     44.3
Event      Yes     No      30.8
Event      Yes     Yes     53.9
```

**Key insight:** City bonus and focus both apply multiplicatively. The RRR value is the total % of materials returned when crafting.

---

## 12. Item Categories & Sub-Categories

From `items-lite.json`:

**Categories:** `weapon`, `armor`, `consumable`, `material`, `weapon`, `consumable`, `accessory`, `mount`, `familiars`, `others`

**Sub-categories:** `mainhand`, `offhand`, `head`, `chest`, `legs`, `shoes`, `cape`, `alcohol`, `analytics`, `arrows`, `bags`, `bardings`, `blocks`, `books`, `scrolls`, `consumables`, `fish`, `flags`, `flowers`, `food`, `gems`, `harvesters`, `helmets`, `household`, `insurance`, `journalism`, `laborer`, `lamps`, `materials`, `misc`, `mounts`, `pages`, `plants`, `potion`, `raw`, `refinedresources`, `seeds`, `semiFinished`, `shields`, `spells`, `tomes`, `tracked`, `tool consumables`, `transmutation`, `unit`, `unfinished`, `wood`

---

## 13. Open Questions (to resolve before rebuild)

These are intentional unknowns that should be answered during the rebuild:

1. **Deployment target:** Static hosting (Vercel/Netlify) with Express as a separate serverless function, or self-hosted Node server?
2. **Real backend vs localStorage:** Should user data (plans, watchlists) eventually migrate to a real database (Supabase, Firebase, Postgres), or stay client-side?
3. **Payment integration:** If premium upgrade becomes real, which payment provider? Stripe? Paddle?
4. **Multi-server session:** If a user logs in on West but switches to Europe, does session persist? (Currently: yes, it's in localStorage)
5. **Watchlist alerts:** The current implementation is mock. Should real price comparison alerts be implemented? (Would need persistent background tasks or a server component)
6. **Rate limiting:** The AODP API has implicit rate limits. Should the app add explicit request throttling?
7. **Item database updates:** `items-lite.json` is static. How to handle new items added to the game? Auto-sync from AODP?
8. **Enchanted items:** Currently items like `T4_MAIN_SPEAR@3` (T4+3) are included. Should the app handle all enchantment levels, or cap at a certain level?
9. **Mobile experience:** The current app is desktop-first. Prioritize responsive redesign or native mobile app (React Native / Capacitor)?
10. **Auth security:** Client-side auth with localStorage is inherently insecure for real-world use. Consider adding a server-side auth layer if deploying with a real backend.

---

## 14. Phase Planning (Recommended)

### Phase 1 — Foundation
- Project setup: Vite + React + TypeScript + Tailwind v4 + shadcn/ui
- Static item database + search
- AppShell layout (sidebar + header)
- Dark theme with gold accents

### Phase 2 — Price Checker
- Express server + AODP proxy
- localStorage caching layer
- Price fetching + display
- City filter + quality filter
- Freshness indicators

### Phase 3 — Top Flipping
- HOT_ITEMS definition
- Parallel price fetching
- Route generation + profit calculation
- History verification
- Results table + stale-while-revalidate

### Phase 4 — Crafting Calculator
- BaseCalculator component
- Item selection + craft list
- RRR system
- Ingredient resolution
- Shopping list
- Profit calculation

### Phase 5 — Persistence + Auth
- AuthContext (register/login/logout)
- Master superuser
- CraftingPlan save/load/delete
- Auto-save draft
- URL state encoding

### Phase 6 — Advanced Features
- Profit Scanner
- Market Pulse
- Refining Calculator
- Cooking Calculator
- Library (reverse lookup)
- Watchlist + notifications

### Phase 7 — Polish
- Animations (Framer Motion)
- Loading skeletons
- Error states
- Empty states
- Mobile responsive
- Performance optimization

---

---

## 15. Optimizations & Improvements for v2

These are concrete issues found in the current codebase, plus architectural improvements to apply when rebuilding.

---

### 15.1 Architecture & Stack

#### Replace localStorage with TanStack Query (React Query)
**Problem:** `albion-data.ts` and `price-cache.ts` reimplement their own caching logic, TTL checking, and stale detection from scratch. Manual `localStorage.getItem`/`setItem` everywhere — no automatic garbage collection, no background refetch, no deduplication.

**Fix:**
```typescript
// TanStack Query replaces: price-cache.ts, albion-api.ts custom fetch logic,
// plus the getOrMarkStale / setPriceCacheBatch / clearStalePrices manual system
import { useQuery } from '@tanstack/react-query'

const { data } = useQuery({
  queryKey: ['prices', itemIds, locations, qualities, server],
  queryFn: () => fetchPrices(itemIds, locations, qualities, server),
  staleTime: 5 * 60 * 1000,      // 5 min — single item
  gcTime: 30 * 60 * 1000,         // 30 min garbage collection
  refetchOnWindowFocus: false,
  refetchOnMount: false,
})
```
**Why:** Automatic cache invalidation, background refetch, request deduplication, loading/error states, pagination support. Eliminates ~300 lines of manual cache code.

#### Replace Express proxy with Next.js API Routes or a lightweight Hono server
**Problem:** Express + Vite co-hosting is fine for dev but creates a deployment coupling. The server does only two things: proxy + NodeCache.

**Fix:** Hono is 10x lighter than Express (nanoid-based, no middleware bloat) and works in:
- Next.js API routes (serverless-friendly)
- Cloudflare Workers
- Bun standalone

```typescript
// server/index.ts — Hono
import { Hono } from 'hono'
import { NodeCache } from 'cache-manager'
import { cors, logger } from 'hono/middleware'

const app = new Hono()
app.use('*', cors(), logger())
app.use('/api/*', cacheMiddleware()) // shared NodeCache layer
```

#### Add Redis for server-side cache (production)
**Problem:** NodeCache is in-process memory — lost on server restart, doesn't share across instances.

**Fix:**
```typescript
import { createClient } from 'redis'
const redis = createClient({ url: process.env.REDIS_URL })
// TTL: 5 min for prices, 45 min for history
// Bonus: pub/sub for real-time price push to clients
```

---

### 15.2 Data Layer

#### Replace static `items-lite.json` with dynamic item catalog
**Problem:** Static JSON goes stale when the game adds new items. The catalog must be rebuilt and redeployed.

**Fix:** Fetch the item catalog from AODP at server startup and cache it in Redis:
```
GET https://www.albion-online-data.com/api/v2/stats/prices/T4_BAG
```
The API response tells you all available item IDs. Or mirror from the official Albion wiki API.

#### Server-side filtering instead of client-side
**Problem (TopFlipping.tsx):** `buildItemList()` generates all enchantment variants client-side, then fetches them all. For 120 HOT_ITEMS × 5 qualities × 5 enchantments = 3,000 API calls (batched to ~75 requests). All filtering, sorting, dedup runs on the client.

**Fix:** Pass filter params to the server. The server returns pre-filtered results with pagination:
```typescript
// GET /api/opportunities?cities=Martlock,Bridgewatch&qualities=1,2&tiers=4,5,6&sort=profit&limit=50
// Server: fetches HOT_ITEMS, filters, generates routes, sorts, returns top 50
// Client: just renders. No buildOpportunities(), no dedup logic on the client.
```

#### Ingredient resolution as a DAG (Directed Acyclic Graph)
**Problem (BaseCalculator):** `shoppingList` useMemo walks `craftList → craftingRecipe → itemsData.find` for every item on every render. For complex items with 8+ ingredients and recursive sub-ingredients, this is O(n × recipe_depth) and runs on every state change.

**Fix:**
```typescript
// Pre-compute a DAG at app init, not at render time
interface IngredientNode {
  id: string
  name: string
  quantity: number
  children: IngredientNode[]
  isCraftable: boolean
}

// Build once: resolve all recipes recursively
// Topological sort: compute all raw materials in one pass
// Cache the DAG per items-lite.json version
```

#### Index items by ID for O(1) lookup
**Problem:** `itemsData.find(it => it.id === item.id)` in a loop — O(n) per lookup. Called inside useMemo, useEffect, and render for every craft item and every ingredient.

**Fix (already partially done):**
```typescript
// Do this once at module load, not per-render
const ITEMS_BY_ID: Record<string, AlbionItem> = {}
itemsData.forEach(item => { ITEMS_BY_ID[item.id] = item })

// Then: O(1) lookup
const item = ITEMS_BY_ID[item.id]
```

---

### 15.3 Performance

#### Progressive disclosure for Top Flipping results
**Problem (TopFlipping.tsx):** Renders all matched opportunities at once. With 7 cities × 6 qualities, the result set can be 100+ items. All 100 `<motion.div>` components animate in with staggered delays, causing jank on initial render.

**Fix:**
- Virtualize the list with `@tanstack/react-virtual`
- Only render items in viewport
- Defer animation for off-screen items
- Show top 20 initially, "Load More" appends batches of 20

#### Debounce filter changes before triggering scans
**Problem (TopFlipping.tsx):** The useEffect fires on every filter prop change with only 1200ms debounce. No cancellation of in-flight scans when filters change rapidly.

**Fix:**
```typescript
// Already has scanIdRef for abort — strengthen it
const scanController = new AbortController()

useEffect(() => {
  const timer = setTimeout(async () => {
    scanController.abort() // cancel previous
    const newController = new AbortController()
    scanController = newController
    await scanOpportunities({ signal: newController.signal })
  }, 500) // reduce from 1200ms — snappier UI
  return () => {
    clearTimeout(timer)
    scanController.abort()
  }
}, [filterDeps])
```

#### Lazy-load history data (verification)
**Problem (TopFlipping.tsx):** `verifyWithHistory()` fetches 72h history for top 30 results sequentially in batches of 10. This blocks the UI until all 3 batches complete (3 × 300ms = ~1s minimum, plus network variance).

**Fix:**
- Trigger verification as a **background task**, not blocking the main render
- Show results immediately with `verificationStatus: 'unknown'`
- Stream verification results in: update individual items in-place as they complete
- Add a "Verified N of 30" progress indicator

#### WebSocket for real-time price updates
**Problem:** The app is fully pull-based. Prices update only when the user refreshes or when cache expires. A player flipping items needs the latest prices to make decisions.

**Fix:**
```typescript
// Option A: Simple polling (MVP)
// usePriceStream(itemIds, { interval: 30000 }) // 30s

// Option B: WebSocket (production)
// Server subscribes to AODP price webhooks (if available)
// or polls AODP server-side and pushes diffs via WebSocket
// Client receives { itemId, city, price, delta } updates
// TanStack Query's queryClient.setQueryData() updates cache in-place — zero re-render for unchanged items
```

#### Batch API requests smarter
**Problem (albion-api.ts):** `fetchPrices` chunks by 40 items per request regardless of the number of cities and qualities being fetched. With 7 cities and 5 qualities, each chunk still hits the API once — fine. But the retry logic only triggers on 429 and only retries once.

**Fix:**
```typescript
// Token bucket rate limiter (server-side)
import Bottleneck from 'bottleneck'
const limiter = new Bottleneck({ maxConcurrent: 5, minTime: 200 })
// max 5 concurrent requests, 200ms between requests
// Queue all fetchPrices chunks through the limiter
```

---

### 15.4 UI / UX

#### Break BaseCalculator into micro-components
**Problem (BaseCalculator.tsx, ~1,450 lines):** This is a monolith. One component with ~30 sub-panels rendered inline. Extremely hard to test, debug, or modify safely.

**Fix — break into:**
```
BaseCalculator/
├── BaseCalculator.tsx          # Orchestrator, state owner
├── CraftListTable.tsx          # Craft items table
├── CraftItemRow.tsx            # Single row
├── ShoppingListTable.tsx       # Shopping list table
├── ShoppingItemRow.tsx         # Single shopping item row
├── RRRPanel.tsx                # Station/City/Focus toggles
├── SellConfigPanel.tsx         # Sell prices + city
├── CityPriceTable.tsx          # Best market table
├── ProfitSummary.tsx           # Footer summary
├── FinalizeModal.tsx           # Save plan modal
├── AutoSaveToast.tsx           # Auto-save notification
└── RecentItemsDropdown.tsx     # Recent items dropdown
```

**Testing:** Each piece becomes independently testable. State flows down, events flow up.

#### Add an RRR simulator / visual calculator
**Problem:** The RRR panel shows 3 toggles but doesn't explain the impact. A new player doesn't know what "focus" means in-game.

**Fix:**
- Add a small interactive RRR calculator in the panel
- Show side-by-side comparison: "Normal vs Event", "City vs No City"
- Tooltip on each toggle explaining the game mechanic

#### Stale data warnings
**Problem:** Freshness is shown as a colored border/label but doesn't interrupt the user's workflow. A user might act on stale data without realizing it.

**Fix:**
- Add a banner: "⚠ Price data is 18 hours old — market may have shifted" when `freshness === 'stale'`
- Make the banner actionable: "Refresh" button that bypasses cache

#### Price input: support raw silver entry
**Problem:** `sellPrices[item.id]` stores raw numbers but the input uses `toLocaleString()` for display, then strips commas on change. If a user pastes "1,234,567" it works, but "1.2M" doesn't.

**Fix:** Add a smart formatter:
```typescript
// "1.5M" → 1,500,000
// "1500000" → 1,500,000
// "1,500,000" → 1,500,000
function parseSilverInput(raw: string): number {
  const cleaned = raw.replace(/,/g, '')
  if (cleaned.endsWith('k')) return parseFloat(cleaned) * 1_000
  if (cleaned.endsWith('m')) return parseFloat(cleaned) * 1_000_000
  return parseInt(cleaned) || 0
}
```

#### Offline mode with service worker
**Problem:** No offline support. If AODP is down or the user loses connection, the app shows nothing.

**Fix:**
- Service worker caches the app shell + items-lite.json
- When offline: show cached price data with an "Offline — showing cached data from [time]" banner
- Queue user actions (save plan, toggle watchlist) and sync when back online

#### Dark mode toggle (even though dark-only now)
**Problem:** `dark` class is hardcoded. If users want light mode (unlikely but some accessibility cases), they can't.

**Fix:** If building for broader use, add `class="dark"` toggle on the `<html>` element and persist to localStorage. Low priority given the audience.

---

### 15.5 Code Quality

#### Add Error Boundaries
**Problem:** Any uncaught error in a React component crashes the entire app. No error boundary exists.

**Fix:**
```tsx
// src/components/shared/ErrorBoundary.tsx
class ErrorBoundary extends React.Component {
  state = { hasError: false }
  static getDerivedStateFromError() { return { hasError: true } }
  render() {
    if (this.state.hasError) {
      return <div className="p-8 text-center">
        <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-white">Something went wrong</h2>
        <p className="text-primary/50 mt-2">Try refreshing the page</p>
        <button onClick={() => window.location.reload()} className="btn-primary mt-4">Reload</button>
      </div>
    }
    return this.props.children
  }
}
```

#### Add unit tests for calculation logic
**Problem:** `crafting-utils.ts` has the core profit math — but zero tests. A typo in the RRR formula would silently break profit calculations for all users.

**Fix:**
```typescript
// src/lib/crafting-utils.test.ts
describe('getRrr', () => {
  it('returns 15.2 for normal + no city + no focus', () => {
    expect(getRrr({ stationBonus: 10, cityBonus: false, focus: false })).toBe(15.2)
  })
  it('returns 47.9 for normal + city + focus', () => {
    expect(getRrr({ stationBonus: 10, cityBonus: true, focus: true })).toBe(47.9)
  })
})

describe('calculateCraftingProfit', () => {
  it('returns correct profit', () => {
    const net = calculateNetRevenue(10_000, 4, 1) // 9,500
    const mat = calculateMaterialCost([{ id: 'T4_WOOD', count: 10, price: 500 }], 24.8)
    const profit = calculateCraftingProfit(net, mat, 0)
    expect(profit).toBeGreaterThan(0)
  })
})
```

#### Add Playwright E2E tests
- Register/login flow
- Add item to crafting calculator
- Top Flipping scan and verify results render
- Share plan via URL and reload

#### TypeScript: stricter config
**Problem:** Some `any` types in the codebase (`priceData: any[]` in price-cache.ts).

**Fix:**
```jsonc
// tsconfig.json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true
  }
}
```

---

### 15.6 Security (Auth & Data)

#### Migrate from localStorage auth to real backend
**Problem:** SHA-256 in browser is not secure auth — the hash is reversible if an attacker knows the salt. Passwords stored in localStorage are readable by any JS on the page (XSS risk). Users on shared computers can see each other's data.

**Fix:** Choose one:

| Option | Complexity | Best For |
|---|---|---|
| **Supabase Auth + Postgres** | Medium | Full control, self-hosted or cloud |
| **Firebase Auth** | Low | Google account SSO + email, managed |
| **Auth.js (NextAuth)** | Medium | If using Next.js, supports email magic links |
| **Clerk** | Low | Drop-in, excellent dev experience, free tier |

#### Separate client session from server identity
**Problem:** All user data lives in `albion_accounts_v3` in localStorage. `toggleWatchlist()` modifies this array in memory and re-serializes it — no server-side persistence, no conflict resolution.

**Fix:** Once real backend exists, `toggleWatchlist()` becomes:
```typescript
await fetch('/api/watchlist', {
  method: 'POST',
  body: JSON.stringify({ itemId })
})
// Optimistic update: update UI immediately
// Rollback on error
```

#### Watchlist alerts: real background monitoring
**Problem (WatchlistContext.tsx):** Mock implementation — generates fake notifications, doesn't actually compare prices to targets.

**Fix:** Two options:
1. **Serverless function** (cron job every 5 min): query AODP for watchlist items, compare to user's `targetPrice`, send email/webhook if crossed
2. **Service worker + push notifications**: browser pushes alerts even when tab is closed

---

### 15.7 Deployment & DevOps

#### Dockerize the stack
**Problem:** No Docker setup. Dev machine dependency hell.

**Fix:**
```dockerfile
# docker-compose.yml
services:
  app:
    build: .
    ports: ["3000:3000"]
    depends_on:
      - redis
  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]
```

#### Add API rate limit headers from server
**Problem (server.ts):** No explicit rate limiting on the Express server. A malicious or buggy client could hammer AODP and get the IP banned.

**Fix:**
```typescript
import rateLimit from 'express-rate-limit'
const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100,            // 100 requests per minute per IP
  standardHeaders: true,
  legacyHeaders: false,
})
app.use('/api/', limiter)
```

#### Vercel/Netlify deployment config
```jsonc
// vercel.json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "rewrites": [{ "source": "/api/:path*", "destination": "/api/:path*" }]
}
// Note: API routes need to be deployed as serverless functions
// Consider moving to Next.js + API routes for single-deployment
```

---

### 15.8 Summary: What I'd Do Differently

Ranked by impact:

| Priority | Change | Impact |
|---|---|---|
| **1** | TanStack Query | Eliminates 300+ lines of manual cache code, fixes stale data bugs |
| **2** | Server-side filtering for Top Flipping | Moves heavy computation off the client, enables pagination |
| **3** | Break BaseCalculator into micro-components | Makes the codebase maintainable long-term |
| **4** | Real backend (Supabase/Firebase) | Security, cross-device sync, real watchlist alerts |
| **5** | WebSocket / real-time prices | Competitive advantage — other tools don't have this |
| **6** | Virtualize long lists | Fix jank on Top Flipping results page |
| **7** | Add unit tests on crafting-utils | Prevents silent profit calculation bugs |
| **8** | Docker + proper deployment config | Makes the app actually deployable, not just runnable locally |
| **9** | Error boundaries | Graceful degradation instead of white-screen crashes |
| **10** | RRR visual simulator | Better onboarding for new players |

*End of PRD*

---

# Appendices

---

## Appendix A — HOT_ITEMS Reference List

The complete list of ~100 item IDs that Top Flipping and Profit Scanner scan. These are high-volume, frequently traded items. The `@Q` suffix is added dynamically in code (e.g. `T4_MAIN_SPEAR@1`).

### Mounts (16)
```
T4_MOUNT_HORSE, T5_MOUNT_HORSE, T6_MOUNT_HORSE, T7_MOUNT_HORSE, T8_MOUNT_HORSE
T4_MOUNT_OX, T5_MOUNT_OX, T6_MOUNT_OX, T7_MOUNT_OX, T8_MOUNT_OX
T4_MOUNT_GIANTSTAG, T5_MOUNT_MOOSE, T6_MOUNT_DIREBIRD, T7_MOUNT_SWAMPDRAGON, T8_MOUNT_DIREBULL
T4_FARM_GIANTSTAG_GROWN, T5_FARM_MOOSE_GROWN
```

### Bags & Capes (17)
```
T4_BAG, T5_BAG, T6_BAG, T7_BAG, T8_BAG
T4_CAPE, T5_CAPE, T6_CAPE, T7_CAPE, T8_CAPE
T4_CAPEITEM_FW_MARTLOCK, T4_CAPEITEM_FW_LYNHURST, T4_CAPEITEM_FW_FORTSTERLING
T4_CAPEITEM_FW_BRIDGEWATCH, T4_CAPEITEM_FW_THETFORD, T4_CAPEITEM_FW_CAERLEON
```

### Weapons — Warrior (14)
```
T4_MAIN_SWORD, T5_MAIN_SWORD, T6_MAIN_SWORD
T4_MAIN_AXE, T5_MAIN_AXE, T6_MAIN_AXE
T4_MAIN_MACE, T5_MAIN_MACE, T6_MAIN_MACE
T4_MAIN_HAMMER, T5_MAIN_HAMMER, T6_MAIN_HAMMER
T4_2H_CLAYMORE, T5_2H_CLAYMORE, T6_2H_CLAYMORE
```

### Weapons — Hunter (14)
```
T4_MAIN_SPEAR, T5_MAIN_SPEAR, T6_MAIN_SPEAR
T4_2H_BOW, T5_2H_BOW, T6_2H_BOW
T4_2H_WARBOW, T5_2H_WARBOW, T6_2H_WARBOW
T4_2H_CROSSBOW, T5_2H_CROSSBOW, T6_2H_CROSSBOW
T4_2H_NATURESTAFF, T5_2H_NATURESTAFF, T6_2H_NATURESTAFF
```

### Weapons — Mage (18)
```
T4_2H_FIRESTAFF, T5_2H_FIRESTAFF, T6_2H_FIRESTAFF
T4_2H_HOLYSTAFF, T5_2H_HOLYSTAFF, T6_2H_HOLYSTAFF
T4_2H_CURSESTAFF, T5_2H_CURSESTAFF, T6_2H_CURSESTAFF
T4_2H_FROSTSTAFF, T5_2H_FROSTSTAFF, T6_2H_FROSTSTAFF
T4_2H_ARCANESTAFF, T5_2H_ARCANESTAFF, T6_2H_ARCANESTAFF
```

### Armor — Plate (9)
```
T4_HEAD_PLATE_SET1, T5_HEAD_PLATE_SET1, T6_HEAD_PLATE_SET1
T4_ARMOR_PLATE_SET1, T5_ARMOR_PLATE_SET1, T6_ARMOR_PLATE_SET1
T4_SHOES_PLATE_SET1, T5_SHOES_PLATE_SET1, T6_SHOES_PLATE_SET1
```

### Armor — Leather (9)
```
T4_HEAD_LEATHER_SET1, T5_HEAD_LEATHER_SET1, T6_HEAD_LEATHER_SET1
T4_ARMOR_LEATHER_SET1, T5_ARMOR_LEATHER_SET1, T6_ARMOR_LEATHER_SET1
T4_SHOES_LEATHER_SET1, T5_SHOES_LEATHER_SET1, T6_SHOES_LEATHER_SET1
```

### Armor — Cloth (9)
```
T4_HEAD_CLOTH_SET1, T5_HEAD_CLOTH_SET1, T6_HEAD_CLOTH_SET1
T4_ARMOR_CLOTH_SET1, T5_ARMOR_CLOTH_SET1, T6_ARMOR_CLOTH_SET1
T4_SHOES_CLOTH_SET1, T5_SHOES_CLOTH_SET1, T6_SHOES_CLOTH_SET1
```

### Consumables (8)
```
T4_POTION_HEAL, T6_POTION_HEAL
T4_POTION_ENERGY, T6_POTION_ENERGY
T7_POTION_GIGANTIFY
T8_MEAL_STEW, T6_MEAL_STEW
T7_MEAL_OMELETTE, T5_MEAL_OMELETTE
```

### Gathering Tools (15)
```
T4_TOOL_PICK, T5_TOOL_PICK, T6_TOOL_PICK
T4_TOOL_AXE, T5_TOOL_AXE, T6_TOOL_AXE
T4_TOOL_SICKLE, T5_TOOL_SICKLE, T6_TOOL_SICKLE
T4_TOOL_KNIFE, T5_TOOL_KNIFE, T6_TOOL_KNIFE
T4_TOOL_HAMMER, T5_TOOL_HAMMER, T6_TOOL_HAMMER
```

**Total: ~100 base item IDs (before enchantment levels)**

For Top Flipping, each base ID is expanded to all selected enchantment levels (0–3) and all selected qualities (1–5). Max expanded set: 100 × 4 enchantments × 5 qualities = 2,000 item IDs, chunked into ~50 API requests of 40 items each.

---

## Appendix B — Item Database Schema

> **Note:** The original app's `items-lite.json` is loaded dynamically from AODP at runtime. The schema below is derived from `src/types/albion.ts` and `AlbionItem` interface.

### Source
- **Dynamic:** fetched from AODP API or generated at build time from the Albion Online Data Project
- **Static fallback:** `public/data/items-lite.json` — if AODP is down, a bundled static copy serves as fallback

### AlbionItem (TypeScript)

```typescript
interface AlbionItem {
  id: string;              // Required. e.g. "T4_MAIN_SPEAR" or "T4_MAIN_SPEAR@1"
  name: string;           // Required. e.g. "Spear" or "Spear (.1)"
  tier: number;           // Required. 1–8
  enchantment: number;     // Required. 0–3 (0 = no enchantment)
  weight: number;          // Required. Item weight in kg
  itemValue: number;       // Required. Silver value used for station fee calculation
  category: string;        // Required. One of: weapon, armor, consumable, material,
                            //   accessory, mount, familiar, other
  subCategory: string;     // Required. e.g. sword, plate_armor, potion,
                            //   refinedresources, cape, bag, etc.
  craftingRecipe?: Array<{ id: string; count: number }>; // Optional. Ingredients list.
                            //   If absent, item is not craftable.
  icon: string;            // Required. Full URL to render service
                            //   e.g. "https://render.albiononline.com/v1/item/T4_MAIN_SPEAR.png"
}
```

### Field-by-field rules

| Field | Required | Notes |
|---|---|---|
| `id` | Yes | Unique identifier. Format: `T{tier}_{category}_{name}` or `T{tier}_{category}_{name}@{enchantment}`. Used in ALL API calls and as the primary join key. |
| `name` | Yes | Display name shown in search results, cards, and tables. May include enchantment suffix like `(.1)` for +1. |
| `tier` | Yes | Integer 1–8. Used for tier-range filters in Profit Scanner. |
| `enchantment` | Yes | Integer 0–3. 0 = non-enchanted. AODP API handles the `@X` suffix. |
| `weight` | Yes | Float. Not prominently displayed in UI but may be used for carrying capacity calculations in future. |
| `itemValue` | Yes | Integer. Used in station fee formula: `stationFee = itemValue × 0.05 × (userFee / 100)`. Default user fee in app: 500 silver/100 items. |
| `category` | Yes | Lowercase string. Used for category filter dropdown. |
| `subCategory` | Yes | Lowercase string with underscores. Used to determine crafting bonus city. |
| `craftingRecipe` | No | Array of `{id, count}`. If absent or empty array → item is not craftable. |
| `icon` | Yes | Full URL. Must include `referrerPolicy="no-referrer"` when rendering `<img>` tags. |

### AODP Price Response (AlbionPrice)

This is the shape returned by the proxy API for price queries.

```typescript
interface AlbionPrice {
  item_id: string;           // Matches item.id without quality suffix
  city: string;              // One of ALBION_CITIES
  quality: 1 | 2 | 3 | 4 | 5; // Item quality level

  // Sell orders (what sellers are asking)
  sell_price_min: number;     // Lowest ask price
  sell_price_max: number;     // Highest ask price
  sell_price_min_date: string; // ISO timestamp of when min was last updated

  // Buy orders (what buyers are offering)
  buy_price_min: number;      // Lowest bid price
  buy_price_max: number;      // Highest bid price
  buy_price_min_date: string; // ISO timestamp of when bid was last updated

  // Historical context (not always present)
  historical_avg?: number;    // Weighted average over recent period
  historical_count?: number;  // Total count of transactions
}
```

### AODP History Response (AlbionHistory)

```typescript
interface AlbionHistory {
  location: string;           // City name
  item_id: string;
  quality: number;
  data: Array<{
    item_count: number;       // Number of items traded in this period
    avg_price: number;        // Volume-weighted average price
    timestamp: string;        // ISO timestamp at start of this period
  }>;
}
```

### How to regenerate the items database

The item catalog is not stored statically in the rebuild. To generate `items-lite.json`:

```bash
# Option 1: Fetch all item IDs from a known set (use HOT_ITEMS as seed)
# For each HOT_ITEM base ID, call:
curl "https://www.albion-online-data.com/api/v2/stats/prices/T4_MAIN_SPEAR, T5_MAIN_SWORD?locations=Caerleon&qualities=1"
# Parse the item_id field from responses to build the complete catalog.

# Option 2: Mirror from community sources
# Albion Online Wiki API or community-maintained item lists on GitHub.

# Option 3: AODP doesn't provide a full catalog endpoint.
# Use the HOT_ITEMS list as the canonical item list for v2.
# Dynamically expand with enchantment levels at runtime.
```

---

## Appendix C — URL State Encoding Spec

The Calculator uses URL hash (`#state=...`) to share full calculator state via URL. This is the exact encoding spec.

### Overview

Two layers: a human-readable field selector, then base64 encoding.

### Step 1 — Field Selection (compressCalculatorState)

Not all fields are serialized. Only the ones needed to restore calculator state:

```typescript
interface CalculatorState {
  l: Array<{               // craftList — required
    id: string              // item ID e.g. "T4_MAIN_SPEAR"
    c: number               // count (quantity to craft)
    f: number               // stationFeeSilver (fee per craft)
  }>
  h: Record<string, number> // haveList — optional
  m: Record<string, Record<string, number>> // manualPrices — optional
  s: Record<string, number> // sellPrices — optional
  c: Record<string, string> // sourceCities — optional
  g: string                 // globalCity — required (default: "Caerleon")
  r: RrrConfig              // rrrConfig — required
}

interface RrrConfig {
  stationBonus: 10 | 20
  cityBonus: boolean
  focus: boolean
}
```

### Step 2 — Base64 Encoding (serializeState)

```typescript
// Encode
function encodeState(state: CalculatorState): string {
  const json = JSON.stringify(state)
  return btoa(encodeURIComponent(json)
    .replace(/%([0-9A-F]{2})/g, (_, hex) =>
      String.fromCharCode(parseInt(hex, 16))
    )
  )
}

// Decode
function decodeState(hash: string): CalculatorState | null {
  try {
    const json = decodeURIComponent(
      Array.from(atob(hash), c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join('')
    )
    return JSON.parse(json)
  } catch { return null }
}
```

### Step 3 — Full URL

```
https://app.albionmarket.com/calculator/crafting#state=BASE64STRING
```

### Rebuild Notes

- For v2, consider using **LZ-string** compression instead of raw base64 — achieves ~40% shorter URLs for typical calculator states
- Add URL length validation: if encoded string > 2000 chars, warn user or offer a different share method (e.g. save to server, return short link)
- Sanitize all decoded fields before applying to state — validate `globalCity` against ALBION_CITIES list, validate `craftList` item IDs against known items

---

## Appendix D — Responsive Breakpoint Strategy

The current app uses scattered `hidden lg:hidden md:` Tailwind classes that are hard to maintain. Here's the unified strategy for v2.

### Breakpoints

| Name | Min Width | Use Case |
|---|---|---|
| `xs` | 0px | Small phones (≤375px) |
| `sm` | 640px | Large phones, small tablets |
| `md` | 768px | Tablets |
| `lg` | 1024px | Laptops |
| `xl` | 1280px | Desktops |

### Component Strategy

#### AppShell / Sidebar
```
Mobile (xs–md):  Full-width overlay sheet, triggered by hamburger in header
Tablet+ (lg+):    Fixed sidebar, collapsible to icon-only (64px) or full (256px)
```

#### PriceCard (per-city card)
```
Mobile (xs–md):  Stacked layout — price on top, city info below, expand inline
Desktop (lg+):   Single-row layout — all metrics in one row
```

#### Top Flipping Results
```
Mobile (xs–md):  Card stack layout, 1 column, all data visible in card
Desktop (lg+):   Single-row table, all data in one row
```

#### BaseCalculator — Craft List Table
```
Mobile (xs–md):  Card layout per craft item, full ingredient list visible
Tablet (md):     Hybrid — table for craft items, cards for shopping list
Desktop (lg+):   Full-width horizontal table with all columns
```

#### BaseCalculator — Shopping List Table
```
Mobile (xs–lg):  Card layout per ingredient
Desktop (xl+):   Full table
```

### Implementation Pattern

```tsx
// Instead of scattered hidden classes, use a layout component
function ResponsiveTable({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* Mobile: cards */}
      <div className="block xl:hidden space-y-3">
        {/* Mobile-optimized card layout */}
      </div>
      {/* Desktop: table */}
      <div className="hidden xl:block overflow-x-auto">
        {/* Full table */}
      </div>
    </>
  )
}
```

### Priority rules
1. **Never truncate critical data** on mobile — hide columns, not data
2. **Profit numbers must always be visible** — highest priority
3. **Search and filters must always be accessible** — no buried menus
4. **Touch targets minimum 44px** on mobile

---

## Appendix E — Error State Matrix

Per-feature × per-error-type → UI behavior.

### Price Checker

| Error | User sees | Action |
|---|---|---|
| AODP returns 429 | Toast: "Rate limited — retrying in Xs" | Auto-retry with backoff (2s, 4s, 8s) |
| AODP returns 500 | Banner: "Albion data unavailable" | Retry button |
| AODP returns empty array | Inline: "No price data for this item" | Suggest checking quality/city filters |
| Network timeout | Inline: "Connection timed out" | Retry button |
| Item not found | Inline: "Item not found" | Show suggestion to check spelling |
| Cache stale (TTL expired) | Green "Refreshing..." indicator | Background fetch, keep showing stale data |

### Top Flipping

| Error | User sees | Action |
|---|---|---|
| Partial batch failure | Subtle warning badge, 3 of 50 failed | Show partial results, show failed count |
| All batches fail | Full error state: "Scan failed — check connection" | Retry button |
| 0 opportunities found | Empty state: "No profitable routes found" | Suggest widening city/quality filters |
| History verification fails | Items marked "unknown" | No action needed, silent fail |

### Crafting Calculator

| Error | User sees | Action |
|---|---|---|
| Pull Market fails | Inline error: "Failed to fetch prices" | Retry button |
| Item has no recipe | Inline: "No crafting recipe for this item" | Suggest checking Library |
| Ingredient not in database | Console warning, skip ingredient | Manual price input available |
| Auto-save fails | Toast: "Auto-save failed — changes not saved" | Manual save available |
| URL state decode fails | Silent fail, start with empty calculator | No action needed |

### Market Pulse

| Error | User sees | Action |
|---|---|---|
| History fetch fails mid-scan | Progress continues, failed items skipped | Show "N items skipped" at end |
| 429 during batch | 5s wait, resume | Auto-resume |
| 0 volume data | Card: "No recent trading activity" | Grey out card |

### Auth

| Error | User sees | Action |
|---|---|---|
| Wrong email | Inline: "Email not found" | Suggest registering |
| Wrong password | Inline: "Incorrect password" | Retry |
| Email already registered | Inline: "Email already in use" | Suggest login |
| Password too short | Inline: "Password must be at least 6 characters" | Live validation |
| Master superuser wrong password | Inline: "Incorrect password" | No hint that master account exists |
| Reserved email attempted | Inline: "Email not available" | No hint why |

---

## Appendix F — Notification Trigger Logic

### Current State (Mock)
`WatchlistContext` polls every 5 minutes and generates mock `system` notifications. The rebuild should implement real triggers.

### Real Notification Logic

```typescript
interface PriceAlert {
  itemId: string
  targetPrice: number        // user-set threshold
  direction: 'above' | 'below'
}

// Trigger evaluation (serverless function, runs every 5 min)
async function evaluateWatchlist(userId: string) {
  const user = await getUser(userId)
  if (!user.watchlist?.length) return

  const alerts = await getAlerts(userId) // { itemId, targetPrice, direction }
  const prices = await fetchPrices(alerts.map(a => a.itemId), ALL_CITIES, [1], user.server)

  for (const alert of alerts) {
    const latestPrice = prices
      .filter(p => p.item_id === alert.itemId)
      .sort((a, b) => b.sell_price_min_date.localeCompare(a.sell_price_min_date))[0]

    const crossedAbove = alert.direction === 'above' && latestPrice.sell_price_min >= alert.targetPrice
    const crossedBelow = alert.direction === 'below' && latestPrice.sell_price_min <= alert.targetPrice

    if (crossedAbove || crossedBelow) {
      await createNotification(userId, {
        type: crossedAbove ? 'price_spike' : 'price_drop',
        itemId: alert.itemId,
        message: `${getItemName(alert.itemId)} is now ${formatSilver(latestPrice.sell_price_min)} — ${alert.direction === 'above' ? 'above' : 'below'} your target of ${formatSilver(alert.targetPrice)}`,
        createdAt: new Date().toISOString(),
        read: false,
      })
      // Also: delete alert so it doesn't fire again repeatedly
      await deleteAlert(alert.id)
    }
  }
}
```

### Notification Types

| Type | Color | Trigger | Auto-expire |
|---|---|---|---|
| `price_drop` | Green | Price fell below user's alert threshold | Never — stays in history |
| `price_spike` | Red | Price rose above user's alert threshold | Never |
| `system` | Blue | App-level events: watchlist item added, plan saved, etc. | Never |
| `scan_complete` | Blue | Top Flipping scan finished (if notifications enabled) | 1 hour |

### Implementation: Serverless Cron

```typescript
// Vercel Cron or AWS EventBridge → triggers every 5 min
export async function GET(request: Request) {
  const users = await db.select('id').from('users')
  await Promise.all(users.map(evaluateWatchlist))
  return Response.json({ ok: true })
}
```

```json
// vercel.json cron config
{ "cron": "*/5 * * * *" }
```

---

## Appendix G — Auth Flow Spec

### AuthModal UI

A `shadcn/ui` Dialog centered on screen. Two modes toggled inline without navigation.

```
┌─────────────────────────────────────────┐
│ [Lock icon]  Sign In / Create Account   │
│  Access your crafting plans / Join us   │
├─────────────────────────────────────────┤
│  Email                                  │
│  ┌─────────────────────────────────┐   │
│  │ 📧 you@example.com              │   │
│  └─────────────────────────────────┘   │
│                                         │
│  [Animated in on register only]         │
│  Display Name                           │
│  ┌─────────────────────────────────┐   │
│  │ 👤 Your crafter name            │   │
│  └─────────────────────────────────┘   │
│                                         │
│  Password (min. 6 chars on register)    │
│  ┌─────────────────────────────────┐   │
│  │ 🔒 ••••••••••••••    [👁]       │   │
│  └─────────────────────────────────┘   │
│                                         │
│  [Inline error/success feedback]        │
│                                         │
│  [     Sign In / Create Account     ]   │
│                                         │
│  [Already have an account? Sign in]     │
│                                         │
├─────────────────────────────────────────┤
│  Local-First • Password Secured         │
│  No Server Required                     │
└─────────────────────────────────────────┘
```

### Registration Flow

```
User submits form
  ↓
Validate email format (regex)
Validate username ≥ 3 chars
Validate password ≥ 6 chars
  ↓ (fail) → show inline error under relevant field
  ↓ (pass)
Check email !== 'admin@albionnavigator.com'
  ↓ (fail) → "Email not available"
  ↓ (pass)
Check email not in albion_accounts_v3
  ↓ (fail) → "Email already in use"
  ↓ (pass)
Hash password: SHA-256(password + 'albion_nav_salt_v2')
  ↓
Create User object:
  id = crypto.randomUUID()
  role = 'user'
  subscription = { tier: 'free' }
  stats = { contributorLevel: 1, points: 0, joinDate: now }
  craftingPlans = []
  savedSimulations = []
  watchlist = []
  ↓
Append to albion_accounts_v3
Set albion_session_v3 = user object
  ↓
Show success "Account created! Welcome aboard."
Auto-close modal after 900ms
```

### Login Flow

```
User submits form
  ↓
Hash password: SHA-256(password + 'albion_nav_salt_v2')
  ↓
If email === 'admin@albionnavigator.com' AND password === 'AlbionMaster2025!'
  → Load from albion_master_data
  → Set session
  → Done
  ↓
Search albion_accounts_v3 for email match
  ↓ (not found) → "Email not found"
  ↓ (found)
Compare stored hash === computed hash
  ↓ (no match) → "Incorrect password"
  ↓ (match)
Set albion_session_v3 = user object
  ↓
Show success "Welcome back!"
Auto-close modal after 900ms
```

### Master Superuser

| Field | Value |
|---|---|
| Email | `admin@albionnavigator.com` |
| Password | `AlbionMaster2025!` (hardcoded, never stored) |
| ID | `master-superuser` |
| Role | `superuser` |
| Subscription | `premium` |
| Plans limit | Unlimited |
| Watchlist limit | Unlimited |
| Data stored in | `albion_master_data` (separate from accounts) |

### Role Limits

| Limit | Free | Premium | Superuser |
|---|---|---|---|
| Crafting plans | 5 | ∞ | ∞ |
| Watchlist items | 10 | ∞ | ∞ |
| Saved simulations | ∞ | ∞ | ∞ |
| Priority support | No | Yes | Yes |

### Rebuild Note: Auth Security

The localStorage auth is **intentionally insecure for v1**. For v2, the migration path is:
1. Add a `users` table to a real database (Supabase Postgres)
2. Replace `hashPassword()` with server-side bcrypt (cost factor 12)
3. Replace localStorage session with HTTP-only JWT cookie
4. Move `albion_accounts_v3` reads/writes to API routes
5. Add CSRF protection

---

## Appendix H — Enchantment & Quality Multiplier Reference

### Enchantment Levels

Albion items have enchantment tiers: +1 (.1), +2 (.2), +3 (.3), +4 (.4).
In API IDs: `T4_MAIN_SPEAR` = T4 no enchant, `T4_MAIN_SPEAR@1` = T4+1, `T4_MAIN_SPEAR@2` = T4+2, etc.

The app currently supports enchantments 0–3 (T4–T4+3) in the filter UI.

### Quality Levels

| Quality | ID | Price Multiplier | API Quality Flag |
|---|---|---|---|
| Normal | 1 | 1.0× | `qualities=1` |
| Good | 2 | 1.4× | `qualities=2` |
| Outstanding | 3 | 2.0× | `qualities=3` |
| Excellent | 4 | 3.0× | `qualities=4` |
| Masterpiece | 5 | 5.0× | `qualities=5` |

### How AODP Handles Quality

The AODP API **does not automatically apply quality multipliers**. You must request specific qualities explicitly:

```
GET /prices/T4_MAIN_SPEAR?locations=Caerleon&qualities=1,2,3,4,5
```

The API returns separate rows for each quality — the multiplier is implicit in the price data, not computed by the client. The quality field in the response tells you which row is which quality.

**Important:** If you query with `qualities=1` only, you only get Normal quality data. You must explicitly include `2,3,4,5` in the query params to get higher quality prices.

### ID Format in API Calls

```
Base:  T4_MAIN_SPEAR     (no quality in ID — quality is a query param)
With quality: T4_MAIN_SPEAR?qualities=1,2,3
With enchant: T4_MAIN_SPEAR@1  (enchantment is part of the ID)
With both:    T4_MAIN_SPEAR@1?qualities=1,2
```

---

## Appendix I — Testing Strategy

### Tooling

| Type | Tool | Config file |
|---|---|---|
| Unit tests | Vitest | `vitest.config.ts` |
| Component tests | Vitest + Testing Library | (same) |
| E2E tests | Playwright | `playwright.config.ts` |
| Type checking | TypeScript (strict) | `tsconfig.json` |
| Linting | ESLint + Tailwind plugin | `.eslintrc` |

### What to test (prioritized)

#### Tier 1 — Core math (must have)
```typescript
// crafting-utils.test.ts
describe('getRrr', () => {
  it('returns 15.2 for normal + no city + no focus', () => { ... })
  it('returns 47.9 for normal + city + focus', () => { ... })
  it('returns 53.9 for event + city + focus', () => { ... })
  it('returns 0 for null config', () => { ... }) // graceful fallback
})
describe('calculateCraftingProfit', () => {
  it('returns positive profit for profitable craft', () => { ... })
  it('returns negative for loss-making craft', () => { ... })
  it('handles zero prices gracefully', () => { ... })
})
describe('calculateNetRevenue', () => {
  it('applies 4% tax for premium', () => { ... })
  it('applies 8% tax for non-premium', () => { ... })
  it('always deducts 1% setup fee', () => { ... })
})
```

#### Tier 2 — URL state (must have)
```typescript
// share-utils.test.ts
describe('serializeState / deserializeState', () => {
  it('roundtrips a complex calculator state', () => { ... })
  it('handles empty optional fields', () => { ... })
  it('returns null on corrupted input', () => { ... })
})
describe('compressCalculatorState / decompressCalculatorState', () => {
  it('restores craftList correctly', () => { ... })
  it('defaults globalCity to Caerleon', () => { ... })
  it('defaults rrrConfig to normal values', () => { ... })
})
```

#### Tier 3 — Auth (should have)
```typescript
// auth.test.ts
describe('register', () => {
  it('rejects email already registered', () => { ... })
  it('rejects reserved email', () => { ... })
  it('rejects password < 6 chars', () => { ... })
  it('creates user with correct defaults', () => { ... })
})
describe('login', () => {
  it('succeeds with correct credentials', () => { ... })
  it('fails with wrong password', () => { ... })
  it('fails with unknown email', () => { ... })
  it('master superuser always works', () => { ... })
})
```

#### Tier 4 — E2E flows (should have)
```typescript
// e2e/auth.spec.ts
test('register → login → save plan → logout → login again', async () => { ... })

// e2e/calculator.spec.ts
test('search item → add to craft list → pull prices → see profit', async () => { ... })

// e2e/topflipping.spec.ts
test('select cities → start scan → see results → add to watchlist', async () => { ... })
```

### Coverage targets
- **crafting-utils.ts**: 100% (pure functions, easy to cover)
- **share-utils.ts**: 100%
- **AuthContext.tsx**: 100% of non-UI logic
- **Component tests**: 80% of shared components (SearchBar, PriceCard, CityFilter)
- **E2E**: critical user flows only (register, calculator, top flipping, share plan)
