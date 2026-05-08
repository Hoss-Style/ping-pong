# Atlas Supreme Invitational

Ping pong tournament management app for the **Atlas Supreme Invitational** — May 14, 2026.

> 18 teams · 36 players · single elimination with play-in · 1 game to 21 (BO3 finals) · 3 tables · ~2hr runtime

Mobile-first React app. Phone-sized layout (max-width 480px) so it works great on both phone and desktop.

---

## Quick Start

```bash
# 1. Install
npm install

# 2. Run locally
npm run dev
# → opens http://localhost:5173

# 3. Build for production
npm run build
# → outputs to ./dist/

# 4. Preview the build
npm run preview
```

That's it. No backend required for single-device use.

---

## What's in here

```
atlas-supreme-repo/
├── index.html              ← page shell, fonts, meta tags
├── package.json            ← dependencies
├── vite.config.js          ← build config
├── src/
│   ├── main.jsx            ← React entry point
│   └── App.jsx             ← THE WHOLE APP (single file ~3000 lines)
└── README.md               ← this file
```

The entire app is in `src/App.jsx`. Single file by design — easier to understand, hack on, and deploy.

---

## Features

### Tournament Management
- **Edit player names** — tap any name in the Players tab
- **Place players in teams** — tap empty slot, search/pick from full roster
- **Reseed teams** — tap the seed badge in EDIT mode to swap any seed 1–9 with another on that side; bracket rebuilds automatically
- **Lock / unlock bracket** 🔒 — prevents accidental edits during the event
- **Reset options** — clear progress only OR reset everything to defaults

### Live Tournament
- **Bracket view** with round tabs (Play-In → R16 → QF → SF → Final)
- **Score entry** — single game to 21, or BO3 for finals
- **Forfeit / walkover** buttons in score editor
- **Auto-advancement** — winner moves forward; cascade-clears downstream if you edit
- **Live "NOW PLAYING"** banner in schedule (auto-detects current time)
- **Per-table filter** in schedule (T1 / T2 / T3 / All)
- **Player schedule** — tap 📅 next to any player to see all their matches
- **Stats tab** — biggest upset, tightest match, top players, team leaderboard

### Display & Sharing
- **TV mode** 📺 — full-screen layout for casting to a big screen during the event
- **Print schedule** 🖨️ — clean 8.5×11 printable
- **Share match cards** 📤 — branded outcome cards (uses native share / clipboard)

---

## Player Data

Default roster (37 players, 11 confirmed teams + 7 paired solos = 18 teams) is hardcoded at the top of `App.jsx` in `PLAYER_NAMES_DEFAULT`. Update names there before launch, or edit them live in-app.

---

## Persistence

Currently uses **`localStorage`** under the key `atlas-supreme-final-v1`. This means:

- ✅ Works offline
- ✅ Survives page refresh
- ❌ One device only — opening on phone vs desktop = separate brackets

If you need **multi-device sync** (e.g. you score on your phone while the TV displays on a laptop), see the **Multi-Device Sync** section below.

### Reset
- In-app: tap the ↻ icon in the header
- Hard reset: `localStorage.removeItem('atlas-supreme-final-v1')` in browser DevTools

---

## Deployment

### Vercel (easiest)
```bash
npm install -g vercel
vercel
# Follow prompts. Auto-detects Vite.
```

### Netlify
```bash
# Build first
npm run build

# Drag-and-drop the ./dist folder onto netlify.com/drop
```

### GitHub Pages
1. Add `base: '/your-repo-name/'` to `vite.config.js`
2. Run `npm run build`
3. Deploy `dist/` via GitHub Actions or `gh-pages` package

### Self-hosted
The `dist/` folder is plain static HTML/CSS/JS. Drop it on any static host (S3, Cloudflare Pages, your server, etc).

---

## Multi-Device Sync (optional upgrade)

Want everyone to see the same live bracket on their phones while you score from yours? Swap `localStorage` for a real-time backend.

### Option A: Supabase (recommended — free tier works)

1. Create project at [supabase.com](https://supabase.com)
2. In Supabase SQL editor, create a table:
   ```sql
   create table tournament_state (
     id text primary key,
     data jsonb not null,
     updated_at timestamptz default now()
   );
   alter table tournament_state enable row level security;
   create policy "open" on tournament_state for all using (true) with check (true);
   ```
3. `npm install @supabase/supabase-js`
4. In `src/App.jsx`, replace the persistence `useEffect` blocks (search for `// Persistence`) with:

   ```js
   import { createClient } from '@supabase/supabase-js';
   const supabase = createClient('YOUR_URL', 'YOUR_ANON_KEY');
   const ROOM_ID = 'atlas-supreme-2026';

   // Load + subscribe
   useEffect(() => {
     supabase.from('tournament_state').select('data').eq('id', ROOM_ID).single()
       .then(({ data }) => { if (data?.data) setData(data.data); setLoaded(true); });

     const channel = supabase.channel('state')
       .on('postgres_changes',
         { event: '*', schema: 'public', table: 'tournament_state', filter: `id=eq.${ROOM_ID}` },
         (payload) => setData(payload.new.data))
       .subscribe();
     return () => { channel.unsubscribe(); };
   }, []);

   // Save
   useEffect(() => {
     if (!loaded) return;
     supabase.from('tournament_state').upsert({ id: ROOM_ID, data, updated_at: new Date() });
   }, [data, loaded]);
   ```
5. Done — every connected device now stays in sync in real-time.

### Option B: Firebase Realtime Database
Similar to Supabase. `npm install firebase`, init in App, listen to a `/tournaments/atlas-2026` path. Works equally well.

### Option C: Simple polling against your own API
If you have a server somewhere, write a tiny endpoint that GETs/PUTs the `data` blob and poll it every 3-5 seconds. Less elegant but bulletproof.

---

## Customizing Look & Feel

All design tokens live at the top of `App.jsx` in the `T = { ... }` object:

```js
const T = {
  bgDeep:  '#04120E',
  bg:      '#0A2620',
  gold:    '#D4A54B',
  goldBr:  '#F5C86E',
  ivory:   '#F5EEDC',
  red:     '#C7484A',
  // ...
};
```

Change colors, then everything updates. The fonts (Oswald + Barlow Condensed) are loaded from Google Fonts in `index.html`.

---

## Bracket Logic

Defined in two structures near the top of `App.jsx`:

- **`TEAM_SLOTS`** — 18 slots (9 per side), each mapping a default seed → match position
- **`FLOW`** — match → next match + slot index (e.g. `L_PI` winner goes to `L_R1_1` slot 1)

If you ever need to change the format (different bracket size, double elimination, etc), these two structures are where to start.

The reseeding logic uses `SEED_TO_SLOT` to map a side+seed to a slot id, then `rebuildMatchesFromSeeds()` re-fills all R1 + PI match slots based on current seeds. It clears all match progress when reseeding (intentional — preserving partially-played progress through a reseed gets messy fast).

---

## Format Notes

- **Regular matches**: 1 game to 21, win by 2 (input accepts up to 30 to handle deuce scenarios like 22-20)
- **Finals**: Best of 3 to 21 (3 game inputs)
- **Schedule**: 7 waves × ~12 minutes + 3-min buffers = exactly 2 hours
- **Play-in**: 4 teams (seeds 8 & 9 each side) play 2 PI matches; winners face the #1 seeds in R16

---

## Browser Support

Tested in modern Safari, Chrome, Firefox (mobile + desktop). Requires:
- ES2020 support
- CSS `backdrop-filter` (for glass header effect — falls back gracefully)
- `localStorage` enabled

Won't work in IE11. Don't run it in IE11.

---

## Pre-Tournament Checklist

- [ ] Update `PLAYER_NAMES_DEFAULT` in `App.jsx` with final roster
- [ ] (Optional) Set up Supabase for multi-device sync
- [ ] Deploy to Vercel/Netlify and share URL
- [ ] Open the URL on your phone, set seeds 1–7 each side
- [ ] **Lock the bracket** 🔒 the morning of the event
- [ ] Cast TV mode 📺 to a big screen at the venue
- [ ] Print the schedule 🖨️ as a backup
- [ ] Have fun · Dream Big

---

## Troubleshooting

**"My changes don't appear on someone else's phone"**
You're using the default localStorage persistence. Set up Supabase or another backend (see Multi-Device Sync above).

**"I want to start over but the old data keeps loading"**
In-app: ↻ icon → "RESET EVERYTHING". Or in browser DevTools console: `localStorage.clear()`.

**"The fonts look wrong"**
Google Fonts CDN may be blocked. Either host the fonts yourself or replace `Oswald` / `Barlow Condensed` in the `S` styles object with `system-ui` / `sans-serif`.

**"It feels slow on older phones"**
The app is lightweight but renders a lot at once. Try removing the `backdrop-filter` blur in the header style — it's the biggest perf cost.

---

## License

Private. Built for the Atlas Supreme Invitational.

**DREAM BIG.**
