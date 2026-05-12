import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from './supabase.js';

const ROOM_ID = 'atlas-supreme-invitational';

// ═══════════════════════════════════════════════════════════════════════════
// ATLAS SUPREME INVITATIONAL — TOURNAMENT APP
// ═══════════════════════════════════════════════════════════════════════════
// 36 players · 18 teams · single elimination w/ play-in
// 1 game to 21; Finals BO3 to 21
// May 14, 2026 · Phoenix
//
// Persistence: localStorage (single-device).
// For multi-device sync swap for Supabase/Firebase — see README.
// ═══════════════════════════════════════════════════════════════════════════

const STORAGE_KEY = 'atlas-supreme-final-v1';

// ═══ DESIGN TOKENS ═════════════════════════════════════════════════════════
// Brand guide: Atlas Green #2E5B4E · Atlas Orange #F2A23A · Cream #F6F4EF
const T = {
  bgDeep:  '#0B1E17',
  bg:      '#162E24',
  bgMid:   '#1E3D30',
  bgCard:  '#1A3A2C',
  bgSoft:  '#2E5B4E',   // Atlas Green

  goldDark: '#B5761E',
  gold:     '#F2A23A',  // Atlas Orange
  goldBr:   '#FFBC5C',
  goldGlow: '#FFD080',

  ivory:    '#F6F4EF',  // Brand Cream
  ivoryDim: '#C5C2BA',
  parchment:'#E8E3D8',

  sage:     '#6F8B81',  // Brand Sage

  red:      '#C7484A',
  rim:      'rgba(242,162,58,0.28)',
  rimSoft:  'rgba(242,162,58,0.12)',
};

// ═══ DATA MODEL ════════════════════════════════════════════════════════════
const EVENT_DATE = 'MAY 14, 2026';
const NUM_TEAMS = 18;
const PLAYER_NAMES_DEFAULT = [
  // Confirmed teams (paired together as default seeds)
  'JAMES PILLOR', 'JOEY PILLOR',           // L1
  'STEVEN SCHWARZ', 'MAX SCHWARZ',         // L2
  'BILL STERN', 'ROD BEACH',               // L3
  'PHIL HAENEL', 'FOSTER BUNDY',           // L4
  'MARTY MAIER', 'CARTER WILSON',          // L5
  'COOPER FRATT', 'JOSEPH ZAKHARY',        // L6 (paired solo)
  'HAYDEN THOMSON', 'DANNY SCHUSTER',      // L7 (paired solo)
  'CHRIS CANTER', 'TJ CLAASSEN',           // L8 PI (paired solo)
  'HAGEN HYATT', 'BEN SACKS',              // L9 PI (paired solo)
  'MILO MORAN', 'CHRIS WALTON',            // R1
  'TIM WESTFALL', 'JACK MCANDREW',         // R2
  'ROMAN SHENKIRYK', 'BRETT BAKER',        // R3
  'MIKE FORST', 'SPENCER KEMPER',          // R4
  'ADAM PINYARD', 'WARREN KELLY',          // R5
  'JAN DEJONG', 'ANTHONY ARVIDSON',        // R6
  'CHASE GABRIEL', 'STEIN KOSS',           // R7 (paired solo)
  'CHRIS KREWSON', 'TOM LEWIS JR.',        // R8 PI (paired solo)
  'ILENE SMITH', 'ASHLEY PETERS',          // R9 PI (paired solo)
];

// Bracket structure: 18 teams, 4 in play-in (2 PI matches), 14 byes to R16
// Match flow:
//   L_PI → L_R1_1 (bottom slot vs L1)
//   R_PI → R_R1_1 (bottom slot vs R1)
//   L_R1_1 + L_R1_2 → L_QF_1
//   L_R1_3 + L_R1_4 → L_QF_2
//   L_QF_1 + L_QF_2 → L_SF
//   (mirror right) → R_SF
//   L_SF + R_SF → FINAL

const TEAM_SLOTS = [
  // LEFT SIDE
  { id: 'L1', side: 'L', defaultSeed: 1, match: 'L_R1_1', position: 0 },
  { id: 'L4', side: 'L', defaultSeed: 4, match: 'L_R1_2', position: 0 },
  { id: 'L5', side: 'L', defaultSeed: 5, match: 'L_R1_2', position: 1 },
  { id: 'L3', side: 'L', defaultSeed: 3, match: 'L_R1_3', position: 0 },
  { id: 'L6', side: 'L', defaultSeed: 6, match: 'L_R1_3', position: 1 },
  { id: 'L2', side: 'L', defaultSeed: 2, match: 'L_R1_4', position: 0 },
  { id: 'L7', side: 'L', defaultSeed: 7, match: 'L_R1_4', position: 1 },
  { id: 'LP1', side: 'L', defaultSeed: 8, match: 'L_PI', position: 0, pi: true },
  { id: 'LP2', side: 'L', defaultSeed: 9, match: 'L_PI', position: 1, pi: true },
  // RIGHT SIDE
  { id: 'R1', side: 'R', defaultSeed: 1, match: 'R_R1_1', position: 0 },
  { id: 'R4', side: 'R', defaultSeed: 4, match: 'R_R1_2', position: 0 },
  { id: 'R5', side: 'R', defaultSeed: 5, match: 'R_R1_2', position: 1 },
  { id: 'R3', side: 'R', defaultSeed: 3, match: 'R_R1_3', position: 0 },
  { id: 'R6', side: 'R', defaultSeed: 6, match: 'R_R1_3', position: 1 },
  { id: 'R2', side: 'R', defaultSeed: 2, match: 'R_R1_4', position: 0 },
  { id: 'R7', side: 'R', defaultSeed: 7, match: 'R_R1_4', position: 1 },
  { id: 'RP1', side: 'R', defaultSeed: 8, match: 'R_PI', position: 0, pi: true },
  { id: 'RP2', side: 'R', defaultSeed: 9, match: 'R_PI', position: 1, pi: true },
];

// Maps seed (1-9) per side to a TEAM_SLOT id.
// When user reseeds, we keep the slot positions fixed but the TEAM associated
// with each seed changes. The slot's defaultSeed is just the initial label.
const SEED_TO_SLOT = {
  L: { 1: 'L1', 2: 'L2', 3: 'L3', 4: 'L4', 5: 'L5', 6: 'L6', 7: 'L7', 8: 'LP1', 9: 'LP2' },
  R: { 1: 'R1', 2: 'R2', 3: 'R3', 4: 'R4', 5: 'R5', 6: 'R6', 7: 'R7', 8: 'RP1', 9: 'RP2' },
};

// Match advancement flow
const FLOW = {
  L_PI:   { next: 'L_R1_1', slot: 1 },
  L_R1_1: { next: 'L_QF_1', slot: 0 },
  L_R1_2: { next: 'L_QF_1', slot: 1 },
  L_R1_3: { next: 'L_QF_2', slot: 0 },
  L_R1_4: { next: 'L_QF_2', slot: 1 },
  L_QF_1: { next: 'L_SF', slot: 0 },
  L_QF_2: { next: 'L_SF', slot: 1 },
  L_SF:   { next: 'FINAL', slot: 0 },
  R_PI:   { next: 'R_R1_1', slot: 1 },
  R_R1_1: { next: 'R_QF_1', slot: 0 },
  R_R1_2: { next: 'R_QF_1', slot: 1 },
  R_R1_3: { next: 'R_QF_2', slot: 0 },
  R_R1_4: { next: 'R_QF_2', slot: 1 },
  R_QF_1: { next: 'R_SF', slot: 0 },
  R_QF_2: { next: 'R_SF', slot: 1 },
  R_SF:   { next: 'FINAL', slot: 1 },
  FINAL:  null,
};

const ROUNDS = [
  { id: 'PI', label: 'PLAY-IN', short: 'PI', matchIds: ['L_PI', 'R_PI'] },
  { id: 'R1', label: 'ROUND OF 16', short: 'R16',
    matchIds: ['L_R1_1','L_R1_2','L_R1_3','L_R1_4','R_R1_1','R_R1_2','R_R1_3','R_R1_4'] },
  { id: 'QF', label: 'QUARTERFINALS', short: 'QF',
    matchIds: ['L_QF_1','L_QF_2','R_QF_1','R_QF_2'] },
  { id: 'SF', label: 'SEMIFINALS', short: 'SF', matchIds: ['L_SF','R_SF'] },
  { id: 'F',  label: 'FINAL', short: 'F', matchIds: ['FINAL'] },
];

// Schedule: 7 waves × 3 tables; total 2 hours
const SCHEDULE_SLOTS = [
  { time: '4:30 – 4:45', duration: '15 min', round: 'PI',
    matchIds: ['L_PI', 'R_PI', 'L_R1_2'], tables: [1, 2, 3] },
  { time: '4:45 – 5:00', duration: '15 min', round: 'R1',
    matchIds: ['L_R1_3', 'L_R1_4', 'R_R1_2'], tables: [1, 2, 3] },
  { time: '5:00 – 5:15', duration: '15 min', round: 'R1',
    matchIds: ['L_R1_1', 'R_R1_3', 'R_R1_4'], tables: [1, 2, 3] },
  { time: '5:15 – 5:30', duration: '15 min', round: 'R1/QF',
    matchIds: ['R_R1_1', 'L_QF_2', 'R_QF_2'], tables: [1, 2, 3] },
  { time: '5:30 – 5:45', duration: '15 min', round: 'QF',
    matchIds: ['L_QF_1', 'R_QF_1', null], tables: [1, 2, 'Warmup'] },
  { time: '5:45 – 6:00', duration: '15 min', round: 'SF',
    matchIds: ['L_SF', 'R_SF', null], tables: [1, 2, 'Warmup'] },
  { time: '6:00 – 6:30', duration: '30 min', round: 'FINAL',
    matchIds: ['FINAL', null, null], tables: [1, 'Spectate', 'Spectate'] },
];

// ═══ HELPERS ═══════════════════════════════════════════════════════════════
const cloneData = (d) => JSON.parse(JSON.stringify(d));

function makeDefaultData() {
  const players = PLAYER_NAMES_DEFAULT.map((name, i) => ({
    id: `p${i + 1}`,
    name,
  }));

  // Each team gets two consecutive players from the list
  const teams = {};
  TEAM_SLOTS.forEach((slot, idx) => {
    teams[slot.id] = {
      id: slot.id,
      side: slot.side,
      seed: slot.defaultSeed,
      pi: !!slot.pi,
      playerIds: [
        players[idx * 2]?.id || null,
        players[idx * 2 + 1]?.id || null,
      ],
    };
  });

  // All matches start empty except R1 + PI which have their seeded slots filled
  const matches = {};
  TEAM_SLOTS.forEach(s => {
    if (!matches[s.match]) matches[s.match] = makeMatch();
    matches[s.match].slots[s.position] = s.id;
  });
  ['L_QF_1','L_QF_2','L_SF','R_QF_1','R_QF_2','R_SF','FINAL'].forEach(m => {
    if (!matches[m]) matches[m] = makeMatch();
  });

  return { players, teams, matches, locked: false, scheduleTimes: Array(SCHEDULE_SLOTS.length).fill(null) };
}

function makeMatch() {
  return { slots: [null, null], winner: null, scores: { team1: [], team2: [] }, isForfeit: false };
}

function getTeamDisplayName(team, data) {
  if (team?.name) return team.name;
  const p1 = team?.playerIds[0] ? data.players.find(p => p.id === team.playerIds[0]) : null;
  const p2 = team?.playerIds[1] ? data.players.find(p => p.id === team.playerIds[1]) : null;
  if (p1 && p2) return `${p1.name} / ${p2.name}`;
  if (p1) return p1.name;
  if (p2) return p2.name;
  return 'TBD';
}

function getEffectiveSlots(data) {
  return SCHEDULE_SLOTS.map((slot, i) => {
    const override = data?.scheduleTimes?.[i];
    return override ? { ...slot, time: override } : slot;
  });
}

function parseDurationMin(str) {
  return parseInt(str) || 12;
}

function fmtTime(date) {
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
  // e.g. "4:30 PM" or "5:00 PM"
}

function getProjectedSlots(data) {
  const base = getEffectiveSlots(data);
  const actuals = data?.slotActualStarts || [];

  // actuals[slotIdx] = array of ISO strings per table (or null), e.g. ['2026-...', null, '2026-...']
  // slotEarliestStart = the first table to start in each slot (drives cascade)
  const slotEarliestStart = base.map((_, i) => {
    const tableStarts = Array.isArray(actuals[i]) ? actuals[i] : [];
    const valid = tableStarts.filter(Boolean).map(ts => new Date(ts).getTime());
    return valid.length ? new Date(Math.min(...valid)) : null;
  });

  // Forward-fill projections
  const projStart = [...slotEarliestStart];
  for (let i = 1; i < base.length; i++) {
    if (!projStart[i] && projStart[i - 1]) {
      const dur = parseDurationMin(base[i - 1].duration);
      projStart[i] = new Date(projStart[i - 1].getTime() + dur * 60000);
    }
  }

  return base.map((slot, i) => {
    const tableStarts = Array.isArray(actuals[i]) ? actuals[i] : [];
    const hasAnyActual = tableStarts.some(Boolean);
    const proj = projStart[i];
    if (!proj) return { ...slot, projected: false, tableStarts };

    const dur = parseDurationMin(slot.duration);
    const endDate = new Date(proj.getTime() + dur * 60000);
    const timeStr = `${fmtTime(proj)} – ${fmtTime(endDate)}`;
    return {
      ...slot,
      time: timeStr,
      projected: !hasAnyActual,
      tableStarts,
    };
  });
}

function matchLabel(matchId) {
  if (matchId === 'FINAL') return 'CHAMPIONSHIP';
  const side = matchId.startsWith('L') ? 'LEFT' : matchId.startsWith('R') ? 'RIGHT' : '';
  if (matchId.endsWith('_PI')) return `${side} · PLAY-IN`;
  if (matchId.includes('_SF')) return `${side} · SEMIFINAL`;
  if (matchId.includes('_QF_')) return `${side} · QF ${matchId.endsWith('1') ? 1 : 2}`;
  if (matchId.includes('_R1_')) {
    const n = matchId.split('_').pop();
    return `${side} · R16 #${n}`;
  }
  return matchId;
}

function findScheduleSlot(matchId) {
  for (let i = 0; i < SCHEDULE_SLOTS.length; i++) {
    const slot = SCHEDULE_SLOTS[i];
    const tableIdx = slot.matchIds.indexOf(matchId);
    if (tableIdx >= 0) {
      return { slotIndex: i, tableIndex: tableIdx, time: slot.time, table: slot.tables[tableIdx] };
    }
  }
  return null;
}

function parseSlotTime(timeStr) {
  // "4:30 – 4:42" → start/end Date for today
  const [startStr, endStr] = timeStr.split('–').map(s => s.trim());
  const parse = (s) => {
    const [h, m] = s.split(':').map(Number);
    const date = new Date();
    date.setHours(h < 12 ? h + 12 : h, m, 0, 0);
    return date;
  };
  return { start: parse(startStr), end: parse(endStr) };
}

function getLiveSlotInfo(schedSlots = SCHEDULE_SLOTS) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const eventDay = new Date(2026, 4, 14); // May 14 2026

  if (today < eventDay) {
    const daysUntil = Math.round((eventDay - today) / 86400000);
    return { status: 'upcoming', index: 0, daysUntil };
  }
  if (today > eventDay) {
    return { status: 'finished', index: schedSlots.length - 1 };
  }
  // Event day — use clock
  const parsed = schedSlots.map(s => parseSlotTime(s.time));
  for (let i = 0; i < parsed.length; i++) {
    if (now >= parsed[i].start && now <= parsed[i].end) return { status: 'live', index: i };
  }
  if (now < parsed[0].start) {
    return { status: 'upcoming', index: 0, minutesUntil: Math.ceil((parsed[0].start - now) / 60000) };
  }
  for (let i = 0; i < parsed.length - 1; i++) {
    if (now > parsed[i].end && now < parsed[i+1].start) {
      return { status: 'upcoming', index: i+1, minutesUntil: Math.ceil((parsed[i+1].start - now) / 60000) };
    }
  }
  return { status: 'finished', index: parsed.length - 1 };
}

// Compute hot-takes / leaderboards from current data
function computeStats(data) {
  const teamStats = {}, playerStats = {};
  Object.keys(data.teams).forEach(tid => {
    teamStats[tid] = { wins: 0, losses: 0, pf: 0, pa: 0 };
  });
  data.players.forEach(p => { playerStats[p.id] = { wins: 0, losses: 0, name: p.name }; });

  let biggestUpset = null, closestMatch = null, highestScoringMatch = null;
  let totalMatches = 0, totalForfeits = 0, totalPoints = 0, scoredMatches = 0;

  Object.keys(data.matches).forEach(mid => {
    const m = data.matches[mid];
    if (!m.winner) return;
    totalMatches++;

    const t1 = m.slots[0], t2 = m.slots[1];
    if (!t1 || !t2) return;
    const winnerId = m.winner, loserId = winnerId === t1 ? t2 : t1;

    teamStats[winnerId].wins++;
    teamStats[loserId].losses++;
    data.teams[winnerId].playerIds.forEach(pid => { if (pid && playerStats[pid]) playerStats[pid].wins++; });
    data.teams[loserId].playerIds.forEach(pid => { if (pid && playerStats[pid]) playerStats[pid].losses++; });

    if (m.isForfeit) { totalForfeits++; return; }

    const t1Pts = m.scores.team1.reduce((s, g) => s + (g[0] || 0), 0);
    const t2Pts = m.scores.team2.reduce((s, g) => s + (g[1] || 0), 0);
    teamStats[t1].pf += t1Pts; teamStats[t1].pa += t2Pts;
    teamStats[t2].pf += t2Pts; teamStats[t2].pa += t1Pts;
    const matchTotal = t1Pts + t2Pts;
    if (matchTotal > 0) {
      totalPoints += matchTotal;
      scoredMatches++;
      if (!highestScoringMatch || matchTotal > highestScoringMatch.totalPts) {
        highestScoringMatch = { matchId: mid, totalPts: matchTotal, t1Pts, t2Pts, winnerId, loserId };
      }
    }

    const wSeed = data.teams[winnerId].seed, lSeed = data.teams[loserId].seed;
    if (wSeed > lSeed) {
      const gap = wSeed - lSeed;
      if (!biggestUpset || gap > biggestUpset.gap) biggestUpset = { matchId: mid, gap, winnerId, loserId };
    }
    const last = m.scores.team1.length - 1;
    if (last >= 0) {
      const margin = Math.abs(m.scores.team1[last][0] - m.scores.team2[last][1]);
      if (margin > 0 && (!closestMatch || margin < closestMatch.margin)) {
        closestMatch = { matchId: mid, margin };
      }
    }
  });

  const avgPtsPerSide = scoredMatches > 0 ? (totalPoints / scoredMatches / 2).toFixed(1) : null;

  // Undefeated teams (won at least 1, no losses)
  const undefeated = Object.entries(teamStats)
    .filter(([, s]) => s.wins > 0 && s.losses === 0)
    .map(([id]) => ({ id, wins: teamStats[id].wins }))
    .sort((a, b) => b.wins - a.wins);

  // Most dominant by point differential
  const dominantEntry = Object.entries(teamStats)
    .filter(([, s]) => s.wins > 0 && (s.pf - s.pa) > 0)
    .sort((a, b) => (b[1].pf - b[1].pa) - (a[1].pf - a[1].pa))[0];
  const mostDominant = dominantEntry ? { id: dominantEntry[0], diff: dominantEntry[1].pf - dominantEntry[1].pa } : null;

  // Win streak = wins in single-elim (each win = consecutive round)
  const streakEntry = Object.entries(teamStats)
    .filter(([, s]) => s.wins > 0)
    .sort((a, b) => b[1].wins - a[1].wins)[0];
  const winStreak = streakEntry ? { id: streakEntry[0], wins: streakEntry[1].wins } : null;

  return {
    teamStats, playerStats, biggestUpset, closestMatch, highestScoringMatch,
    totalMatches, totalForfeits, totalPoints, avgPtsPerSide,
    undefeated, mostDominant, winStreak,
  };
}

function matchScoreString(match) {
  if (match.isForfeit) return 'FORFEIT';
  if (!match.scores.team1.length) return '';
  return match.scores.team1.map((g, i) => `${g[0]}-${match.scores.team2[i][1]}`).join(', ');
}

function useIsDesktop() {
  const [v, setV] = useState(() => typeof window !== 'undefined' && window.innerWidth >= 960);
  useEffect(() => {
    const fn = () => setV(window.innerWidth >= 960);
    window.addEventListener('resize', fn);
    return () => window.removeEventListener('resize', fn);
  }, []);
  return v;
}

// ═══════════════════════════════════════════════════════════════════════════
// LANDING PAGE
// ═══════════════════════════════════════════════════════════════════════════
function LandingPage({ onEnter }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => { requestAnimationFrame(() => setVisible(true)); }, []);

  const handleEnter = () => {
    onEnter();
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: T.bgDeep,
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden',
    }}>
      <style>{`
        @keyframes landingFadeUp {
          from { opacity: 0; transform: translateY(24px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes heroScale {
          from { transform: scale(1.06); }
          to   { transform: scale(1); }
        }
        .landing-hero-img {
          animation: heroScale 1.4s cubic-bezier(0.22,1,0.36,1) forwards;
        }
        .landing-cta:hover {
          background: #FFBC5C !important;
          transform: translateY(-2px);
          box-shadow: 0 8px 32px rgba(242,162,58,0.5) !important;
        }
        .landing-cta:active { transform: scale(0.97) !important; }
        .landing-bracket-btn:hover { background: rgba(242,162,58,0.15) !important; }
      `}</style>

      {/* Hero image — full bleed */}
      <div style={{
        position: 'absolute', inset: 0, overflow: 'hidden',
      }}>
        <img
          className="landing-hero-img"
          src="/hero.png"
          alt=""
          style={{
            width: '100%', height: '100%',
            objectFit: 'cover', objectPosition: 'center top',
            display: 'block',
          }}
        />
        {/* gradient overlay: dark bottom + left dark panel on desktop */}
        <div style={{
          position: 'absolute', inset: 0,
          background: `
            linear-gradient(to top,  rgba(11,30,23,0.97) 0%, rgba(11,30,23,0.7) 38%, rgba(11,30,23,0.0) 65%),
            linear-gradient(to right, rgba(11,30,23,0.88) 0%, rgba(11,30,23,0.4) 48%, rgba(11,30,23,0.0) 70%)
          `,
        }} />
      </div>

      {/* Content panel — bottom-left anchored */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        padding: '0 28px 48px 28px',
        display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
        opacity: visible ? 1 : 0,
        transition: 'opacity 0.6s ease',
      }}>
        {/* Atlas A logomark */}
        <div style={{ marginBottom: 16, animation: 'landingFadeUp 0.7s 0.05s both' }}>
          <AtlasA size={72} color={T.ivory} />
        </div>

        {/* Event name */}
        <div style={{
          fontFamily: 'Oswald, sans-serif', fontWeight: 700,
          fontSize: 'clamp(36px, 10vw, 72px)',
          lineHeight: 0.9, letterSpacing: '-0.5px',
          color: T.ivory,
          marginBottom: 8,
          animation: 'landingFadeUp 0.7s 0.2s both',
        }}>
          ATLAS<br />
          <span style={{ color: T.gold }}>SUPREME</span>
        </div>
        {/* Gold stars — matching wordmark */}
        <div style={{
          display: 'flex', gap: 10, marginBottom: 10,
          animation: 'landingFadeUp 0.7s 0.26s both',
        }}>
          <Star size={18} /><Star size={18} /><Star size={18} />
        </div>
        <div style={{
          fontFamily: 'Barlow Condensed, sans-serif', fontWeight: 600,
          fontSize: 'clamp(14px, 4vw, 20px)',
          letterSpacing: 5, color: T.sage,
          marginBottom: 4,
          animation: 'landingFadeUp 0.7s 0.28s both',
        }}>
          INVITATIONAL
        </div>
        <div style={{
          fontFamily: 'Barlow Condensed, sans-serif', fontWeight: 500,
          fontSize: 'clamp(11px, 3vw, 14px)',
          letterSpacing: 3, color: T.ivoryDim,
          marginBottom: 36,
          animation: 'landingFadeUp 0.7s 0.34s both',
        }}>
          18 TEAMS · 36 PLAYERS · MAY 14, 2026
        </div>

        {/* Divider */}
        <div style={{
          width: 56, height: 2, background: T.gold, marginBottom: 32,
          animation: 'landingFadeUp 0.7s 0.38s both',
        }} />

        {/* Dream big tagline */}
        <div style={{
          fontFamily: 'Courier Prime, monospace', fontStyle: 'italic',
          fontSize: 'clamp(13px, 3.5vw, 18px)',
          color: T.ivoryDim, letterSpacing: 1,
          marginBottom: 40,
          animation: 'landingFadeUp 0.7s 0.42s both',
        }}>
          "DREAM BIG"
        </div>

      </div>

      {/* Top-right continue button */}
      <div style={{
        position: 'absolute', top: 20, right: 20,
        opacity: visible ? 1 : 0, transition: 'opacity 0.8s 0.4s ease',
      }}>
        <button
          className="landing-cta"
          onClick={() => handleEnter()}
          style={{
            background: 'rgba(11,30,23,0.7)',
            border: `1px solid ${T.rim}`,
            borderRadius: 8, padding: '10px 20px',
            fontFamily: 'Oswald, sans-serif', fontSize: 13,
            letterSpacing: 2, color: T.gold,
            cursor: 'pointer',
            backdropFilter: 'blur(8px)',
            transition: 'all 0.18s ease',
          }}
        >
          CONTINUE →
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ROOT APP
// ═══════════════════════════════════════════════════════════════════════════
export default function App() {
  const [data, setData] = useState(() => makeDefaultData());
  const [tab, setTab] = useState('bracket'); // bracket | schedule | players | stats
  const [activeRound, setActiveRound] = useState('R1');
  const [picker, setPicker] = useState(null);
  const [seedEditor, setSeedEditor] = useState(null);
  const [editingPlayer, setEditingPlayer] = useState(null);
  const [editTeamMode, setEditTeamMode] = useState(false);
  const [resetMenu, setResetMenu] = useState(false);
  const [scoreEditor, setScoreEditor] = useState(null);
  const [shareCard, setShareCard] = useState(null);
  const [playerSchedule, setPlayerSchedule] = useState(null);
  const [tableFilter, setTableFilter] = useState('all');
  const [urlView, setUrlView] = useState(() => new URLSearchParams(window.location.search).get('view') || 'landing');
  const [printMode, setPrintMode] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const navigateView = (view) => {
    const url = view ? `?view=${view}` : `${window.location.pathname}?view=app`;
    window.history.pushState({}, '', url);
    setUrlView(view);
  };
  const [loaded, setLoaded] = useState(false);
  const [toast, setToast] = useState(null);
  const isDesktop = useIsDesktop();
  const [session, setSession]             = useState(null);
  const [showLogin, setShowLogin]         = useState(false);
  const [loginEmail, setLoginEmail]       = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError]       = useState('');
  const [loginLoading, setLoginLoading]   = useState(false);
  const isAdmin = !!session;

  // Auth — watch for login / logout
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setSession(session);
    });
    return () => subscription.unsubscribe();
  }, []);

  // Track whether a save is in flight so real-time doesn't echo it back
  const isSaving = useRef(false);

  // Load from Supabase + real-time sync for all viewers
  useEffect(() => {
    supabase
      .from('tournament_state')
      .select('data')
      .eq('id', ROOM_ID)
      .single()
      .then(({ data: row, error }) => {
        if (error) console.error('[load]', error);
        if (row?.data) setData(row.data);
        setLoaded(true);
      });

    const channel = supabase
      .channel('tournament')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tournament_state' }, payload => {
        // Skip the echo of our own save — admin already has latest state in memory
        if (isSaving.current) return;
        if (payload.new?.data) setData(payload.new.data);
      })
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, []);

  // Save to Supabase — admins only
  useEffect(() => {
    if (!loaded || !isAdmin) return;
    isSaving.current = true;
    supabase.from('tournament_state').upsert({
      id: ROOM_ID,
      data,
      updated_at: new Date().toISOString(),
    }).then(({ error }) => {
      if (error) {
        console.error('[save]', error);
        setToast('⚠️ Save failed'); setTimeout(() => setToast(null), 3000);
      }
      // Allow a short window then re-enable real-time updates from others
      setTimeout(() => { isSaving.current = false; }, 1000);
    });
  }, [data, loaded, isAdmin]);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 1800); };

  // ─── Auth ops ────────────────────────────────────────────────────────────
  const handleLogin = async () => {
    setLoginLoading(true);
    setLoginError('');
    const { error } = await supabase.auth.signInWithPassword({
      email: loginEmail,
      password: loginPassword,
    });
    if (error) {
      setLoginError(error.message);
    } else {
      setShowLogin(false);
      setLoginEmail('');
      setLoginPassword('');
    }
    setLoginLoading(false);
  };

  const handleLogout = () => supabase.auth.signOut();

  // ─── Player ops ──────────────────────────────────────────────────────────
  const updatePlayerName = (playerId, newName) => {
    setData(prev => {
      const next = cloneData(prev);
      const p = next.players.find(p => p.id === playerId);
      if (p) p.name = newName.trim().toUpperCase() || p.name;
      return next;
    });
  };

  const placePlayer = (teamId, slotIndex, playerId) => {
    setData(prev => {
      const next = cloneData(prev);
      Object.keys(next.teams).forEach(tid => {
        next.teams[tid].playerIds = next.teams[tid].playerIds.map(pid =>
          pid === playerId ? null : pid
        );
      });
      next.teams[teamId].playerIds[slotIndex] = playerId;
      const otherIdx = 1 - slotIndex;
      if (next.teams[teamId].playerIds[otherIdx] === null) {
        setTimeout(() => setPicker({ teamId, slotIndex: otherIdx }), 0);
      } else {
        setTimeout(() => setPicker(null), 0);
      }
      return next;
    });
  };

  const removePlayer = (teamId, slotIndex) => {
    setData(prev => {
      const next = cloneData(prev);
      const team = next.teams[teamId];
      team.playerIds[slotIndex] = null;
      Object.keys(next.matches).forEach(mid => {
        const m = next.matches[mid];
        if (m.winner === teamId) {
          clearDownstream(next, mid, teamId);
          m.winner = null;
        }
      });
      return next;
    });
  };

  // ─── SEED REASSIGNMENT ──────────────────────────────────────────────────
  // Swap which team occupies seed N on a given side. Triggers full rebuild
  // of all match slot assignments while preserving teams / players.
  const reassignSeed = (side, fromSeed, toSeed) => {
    if (data.locked) { showToast('Bracket is locked'); return; }
    if (fromSeed === toSeed) return;
    setData(prev => {
      const next = cloneData(prev);

      // Find the two teams on this side currently holding fromSeed and toSeed
      const fromTeam = Object.values(next.teams).find(t => t.side === side && t.seed === fromSeed);
      const toTeam = Object.values(next.teams).find(t => t.side === side && t.seed === toSeed);
      if (!fromTeam || !toTeam) return prev;

      // Swap their seeds
      fromTeam.seed = toSeed;
      toTeam.seed = fromSeed;

      // PI flag follows seeds 8/9
      fromTeam.pi = (toSeed === 8 || toSeed === 9);
      toTeam.pi = (fromSeed === 8 || fromSeed === 9);

      // Rebuild all match slot assignments based on new seeding
      rebuildMatchesFromSeeds(next);

      return next;
    });
    showToast(`Reseeded ${side} bracket`);
  };

  function rebuildMatchesFromSeeds(state) {
    // Reset all match data
    Object.keys(state.matches).forEach(mid => {
      state.matches[mid] = makeMatch();
    });
    // Re-fill R1 and PI slots based on current seeds
    Object.values(state.teams).forEach(team => {
      const slotId = SEED_TO_SLOT[team.side][team.seed];
      const slot = TEAM_SLOTS.find(s => s.id === slotId);
      if (!slot) return;
      // Update the team's id-anchor: keep as-is (we use seed-driven lookup)
      // But matches reference team ids, so we need to put THIS team's id into the slot
      state.matches[slot.match].slots[slot.position] = team.id;
    });
  }

  // ─── Match advancement ──────────────────────────────────────────────────
  const advanceWinner = (matchId, teamId) => {
    if (editTeamMode) return;
    const team = data.teams[teamId];
    if (!team) return;
    if (!data.locked && team.playerIds.some(p => p === null)) {
      const emptyIdx = team.playerIds.findIndex(p => p === null);
      setPicker({ teamId, slotIndex: emptyIdx });
      return;
    }
    setData(prev => {
      const next = cloneData(prev);
      const m = next.matches[matchId];
      if (m.winner === teamId) {
        clearDownstream(next, matchId, teamId);
        m.winner = null;
        m.isForfeit = false;
        m.scores = { team1: [], team2: [] };
      } else {
        if (m.winner) clearDownstream(next, matchId, m.winner);
        m.winner = teamId;
        m.isForfeit = false;
        m.scores = { team1: [], team2: [] };
        const flow = FLOW[matchId];
        if (flow) next.matches[flow.next].slots[flow.slot] = teamId;
      }
      return next;
    });
  };

  const recordForfeit = (matchId, teamId) => {
    setData(prev => {
      const next = cloneData(prev);
      const m = next.matches[matchId];
      if (m.winner) clearDownstream(next, matchId, m.winner);
      m.winner = teamId;
      m.isForfeit = true;
      m.scores = { team1: [], team2: [] };
      const flow = FLOW[matchId];
      if (flow) next.matches[flow.next].slots[flow.slot] = teamId;
      return next;
    });
    setScoreEditor(null);
    showToast('Forfeit recorded');
  };

  const saveScores = (matchId, t1Scores, t2Scores) => {
    setData(prev => {
      const next = cloneData(prev);
      const m = next.matches[matchId];
      m.scores = { team1: t1Scores, team2: t2Scores };
      const t1Wins = t1Scores.filter(s => s[0] > s[1]).length;
      const t2Wins = t2Scores.filter(s => s[0] < s[1]).length;
      const winsNeeded = matchId === 'FINAL' ? 2 : 1;
      let winner = null;
      if (t1Wins >= winsNeeded) winner = m.slots[0];
      else if (t2Wins >= winsNeeded) winner = m.slots[1];
      if (winner) {
        if (m.winner && m.winner !== winner) clearDownstream(next, matchId, m.winner);
        m.winner = winner; m.isForfeit = false;
        const flow = FLOW[matchId];
        if (flow) next.matches[flow.next].slots[flow.slot] = winner;
      } else if (m.winner) {
        // No winner from scores — clear the previously set winner and downstream
        clearDownstream(next, matchId, m.winner);
        m.winner = null;
      }
      return next;
    });
    setScoreEditor(null);
    showToast('Scores saved');
  };

  function clearDownstream(state, fromMatchId, teamId) {
    const flow = FLOW[fromMatchId]; if (!flow) return;
    const ds = state.matches[flow.next];
    if (ds.slots[flow.slot] === teamId) ds.slots[flow.slot] = null;
    if (ds.winner === teamId) {
      const w = ds.winner; ds.winner = null;
      ds.scores = { team1: [], team2: [] };
      clearDownstream(state, flow.next, w);
    }
  }

  // ─── Lock / Unlock ──────────────────────────────────────────────────────
  const toggleLock = () => {
    setData(prev => ({ ...prev, locked: !prev.locked }));
    showToast(data.locked ? 'Rosters unlocked' : 'Rosters locked 🔒');
  };

  // ─── Reset operations ───────────────────────────────────────────────────
  const resetBracketProgress = () => {
    setData(prev => {
      const next = cloneData(prev);
      Object.keys(next.matches).forEach(id => {
        next.matches[id].winner = null;
        next.matches[id].isForfeit = false;
        next.matches[id].scores = { team1: [], team2: [] };
        if (!id.includes('_R1_') && !id.endsWith('_PI')) {
          next.matches[id].slots = [null, null];
        }
      });
      next.slotActualStarts = [];
      next.slotActualEnds = [];
      return next;
    });
    setResetMenu(false);
    showToast('Bracket progress cleared');
  };

  const clearTeamRosters = () => {
    setData(prev => {
      const next = cloneData(prev);
      Object.keys(next.teams).forEach(tid => {
        next.teams[tid].playerIds = [null, null];
        next.teams[tid].name = null;
      });
      Object.keys(next.matches).forEach(id => {
        next.matches[id].winner = null;
        next.matches[id].isForfeit = false;
        next.matches[id].scores = { team1: [], team2: [] };
      });
      next.slotActualStarts = [];
      next.slotActualEnds = [];
      return next;
    });
    setResetMenu(false);
    showToast('Team rosters cleared');
  };

  const resetEverything = () => {
    setData(makeDefaultData());
    setResetMenu(false);
    showToast('Reset to defaults');
  };

  // ─── Helpers / derived ──────────────────────────────────────────────────
  const getPlayerTeam = (playerId) => {
    if (!playerId) return null;
    for (const tid of Object.keys(data.teams)) {
      if (data.teams[tid].playerIds.includes(playerId)) return data.teams[tid];
    }
    return null;
  };

  const stats = useMemo(() => {
    let placed = 0, complete = 0;
    Object.values(data.teams).forEach(t => {
      t.playerIds.forEach(p => p && placed++);
      if (t.playerIds.every(p => p !== null)) complete++;
    });
    return { placed, complete };
  }, [data]);

  const champion = data.matches.FINAL?.winner ? data.teams[data.matches.FINAL.winner] : null;

  // URL-based view routing
  if (urlView === 'landing') {
    return (
      <>
        <style>{globalCSS}</style>
        <LandingPage onEnter={() => navigateView('')} />
      </>
    );
  }
  if (urlView === 'bracket') {
    return <TVDisplay data={data} view="bracket" onExit={() => navigateView('')} />;
  }
  if (urlView === 'schedule') {
    return <TVScheduleDisplay data={data} onExit={() => navigateView('')} />;
  }
  if (printMode) {
    return <PrintSchedule data={data} onClose={() => setPrintMode(false)} />;
  }

  // ─── RENDER ─────────────────────────────────────────────────────────────
  return (
    <div style={S.appShell}>
      <style>{globalCSS}</style>
      <div style={{ ...S.app, maxWidth: isDesktop ? 'none' : '480px', overflowX: isDesktop ? 'visible' : 'hidden' }}>

        {/* HEADER */}
        <header style={S.header}>
          <div style={S.brandBlock}>
            <AtlasA size={48} color={T.bgSoft} />
            <div style={{ marginLeft: 10 }}>
              <div style={S.brandTitle}>ATLAS <span style={{ color: T.gold }}>SUPREME</span></div>
              <div style={S.eventLabel}>INVITATIONAL · {EVENT_DATE}</div>
            </div>
          </div>
          <div style={{ position: 'relative' }}>
            {/* Hamburger button */}
            <button
              style={S.hamburgerBtn}
              onClick={() => setMenuOpen(o => !o)}
              aria-label="Menu"
            >
              <span style={S.hamLine} />
              <span style={S.hamLine} />
              <span style={S.hamLine} />
            </button>

            {/* Dropdown menu */}
            {menuOpen && (
              <>
                {/* Backdrop to close */}
                <div style={{ position: 'fixed', inset: 0, zIndex: 199 }} onClick={() => setMenuOpen(false)} />
                <div style={S.dropMenu}>
                  {/* TV views */}
                  <div style={S.dropSection}>DISPLAY</div>
                  <button style={S.dropItem} className="drop-item-hover" onClick={() => { navigateView('landing'); setMenuOpen(false); }}>
                    <span style={S.dropIcon}>🏠</span> Home
                  </button>
                  <button style={S.dropItem} className="drop-item-hover" onClick={() => { navigateView('bracket'); setMenuOpen(false); }}>
                    <span style={S.dropIcon}>📺</span> Bracket TV
                  </button>
                  <button style={S.dropItem} className="drop-item-hover" onClick={() => { navigateView('schedule'); setMenuOpen(false); }}>
                    <span style={S.dropIcon}>🖥️</span> Schedule TV
                  </button>

                  {/* Print */}
                  <div style={S.dropDivider} />
                  <div style={S.dropSection}>PRINT</div>
                  <button style={S.dropItem} className="drop-item-hover" onClick={() => { setPrintMode(true); setMenuOpen(false); }}>
                    <span style={S.dropIcon}>🖨️</span> Print / Bracket
                  </button>

                  {/* Admin actions */}
                  {isAdmin && (
                    <>
                      <div style={S.dropDivider} />
                      <div style={S.dropSection}>ADMIN</div>
                      <button style={S.dropItem} className="drop-item-hover" onClick={() => { toggleLock(); setMenuOpen(false); }}>
                        <span style={S.dropIcon}>{data.locked ? '🔒' : '🔓'}</span>
                        {data.locked ? 'Unlock Rosters' : 'Lock Rosters'}
                      </button>
                      <button style={S.dropItem} className="drop-item-hover" onClick={() => { setResetMenu(true); setMenuOpen(false); }}>
                        <span style={S.dropIcon}>↻</span> Reset…
                      </button>
                      <div style={S.dropDivider} />
                      <button style={{ ...S.dropItem, color: T.sage }} className="drop-item-hover" onClick={() => { handleLogout(); setMenuOpen(false); }}>
                        <span style={S.dropIcon}>→</span> Log out
                      </button>
                    </>
                  )}

                  {/* Login */}
                  {!isAdmin && (
                    <>
                      <div style={S.dropDivider} />
                      <button style={S.dropItem} className="drop-item-hover" onClick={() => { setShowLogin(true); setMenuOpen(false); }}>
                        <span style={S.dropIcon}>🔑</span> Admin login
                      </button>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        </header>


        {/* TAB BAR */}
        <nav style={S.tabBar}>
          {[
            { id: 'bracket',  label: 'BRACKET',  sub: `${stats.complete}/18` },
            { id: 'schedule', label: 'SCHEDULE', sub: '3 TABLES' },
            { id: 'players',  label: 'TEAMS',     sub: `${stats.placed}/36` },
            { id: 'stats',    label: 'STATS',    sub: 'LIVE' },
          ].map(t => (
            <button
              key={t.id}
              style={tab === t.id ? S.tabActive : S.tab}
              onClick={() => setTab(t.id)}
            >
              <span style={S.tabLabel}>{t.label}</span>
              <span style={S.tabSub}>{t.sub}</span>
            </button>
          ))}
        </nav>

        {/* CONTENT */}
        <main style={S.content}>
          {tab === 'bracket' && (isDesktop ? (
            <DesktopBracketView
              data={data}
              onTeamTap={isAdmin ? (matchId) => setScoreEditor({ matchId }) : undefined}
              onScoreEdit={isAdmin ? setScoreEditor : undefined}
              onShareMatch={setShareCard}
              locked={!isAdmin}
            />
          ) : (
            <BracketView
              data={data}
              activeRound={activeRound}
              setActiveRound={setActiveRound}
              onTeamTap={isAdmin ? (matchId) => setScoreEditor({ matchId }) : undefined}
              onSlotTap={isAdmin && !data.locked ? (teamId, slotIndex) => setPicker({ teamId, slotIndex }) : undefined}
              onRemovePlayer={isAdmin && !data.locked ? removePlayer : undefined}
              editTeamMode={editTeamMode}
              setEditTeamMode={isAdmin && !data.locked ? setEditTeamMode : () => {}}
              onScoreEdit={isAdmin ? setScoreEditor : undefined}
              onShareMatch={setShareCard}
              onSeedEdit={isAdmin && !data.locked ? setSeedEditor : undefined}
              locked={!isAdmin}
            />
          ))}
          {tab === 'schedule' && (
            <ScheduleView data={data} isAdmin={isAdmin}
              onTimeEdit={(idx, newTime) => {
                const next = cloneData(data);
                if (!next.scheduleTimes) next.scheduleTimes = Array(SCHEDULE_SLOTS.length).fill(null);
                next.scheduleTimes[idx] = newTime;
                setData(next);
              }}
              onSlotStart={(slotIdx, tableIdx) => {
                const next = cloneData(data);
                if (!next.slotActualStarts) next.slotActualStarts = [];
                if (!Array.isArray(next.slotActualStarts[slotIdx])) {
                  next.slotActualStarts[slotIdx] = [null, null, null];
                }
                next.slotActualStarts[slotIdx][tableIdx] = new Date().toISOString();
                setData(next);
              }}
              onSlotStop={(slotIdx, tableIdx) => {
                const next = cloneData(data);
                if (!next.slotActualEnds) next.slotActualEnds = [];
                if (!Array.isArray(next.slotActualEnds[slotIdx])) {
                  next.slotActualEnds[slotIdx] = [null, null, null];
                }
                next.slotActualEnds[slotIdx][tableIdx] = new Date().toISOString();
                setData(next);
              }}
              onSlotRestart={(slotIdx, tableIdx) => {
                const next = cloneData(data);
                if (Array.isArray(next.slotActualEnds?.[slotIdx])) {
                  next.slotActualEnds[slotIdx][tableIdx] = null;
                }
                setData(next);
              }}
            />
          )}
          {tab === 'players' && (
            <PlayersView
              data={data}
              isAdmin={isAdmin}
              editingPlayer={isAdmin ? editingPlayer : null}
              setEditingPlayer={isAdmin ? setEditingPlayer : () => {}}
              updatePlayerName={isAdmin ? updatePlayerName : () => {}}
              getPlayerTeam={getPlayerTeam}
              onPlayerSchedule={(pid) => setPlayerSchedule({ playerId: pid })}
              onSlotTap={isAdmin ? (teamId, slotIndex) => setPicker({ teamId, slotIndex }) : undefined}
              onTeamNameEdit={isAdmin ? (teamId, name) => {
                const next = cloneData(data);
                next.teams[teamId].name = name || null;
                setData(next);
              } : undefined}
              onAddAlternate={isAdmin ? (name) => {
                const next = cloneData(data);
                if (!next.alternates) next.alternates = [];
                next.alternates.push({ id: `alt_${Date.now()}`, name: name.trim().toUpperCase() });
                setData(next);
              } : undefined}
              onRemoveAlternate={isAdmin ? (altId) => {
                const next = cloneData(data);
                next.alternates = (next.alternates || []).filter(a => a.id !== altId);
                setData(next);
              } : undefined}
              onAssignAlternate={isAdmin ? (altId, teamId, slotIndex) => {
                const next = cloneData(data);
                const alt = (next.alternates || []).find(a => a.id === altId);
                if (!alt) return;
                // Remove alt from alternates list
                next.alternates = next.alternates.filter(a => a.id !== altId);
                // Check if there's already a player in that slot — move them back to unplaced (they stay in players list)
                // Add alt as a real player
                const newPlayer = { id: alt.id, name: alt.name };
                if (!next.players.find(p => p.id === alt.id)) next.players.push(newPlayer);
                // Remove from any other team
                Object.keys(next.teams).forEach(tid => {
                  next.teams[tid].playerIds = next.teams[tid].playerIds.map(pid => pid === alt.id ? null : pid);
                });
                next.teams[teamId].playerIds[slotIndex] = alt.id;
                setData(next);
              } : undefined}
            />
          )}
          {tab === 'stats' && <StatsView data={data} />}
        </main>

        {/* CHAMPION BADGE */}
        {champion && tab === 'bracket' && (
          <ChampionBadge team={champion} players={data.players} />
        )}

        {/* MODALS / SHEETS */}
        {picker && (
          <PlayerPicker
            data={data}
            picker={picker}
            onClose={() => setPicker(null)}
            onPick={(pid) => placePlayer(picker.teamId, picker.slotIndex, pid)}
            onPickAlt={(altId) => {
              const next = cloneData(data);
              const alt = (next.alternates || []).find(a => a.id === altId);
              if (!alt) return;
              next.alternates = next.alternates.filter(a => a.id !== altId);
              if (!next.players.find(p => p.id === alt.id)) next.players.push({ id: alt.id, name: alt.name });
              Object.keys(next.teams).forEach(tid => {
                next.teams[tid].playerIds = next.teams[tid].playerIds.map(pid => pid === alt.id ? null : pid);
              });
              next.teams[picker.teamId].playerIds[picker.slotIndex] = alt.id;
              setData(next);
              setPicker(null);
            }}
          />
        )}
        {seedEditor && (
          <SeedEditor
            data={data}
            side={seedEditor.side}
            currentSeed={seedEditor.currentSeed}
            onClose={() => setSeedEditor(null)}
            onReassign={(newSeed) => {
              reassignSeed(seedEditor.side, seedEditor.currentSeed, newSeed);
              setSeedEditor(null);
            }}
          />
        )}
        {scoreEditor && (
          <ScoreEditor
            data={data}
            matchId={scoreEditor.matchId}
            onClose={() => setScoreEditor(null)}
            onSave={saveScores}
            onForfeit={recordForfeit}
          />
        )}
        {shareCard && (
          <ShareMatchCard
            data={data}
            matchId={shareCard.matchId}
            onClose={() => setShareCard(null)}
          />
        )}
        {playerSchedule && (
          <PlayerScheduleSheet
            data={data}
            playerId={playerSchedule.playerId}
            onClose={() => setPlayerSchedule(null)}
          />
        )}
        {resetMenu && (
          <ResetMenu
            onClose={() => setResetMenu(false)}
            onResetBracket={resetBracketProgress}
            onClearRosters={clearTeamRosters}
            onResetAll={resetEverything}
          />
        )}
        {toast && <div style={S.toast}>{toast}</div>}

        {/* LOGIN MODAL */}
        {showLogin && (
          <div style={S.overlay} onClick={() => setShowLogin(false)}>
            <div style={S.loginModal} onClick={e => e.stopPropagation()}>
              <div style={S.loginTitle}>ADMIN LOGIN</div>
              <input
                style={S.loginInput}
                type="email"
                placeholder="Email"
                value={loginEmail}
                onChange={e => setLoginEmail(e.target.value)}
                autoComplete="email"
              />
              <input
                style={S.loginInput}
                type="password"
                placeholder="Password"
                value={loginPassword}
                onChange={e => setLoginPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
                autoComplete="current-password"
              />
              {loginError && <div style={S.loginError}>{loginError}</div>}
              <button style={S.loginSubmit} onClick={handleLogin} disabled={loginLoading}>
                {loginLoading ? 'Signing in…' : 'Sign In'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// BRACKET VIEW
// ═══════════════════════════════════════════════════════════════════════════
function BracketView({ data, activeRound, setActiveRound, onTeamTap, onSlotTap, onRemovePlayer,
                      editTeamMode, setEditTeamMode, onScoreEdit, onShareMatch, onSeedEdit, locked }) {
  const round = ROUNDS.find(r => r.id === activeRound);
  return (
    <div style={S.bracketView}>
      {/* Round selector */}
      <div style={S.roundTabs}>
        {ROUNDS.map(r => {
          const matches = r.matchIds.map(mid => data.matches[mid]).filter(Boolean);
          const completed = matches.filter(m => m.winner).length;
          const isActive = activeRound === r.id;
          return (
            <button key={r.id} style={isActive ? S.roundTabActive : S.roundTab}
                    onClick={() => setActiveRound(r.id)}>
              <div style={S.roundShort}>{r.short}</div>
              <div style={S.roundProgress}>{completed}/{matches.length}</div>
            </button>
          );
        })}
      </div>

      {/* Toolbar */}
      <div style={S.bracketToolbar}>
        <button
          style={editTeamMode ? S.toolbarBtnActive : S.toolbarBtn}
          onClick={() => !locked && setEditTeamMode(v => !v)}
          disabled={locked}
        >
          {editTeamMode ? 'DONE EDITING' : '✎ EDIT TEAMS'}
        </button>
        {activeRound === 'R1' || activeRound === 'PI' ? (
          <span style={S.toolbarHint}>
            {locked ? 'Bracket locked' : editTeamMode
              ? 'Tap × to remove, tap seed to reseed'
              : 'Tap a team to advance · Tap empty slot to fill'}
          </span>
        ) : (
          <span style={S.toolbarHint}>
            {locked ? 'Bracket locked' : 'Tap winner to advance · Tap 📊 to enter scores'}
          </span>
        )}
      </div>

      {/* Matches */}
      <div style={S.matchList}>
        {round.matchIds.map((mid, idx) => (
          <MatchCard
            key={mid}
            matchId={mid}
            match={data.matches[mid]}
            data={data}
            onTeamTap={onTeamTap}
            onSlotTap={onSlotTap}
            onRemovePlayer={onRemovePlayer}
            editTeamMode={editTeamMode}
            indexInRound={idx}
            onScoreEdit={() => onScoreEdit({ matchId: mid })}
            onShareMatch={() => onShareMatch({ matchId: mid })}
            onSeedEdit={onSeedEdit}
            locked={locked}
          />
        ))}
      </div>
    </div>
  );
}

function MatchCard({ matchId, match, data, onTeamTap, onSlotTap, onRemovePlayer, editTeamMode,
                    indexInRound, onScoreEdit, onShareMatch, onSeedEdit, locked }) {
  const isFinal = matchId === 'FINAL';
  const finalDecided = isFinal && match.winner;
  const hasScores = match.scores.team1.length > 0;

  return (
    <div style={{ ...S.matchCard, ...(finalDecided ? S.matchCardChamp : {}) }}>
      <div style={S.matchHeader}>
        <span style={S.matchHeaderLabel}>{matchLabel(matchId)}</span>
        <div style={S.matchHeaderRight}>
          {match.isForfeit && <span style={S.matchHeaderForfeit}>FORFEIT</span>}
          {hasScores && <span style={S.matchHeaderTag}>SCORED</span>}
          {match.winner && !hasScores && !match.isForfeit && (
            <span style={S.matchHeaderTag}>ADVANCED</span>
          )}
        </div>
      </div>

      <TeamRow teamId={match.slots[0]} match={match} data={data} matchId={matchId}
               onTeamTap={onTeamTap} onSlotTap={onSlotTap} onRemovePlayer={onRemovePlayer}
               editTeamMode={editTeamMode} isFinal={isFinal} onSeedEdit={onSeedEdit} locked={locked} />

      <div style={S.vsRow}>
        <div style={S.vsLine} />
        {match.winner && matchScoreString(match)
          ? <div style={S.vsScore}>{matchScoreString(match)}</div>
          : <div style={S.vsLabel}>VS</div>}
        <div style={S.vsLine} />
      </div>

      <TeamRow teamId={match.slots[1]} match={match} data={data} matchId={matchId}
               onTeamTap={onTeamTap} onSlotTap={onSlotTap} onRemovePlayer={onRemovePlayer}
               editTeamMode={editTeamMode} isFinal={isFinal} onSeedEdit={onSeedEdit} locked={locked} />
    </div>
  );
}

function TeamRow({ teamId, match, data, matchId, onTeamTap, onSlotTap, onRemovePlayer,
                   editTeamMode, isFinal, onSeedEdit, locked }) {
  if (!teamId) {
    const isPI = matchId === 'L_R1_1' || matchId === 'R_R1_1';
    return (
      <div style={S.teamRowEmpty}>
        <span style={S.teamRowEmptyText}>
          {isPI ? '↑ WINNER OF PLAY-IN' : 'WAITING FOR WINNER...'}
        </span>
      </div>
    );
  }

  const team = data.teams[teamId];
  const player1 = team.playerIds[0] ? data.players.find(p => p.id === team.playerIds[0]) : null;
  const player2 = team.playerIds[1] ? data.players.find(p => p.id === team.playerIds[1]) : null;
  const isComplete = !!(player1 && player2);
  const isWinner = match.winner === teamId;
  const isLoser = match.winner && !isWinner;
  const showSlots = matchId.includes('_R1_') || matchId.endsWith('_PI');

  const handleTap = () => {
    if (locked || editTeamMode) return;
    if (!isComplete) {
      const empty = team.playerIds.findIndex(p => p === null);
      if (empty >= 0) onSlotTap(teamId, empty);
    } else {
      onTeamTap(matchId, teamId);
    }
  };

  return (
    <div
      style={{
        ...S.teamRow,
        ...(isWinner ? S.teamRowWinner : {}),
        ...(isLoser ? S.teamRowLoser : {}),
        ...(isFinal && isWinner ? S.teamRowChamp : {}),
      }}
      onClick={handleTap}
    >
      <div
        style={{
          ...S.teamSeed,
          ...(isFinal && isWinner ? { color: T.bgDeep } : {}),
          ...(editTeamMode && showSlots ? S.teamSeedEditable : {}),
        }}
        onClick={(e) => {
          if (editTeamMode && showSlots && !locked) {
            e.stopPropagation();
            onSeedEdit({ side: team.side, currentSeed: team.seed });
          }
        }}
      >
        {team.seed}
        {team.pi && <div style={S.piTag}>PI</div>}
      </div>
      <div style={S.teamPlayers}>
        {showSlots ? (
          <>
            <PlayerSlot player={player1} num={1}
              onTap={(e) => { e.stopPropagation(); !locked && onSlotTap(teamId, 0); }}
              onRemove={(e) => { e.stopPropagation(); !locked && onRemovePlayer(teamId, 0); }}
              editMode={editTeamMode} isChamp={isFinal && isWinner} locked={locked} />
            <PlayerSlot player={player2} num={2}
              onTap={(e) => { e.stopPropagation(); !locked && onSlotTap(teamId, 1); }}
              onRemove={(e) => { e.stopPropagation(); !locked && onRemovePlayer(teamId, 1); }}
              editMode={editTeamMode} isChamp={isFinal && isWinner} locked={locked} />
          </>
        ) : (
          <>
            <div style={{ ...S.teamPlayerName, ...(isFinal && isWinner ? { color: T.bgDeep } : {}) }}>
              {player1 ? player1.name : <span style={S.tbd}>...</span>}
            </div>
            <div style={{ ...S.teamPlayerName, ...(isFinal && isWinner ? { color: T.bgDeep } : {}) }}>
              {player2 ? player2.name : <span style={S.tbd}>...</span>}
            </div>
          </>
        )}
      </div>
      {isWinner && (
        <div style={S.winnerCheck}>
          <CheckIcon color={isFinal ? T.bgDeep : T.gold} />
        </div>
      )}
    </div>
  );
}

function PlayerSlot({ player, num, onTap, onRemove, editMode, isChamp, locked }) {
  if (!player) {
    return (
      <button style={S.playerSlotEmpty} onClick={onTap} disabled={locked}>
        <span style={S.plus}>+</span>
        <span style={S.playerSlotEmptyLabel}>TAP TO ADD PLAYER {num}</span>
      </button>
    );
  }
  return (
    <div style={S.playerSlotFilled}>
      <span style={{ ...S.playerSlotName, ...(isChamp ? { color: T.bgDeep } : {}) }}>
        {player.name}
      </span>
      {editMode && !locked && <button style={S.removeBtn} onClick={onRemove}>×</button>}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// DESKTOP BRACKET — March Madness style for screens ≥ 960px
// ═══════════════════════════════════════════════════════════════════════════
function DesktopBracketView({ data, onTeamTap, onScoreEdit, onShareMatch, locked }) {
  const MH = 150, MW = 210, HG = 14, VG = 22, PAD = 40;
  const containerRef = useRef(null);
  const [scale, setScale] = useState(1);
  const UNIT = MH + VG;

  // Vertical centers for each match relative to bracket top
  const rc = [0,1,2,3].map(i => i * UNIT + MH / 2);
  const qc = [[0,1],[2,3]].map(([a,b]) => (rc[a] + rc[b]) / 2);
  const sc = (qc[0] + qc[1]) / 2;

  // Top positions
  const rt = rc.map(c => c - MH / 2);
  const qt = qc.map(c => c - MH / 2);
  const st = sc - MH / 2;
  const totalH = rt[3] + MH + PAD * 2;

  // Column X positions
  const C = {};
  C.piX  = 0;
  C.r1X  = MW + HG;
  C.qfX  = C.r1X  + MW + HG;
  C.sfX  = C.qfX  + MW + HG;
  C.finX = C.sfX  + MW + HG;
  C.rsfX = C.finX + MW + HG;
  C.rqfX = C.rsfX + MW + HG;
  C.rr1X = C.rqfX + MW + HG;
  C.rpiX = C.rr1X + MW + HG;
  const totalW = C.rpiX + MW;

  useEffect(() => {
    const compute = () => {
      if (!containerRef.current) return;
      const available = containerRef.current.offsetWidth - 24;
      setScale(available / totalW);
    };
    compute();
    window.addEventListener('resize', compute);
    return () => window.removeEventListener('resize', compute);
  }, [totalW]);

  const Y = c => PAD + c;
  const lp = { stroke: T.gold, strokeWidth: 1.5, opacity: 0.35, strokeLinecap: 'round' };

  // Helper to generate a bracket pair connector
  const pairLines = (prefix, x1, x2, ya, yb, ymid) => {
    const xm = x1 + HG / 2;
    return [
      <line key={`${prefix}a`} x1={x1} y1={ya}   x2={xm} y2={ya}   {...lp} />,
      <line key={`${prefix}b`} x1={x1} y1={yb}   x2={xm} y2={yb}   {...lp} />,
      <line key={`${prefix}v`} x1={xm} y1={ya}   x2={xm} y2={yb}   {...lp} />,
      <line key={`${prefix}m`} x1={xm} y1={ymid} x2={x2} y2={ymid} {...lp} />,
    ];
  };

  const svgLines = [
    // Left PI → R1_1
    <line key="l-pi" x1={C.piX+MW} y1={Y(rc[0])} x2={C.r1X}    y2={Y(rc[0])} {...lp} />,
    // Left R1 → QF
    ...pairLines('l-r1a', C.r1X+MW,    C.qfX,      Y(rc[0]), Y(rc[1]), Y(qc[0])),
    ...pairLines('l-r1b', C.r1X+MW,    C.qfX,      Y(rc[2]), Y(rc[3]), Y(qc[1])),
    // Left QF → SF
    ...pairLines('l-qf',  C.qfX+MW,    C.sfX,      Y(qc[0]), Y(qc[1]), Y(sc)),
    // Left SF → Final
    <line key="l-sf" x1={C.sfX+MW}  y1={Y(sc)}  x2={C.finX}  y2={Y(sc)}  {...lp} />,
    // Right SF → Final
    <line key="r-sf" x1={C.finX+MW} y1={Y(sc)}  x2={C.rsfX}  y2={Y(sc)}  {...lp} />,
    // Right QF → SF (connectors on left of QF, toward rsfX right edge)
    ...pairLines('r-qf',  C.rqfX,      C.rsfX+MW,  Y(qc[0]), Y(qc[1]), Y(sc)),
    // Right R1 → QF (connectors on left of R1, toward rqfX right edge)
    ...pairLines('r-r1a', C.rr1X,      C.rqfX+MW,  Y(rc[0]), Y(rc[1]), Y(qc[0])),
    ...pairLines('r-r1b', C.rr1X,      C.rqfX+MW,  Y(rc[2]), Y(rc[3]), Y(qc[1])),
    // Right PI → R1_1
    <line key="r-pi" x1={C.rr1X+MW} y1={Y(rc[0])} x2={C.rpiX} y2={Y(rc[0])} {...lp} />,
  ];

  const mc = (matchId, x, top, isFinalCard = false) => (
    <div key={matchId} style={{ position: 'absolute', left: x, top: PAD + top }}>
      <DesktopMatchCard
        matchId={matchId} data={data}
        onTeamTap={onTeamTap} onScoreEdit={onScoreEdit} onShareMatch={onShareMatch}
        locked={locked} width={MW} isFinalCard={isFinalCard}
      />
    </div>
  );

  const LABELS = [
    [C.piX,  'PLAY-IN'],   [C.r1X,  'ROUND OF 16'], [C.qfX,  'QUARTERFINALS'],
    [C.sfX,  'SEMIFINALS'],[C.finX, 'CHAMPIONSHIP'], [C.rsfX, 'SEMIFINALS'],
    [C.rqfX, 'QUARTERFINALS'], [C.rr1X, 'ROUND OF 16'], [C.rpiX, 'PLAY-IN'],
  ];

  const innerH = 28 + totalH; // labels (22 + 6 margin) + bracket

  return (
    <div ref={containerRef} style={S.desktopWrap}>
      <div style={{
        transformOrigin: 'top left',
        transform: `scale(${scale})`,
        width: totalW,
        position: 'relative',
      }}>
        {/* Column labels */}
        <div style={{ position: 'relative', width: totalW, height: 28, marginBottom: 10 }}>
          {LABELS.map(([x, label]) => (
            <div key={label + x} style={{ ...S.dmcColLabel, left: x, width: MW }}>{label}</div>
          ))}
        </div>
        {/* Bracket */}
        <div style={{ position: 'relative', width: totalW, height: totalH }}>
          <svg style={{ position: 'absolute', inset: 0, width: totalW, height: totalH, pointerEvents: 'none' }}>
            {svgLines}
          </svg>
          {mc('L_PI',   C.piX,  rt[0])}
          {mc('L_R1_1', C.r1X,  rt[0])} {mc('L_R1_2', C.r1X, rt[1])}
          {mc('L_R1_3', C.r1X,  rt[2])} {mc('L_R1_4', C.r1X, rt[3])}
          {mc('L_QF_1', C.qfX,  qt[0])} {mc('L_QF_2', C.qfX, qt[1])}
          {mc('L_SF',   C.sfX,  st)}
          {mc('FINAL',  C.finX, st, true)}
          {mc('R_SF',   C.rsfX, st)}
          {mc('R_QF_1', C.rqfX, qt[0])} {mc('R_QF_2', C.rqfX, qt[1])}
          {mc('R_R1_1', C.rr1X, rt[0])} {mc('R_R1_2', C.rr1X, rt[1])}
          {mc('R_R1_3', C.rr1X, rt[2])} {mc('R_R1_4', C.rr1X, rt[3])}
          {mc('R_PI',   C.rpiX, rt[0])}
        </div>
      </div>
      {/* Spacer so parent grows to scaled height */}
      <div style={{ height: innerH * scale, flexShrink: 0 }} />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TV BRACKET VIEW — read-only, oversized championship card
// ═══════════════════════════════════════════════════════════════════════════
function TVBracketView({ data }) {
  const MH = 155, MW = 220, HG = 14, VG = 24, PAD = 40;
  const MH_F = 340, MW_F = 360; // final card: ~2.3× taller, 1.6× wider
  const containerRef = useRef(null);
  const [scale, setScale] = useState(1);
  const UNIT = MH + VG;

  const rc = [0,1,2,3].map(i => i * UNIT + MH / 2);
  const qc = [[0,1],[2,3]].map(([a,b]) => (rc[a] + rc[b]) / 2);
  const sc = (qc[0] + qc[1]) / 2;

  const rt = rc.map(c => c - MH / 2);
  const qt = qc.map(c => c - MH / 2);
  const st = sc - MH / 2;
  const finalTop = sc - MH_F / 2;
  const totalH = rt[3] + MH + PAD * 2;

  const C = {};
  C.piX  = 0;
  C.r1X  = MW + HG;
  C.qfX  = C.r1X  + MW + HG;
  C.sfX  = C.qfX  + MW + HG;
  C.finX = C.sfX  + MW + HG;
  C.rsfX = C.finX + MW_F + HG; // wider gap because final card is wider
  C.rqfX = C.rsfX + MW + HG;
  C.rr1X = C.rqfX + MW + HG;
  C.rpiX = C.rr1X + MW + HG;
  const totalW = C.rpiX + MW;

  useEffect(() => {
    const compute = () => {
      if (!containerRef.current) return;
      const available = containerRef.current.offsetWidth - 24;
      setScale(available / totalW);
    };
    compute();
    window.addEventListener('resize', compute);
    return () => window.removeEventListener('resize', compute);
  }, [totalW]);

  const Y = c => PAD + c;
  const lp = { stroke: T.gold, strokeWidth: 1.5, opacity: 0.4, strokeLinecap: 'round' };

  const pairLines = (prefix, x1, x2, ya, yb, ymid) => {
    const xm = x1 + HG / 2;
    return [
      <line key={`${prefix}a`} x1={x1} y1={ya}   x2={xm} y2={ya}   {...lp} />,
      <line key={`${prefix}b`} x1={x1} y1={yb}   x2={xm} y2={yb}   {...lp} />,
      <line key={`${prefix}v`} x1={xm} y1={ya}   x2={xm} y2={yb}   {...lp} />,
      <line key={`${prefix}m`} x1={xm} y1={ymid} x2={x2} y2={ymid} {...lp} />,
    ];
  };

  const svgLines = [
    <line key="l-pi"  x1={C.piX+MW}   y1={Y(rc[0])} x2={C.r1X}       y2={Y(rc[0])} {...lp} />,
    ...pairLines('l-r1a', C.r1X+MW,    C.qfX,         Y(rc[0]), Y(rc[1]), Y(qc[0])),
    ...pairLines('l-r1b', C.r1X+MW,    C.qfX,         Y(rc[2]), Y(rc[3]), Y(qc[1])),
    ...pairLines('l-qf',  C.qfX+MW,    C.sfX,         Y(qc[0]), Y(qc[1]), Y(sc)),
    <line key="l-sf"  x1={C.sfX+MW}   y1={Y(sc)}    x2={C.finX}      y2={Y(sc)}    {...lp} />,
    <line key="r-sf"  x1={C.finX+MW_F} y1={Y(sc)}   x2={C.rsfX}      y2={Y(sc)}    {...lp} />,
    ...pairLines('r-qf',  C.rqfX,       C.rsfX+MW,    Y(qc[0]), Y(qc[1]), Y(sc)),
    ...pairLines('r-r1a', C.rr1X,       C.rqfX+MW,    Y(rc[0]), Y(rc[1]), Y(qc[0])),
    ...pairLines('r-r1b', C.rr1X,       C.rqfX+MW,    Y(rc[2]), Y(rc[3]), Y(qc[1])),
    <line key="r-pi"  x1={C.rr1X+MW}  y1={Y(rc[0])} x2={C.rpiX}      y2={Y(rc[0])} {...lp} />,
  ];

  const mc  = (mid, x, top) => (
    <div key={mid} style={{ position: 'absolute', left: x, top: PAD + top }}>
      <TVMatchCard matchId={mid} data={data} width={MW} />
    </div>
  );
  const mcF = (mid, x, top) => (
    <div key={mid} style={{ position: 'absolute', left: x, top: PAD + top }}>
      <TVMatchCard matchId={mid} data={data} width={MW_F} isFinal />
    </div>
  );

  const LABELS = [
    [C.piX, 'PLAY-IN'], [C.r1X, 'ROUND OF 16'], [C.qfX, 'QUARTERFINALS'],
    [C.sfX, 'SEMIFINALS'], [C.finX, 'CHAMPIONSHIP'], [C.rsfX, 'SEMIFINALS'],
    [C.rqfX, 'QUARTERFINALS'], [C.rr1X, 'ROUND OF 16'], [C.rpiX, 'PLAY-IN'],
  ];
  const LABEL_WIDTHS = { [C.finX]: MW_F };

  const innerH = 28 + totalH;

  return (
    <div ref={containerRef} style={S.desktopWrap}>
      <div style={{ transformOrigin: 'top left', transform: `scale(${scale})`, width: totalW, position: 'relative' }}>
        <div style={{ position: 'relative', width: totalW, height: 28, marginBottom: 10 }}>
          {LABELS.map(([x, label]) => (
            <div key={label + x} style={{ ...S.dmcColLabel, left: x, width: LABEL_WIDTHS[x] ?? MW }}>{label}</div>
          ))}
        </div>
        <div style={{ position: 'relative', width: totalW, height: totalH }}>
          <svg style={{ position: 'absolute', inset: 0, width: totalW, height: totalH, pointerEvents: 'none' }}>
            {svgLines}
          </svg>
          {mc('L_PI',   C.piX,  rt[0])}
          {mc('L_R1_1', C.r1X,  rt[0])} {mc('L_R1_2', C.r1X, rt[1])}
          {mc('L_R1_3', C.r1X,  rt[2])} {mc('L_R1_4', C.r1X, rt[3])}
          {mc('L_QF_1', C.qfX,  qt[0])} {mc('L_QF_2', C.qfX, qt[1])}
          {mc('L_SF',   C.sfX,  st)}
          {mcF('FINAL', C.finX, finalTop)}
          {mc('R_SF',   C.rsfX, st)}
          {mc('R_QF_1', C.rqfX, qt[0])} {mc('R_QF_2', C.rqfX, qt[1])}
          {mc('R_R1_1', C.rr1X, rt[0])} {mc('R_R1_2', C.rr1X, rt[1])}
          {mc('R_R1_3', C.rr1X, rt[2])} {mc('R_R1_4', C.rr1X, rt[3])}
          {mc('R_PI',   C.rpiX, rt[0])}
        </div>
      </div>
      <div style={{ height: innerH * scale, flexShrink: 0 }} />
    </div>
  );
}

function TVMatchCard({ matchId, data, width, isFinal = false }) {
  const match = data.matches[matchId];
  if (!match) return null;

  const renderSlot = (slotIdx) => {
    const teamId = match.slots[slotIdx];
    const isWinner = match.winner === teamId && !!teamId;
    const isLoser  = !!match.winner && match.winner !== teamId && !!teamId;
    const champWin = isFinal && isWinner;

    if (!teamId) {
      const isPI = (matchId === 'L_R1_1' || matchId === 'R_R1_1') && slotIdx === 1;
      return (
        <div style={{ ...S.tvmcSlot, opacity: 0.3 }}>
          <span style={S.tvmcSeed}>–</span>
          <span style={{ ...S.tvmcName, ...(isFinal ? S.tvmcNameFinal : {}) }}>{isPI ? 'PI WINNER' : 'TBD'}</span>
        </div>
      );
    }

    const team = data.teams[teamId];
    const p1 = team.playerIds[0] ? data.players.find(p => p.id === team.playerIds[0]) : null;
    const p2 = team.playerIds[1] ? data.players.find(p => p.id === team.playerIds[1]) : null;
    const displayName = getTeamDisplayName(team, data);
    const hasTeamName = !!team.name;

    return (
      <div style={{
        ...S.tvmcSlot,
        ...(isWinner && !champWin ? S.tvmcSlotWin : {}),
        ...(champWin ? S.tvmcSlotChamp : {}),
        ...(isLoser ? S.tvmcSlotLose : {}),
        ...(isFinal ? S.tvmcSlotFinalPad : {}),
      }}>
        <span style={{ ...S.tvmcSeed, ...(isFinal ? S.tvmcSeedFinal : {}), ...(champWin ? { color: T.bgDeep } : {}) }}>
          {team.seed}
        </span>
        <div style={S.tvmcNames}>
          <div style={{ ...S.tvmcName, ...(isFinal ? S.tvmcNameFinal : {}), ...(champWin ? { color: T.bgDeep } : {}) }}>
            {hasTeamName ? team.name : (p1?.name || '—')}
          </div>
          {!hasTeamName && (
            <div style={{ ...S.tvmcName, ...(isFinal ? S.tvmcNameFinal : {}), ...(champWin ? { color: T.bgDeep } : {}) }}>
              {p2?.name || '—'}
            </div>
          )}
          {hasTeamName && (
            <div style={{ ...S.tvmcSubNames, ...(champWin ? { color: T.bgDeep, opacity: 0.6 } : {}) }}>
              {[p1?.name, p2?.name].filter(Boolean).join(' / ') || ''}
            </div>
          )}
        </div>
        {isWinner && (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
               stroke={champWin ? T.bgDeep : T.gold} strokeWidth="3" style={{ flexShrink: 0 }}>
            <path d="M5 12l5 5L20 7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </div>
    );
  };

  const shortLabel = matchLabel(matchId).replace('LEFT · ', 'L · ').replace('RIGHT · ', 'R · ');

  return (
    <div style={{
      ...S.dmc, width,
      ...(isFinal ? {
        border: `2px solid ${T.gold}`,
        boxShadow: `0 0 32px rgba(212,165,75,0.5), inset 0 0 24px rgba(212,165,75,0.07)`,
        borderRadius: 12,
      } : {}),
    }}>
      {renderSlot(0)}
      <div style={S.dmcDivider} />
      {renderSlot(1)}
    </div>
  );
}

function DesktopMatchCard({ matchId, data, onTeamTap, onScoreEdit, onShareMatch, locked, width, isFinalCard }) {
  const match = data.matches[matchId];
  if (!match) return null;
  const isFinal = matchId === 'FINAL';

  const renderSlot = (slotIdx) => {
    const teamId = match.slots[slotIdx];
    const isWinner = match.winner === teamId && !!teamId;
    const isLoser  = !!match.winner && match.winner !== teamId && !!teamId;

    if (!teamId) {
      const isPI = (matchId === 'L_R1_1' || matchId === 'R_R1_1') && slotIdx === 1;
      return (
        <div style={S.dmcSlotEmpty}>
          <span style={S.dmcSeedEmpty}>–</span>
          <span style={S.dmcNameTbd}>{isPI ? 'PI WINNER' : 'TBD'}</span>
        </div>
      );
    }

    const team = data.teams[teamId];
    const p1 = team.playerIds[0] ? data.players.find(p => p.id === team.playerIds[0]) : null;
    const p2 = team.playerIds[1] ? data.players.find(p => p.id === team.playerIds[1]) : null;
    const champWin = isFinal && isWinner;
    const hasTeamName = !!team.name;

    return (
      <div
        style={{
          ...S.dmcSlot,
          ...(isWinner ? (champWin ? S.dmcSlotChamp : S.dmcSlotWin) : {}),
          ...(isLoser  ? S.dmcSlotLose : {}),
          cursor: locked ? 'default' : 'pointer',
        }}
        onClick={() => !locked && onTeamTap && onTeamTap(matchId, teamId)}
      >
        <span style={{ ...S.dmcSeed, ...(champWin ? { color: T.bgDeep } : {}) }}>
          {team.seed}
        </span>
        <div style={S.dmcPlayerNames}>
          {hasTeamName && (
            <div style={{ ...S.dmcTeamName, ...(champWin ? { color: T.bgDeep } : {}), ...(isFinalCard ? { fontSize: 14 } : {}) }}>
              {team.name}
            </div>
          )}
          <div style={{ ...S.dmcPName, ...(champWin ? { color: T.bgDeep } : {}), ...(isFinalCard ? { fontSize: 16, fontWeight: 700 } : {}), ...(hasTeamName ? { opacity: 0.6, fontSize: 11 } : {}) }}>
            {p1 ? p1.name : '…'}
          </div>
          <div style={{ ...S.dmcPName, ...(champWin ? { color: T.bgDeep } : {}), ...(isFinalCard ? { fontSize: 16, fontWeight: 700 } : {}), ...(hasTeamName ? { opacity: 0.6, fontSize: 11 } : {}) }}>
            {p2 ? p2.name : '…'}
          </div>
        </div>
        {isWinner && (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
               stroke={champWin ? T.bgDeep : T.gold} strokeWidth="3" style={{ flexShrink: 0 }}>
            <path d="M5 12l5 5L20 7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </div>
    );
  };

  const shortLabel = matchLabel(matchId)
    .replace('LEFT · ', 'L · ').replace('RIGHT · ', 'R · ');

  const finalCardStyle = isFinalCard ? {
    border: `2px solid ${T.gold}`,
    boxShadow: `0 0 24px rgba(212,165,75,0.45), inset 0 0 16px rgba(212,165,75,0.06)`,
    borderRadius: 10,
  } : {};

  // For the final, show series score (e.g. "1–0") counting only played games.
  // For regular matches, show score string only once winner is set.
  const dividerScore = (() => {
    if (isFinalCard) {
      const played = (match.scores?.team1 || []).filter(g => g[0] > 0 || g[1] > 0);
      if (!played.length) return '';
      const t1w = played.filter(g => g[0] > g[1]).length;
      const t2w = played.filter(g => g[1] > g[0]).length;
      return `${t1w}–${t2w}`;
    }
    return match.winner ? matchScoreString(match) : '';
  })();

  return (
    <div style={{ ...S.dmc, width, ...finalCardStyle }}>
      {renderSlot(0)}
      <div style={S.dmcDivider}>
        {dividerScore && <span style={S.dmcScore}>{dividerScore}</span>}
      </div>
      {renderSlot(1)}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SEED EDITOR — swap seeds 1-9 within a side
// ═══════════════════════════════════════════════════════════════════════════
function SeedEditor({ data, side, currentSeed, onClose, onReassign }) {
  // Find current team holding currentSeed
  const currentTeam = Object.values(data.teams).find(t => t.side === side && t.seed === currentSeed);
  const currentP1 = currentTeam ? data.players.find(p => p.id === currentTeam.playerIds[0]) : null;
  const currentP2 = currentTeam ? data.players.find(p => p.id === currentTeam.playerIds[1]) : null;

  // All seeds on this side, sorted
  const seedsOnSide = [1,2,3,4,5,6,7,8,9].map(seed => {
    const team = Object.values(data.teams).find(t => t.side === side && t.seed === seed);
    return { seed, team };
  });

  return (
    <div style={S.sheetBackdrop} onClick={onClose}>
      <div style={S.sheet} onClick={e => e.stopPropagation()}>
        <div style={S.sheetHandleWrap} onClick={onClose}><div style={S.sheetHandle} /></div>
        <div style={S.sheetHeader}>
          <div>
            <div style={S.sheetTitle}>REASSIGN SEED</div>
            <div style={S.sheetSub}>
              {side === 'L' ? 'LEFT' : 'RIGHT'} BRACKET · CURRENTLY SEED {currentSeed}
            </div>
            {currentTeam && (
              <div style={S.seedEditorCurrent}>
                {currentP1?.name || '—'} / {currentP2?.name || '—'}
              </div>
            )}
          </div>
          <button style={S.sheetClose} onClick={onClose}>×</button>
        </div>
        <div style={S.seedExplain}>
          Swap with another seed on the {side === 'L' ? 'LEFT' : 'RIGHT'} side.
          The bracket will rebuild with new matchups.
        </div>
        <div style={S.seedList}>
          {seedsOnSide.map(({ seed, team }) => {
            const p1 = team ? data.players.find(p => p.id === team.playerIds[0]) : null;
            const p2 = team ? data.players.find(p => p.id === team.playerIds[1]) : null;
            const isCurrent = seed === currentSeed;
            return (
              <button
                key={seed}
                style={{ ...S.seedItem, ...(isCurrent ? S.seedItemCurrent : {}) }}
                onClick={() => !isCurrent && onReassign(seed)}
                disabled={isCurrent}
              >
                <div style={S.seedItemBadge}>{seed}{seed >= 8 && <span style={S.piTagSmall}>PI</span>}</div>
                <div style={S.seedItemBody}>
                  {team ? (
                    <>
                      <div style={S.seedItemName}>{p1?.name || '—'}</div>
                      <div style={S.seedItemName}>{p2?.name || '—'}</div>
                    </>
                  ) : (
                    <div style={S.seedItemEmpty}>Empty</div>
                  )}
                </div>
                {isCurrent && <div style={S.seedItemCurrentLabel}>CURRENT</div>}
                {!isCurrent && <div style={S.seedItemSwap}>SWAP →</div>}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SCHEDULE VIEW
// ═══════════════════════════════════════════════════════════════════════════
function ScheduleMatchLine({ mid, tableNum, data }) {
  const match = mid ? data.matches[mid] : null;
  const t1 = match?.slots[0] ? data.teams[match.slots[0]] : null;
  const t2 = match?.slots[1] ? data.teams[match.slots[1]] : null;
  const w1 = match?.winner && match.winner === match?.slots[0];
  const w2 = match?.winner && match.winner === match?.slots[1];
  const n1 = t1 ? getTeamDisplayName(t1, data) : null;
  const n2 = t2 ? getTeamDisplayName(t2, data) : null;
  const done = !!match?.winner;
  if (!n1 && !n2) return null;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0, minWidth: 0 }}>
      <div style={{
        fontFamily: 'Oswald, sans-serif', fontSize: 11, fontWeight: 600,
        color: T.gold, letterSpacing: 1, minWidth: 24, flexShrink: 0,
      }}>T{tableNum}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, flex: 1 }}>
        <span style={{
          fontFamily: 'Barlow Condensed, sans-serif', fontSize: 14, fontWeight: 600,
          color: w2 ? T.ivoryDim : T.ivory,
          opacity: done && !w1 ? 0.45 : 1,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{n1 || 'TBD'}</span>
        <span style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: 11, color: T.sage, flexShrink: 0 }}>vs</span>
        <span style={{
          fontFamily: 'Barlow Condensed, sans-serif', fontSize: 14, fontWeight: 600,
          color: w1 ? T.ivoryDim : T.ivory,
          opacity: done && !w2 ? 0.45 : 1,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{n2}</span>
        {done && <span style={{ fontSize: 11, color: T.gold, flexShrink: 0 }}>✓</span>}
      </div>
    </div>
  );
}

function ScheduleView({ data, isAdmin, onTimeEdit, onSlotStart, onSlotStop, onSlotRestart }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 15000);
    return () => clearInterval(id);
  }, []);

  const rawLive = getLiveSlotInfo(SCHEDULE_SLOTS);
  const isEventDay = rawLive.status === 'live' || (rawLive.status === 'upcoming' && rawLive.daysUntil == null);
  const slots = isEventDay ? getProjectedSlots(data) : SCHEDULE_SLOTS;
  const live = getLiveSlotInfo(slots);

  if (live.status === 'finished') {
    return <div style={S.scheduleView}><div style={S.schedFinished}>🏆 TOURNAMENT COMPLETE</div></div>;
  }

  return (
    <div style={S.scheduleView}>
      {slots.map((slot, slotIdx) => {
        const isLive = live.status === 'live' && live.index === slotIdx;
        const isPast = (live.status === 'live' && slotIdx < live.index) || live.status === 'finished';
        const isNext = live.status === 'live' && live.index + 1 === slotIdx;

        return (
          <div key={slotIdx} style={{
            borderBottom: `1px solid rgba(242,162,58,0.12)`,
            background: isLive ? 'rgba(242,162,58,0.06)' : 'transparent',
            opacity: isPast ? 0.45 : 1,
          }}>
            {/* Slot header row */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '8px 14px 6px',
              borderBottom: `1px solid rgba(242,162,58,0.08)`,
              borderLeft: `3px solid ${isLive ? T.gold : isNext ? T.sage : 'transparent'}`,
            }}>
              {isLive && <span style={S.liveDot} />}
              <span style={{ fontFamily: 'Oswald, sans-serif', fontWeight: 700, fontSize: 14, color: isLive ? T.gold : T.ivory, letterSpacing: 0.5 }}>
                {slot.time.split('–')[0].trim()}
              </span>
              <span style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: 11, color: T.sage, letterSpacing: 2 }}>
                {slot.round}
              </span>
              {isNext && <span style={{ fontFamily: 'Oswald, sans-serif', fontSize: 10, color: T.sage, letterSpacing: 1.5, marginLeft: 'auto' }}>UP NEXT</span>}
            </div>

            {/* Table cards */}
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {[0, 1, 2].map(i => {
                const mid = slot.matchIds[i];
                const tableNum = slot.tables[i];
                if (!mid) return null;
                const match = data.matches[mid];
                const t1 = match?.slots[0] ? data.teams[match.slots[0]] : null;
                const t2 = match?.slots[1] ? data.teams[match.slots[1]] : null;
                const n1 = t1 ? getTeamDisplayName(t1, data) : null;
                const n2 = t2 ? getTeamDisplayName(t2, data) : null;
                const w1 = match?.winner === match?.slots[0];
                const w2 = match?.winner === match?.slots[1];
                const done = !!match?.winner;
                const storedTs = data.slotActualStarts?.[slotIdx]?.[i] || slot.tableStarts?.[i];
                const actualTs = storedTs ? new Date(storedTs) : null;
                const stoppedTs = data.slotActualEnds?.[slotIdx]?.[i];
                const manuallyStopped = !!stoppedTs;
                const isDone = done || manuallyStopped;
                const canStart = isAdmin && !actualTs && !isDone;
                const canStop = isAdmin && actualTs && !isDone;

                return (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: 0,
                    padding: '9px 14px',
                    borderBottom: i < 2 ? `1px solid rgba(242,162,58,0.06)` : 'none',
                  }}>
                    {/* Table label */}
                    <div style={{
                      fontFamily: 'Oswald, sans-serif', fontSize: 11, fontWeight: 700,
                      color: T.gold, letterSpacing: 1, minWidth: 28, flexShrink: 0,
                    }}>T{tableNum}</div>

                    {/* Teams */}
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                      <span style={{
                        fontFamily: 'Barlow Condensed, sans-serif', fontSize: 14, fontWeight: 600,
                        color: isDone ? (w1 ? T.gold : T.sage) : T.ivory,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>{n1 || '—'}</span>
                      <span style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: 11, color: T.sage, flexShrink: 0 }}>vs</span>
                      <span style={{
                        fontFamily: 'Barlow Condensed, sans-serif', fontSize: 14, fontWeight: 600,
                        color: isDone ? (w2 ? T.gold : T.sage) : T.ivory,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>{n2 || '—'}</span>
                    </div>

                    {/* Status / Start / Stop */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 8, flexShrink: 0 }}>
                      {actualTs && (
                        <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: 11, color: isDone ? T.sage : T.gold, letterSpacing: 0.5 }}>
                          {isDone ? '✓' : '●'} {actualTs.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true })}
                        </div>
                      )}
                      {canStart && (
                        <button style={{
                          background: T.bgSoft, border: `1px solid ${T.rim}`,
                          color: T.gold, fontFamily: 'Oswald, sans-serif', fontSize: 10,
                          letterSpacing: 1, padding: '4px 10px', borderRadius: 4, cursor: 'pointer',
                        }} onClick={() => onSlotStart(slotIdx, i)}>
                          START
                        </button>
                      )}
                      {canStop && (
                        <button style={{
                          background: 'rgba(180,40,40,0.15)', border: '1px solid rgba(220,60,60,0.35)',
                          color: '#E07070', fontFamily: 'Oswald, sans-serif', fontSize: 10,
                          letterSpacing: 1, padding: '4px 10px', borderRadius: 4, cursor: 'pointer',
                        }} onClick={() => onSlotStop(slotIdx, i)}>
                          STOP
                        </button>
                      )}
                      {manuallyStopped && !done && (
                        <button style={{
                          background: 'rgba(46,91,78,0.25)', border: `1px solid ${T.rim}`,
                          color: T.sage, fontFamily: 'Oswald, sans-serif', fontSize: 10,
                          letterSpacing: 1, padding: '4px 10px', borderRadius: 4, cursor: 'pointer',
                        }} onClick={() => onSlotRestart(slotIdx, i)}>
                          ↺ RESUME
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function SchedMatchRow({ slot, slotIdx, data, isAdmin, onSlotStart }) {
  return (
    <div style={S.schedMatchRow}>
      {[0, 1, 2].map(i => {
        const mid = slot.matchIds[i];
        const tableNum = slot.tables[i];
        const match = mid ? data.matches[mid] : null;
        const t1 = match?.slots[0] ? data.teams[match.slots[0]] : null;
        const t2 = match?.slots[1] ? data.teams[match.slots[1]] : null;
        const tableActualTs = slot.tableStarts?.[i] ? new Date(slot.tableStarts[i]) : null;
        const canStart = isAdmin && !tableActualTs;

        return (
          <div key={i} style={S.schedTableCard}>
            <div style={S.schedTableNum}>TABLE {tableNum}</div>
            {mid && t1 && t2 ? (
              <>
                <SchedTeam team={t1} data={data} match={match} isWinner={match.winner === t1.id} />
                <div style={S.schedVs}>VS</div>
                <SchedTeam team={t2} data={data} match={match} isWinner={match.winner === t2.id} />
                {match.winner && (
                  <div style={S.schedResult}>{matchScoreString(match)}</div>
                )}
              </>
            ) : (
              <div style={S.schedTbd}>{mid ? 'Awaiting bracket' : 'Open'}</div>
            )}
            {tableActualTs ? (
              <div style={S.schedStarted}>● {tableActualTs.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true })}</div>
            ) : canStart ? (
              <button style={S.slotStartBtn} onClick={() => onSlotStart(slotIdx, i)}>▶ START</button>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function SchedTeam({ team, data, match, isWinner }) {
  const p1 = team.playerIds[0] ? data.players.find(p => p.id === team.playerIds[0]) : null;
  const p2 = team.playerIds[1] ? data.players.find(p => p.id === team.playerIds[1]) : null;
  return (
    <div style={{ ...S.schedTeamRow, ...(isWinner ? S.schedTeamWinner : {}) }}>
      <span style={S.schedTeamSeed}>{team.seed}</span>
      <span style={S.schedTeamName}>
        {team.name || getTeamDisplayName(team, data)}
      </span>
    </div>
  );
}

function TimeSlot({ slot, slotIdx, data, tableFilter, isLive, isPast, isNext, isAdmin, onTimeEdit, onSlotStart }) {
  const [editing, setEditing] = useState(false);
  const [editVal, setEditVal] = useState(slot.time);
  const visible = tableFilter === 'all' ? [0, 1, 2] : [tableFilter - 1];
  const canEditTime = isAdmin && !(slot.tableStarts || []).some(Boolean);

  const startEdit = () => { setEditVal(slot.time); setEditing(true); };
  const commitEdit = () => {
    setEditing(false);
    if (editVal.trim() && editVal.trim() !== slot.time) onTimeEdit(slotIdx, editVal.trim());
  };

  return (
    <div style={{ ...S.timeSlot, ...(isLive ? S.timeSlotLive : {}), ...(isPast ? S.timeSlotPast : {}) }}>
      <div style={S.slotTime}>
        {isLive && <div style={S.slotLiveBadge}>LIVE</div>}
        {isNext && <div style={S.slotNextBadge}>NEXT</div>}
        {editing ? (
          <input autoFocus value={editVal} onChange={e => setEditVal(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditing(false); }}
            style={S.slotTimeInput} />
        ) : (
          <div style={S.slotTimeMain} onClick={canEditTime ? startEdit : undefined}
               title={canEditTime ? 'Click to edit time' : undefined}>
            {slot.time}
            {slot.projected && <div style={S.slotEstBadge}>EST</div>}
            {canEditTime && <span style={S.slotTimeEditHint}>✎</span>}
          </div>
        )}
        <div style={S.slotTimeDuration}>{slot.duration}</div>
      </div>
      <div style={S.slotMatches}>
        {visible.map((i, idx) => {
          const tableActualTs = slot.tableStarts?.[i] ? new Date(slot.tableStarts[i]) : null;
          const canStart = isAdmin && !tableActualTs;
          return (
            <SlotMatch key={i}
              matchId={slot.matchIds[i]}
              tableNum={slot.tables[i]}
              data={data}
              isLast={idx === visible.length - 1}
              isAdmin={isAdmin}
              canStart={canStart}
              actualTs={tableActualTs}
              onStart={() => onSlotStart(slotIdx, i)} />
          );
        })}
      </div>
    </div>
  );
}

function SlotMatch({ matchId, tableNum, data, isLast, isAdmin, canStart, actualTs, onStart }) {
  const borderStyle = isLast ? {} : { borderRight: `1px solid ${T.rim}` };

  const startedFooter = actualTs ? (
    <div style={S.slotTableStarted}>
      ● {actualTs.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true })}
    </div>
  ) : canStart ? (
    <button style={S.slotStartBtn} onClick={onStart}>▶ START</button>
  ) : null;

  if (!matchId) {
    return (
      <div style={{ ...S.slotMatch, ...S.slotMatchEmpty, ...borderStyle }}>
        <div style={S.tableLabel}>{tableNum}</div>
        <div style={S.matchEmpty}>Open / Warmup</div>
        {startedFooter}
      </div>
    );
  }
  const match = data.matches[matchId];
  const t1 = match.slots[0] ? data.teams[match.slots[0]] : null;
  const t2 = match.slots[1] ? data.teams[match.slots[1]] : null;
  const p1a = t1?.playerIds[0] ? data.players.find(p => p.id === t1.playerIds[0]) : null;
  const p1b = t1?.playerIds[1] ? data.players.find(p => p.id === t1.playerIds[1]) : null;
  const p2a = t2?.playerIds[0] ? data.players.find(p => p.id === t2.playerIds[0]) : null;
  const p2b = t2?.playerIds[1] ? data.players.find(p => p.id === t2.playerIds[1]) : null;
  const complete = !!(t1 && p1a && p1b && t2 && p2a && p2b);

  return (
    <div style={{ ...S.slotMatch, ...borderStyle }}>
      <div style={S.tableLabel}>TABLE {tableNum}</div>
      {complete ? (
        <>
          <div style={{ ...S.matchTeam, ...(match.winner === t1.id ? S.matchTeamWinner : {}) }}>
            <div style={S.matchTeamSeed}>{t1.seed}</div>
            <div style={S.matchTeamNames}>
              {t1.name
                ? <div style={S.matchTeamNameBold}>{t1.name}</div>
                : <><div style={S.playerSmall}>{p1a.name}</div><div style={S.playerSmall}>{p1b.name}</div></>}
            </div>
          </div>
          <div style={S.scheduleVs}>VS</div>
          <div style={{ ...S.matchTeam, ...(match.winner === t2.id ? S.matchTeamWinner : {}) }}>
            <div style={S.matchTeamSeed}>{t2.seed}</div>
            <div style={S.matchTeamNames}>
              {t2.name
                ? <div style={S.matchTeamNameBold}>{t2.name}</div>
                : <><div style={S.playerSmall}>{p2a.name}</div><div style={S.playerSmall}>{p2b.name}</div></>}
            </div>
          </div>
          {match.scores.team1.length > 0 && (
            <div style={S.matchScoreSmall}>{matchScoreString(match)}</div>
          )}
        </>
      ) : (
        <div style={S.matchIncomplete}>
          {t1 && t2 ? 'Add players to teams' : 'Awaiting bracket'}
        </div>
      )}
      {startedFooter}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// PLAYERS VIEW
// ═══════════════════════════════════════════════════════════════════════════
function PlayersView({ data, isAdmin, editingPlayer, setEditingPlayer, updatePlayerName,
                       getPlayerTeam, onPlayerSchedule, onSlotTap, onTeamNameEdit,
                       onAddAlternate, onRemoveAlternate, onAssignAlternate }) {
  const [subTab, setSubTab] = useState('teams');
  const [newAltName, setNewAltName] = useState('');

  const leftTeams  = Object.values(data.teams).filter(t => t.side === 'L').sort((a,b) => a.seed - b.seed);
  const rightTeams = Object.values(data.teams).filter(t => t.side === 'R').sort((a,b) => a.seed - b.seed);
  const alternates = data.alternates || [];

  return (
    <div style={S.playersView}>
      {/* Sub-tab bar */}
      <div style={S.subTabBar}>
        {[['teams','TEAMS'],['players','PLAYERS'],['alternates','SUBS']].map(([id, label]) => (
          <button key={id} style={subTab === id ? S.subTabActive : S.subTab}
            onClick={() => setSubTab(id)}>{label}</button>
        ))}
      </div>

      {/* TEAMS sub-tab */}
      {subTab === 'teams' && (
        <div style={S.teamsGrid}>
          {[{ label: 'LEFT BRACKET', teams: leftTeams }, { label: 'RIGHT BRACKET', teams: rightTeams }].map(({ label, teams }) => (
            <div key={label} style={S.teamsSide}>
              <div style={S.teamsSideLabel}>{label}</div>
              {teams.map(team => {
                const p1 = team.playerIds[0] ? data.players.find(p => p.id === team.playerIds[0]) : null;
                const p2 = team.playerIds[1] ? data.players.find(p => p.id === team.playerIds[1]) : null;
                return (
                  <div key={team.id} style={S.teamCard}>
                    <div style={S.teamCardSeed}>
                      <div style={S.teamSeedNum}>{team.seed}</div>
                      {team.pi && <div style={S.teamPiTag}>PI</div>}
                    </div>
                    <div style={S.teamCardSlots}>
                      <TeamNameSlot
                        name={team.name || ''}
                        isAdmin={isAdmin}
                        onSave={isAdmin ? (n) => onTeamNameEdit(team.id, n) : undefined}
                      />
                      <TeamSlot name={p1?.name} empty={!p1}
                        onTap={isAdmin ? () => onSlotTap(team.id, 0) : undefined} />
                      <TeamSlot name={p2?.name} empty={!p2}
                        onTap={isAdmin ? () => onSlotTap(team.id, 1) : undefined} />
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}

      {/* PLAYERS sub-tab */}
      {subTab === 'players' && (
        <div style={S.playerList}>
          {data.players.map((player, idx) => (
            <PlayerRow
              key={player.id}
              player={player}
              num={idx + 1}
              team={getPlayerTeam(player.id)}
              isEditing={editingPlayer === player.id}
              onEditStart={() => isAdmin && setEditingPlayer(player.id)}
              onEditEnd={() => setEditingPlayer(null)}
              onSave={(name) => { updatePlayerName(player.id, name); setEditingPlayer(null); }}
              onShowSchedule={() => onPlayerSchedule(player.id)}
            />
          ))}
        </div>
      )}

      {/* ALTERNATES sub-tab */}
      {subTab === 'alternates' && (
        <div style={S.altView}>
          <div style={S.altInfo}>
            Subs appear in the player picker when assigning players to teams. Selecting one adds them as a player.
          </div>
          {isAdmin && (
            <div style={S.altAddRow}>
              <input
                placeholder="ALT PLAYER NAME"
                value={newAltName}
                onChange={e => setNewAltName(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && newAltName.trim()) {
                    onAddAlternate(newAltName.trim());
                    setNewAltName('');
                  }
                }}
                style={S.altInput}
                autoCapitalize="characters" autoCorrect="off"
              />
              <button
                style={S.altAddBtn}
                disabled={!newAltName.trim()}
                onClick={() => { if (newAltName.trim()) { onAddAlternate(newAltName.trim()); setNewAltName(''); } }}
              >+ ADD</button>
            </div>
          )}
          {alternates.length === 0 ? (
            <div style={S.altEmpty}>No alternates added yet.{isAdmin ? ' Add names above.' : ''}</div>
          ) : alternates.map(alt => (
            <AltRow key={alt.id} alt={alt} isAdmin={isAdmin}
              onRemove={() => onRemoveAlternate(alt.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

function TeamNameSlot({ name, isAdmin, onSave }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);

  const commit = () => {
    setEditing(false);
    onSave(draft.trim().toUpperCase());
  };

  if (editing) {
    return (
      <div style={S.teamNameSlotEditing}>
        <input
          autoFocus
          value={draft}
          placeholder="TEAM NAME"
          onChange={e => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false); }}
          style={S.teamNameInput}
          autoCapitalize="characters" autoCorrect="off"
        />
      </div>
    );
  }

  return (
    <div
      style={{ ...S.teamNameSlot, cursor: isAdmin ? 'pointer' : 'default' }}
      onClick={isAdmin ? () => { setDraft(name); setEditing(true); } : undefined}
    >
      {name
        ? <span style={S.teamNameText}>{name}</span>
        : <span style={S.teamNamePlaceholder}>{isAdmin ? '+ TEAM NAME' : '—'}</span>}
      {isAdmin && <span style={S.teamSlotEdit}>✎</span>}
    </div>
  );
}

function TeamSlot({ name, empty, onTap }) {
  return (
    <div style={{ ...S.teamSlot, ...(empty ? S.teamSlotEmpty : {}), cursor: onTap ? 'pointer' : 'default' }}
         onClick={onTap}>
      {empty ? <span style={S.teamSlotPlaceholder}>TAP TO ASSIGN</span> : <span style={S.teamSlotName}>{name}</span>}
      {onTap && <span style={S.teamSlotEdit}>✎</span>}
    </div>
  );
}

function AltRow({ alt, isAdmin, onRemove }) {
  return (
    <div style={S.altRow}>
      <div style={S.altName}>{alt.name}</div>
      <div style={S.altActions}>
        {isAdmin && <button style={S.altRemoveBtn} onClick={onRemove}>✕</button>}
      </div>
    </div>
  );
}

function PlayerRow({ player, num, team, isEditing, onEditStart, onEditEnd, onSave, onShowSchedule }) {
  const [draft, setDraft] = useState(player.name);
  const inputRef = useRef(null);

  useEffect(() => {
    if (isEditing) {
      setDraft(player.name);
      setTimeout(() => { inputRef.current?.focus(); inputRef.current?.select(); }, 0);
    }
  }, [isEditing, player.name]);

  if (isEditing) {
    return (
      <div style={S.playerRowEditing}>
        <div style={S.playerNum}>{num}</div>
        <input
          ref={inputRef}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={() => onSave(draft)}
          onKeyDown={e => {
            if (e.key === 'Enter') onSave(draft);
            else if (e.key === 'Escape') onEditEnd();
          }}
          style={S.playerInput}
          autoCapitalize="characters"
          autoCorrect="off"
        />
      </div>
    );
  }

  return (
    <div style={S.playerRow}>
      <div style={S.playerNum}>{num}</div>
      <div style={S.playerName} onClick={onEditStart}>{player.name}</div>
      {team ? (
        <div style={S.playerTeamBadge} onClick={onEditStart}>
          {team.side}{team.seed}{team.pi && ' PI'}
        </div>
      ) : (
        <div style={S.playerAvailableBadge} onClick={onEditStart}>UNPLACED</div>
      )}
      {team && (
        <button style={S.playerScheduleBtn}
          onClick={(e) => { e.stopPropagation(); onShowSchedule(); }}>📅</button>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// PLAYER PICKER
// ═══════════════════════════════════════════════════════════════════════════
function PlayerPicker({ data, picker, onClose, onPick, onPickAlt }) {
  const team = data.teams[picker.teamId];
  const [search, setSearch] = useState('');

  const playersWithStatus = useMemo(() => {
    return data.players.map(p => {
      let placedTeam = null;
      Object.values(data.teams).forEach(t => { if (t.playerIds.includes(p.id)) placedTeam = t; });
      return { ...p, placedTeam };
    });
  }, [data]);

  const alternates = data.alternates || [];
  const q = search.toLowerCase();

  const filtered = playersWithStatus
    .filter(p => p.name.toLowerCase().includes(q))
    .sort((a, b) => {
      if (!a.placedTeam && b.placedTeam) return -1;
      if (a.placedTeam && !b.placedTeam) return 1;
      return 0;
    });

  const filteredAlts = alternates.filter(a => a.name.toLowerCase().includes(q));

  return (
    <div style={S.sheetBackdrop} onClick={onClose}>
      <div style={S.sheet} onClick={e => e.stopPropagation()}>
        <div style={S.sheetHandleWrap} onClick={onClose}><div style={S.sheetHandle} /></div>
        <div style={S.sheetHeader}>
          <div>
            <div style={S.sheetTitle}>PICK PLAYER</div>
            <div style={S.sheetSub}>
              {team.side === 'L' ? 'LEFT' : 'RIGHT'} · SEED {team.seed} · SLOT {picker.slotIndex + 1}
            </div>
          </div>
          <button style={S.sheetClose} onClick={onClose}>×</button>
        </div>
        <div style={S.searchWrap}>
          <input type="text" placeholder="Search players..." value={search}
            onChange={e => setSearch(e.target.value)} style={S.searchInput}
            autoCapitalize="characters" autoCorrect="off" />
        </div>
        <div style={S.pickerList}>
          {filtered.map(p => {
            const isHere = p.placedTeam?.id === picker.teamId &&
                           data.teams[picker.teamId].playerIds[picker.slotIndex] === p.id;
            return (
              <div key={p.id}
                style={{ ...S.pickerItem, ...(isHere ? S.pickerItemCurrent : {}) }}
                onClick={() => onPick(p.id)}>
                <div style={S.pickerLeft}>
                  <div style={S.pickerName}>{p.name}</div>
                  {p.placedTeam && (
                    <div style={S.pickerStatus}>
                      {isHere ? '✓ CURRENTLY HERE' :
                       `ON ${p.placedTeam.side}${p.placedTeam.seed} · WILL MOVE`}
                    </div>
                  )}
                </div>
                {!p.placedTeam && <div style={S.pickerAdd}>+</div>}
                {isHere && <div style={S.pickerHere}>HERE</div>}
              </div>
            );
          })}
          {filteredAlts.length > 0 && (
            <>
              <div style={S.pickerDivider}>SUBS</div>
              {filteredAlts.map(alt => (
                <div key={alt.id} style={S.pickerItem} onClick={() => onPickAlt(alt.id)}>
                  <div style={S.pickerLeft}>
                    <div style={S.pickerName}>{alt.name}</div>
                    <div style={S.pickerStatus}>SUB · will be added as player</div>
                  </div>
                  <div style={S.pickerAdd}>+</div>
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SCORE EDITOR
// ═══════════════════════════════════════════════════════════════════════════
function ScoreEditor({ data, matchId, onClose, onSave, onForfeit }) {
  const match = data.matches[matchId];
  const team1 = match.slots[0] ? data.teams[match.slots[0]] : null;
  const team2 = match.slots[1] ? data.teams[match.slots[1]] : null;

  const isFinal = matchId === 'FINAL';
  const numGames = isFinal ? 3 : 1;
  const formatLabel = isFinal ? 'BEST OF 3 TO 21' : '1 GAME TO 21';

  const [activeGame, setActiveGame] = useState(0);

  // games[i] = [t1_score_str, t2_score_str] — strings so empty field shows blank, not "0"
  const [games, setGames] = useState(() => {
    if (match.scores.team1.length > 0) {
      return match.scores.team1.map((g, i) => [String(g[0]), String(match.scores.team2[i]?.[1] ?? g[1])]);
    }
    return Array.from({ length: numGames }, () => ['', '']);
  });

  const setScore = (gameIdx, teamIdx, val) => {
    setGames(prev => prev.map((g, i) =>
      i !== gameIdx ? g : teamIdx === 0 ? [val, g[1]] : [g[0], val]
    ));
  };

  const n = s => parseInt(s) || 0;
  const t1Wins = games.filter(g => n(g[0]) > n(g[1])).length;
  const t2Wins = games.filter(g => n(g[1]) > n(g[0])).length;
  const winner = t1Wins > t2Wins ? 1 : t2Wins > t1Wins ? 2 : null;

  if (!team1 || !team2) return null;

  const p1a = team1.playerIds[0] ? data.players.find(p => p.id === team1.playerIds[0]) : null;
  const p1b = team1.playerIds[1] ? data.players.find(p => p.id === team1.playerIds[1]) : null;
  const p2a = team2.playerIds[0] ? data.players.find(p => p.id === team2.playerIds[0]) : null;
  const p2b = team2.playerIds[1] ? data.players.find(p => p.id === team2.playerIds[1]) : null;

  const handleSave = () => {
    const t1Scores = games.map(g => [n(g[0]), n(g[1])]);
    const t2Scores = games.map(g => [n(g[0]), n(g[1])]);
    onSave(matchId, t1Scores, t2Scores);
  };

  const renderGameSlots = (gameIdx) => {
    const game = games[gameIdx];
    const hasAny = game[0] !== '' || game[1] !== '';
    const t1Win = hasAny && n(game[0]) > n(game[1]);
    const t2Win = hasAny && n(game[1]) > n(game[0]);
    return (
      <div style={S.scoreGameInputs}>
        {[
          { team: team1, pa: p1a, pb: p1b, val: game[0], idx: 0, isWin: t1Win },
          { team: team2, pa: p2a, pb: p2b, val: game[1], idx: 1, isWin: t2Win },
        ].map(({ team, pa, pb, val, idx, isWin }) => (
          <div key={idx} style={{ ...S.scoreTeamCol, ...(isWin ? S.scoreTeamColWin : {}) }}>
            <div style={S.scoreTeamSeed}>{team.side}{team.seed}</div>
            <div style={S.scoreTeamPlayers}>
              <div>{pa?.name || '…'}</div>
              <div style={{ opacity: 0.7 }}>{pb?.name || '…'}</div>
            </div>
            <input type="text" inputMode="numeric" pattern="[0-9]*" value={val}
              placeholder="0"
              onChange={e => setScore(gameIdx, idx, e.target.value.replace(/\D/g, ''))}
              onFocus={e => e.target.select()}
              style={{ ...S.scoreInput, ...(isWin ? S.scoreInputWin : {}) }} />
            {isWin && <div style={S.scoreWinTag}>WIN</div>}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div style={S.modalBackdrop} onClick={onClose}>
      <div style={{ ...S.scoreModal, ...(isFinal ? { maxWidth: 480 } : {}) }} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={S.scoreHeader}>
          <div>
            <div style={S.sheetTitle}>{isFinal ? 'CHAMPIONSHIP' : 'ENTER SCORES'}</div>
            <div style={S.scoreFormat}>{formatLabel}</div>
          </div>
          <button style={S.sheetClose} onClick={onClose}>×</button>
        </div>

        {isFinal ? (
          <>
            {/* Series banner — names + series score, compact single row */}
            <div style={{ display: 'flex', alignItems: 'center', padding: '12px 20px', borderBottom: `1px solid ${T.rim}`, gap: 12 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: 13, fontWeight: 700, color: t1Wins > t2Wins ? T.gold : T.ivory, letterSpacing: 0.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {p1a?.name || team1.side + team1.seed}
                </div>
                <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12, color: T.ivoryDim, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {p1b?.name || ''}
                </div>
              </div>
              <div style={{ textAlign: 'center', flexShrink: 0 }}>
                <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: 32, fontWeight: 700, letterSpacing: 6, color: T.gold, lineHeight: 1 }}>
                  {t1Wins}<span style={{ color: T.rim, fontSize: 22, margin: '0 2px' }}>–</span>{t2Wins}
                </div>
                <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: 8, letterSpacing: 2.5, color: T.ivoryDim }}>SERIES</div>
              </div>
              <div style={{ flex: 1, minWidth: 0, textAlign: 'right' }}>
                <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: 13, fontWeight: 700, color: t2Wins > t1Wins ? T.gold : T.ivory, letterSpacing: 0.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {p2a?.name || team2.side + team2.seed}
                </div>
                <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12, color: T.ivoryDim, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {p2b?.name || ''}
                </div>
              </div>
            </div>

            {/* Game tabs — pill style, prominent */}
            <div style={{ display: 'flex', gap: 8, padding: '14px 20px', background: 'rgba(0,0,0,0.2)', borderBottom: `1px solid ${T.rim}` }}>
              {games.map((game, i) => {
                const hasScore = game[0] !== '' || game[1] !== '';
                const gT1Win = hasScore && n(game[0]) > n(game[1]);
                const gT2Win = hasScore && n(game[1]) > n(game[0]);
                const isActive = activeGame === i;
                return (
                  <button key={i} onClick={() => setActiveGame(i)} style={{
                    flex: 1,
                    padding: '8px 4px',
                    background: isActive ? T.gold : 'rgba(255,255,255,0.06)',
                    border: isActive ? 'none' : `1px solid ${T.rim}`,
                    borderRadius: 6,
                    cursor: 'pointer',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                    transition: 'background 0.15s, border 0.15s',
                  }}>
                    <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: 2, color: isActive ? T.bgDeep : T.ivoryDim }}>
                      GAME {i + 1}
                    </div>
                    {hasScore ? (
                      <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: 14, fontWeight: 700, letterSpacing: 1, color: isActive ? T.bgDeep : T.ivory }}>
                        <span style={{ ...(!isActive && gT1Win ? { color: T.gold } : {}) }}>{game[0]}</span>
                        <span style={{ opacity: 0.4, margin: '0 3px', fontSize: 11 }}>–</span>
                        <span style={{ ...(!isActive && gT2Win ? { color: T.gold } : {}) }}>{game[1]}</span>
                      </div>
                    ) : (
                      <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: 12, color: isActive ? T.bgDeep : T.rim, opacity: 0.7 }}>– –</div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Active game scores — no team names (already in banner) */}
            <div style={{ padding: '16px 20px' }}>
              <div style={{ display: 'flex', gap: 12 }}>
                {[
                  { val: games[activeGame][0], idx: 0, isWin: games[activeGame][0] !== '' && n(games[activeGame][0]) > n(games[activeGame][1]) },
                  { val: games[activeGame][1], idx: 1, isWin: games[activeGame][1] !== '' && n(games[activeGame][1]) > n(games[activeGame][0]) },
                ].map(({ val, idx, isWin }) => (
                  <div key={idx} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                    <input type="text" inputMode="numeric" pattern="[0-9]*" value={val}
                      placeholder="0"
                      onChange={e => setScore(activeGame, idx, e.target.value.replace(/\D/g, ''))}
                      onFocus={e => e.target.select()}
                      style={{ ...S.scoreInput, fontSize: 48, padding: '18px 0', ...(isWin ? S.scoreInputWin : {}) }} />
                    {isWin && <div style={S.scoreWinTag}>WIN</div>}
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : (
          <div style={S.scoreBody}>
            {renderGameSlots(0)}
          </div>
        )}

        <div style={S.scoreActions}>
          <button style={S.scoreSaveBtn} onClick={handleSave}>
            {winner
              ? `✓ SAVE · ${winner === 1 ? team1.side + team1.seed : team2.side + team2.seed} WINS${isFinal ? ' THE TITLE' : ''}`
              : '✓ SAVE SCORES'}
          </button>
          <button style={S.modalCancel} onClick={onClose}>CANCEL</button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SHARE MATCH CARD
// ═══════════════════════════════════════════════════════════════════════════
function ShareMatchCard({ data, matchId, onClose }) {
  const match = data.matches[matchId];
  if (!match || !match.winner) return null;
  const winner = data.teams[match.winner];
  const loserId = match.slots.find(id => id !== match.winner);
  const loser = loserId ? data.teams[loserId] : null;
  const wp1 = data.players.find(p => p.id === winner.playerIds[0]);
  const wp2 = data.players.find(p => p.id === winner.playerIds[1]);
  const lp1 = loser ? data.players.find(p => p.id === loser.playerIds[0]) : null;
  const lp2 = loser ? data.players.find(p => p.id === loser.playerIds[1]) : null;
  const isUpset = loser && winner.seed > loser.seed;
  const scoreText = matchScoreString(match);

  const shareText = match.isForfeit
    ? `🏓 ${wp1?.name} / ${wp2?.name} advance via forfeit at the Atlas Supreme Invitational!`
    : `🏓 ${wp1?.name} / ${wp2?.name} ${isUpset ? '⚡ STUN ' : 'def. '}${lp1?.name} / ${lp2?.name} ${scoreText} @ ${matchLabel(matchId)}!`;

  const handleShare = async () => {
    if (navigator.share) {
      try { await navigator.share({ text: shareText, title: 'Atlas Supreme Invitational' }); }
      catch (e) {}
    } else { navigator.clipboard?.writeText(shareText); }
  };

  return (
    <div style={S.modalBackdrop} onClick={onClose}>
      <div style={S.shareModal} onClick={e => e.stopPropagation()}>
        <div style={S.shareCard}>
          <div style={S.shareCardStars}><Star size={14} /><Star size={14} /><Star size={14} /></div>
          <div style={S.shareBrandTitle}>ATLAS SUPREME</div>
          <div style={S.shareBrandSub}>INVITATIONAL · DREAM BIG</div>
          {isUpset && <div style={S.shareUpsetBadge}>⚡ UPSET ALERT</div>}
          {match.isForfeit && <div style={S.shareForfeitBadge}>⊘ FORFEIT</div>}
          <div style={S.shareMatchLabel}>{matchLabel(matchId)}</div>

          <div style={S.shareWinnerBlock}>
            <div style={S.shareWinnerLabel}>WINNER</div>
            <div style={S.shareWinnerNames}>
              <div>{wp1?.name || '—'}</div>
              <div style={S.shareSlash}>/</div>
              <div>{wp2?.name || '—'}</div>
            </div>
            <div style={S.shareSeed}>SEED {winner.seed} · {winner.side === 'L' ? 'LEFT' : 'RIGHT'}</div>
          </div>

          {loser && (
            <>
              <div style={S.shareDefeated}>DEFEATED</div>
              <div style={S.shareLoserBlock}>
                <div style={S.shareLoserNames}>
                  {lp1?.name} <span style={S.shareSlash}>/</span> {lp2?.name}
                </div>
                <div style={S.shareLoserSeed}>SEED {loser.seed}</div>
              </div>
            </>
          )}
          {scoreText && <div style={S.shareScore}>{scoreText}</div>}
          <div style={S.shareFooter}>BRING YOUR PADDLE · BRING YOUR DREAM</div>
        </div>

        <div style={S.shareActions}>
          <button style={S.shareBtn} onClick={handleShare}>📤 SHARE</button>
          <button style={S.shareBtnAlt}
            onClick={() => navigator.clipboard?.writeText(shareText)}>📋 COPY TEXT</button>
          <button style={S.modalCancel} onClick={onClose}>CLOSE</button>
        </div>
        <div style={S.shareHint}>📸 Screenshot the card above to share as image</div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// PLAYER SCHEDULE SHEET
// ═══════════════════════════════════════════════════════════════════════════
function PlayerScheduleSheet({ data, playerId, onClose }) {
  const player = data.players.find(p => p.id === playerId);
  if (!player) return null;

  let team = null;
  Object.values(data.teams).forEach(t => { if (t.playerIds.includes(playerId)) team = t; });
  const partnerId = team?.playerIds.find(p => p && p !== playerId);
  const partner = partnerId ? data.players.find(p => p.id === partnerId) : null;

  // Walk forward through their match path
  const matches = [];
  if (team) {
    let mid = null;
    for (const k of Object.keys(data.matches)) {
      if (data.matches[k].slots.includes(team.id)) { mid = k; break; }
    }
    let teamId = team.id;
    while (mid) {
      const m = data.matches[mid];
      matches.push({
        matchId: mid, match: m,
        didWin: m.winner === teamId,
        didLose: m.winner && m.winner !== teamId,
      });
      if (m.winner === teamId) {
        const flow = FLOW[mid]; if (!flow) break;
        mid = flow.next;
      } else break;
    }
  }

  return (
    <div style={S.sheetBackdrop} onClick={onClose}>
      <div style={S.sheet} onClick={e => e.stopPropagation()}>
        <div style={S.sheetHandleWrap} onClick={onClose}><div style={S.sheetHandle} /></div>
        <div style={S.sheetHeader}>
          <div>
            <div style={S.sheetTitle}>{player.name}</div>
            <div style={S.sheetSub}>
              {team ? `${team.side === 'L' ? 'LEFT' : 'RIGHT'} · SEED ${team.seed}` : 'UNPLACED'}
              {partner && ` · w/ ${partner.name}`}
            </div>
          </div>
          <button style={S.sheetClose} onClick={onClose}>×</button>
        </div>
        <div style={S.psList}>
          {matches.length === 0 ? (
            <div style={S.psEmpty}>No scheduled matches.</div>
          ) : matches.map((m, idx) => {
            const sch = findScheduleSlot(m.matchId);
            const opId = m.match.slots.find(id => id !== team?.id);
            const op = opId ? data.teams[opId] : null;
            const op1 = op ? data.players.find(p => p.id === op.playerIds[0]) : null;
            const op2 = op ? data.players.find(p => p.id === op.playerIds[1]) : null;
            return (
              <div key={m.matchId}
                style={{ ...S.psRow, ...(m.didWin ? S.psWin : {}), ...(m.didLose ? S.psLose : {}) }}>
                <div style={S.psTime}>
                  <div style={S.psTimeText}>{sch?.time || '—'}</div>
                  <div style={S.psTableText}>{sch ? `Table ${sch.table}` : ''}</div>
                </div>
                <div style={S.psMain}>
                  <div style={S.psMatchLabel}>{matchLabel(m.matchId)}</div>
                  <div style={S.psOpponent}>
                    vs {op ? `${op1?.name || '—'} / ${op2?.name || '—'}` : 'TBD'}
                  </div>
                  {m.match.scores.team1.length > 0 && (
                    <div style={S.psScore}>{matchScoreString(m.match)}</div>
                  )}
                </div>
                <div>
                  {m.didWin && <span style={S.psWinBadge}>WON</span>}
                  {m.didLose && <span style={S.psLoseBadge}>OUT</span>}
                  {!m.didWin && !m.didLose && <span style={S.psPendingBadge}>UPCOMING</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// STATS VIEW
// ═══════════════════════════════════════════════════════════════════════════
function StatsView({ data }) {
  const stats = useMemo(() => computeStats(data), [data]);

  const playerLB = useMemo(() => {
    return Object.values(stats.playerStats)
      .filter(p => p.wins + p.losses > 0)
      .sort((a, b) => b.wins - a.wins || a.losses - b.losses)
      .slice(0, 10);
  }, [stats]);

  const teamLB = useMemo(() => {
    return Object.entries(stats.teamStats)
      .map(([id, s]) => ({ ...s, id, team: data.teams[id] }))
      .filter(t => t.wins + t.losses > 0)
      .sort((a, b) => b.wins - a.wins || (b.pf - b.pa) - (a.pf - a.pa))
      .slice(0, 8);
  }, [stats, data]);

  const totalMatchesInBracket = Object.keys(data.matches).length;
  const progressPct = totalMatchesInBracket > 0 ? Math.round((stats.totalMatches / totalMatchesInBracket) * 100) : 0;

  if (stats.totalMatches === 0) {
    return (
      <div style={{ ...S.statsView, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 200 }}>
        <div style={S.statsEmpty}>📊 Stats will appear as matches are played.</div>
      </div>
    );
  }

  return (
    <div style={S.statsView}>

      {/* Pulse strip */}
      <div style={S.statsPulse}>
        <div style={S.statsPulseTile}>
          <div style={S.statsPulseVal}>{stats.totalMatches}<span style={S.statsPulseDenom}>/{totalMatchesInBracket}</span></div>
          <div style={S.statsPulseLabel}>MATCHES</div>
          <div style={{ height: 3, borderRadius: 2, background: T.rim, marginTop: 6, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${progressPct}%`, background: T.gold, borderRadius: 2, transition: 'width 0.5s' }} />
          </div>
        </div>
        {stats.avgPtsPerSide && (
          <div style={S.statsPulseTile}>
            <div style={S.statsPulseVal}>{stats.avgPtsPerSide}</div>
            <div style={S.statsPulseLabel}>AVG PTS / SIDE</div>
          </div>
        )}
        {stats.winStreak && (
          <div style={S.statsPulseTile}>
            <div style={S.statsPulseVal}>{stats.winStreak.wins}<span style={S.statsPulseDenom}> W</span></div>
            <div style={S.statsPulseLabel}>BEST RUN</div>
            <div style={S.statsPulseSub}>{(() => { const t = data.teams[stats.winStreak.id]; const p1 = data.players.find(p => p.id === t?.playerIds[0]); return p1?.name?.split(' ')[0] || t?.side + t?.seed; })()}</div>
          </div>
        )}
        {stats.mostDominant && (
          <div style={S.statsPulseTile}>
            <div style={{ ...S.statsPulseVal, color: T.gold }}>+{stats.mostDominant.diff}</div>
            <div style={S.statsPulseLabel}>TOP DIFF</div>
            <div style={S.statsPulseSub}>{(() => { const t = data.teams[stats.mostDominant.id]; const p1 = data.players.find(p => p.id === t?.playerIds[0]); return p1?.name?.split(' ')[0] || t?.side + t?.seed; })()}</div>
          </div>
        )}
      </div>

      {/* Undefeated callout */}
      {stats.undefeated.length > 0 && (
        <div style={S.statsSection}>
          <div style={S.statsSectionTitle}>⚡ UNDEFEATED</div>
          <div style={S.undefeatedGrid}>
            {stats.undefeated.map(({ id, wins }) => {
              const team = data.teams[id];
              const p1 = data.players.find(p => p.id === team?.playerIds[0]);
              const p2 = data.players.find(p => p.id === team?.playerIds[1]);
              return (
                <div key={id} style={S.undefeatedCard}>
                  <div style={S.undefeatedSeed}>{team?.side}{team?.seed}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={S.undefeatedNames}>{p1?.name} / {p2?.name}</div>
                  </div>
                  <div style={S.undefeatedWins}>{wins}-0</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Hot takes */}
      <div style={S.statsSection}>
        <div style={S.statsSectionTitle}>🔥 HOT TAKES</div>
        <div style={S.hotGrid}>
          {stats.biggestUpset && <UpsetCard upset={stats.biggestUpset} data={data} />}
          {stats.closestMatch && <ClosestCard closest={stats.closestMatch} data={data} />}
          {stats.highestScoringMatch && <HighScoreCard match={stats.highestScoringMatch} data={data} />}
          {stats.mostDominant && <DominantCard dominant={stats.mostDominant} data={data} />}
        </div>
        {!stats.biggestUpset && !stats.closestMatch && (
          <div style={S.statsEmpty}>More stats unlock as the bracket progresses.</div>
        )}
      </div>

      {/* Leaderboards */}
      {playerLB.length > 0 && (
        <div style={S.statsSection}>
          <div style={S.statsSectionTitle}>🏆 TOP PLAYERS</div>
          {playerLB.map((p, i) => (
            <div key={i} style={S.lbRow}>
              <div style={S.lbRank}>{i + 1}</div>
              <div style={S.lbName}>{p.name}</div>
              <div style={S.lbRecord}>{p.wins}W · {p.losses}L</div>
            </div>
          ))}
        </div>
      )}

      {teamLB.length > 0 && (
        <div style={S.statsSection}>
          <div style={S.statsSectionTitle}>🥇 TEAM STANDINGS</div>
          {teamLB.map((t, i) => {
            const p1 = data.players.find(p => p.id === t.team.playerIds[0]);
            const p2 = data.players.find(p => p.id === t.team.playerIds[1]);
            const diff = t.pf - t.pa;
            return (
              <div key={i} style={S.lbRow}>
                <div style={S.lbRank}>{i + 1}</div>
                <div style={S.lbTeam}>
                  <div style={S.lbTeamSeed}>{t.team.side}{t.team.seed}</div>
                  <div style={S.lbTeamNames}>{p1?.name} / {p2?.name}</div>
                </div>
                <div style={S.lbRecord}>
                  {t.wins}W · {t.losses}L
                  <div style={{ ...S.lbDiff, color: diff > 0 ? T.gold : diff < 0 ? '#E07070' : T.ivoryDim }}>{diff >= 0 ? '+' : ''}{diff}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function UpsetCard({ upset, data }) {
  const w = data.teams[upset.winnerId], l = data.teams[upset.loserId];
  const wp1 = data.players.find(p => p.id === w.playerIds[0]);
  const wp2 = data.players.find(p => p.id === w.playerIds[1]);
  const lp1 = data.players.find(p => p.id === l.playerIds[0]);
  const lp2 = data.players.find(p => p.id === l.playerIds[1]);
  return (
    <div style={S.hotCard}>
      <div style={S.hotLabel}>BIGGEST UPSET</div>
      <div style={S.hotWin}>
        <strong>{wp1?.name} / {wp2?.name}</strong>
        <span style={S.hotSeed}>SEED {w.seed}</span>
      </div>
      <div style={S.hotVerb}>over</div>
      <div style={S.hotLose}>
        {lp1?.name} / {lp2?.name}
        <span style={S.hotSeed}>SEED {l.seed}</span>
      </div>
      <div style={S.hotMeta}>{matchLabel(upset.matchId)}</div>
    </div>
  );
}

function ClosestCard({ closest, data }) {
  const m = data.matches[closest.matchId];
  const t1 = data.teams[m.slots[0]], t2 = data.teams[m.slots[1]];
  const p1 = data.players.find(p => p.id === t1?.playerIds[0]);
  const p2 = data.players.find(p => p.id === t2?.playerIds[0]);
  return (
    <div style={S.hotCard}>
      <div style={S.hotLabel}>TIGHTEST MATCH</div>
      <div style={S.hotWin}>{p1?.name?.split(' ')[0] || `S${t1?.seed}`} <span style={{ color: T.rim }}>vs</span> {p2?.name?.split(' ')[0] || `S${t2?.seed}`}</div>
      <div style={S.hotScore}>{matchScoreString(m)}</div>
      <div style={S.hotMeta}>Won by {closest.margin} pt{closest.margin !== 1 ? 's' : ''} · {matchLabel(closest.matchId)}</div>
    </div>
  );
}

function HighScoreCard({ match, data }) {
  const t1 = data.teams[match.winnerId], t2 = data.teams[match.loserId];
  const p1 = data.players.find(p => p.id === t1?.playerIds[0]);
  const p2 = data.players.find(p => p.id === t2?.playerIds[0]);
  return (
    <div style={S.hotCard}>
      <div style={S.hotLabel}>HIGHEST SCORING</div>
      <div style={S.hotWin}>{p1?.name?.split(' ')[0] || `S${t1?.seed}`} <span style={{ color: T.rim }}>vs</span> {p2?.name?.split(' ')[0] || `S${t2?.seed}`}</div>
      <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: 22, fontWeight: 700, color: T.gold, letterSpacing: 1, margin: '4px 0 2px' }}>{match.totalPts} <span style={{ fontSize: 11, opacity: 0.6, fontWeight: 400 }}>PTS</span></div>
      <div style={S.hotMeta}>{match.t1Pts}–{match.t2Pts} · {matchLabel(match.matchId)}</div>
    </div>
  );
}

function DominantCard({ dominant, data }) {
  const team = data.teams[dominant.id];
  const p1 = data.players.find(p => p.id === team?.playerIds[0]);
  const p2 = data.players.find(p => p.id === team?.playerIds[1]);
  return (
    <div style={S.hotCard}>
      <div style={S.hotLabel}>MOST DOMINANT</div>
      <div style={S.hotWin}>{p1?.name?.split(' ')[0]} / {p2?.name?.split(' ')[0]}</div>
      <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: 22, fontWeight: 700, color: T.gold, letterSpacing: 1, margin: '4px 0 2px' }}>+{dominant.diff} <span style={{ fontSize: 11, opacity: 0.6, fontWeight: 400 }}>PT DIFF</span></div>
      <div style={S.hotMeta}>{team?.side}{team?.seed}</div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// CHAMPION BADGE
// ═══════════════════════════════════════════════════════════════════════════
function ChampionBadge({ team, players }) {
  const p1 = players.find(p => p.id === team.playerIds[0]);
  const p2 = players.find(p => p.id === team.playerIds[1]);
  return (
    <div style={S.champBadge}>
      <div style={S.champEmoji}>🏆</div>
      <div style={{ flex: 1 }}>
        <div style={S.champLabel}>TOURNAMENT CHAMPIONS</div>
        <div style={S.champNames}>
          {p1?.name || '...'} <span style={{ opacity: 0.5 }}>/</span> {p2?.name || '...'}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// RESET MENU
// ═══════════════════════════════════════════════════════════════════════════
function ResetMenu({ onClose, onResetBracket, onClearRosters, onResetAll }) {
  return (
    <div style={S.modalBackdrop} onClick={onClose}>
      <div style={S.modal} onClick={e => e.stopPropagation()}>
        <div style={S.modalTitle}>RESET OPTIONS</div>
        <div style={S.modalDesc}>What would you like to clear?</div>

        <button style={S.modalOption} onClick={onClearRosters}>
          <div style={S.modalOptionTitle}>CLEAR TEAM ROSTERS</div>
          <div style={S.modalOptionDesc}>Remove players from all teams · keep team names & seeds</div>
        </button>

        <button style={S.modalOption} onClick={onResetBracket}>
          <div style={S.modalOptionTitle}>RESET BRACKET PROGRESS</div>
          <div style={S.modalOptionDesc}>Clear winners & scores · keep rosters & seeds</div>
        </button>

        <button style={S.modalCancel} onClick={onClose}>CANCEL</button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TV DISPLAY MODE
// ═══════════════════════════════════════════════════════════════════════════
function TVDisplay({ data, onExit }) {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const slots = useMemo(() => getProjectedSlots(data), [data]);
  const live = getLiveSlotInfo(slots);
  const liveSlot = live.status === 'live' ? slots[live.index] : null;
  const champion = data.matches.FINAL?.winner ? data.teams[data.matches.FINAL.winner] : null;
  const stats = useMemo(() => computeStats(data), [data]);

  let countdown = null;
  if (liveSlot) {
    const { end } = parseSlotTime(liveSlot.time);
    const diff = end - now;
    if (diff > 0) {
      const m = Math.floor(diff / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      countdown = `${m}:${s.toString().padStart(2, '0')}`;
    }
  } else if (live.status === 'upcoming') {
    if (live.daysUntil != null) {
      countdown = `${live.daysUntil} DAY${live.daysUntil !== 1 ? 'S' : ''} AWAY`;
    } else if (live.minutesUntil != null) {
      countdown = `STARTS IN ${live.minutesUntil} MIN`;
    }
  }

  return (
    <div style={S.tvShell}>
      <style>{globalCSS}</style>

      {/* Top brand bar */}
      <div style={S.tvBrandBar}>
        <div style={S.tvBrandLeft}>
          <AtlasA size={52} color={T.ivory} />
          <div style={{ marginLeft: 4 }}>
            <div style={S.tvBrandTitle}>ATLAS <span style={{ color: T.gold }}>SUPREME</span></div>
            <div style={S.tvBrandSub}>INVITATIONAL · {EVENT_DATE}</div>
          </div>
        </div>
        {liveSlot && countdown && !champion && (
          <div style={S.tvTopCountdown}>
            <span style={S.tvLiveDot} />
            <span style={S.tvTopCountdownText}>{countdown}</span>
          </div>
        )}
        <div style={S.tvClock}>
          {now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true })}
        </div>
        <button style={S.tvExitBtn} onClick={onExit}>✕ EXIT</button>
      </div>

      {/* Champion takeover */}
      {champion && (
        <div style={S.tvChampionTakeover}>
          <div style={S.tvChampStars}>
            {[...Array(5)].map((_, i) => <Star key={i} size={40} />)}
          </div>
          <div style={S.tvChampLabel}>TOURNAMENT CHAMPIONS</div>
          <div style={S.tvChampNames}>
            {champion.name
              ? <div>{champion.name}</div>
              : champion.playerIds.map(pid => {
                  const p = data.players.find(pp => pp.id === pid);
                  return <div key={pid}>{p?.name || '—'}</div>;
                })}
          </div>
          {champion.name && (
            <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: 22, color: T.ivory, opacity: 0.6, letterSpacing: 1, marginTop: -8 }}>
              {champion.playerIds.map(pid => data.players.find(p => p.id === pid)?.name).filter(Boolean).join(' / ')}
            </div>
          )}
          <div style={S.tvChampSeed}>
            {champion.side === 'L' ? 'LEFT' : 'RIGHT'} BRACKET · SEED {champion.seed}
          </div>
          <div style={S.tvChampSubline}>ATLAS SUPREME INVITATIONAL · {EVENT_DATE}</div>
        </div>
      )}

      {/* Bracket view — main content when no champion */}
      {!champion && (
        <div style={{ flex: 1, overflow: 'hidden', minHeight: 0 }}>
          <TVBracketView data={data} />
        </div>
      )}

      {/* Live match cards strip */}
      {!champion && liveSlot && (
        <div style={S.tvLiveBar}>
          <div style={S.tvLiveBarHeader}>
            <span style={S.tvLiveDot} />
            <span style={S.tvLiveBarLabel}>LIVE NOW</span>
            <span style={S.tvLiveBarTime}>{liveSlot.time}</span>
          </div>
          <div style={S.tvLiveCardsRow}>
            {[0, 1, 2].map(i => (
              <TVLiveCard key={i} tableNum={liveSlot.tables[i]}
                matchId={liveSlot.matchIds[i]} data={data} />
            ))}
          </div>
        </div>
      )}

      {/* Ticker */}
      <div style={S.tvTickerStrip}>
        <TVTicker stats={stats} data={data} />
      </div>
    </div>
  );
}

function TVLiveCard({ tableNum, matchId, data }) {
  const m = matchId ? data.matches[matchId] : null;
  const t1 = m?.slots[0] ? data.teams[m.slots[0]] : null;
  const t2 = m?.slots[1] ? data.teams[m.slots[1]] : null;
  const p1a = t1?.playerIds[0] ? data.players.find(p => p.id === t1.playerIds[0]) : null;
  const p1b = t1?.playerIds[1] ? data.players.find(p => p.id === t1.playerIds[1]) : null;
  const p2a = t2?.playerIds[0] ? data.players.find(p => p.id === t2.playerIds[0]) : null;
  const p2b = t2?.playerIds[1] ? data.players.find(p => p.id === t2.playerIds[1]) : null;
  const w1 = m?.winner && m.winner === m?.slots[0];
  const w2 = m?.winner && m.winner === m?.slots[1];

  return (
    <div style={S.tvLiveCard}>
      <div style={S.tvLiveCardHeader}>
        <span style={S.tvLiveCardTable}>TABLE {tableNum}</span>
        {matchId && <span style={S.tvLiveCardLabel}>{matchLabel(matchId)}</span>}
      </div>
      {!matchId || !m ? (
        <div style={S.tvLiveCardEmpty}>OPEN</div>
      ) : (
        <div style={S.tvLiveCardBody}>
          <div style={{ ...S.tvLiveTeam, ...(w1 ? S.tvLiveTeamWin : {}), ...(w2 ? S.tvLiveTeamLose : {}) }}>
            <div style={S.tvLiveSeed}>{t1?.seed ?? '—'}</div>
            <div style={S.tvLiveNames}>
              <div style={S.tvLiveName}>{t1 ? getTeamDisplayName(t1, data) : '—'}</div>
              {!t1?.name && p1b && <div style={{ ...S.tvLiveName, display: 'none' }} />}
            </div>
            {w1 && <div style={S.tvLiveWinCheck}>✓</div>}
          </div>
          <div style={S.tvLiveVs}>VS</div>
          <div style={{ ...S.tvLiveTeam, ...(w2 ? S.tvLiveTeamWin : {}), ...(w1 ? S.tvLiveTeamLose : {}) }}>
            <div style={S.tvLiveSeed}>{t2?.seed ?? '—'}</div>
            <div style={S.tvLiveNames}>
              <div style={S.tvLiveName}>{t2 ? getTeamDisplayName(t2, data) : '—'}</div>
            </div>
            {w2 && <div style={S.tvLiveWinCheck}>✓</div>}
          </div>
        </div>
      )}
    </div>
  );
}

function TVTicker({ stats, data }) {
  const items = [];
  if (stats.totalMatches > 0) {
    items.push(`${stats.totalMatches} MATCHES PLAYED`);
    items.push(`${stats.totalPoints} TOTAL POINTS`);
  }
  if (stats.biggestUpset) {
    const w = data.teams[stats.biggestUpset.winnerId];
    const l = data.teams[stats.biggestUpset.loserId];
    items.push(`🔥 BIGGEST UPSET: SEED ${w.seed} BEAT SEED ${l.seed}`);
  }
  if (stats.closestMatch) {
    items.push(`⚡ TIGHTEST GAME: WON BY ${stats.closestMatch.margin}`);
  }
  items.push('DREAM BIG · ATLAS SUPREME INVITATIONAL · BRING YOUR PADDLE');
  const text = items.join('   ·   ');
  return <div style={S.tvTickerText}>{text}   ·   {text}</div>;
}

// ═══════════════════════════════════════════════════════════════════════════
// TV SCHEDULE DISPLAY
// ═══════════════════════════════════════════════════════════════════════════
function TVScheduleDisplay({ data, onExit }) {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const rawLive = getLiveSlotInfo(SCHEDULE_SLOTS);
  const isEventDay = rawLive.status === 'live' || (rawLive.status === 'upcoming' && rawLive.daysUntil == null);
  const slots = useMemo(() => isEventDay ? getProjectedSlots(data) : SCHEDULE_SLOTS, [data, isEventDay]);
  const live = getLiveSlotInfo(slots);
  const stats = useMemo(() => computeStats(data), [data]);

  return (
    <div style={S.tvShell}>
      <style>{globalCSS}</style>

      {/* Top brand bar */}
      <div style={S.tvBrandBar}>
        <div style={S.tvBrandLeft}>
          <AtlasA size={52} color={T.ivory} />
          <div style={{ marginLeft: 4 }}>
            <div style={S.tvBrandTitle}>ATLAS <span style={{ color: T.gold }}>SUPREME</span></div>
            <div style={S.tvBrandSub}>SCHEDULE · {EVENT_DATE}</div>
          </div>
        </div>
        <div style={S.tvClock}>
          {now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true })}
        </div>
        <button style={S.tvExitBtn} onClick={onExit}>✕ EXIT</button>
      </div>

      {/* Schedule slots */}
      <div style={S.tvSchedGrid}>
        {slots.map((slot, idx) => {
          const isLive = live.status === 'live' && live.index === idx;
          const isPast = (live.status === 'live' && idx < live.index) || live.status === 'finished';
          return (
            <div key={idx} style={{
              ...S.tvSchedSlot,
              ...(isLive ? S.tvSchedSlotLive : {}),
              ...(isPast ? S.tvSchedSlotPast : {}),
            }}>
              <div style={S.tvSchedTime}>
                {isLive && <span style={{ ...S.tvLiveDot, marginRight: 10 }} />}
                {slot.time}
                {slot.projected && <span style={S.tvSchedEst}>EST</span>}
              </div>
              <div style={S.tvSchedTables}>
                {[0, 1, 2].map(i => {
                  const mid = slot.matchIds[i];
                  const m = mid ? data.matches[mid] : null;
                  const t1 = m?.slots[0] ? data.teams[m.slots[0]] : null;
                  const t2 = m?.slots[1] ? data.teams[m.slots[1]] : null;
                  const p1a = t1?.playerIds[0] ? data.players.find(p => p.id === t1.playerIds[0]) : null;
                  const p1b = t1?.playerIds[1] ? data.players.find(p => p.id === t1.playerIds[1]) : null;
                  const p2a = t2?.playerIds[0] ? data.players.find(p => p.id === t2.playerIds[0]) : null;
                  const p2b = t2?.playerIds[1] ? data.players.find(p => p.id === t2.playerIds[1]) : null;
                  const w1 = m?.winner && m.winner === m?.slots[0];
                  const w2 = m?.winner && m.winner === m?.slots[1];
                  return (
                    <div key={i} style={S.tvSchedMatch}>
                      <div style={S.tvSchedTableNum}>TABLE {slot.tables[i]}</div>
                      {mid && m ? (
                        <>
                          <div style={{ ...S.tvSchedTeam, ...(w1 ? S.tvSchedWinner : w2 ? S.tvSchedLoser : {}) }}>
                            <span style={S.tvSchedSeed}>{t1?.seed ?? '—'}</span>
                            <span style={S.tvSchedNames}>{t1 ? getTeamDisplayName(t1, data) : '—'}</span>
                            {w1 && <span style={S.tvSchedCheck}>✓</span>}
                          </div>
                          <div style={S.tvSchedVs}>VS</div>
                          <div style={{ ...S.tvSchedTeam, ...(w2 ? S.tvSchedWinner : w1 ? S.tvSchedLoser : {}) }}>
                            <span style={S.tvSchedSeed}>{t2?.seed ?? '—'}</span>
                            <span style={S.tvSchedNames}>{t2 ? getTeamDisplayName(t2, data) : '—'}</span>
                            {w2 && <span style={S.tvSchedCheck}>✓</span>}
                          </div>
                        </>
                      ) : (
                        <div style={S.tvSchedEmpty}>—</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Ticker */}
      <div style={S.tvTickerStrip}>
        <TVTicker stats={stats} data={data} />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// PRINT SCHEDULE
// ═══════════════════════════════════════════════════════════════════════════
function PrintSchedule({ data, onClose }) {
  const [printTab, setPrintTab] = useState('schedule');
  const slots = getEffectiveSlots(data);

  return (
    <div style={S.printBackdrop}>
      <style>{globalCSS}</style>
      <div style={{ maxWidth: printTab === 'bracket' ? 1060 : 900, margin: '0 auto', background: '#fff', color: '#1a1a1a', fontFamily: 'Arial, sans-serif' }}>

        {/* Top controls — hidden on print */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0 18px', borderBottom: '2px solid #222', marginBottom: 24 }} className="no-print">
          {/* Tabs */}
          <div style={{ display: 'flex', gap: 6 }}>
            {[{ id: 'schedule', label: '📋 SCHEDULE' }, { id: 'bracket', label: '🏆 PREDICTION BRACKET' }].map(t => (
              <button key={t.id} onClick={() => setPrintTab(t.id)} style={{
                background: printTab === t.id ? '#1A3A2C' : '#f0f0f0',
                color: printTab === t.id ? '#F2A23A' : '#555',
                border: printTab === t.id ? '1.5px solid #D4A54B' : '1.5px solid #ccc',
                padding: '8px 16px', borderRadius: 4, fontWeight: 700, cursor: 'pointer', fontSize: 13, letterSpacing: 0.5,
              }}>{t.label}</button>
            ))}
          </div>
          {/* Actions */}
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => window.print()} style={S.printBtn}>🖨️ PRINT</button>
            <button onClick={onClose} style={S.printCloseBtn}>✕ CLOSE</button>
          </div>
        </div>

        {/* SCHEDULE VIEW */}
        {printTab === 'schedule' && (
          <div data-print-area>
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <h1 style={S.printTitle}>ATLAS SUPREME · INVITATIONAL</h1>
              <p style={S.printSubtitle}>{EVENT_DATE} · 4:30 – 6:30 PM · 18 TEAMS</p>
            </div>
            <table style={S.printTable}>
              <thead><tr>
                <th style={S.printTh}>TIME</th>
                <th style={S.printTh}>TABLE 1</th>
                <th style={S.printTh}>TABLE 2</th>
                <th style={S.printTh}>TABLE 3</th>
              </tr></thead>
              <tbody>
                {slots.map((slot, idx) => (
                  <tr key={idx}>
                    <td style={{ ...S.printTd, ...S.printTimeCell }}>
                      <strong>{slot.time}</strong><br />
                      <small>{slot.duration}</small>
                    </td>
                    {[0, 1, 2].map(i => (
                      <td key={i} style={S.printTd}>
                        {slot.matchIds[i]
                          ? <PrintMatchCell matchId={slot.matchIds[i]} data={data} />
                          : <div style={S.printEmpty}>{slot.tables[i]}</div>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={S.printFooter}>
              <p><b>COMPETE · HAVE FUN · DREAM BIG</b></p>
              <p>1 GAME TO 21 · FINALS BEST OF 3 · 3 TABLES</p>
            </div>
          </div>
        )}

        {/* BRACKET VIEW */}
        {printTab === 'bracket' && <PrintBracket data={data} />}
      </div>
    </div>
  );
}

function PrintBracket({ data }) {
  const getTeam = (matchId, pos) => {
    const m = data.matches[matchId];
    if (!m?.slots[pos]) return null;
    const team = data.teams[m.slots[pos]];
    return team ? { name: getTeamDisplayName(team, data), seed: team.seed } : null;
  };

  // ── Layout ──────────────────────────────────────────────────────────────
  // Each match = two rows of height SH with no gap between them.
  // Connector exits at the midpoint between row 1 and row 2 = top + SH.
  const SH   = 26;           // row height (px)
  const MH   = SH * 2;      // match height = 52
  const BG   = 30;           // gap between sibling matches
  const STEP = MH + BG;     // = 82
  const H    = 4*STEP - BG; // = 298  (total bracket height)

  // mc = the y-coordinate of the connector exit for a match at `top`
  const mc = top => top + SH;

  const r16T = [0, STEP, 2*STEP, 3*STEP];
  const r16C = r16T.map(mc);                              // [26,108,190,272]
  const qfC  = [(r16C[0]+r16C[1])/2, (r16C[2]+r16C[3])/2]; // [67, 231]
  const qfT  = qfC.map(c => c - SH);                     // [41, 205]
  const sfC  = (qfC[0]+qfC[1])/2;                        // 149
  const sfT  = sfC - SH;                                 // 123

  // ── Column x-positions ──────────────────────────────────────────────────
  // Naming: lR16 = left R16 column left edge, lR16R = its right edge, etc.
  const PAD=8, R16W=150, CONN=22, QFW=120, SFW=112, FINW=118;

  const lR16   = PAD;
  const lR16R  = lR16  + R16W;   // 158
  const lQF    = lR16R + CONN;   // 180
  const lQFR   = lQF   + QFW;    // 300
  const lSF    = lQFR  + CONN;   // 322
  const lSFR   = lSF   + SFW;    // 434
  const finL   = lSFR  + CONN;   // 456
  const finR   = finL  + FINW;   // 574
  const rSF    = finR  + CONN;   // 596
  const rSFR   = rSF   + SFW;    // 708
  const rQF    = rSFR  + CONN;   // 730
  const rQFR   = rQF   + QFW;    // 850
  const rR16   = rQFR  + CONN;   // 872
  const rR16R  = rR16  + R16W;   // 1022
  const TOTAL_W = rR16R + PAD;   // 1030

  // Connector midpoint x for each gap zone
  const lMid1 = (lR16R + lQF)  / 2;  // 169
  const lMid2 = (lQFR  + lSF)  / 2;  // 311
  const lMid3 = (lSFR  + finL) / 2;  // 445
  const rMid3 = (finR  + rSF)  / 2;  // 585
  const rMid2 = (rSFR  + rQF)  / 2;  // 719
  const rMid1 = (rQFR  + rR16) / 2;  // 861

  // ── SVG lines ───────────────────────────────────────────────────────────
  const segs = [];
  const H_ = (x1, x2, y)       => segs.push(`M${x1},${y} H${x2}`);
  const V_  = (x,  y1, y2)     => segs.push(`M${x},${y1} V${y2}`);

  // Left R16 → QF
  [[0,1],[2,3]].forEach(([a,b], qi) => {
    H_(lR16R, lMid1, r16C[a]);
    H_(lR16R, lMid1, r16C[b]);
    V_(lMid1, r16C[a], r16C[b]);
    H_(lMid1, lQF, qfC[qi]);
  });
  // Left QF → SF
  H_(lQFR, lMid2, qfC[0]); H_(lQFR, lMid2, qfC[1]);
  V_(lMid2, qfC[0], qfC[1]); H_(lMid2, lSF, sfC);
  // Left SF → FINAL
  H_(lSFR, lMid3, sfC); H_(lMid3, finL, sfC);

  // Right R16 → QF
  [[0,1],[2,3]].forEach(([a,b], qi) => {
    H_(rR16, rMid1, r16C[a]);
    H_(rR16, rMid1, r16C[b]);
    V_(rMid1, r16C[a], r16C[b]);
    H_(rMid1, rQFR, qfC[qi]);
  });
  // Right QF → SF
  H_(rQF, rMid2, qfC[0]); H_(rQF, rMid2, qfC[1]);
  V_(rMid2, qfC[0], qfC[1]); H_(rMid2, rSFR, sfC);
  // Right SF → FINAL
  H_(rSF, rMid3, sfC); H_(rMid3, finR, sfC);

  // ── Components ──────────────────────────────────────────────────────────
  const font = "'Barlow Condensed','Oswald',Arial,sans-serif";

  // One team row — underline style
  const Row = ({ team, show, isLast }) => (
    <div style={{
      height: SH,
      borderBottom: isLast ? 'none' : `1.5px solid ${show && team ? '#222' : '#bbb'}`,
      display: 'flex', alignItems: 'center',
      padding: '0 5px', gap: 5, boxSizing: 'border-box',
      // Bottom row has no border so the underline IS the connector exit line
    }}>
      {show && team ? (
        <>
          <span style={{ fontSize: 10, fontWeight: 800, color: '#B5761E', minWidth: 16, textAlign: 'right', flexShrink: 0, fontFamily: font }}>{team.seed}</span>
          <span style={{ fontSize: 11, fontWeight: 600, color: '#111', fontFamily: font, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{team.name}</span>
        </>
      ) : null}
    </div>
  );

  // Two-row match block — top row has underline divider, bottom row IS the exit line
  const Match = ({ t0, t1, w, show }) => (
    <div style={{ width: w, borderBottom: '1.5px solid #bbb' }}>
      <Row team={t0} show={show} isLast={false} />
      <Row team={t1} show={show} isLast={true} />
    </div>
  );

  const LABEL_H = 24;

  const cols = [
    { ids: ['L_R1_1','L_R1_2','L_R1_3','L_R1_4'], tops: r16T, x: lR16, w: R16W, show: true  },
    { ids: ['L_QF_1','L_QF_2'],                   tops: qfT,  x: lQF,  w: QFW,  show: false },
    { ids: ['L_SF'],                               tops:[sfT], x: lSF,  w: SFW,  show: false },
    { ids: ['R_R1_1','R_R1_2','R_R1_3','R_R1_4'], tops: r16T, x: rR16, w: R16W, show: true  },
    { ids: ['R_QF_1','R_QF_2'],                   tops: qfT,  x: rQF,  w: QFW,  show: false },
    { ids: ['R_SF'],                               tops:[sfT], x: rSF,  w: SFW,  show: false },
  ];

  return (
    <div data-print-area style={{ fontFamily: font, background: '#fff', color: '#111' }}>

      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: 22 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 6 }}>
          <svg width="34" height="27" viewBox="0 0 100 80" fill="none">
            <polyline points="12,76 50,4 88,76" stroke="#2E5B4E" strokeWidth="13" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span style={{ fontSize: 24, fontWeight: 800, letterSpacing: 4, color: '#111', fontFamily: "'Oswald',Arial,sans-serif" }}>
            ATLAS <span style={{ color: '#B5761E' }}>SUPREME</span> INVITATIONAL
          </span>
        </div>
        <div style={{ fontSize: 10, color: '#666', letterSpacing: 2, marginBottom: 14 }}>
          PREDICTION BRACKET · {EVENT_DATE} · SINGLE ELIMINATION
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 60, fontSize: 11, color: '#333' }}>
          <span>NAME: <span style={{ display: 'inline-block', width: 190, borderBottom: '1.2px solid #555' }}>&nbsp;</span></span>
          <span>WINNER PICK: <span style={{ display: 'inline-block', width: 160, borderBottom: '1.2px solid #555' }}>&nbsp;</span></span>
        </div>
      </div>

      {/* Bracket canvas */}
      <div style={{ position: 'relative', width: TOTAL_W, height: H + LABEL_H + 12, margin: '0 auto' }}>

        {/* Round labels */}
        {[
          { label: 'ROUND OF 16',  x: lR16, w: R16W },
          { label: 'QUARTERFINAL', x: lQF,  w: QFW  },
          { label: 'SEMIFINAL',    x: lSF,  w: SFW  },
          { label: 'CHAMPION',     x: finL, w: FINW  },
          { label: 'SEMIFINAL',    x: rSF,  w: SFW  },
          { label: 'QUARTERFINAL', x: rQF,  w: QFW  },
          { label: 'ROUND OF 16',  x: rR16, w: R16W },
        ].map(({ label, x, w }, i) => (
          <div key={i} style={{
            position: 'absolute', top: 0, left: x, width: w, textAlign: 'center',
            fontSize: 8.5, fontWeight: 700, letterSpacing: 1, color: '#B5761E',
            fontFamily: font, borderBottom: '1.5px solid #D4A54B', paddingBottom: 4,
          }}>{label}</div>
        ))}

        {/* SVG connector lines */}
        <svg style={{ position: 'absolute', top: LABEL_H, left: 0, overflow: 'visible' }} width={TOTAL_W} height={H}>
          {segs.map((d, i) => <path key={i} d={d} fill="none" stroke="#888" strokeWidth="1.2"/>)}
        </svg>

        {/* Match boxes */}
        <div style={{ position: 'absolute', top: LABEL_H, left: 0 }}>
          {cols.flatMap(col =>
            col.ids.map((mid, mi) => (
              <div key={mid} style={{ position: 'absolute', top: col.tops[mi], left: col.x }}>
                <Match t0={getTeam(mid, 0)} t1={getTeam(mid, 1)} w={col.w} show={col.show} />
              </div>
            ))
          )}

          {/* CHAMPION box — gold bordered, two rows */}
          <div style={{ position: 'absolute', top: sfT, left: finL, width: FINW }}>
            <div style={{ border: '2px solid #D4A54B', borderRadius: 3, overflow: 'hidden', background: 'rgba(212,165,75,0.04)' }}>
              <div style={{ height: SH, borderBottom: '1.5px solid #D4A54B' }} />
              <div style={{ height: SH }} />
            </div>
          </div>
        </div>
      </div>

      <p style={{ textAlign: 'center', fontSize: 8.5, color: '#999', marginTop: 14, letterSpacing: 1 }}>
        1 GAME TO 21 · FINALS BEST OF 3 · MUST WIN BY 2 · COMPETE · DREAM BIG
      </p>
    </div>
  );
}

function PrintMatchCell({ matchId, data }) {
  const m = data.matches[matchId];
  const t1 = m.slots[0] ? data.teams[m.slots[0]] : null;
  const t2 = m.slots[1] ? data.teams[m.slots[1]] : null;
  const p1a = t1?.playerIds[0] ? data.players.find(p => p.id === t1.playerIds[0]) : null;
  const p1b = t1?.playerIds[1] ? data.players.find(p => p.id === t1.playerIds[1]) : null;
  const p2a = t2?.playerIds[0] ? data.players.find(p => p.id === t2.playerIds[0]) : null;
  const p2b = t2?.playerIds[1] ? data.players.find(p => p.id === t2.playerIds[1]) : null;

  if (!t1 || !t2) return <div style={S.printEmpty}>— Open Match —</div>;
  return (
    <div style={S.printMatch}>
      <div><strong>{t1.side}{t1.seed}</strong></div>
      <div>{p1a?.name || '—'}</div>
      <div>{p1b?.name || '—'}</div>
      <div style={S.printVs}>vs</div>
      <div><strong>{t2.side}{t2.seed}</strong></div>
      <div>{p2a?.name || '—'}</div>
      <div>{p2b?.name || '—'}</div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ICONS
// ═══════════════════════════════════════════════════════════════════════════
function Star({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={T.gold}>
      <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 16.8 5.8 21.3l2.4-7.4L2 9.4h7.6z" />
    </svg>
  );
}
function AtlasA({ size = 40, color = T.bgSoft }) {
  const h = size;
  const w = size * (100 / 80);
  return (
    <svg width={w} height={h} viewBox="0 0 100 80" fill="none">
      <polyline points="12,76 50,4 88,76"
        stroke={color} strokeWidth="13"
        strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
function CheckIcon({ color }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color || T.gold} strokeWidth="3">
      <path d="M5 12l5 5L20 7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════════════════
const S = {
  appShell: {
    minHeight: '100vh',
    width: '100%',
    background: T.bgDeep,
    display: 'flex',
    justifyContent: 'center',
  },
  app: {
    width: '100%',
    maxWidth: '480px',
    minHeight: '100vh',
    background: `radial-gradient(ellipse at top, ${T.bgMid} 0%, ${T.bg} 35%, ${T.bgDeep} 100%)`,
    color: T.ivory,
    fontFamily: "'Barlow Condensed', 'Oswald', -apple-system, system-ui, sans-serif",
    display: 'flex', flexDirection: 'column', position: 'relative', overflowX: 'hidden',
  },

  header: {
    display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
    padding: '16px 16px 12px',
    paddingTop: 'calc(16px + env(safe-area-inset-top, 0px))',
    borderBottom: `1px solid ${T.rim}`,
    background: 'rgba(4, 18, 14, 0.6)',
    position: 'sticky', top: 0, zIndex: 10,
    backdropFilter: 'blur(14px)',
    WebkitBackdropFilter: 'blur(14px)',
  },
  brandBlock: { display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 0 },
  starRow: { display: 'flex', gap: 4, marginBottom: 4 },
  brandTitle: {
    fontFamily: "'Oswald', sans-serif",
    fontSize: 22, fontWeight: 700, letterSpacing: 3, lineHeight: 1, color: T.ivory,
  },
  brandSubtitle: {
    fontFamily: "'Oswald', sans-serif",
    fontSize: 12, fontWeight: 300, letterSpacing: 7, lineHeight: 1, marginTop: 4, color: T.ivory,
  },
  eventLabel: {
    color: T.sage,
    fontFamily: "'Oswald', sans-serif",
    fontSize: 9, fontWeight: 600, letterSpacing: 1.6, marginTop: 5,
  },
  headerActions: { display: 'flex', gap: 6, alignItems: 'center' },

  // Hamburger + dropdown
  hamburgerBtn: {
    background: 'rgba(212,165,75,0.06)', border: `1px solid ${T.rim}`,
    borderRadius: 6, width: 40, height: 40, cursor: 'pointer',
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 5,
    padding: 0,
  },
  hamLine: {
    display: 'block', width: 18, height: 2,
    background: T.gold, borderRadius: 2, flexShrink: 0,
  },
  dropMenu: {
    position: 'absolute', top: 'calc(100% + 8px)', right: 0,
    background: T.bgCard, border: `1px solid ${T.rim}`,
    borderRadius: 8, minWidth: 200, zIndex: 200,
    boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
    overflow: 'hidden',
    padding: '6px 0',
  },
  dropSection: {
    fontFamily: "'Oswald', sans-serif", fontSize: 9, fontWeight: 700,
    letterSpacing: 2, color: T.sage, padding: '8px 16px 4px',
  },
  dropItem: {
    display: 'flex', alignItems: 'center', gap: 10,
    width: '100%', background: 'none', border: 'none',
    padding: '10px 16px', cursor: 'pointer',
    fontFamily: "'Barlow Condensed', sans-serif", fontSize: 14, fontWeight: 600,
    color: T.ivory, textAlign: 'left',
    transition: 'background 0.12s',
  },
  dropIcon: { fontSize: 15, flexShrink: 0, width: 20, textAlign: 'center' },
  dropDivider: { height: 1, background: T.rim, margin: '4px 0' },
  iconBtn: {
    background: 'rgba(212,165,75,0.06)',
    border: `1px solid ${T.rim}`, color: T.ivory,
    fontSize: 14, fontWeight: 600,
    padding: '8px 12px', borderRadius: 4, cursor: 'pointer',
    minHeight: 36, minWidth: 36,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  lockBtnActive: {
    background: T.gold, color: T.bgDeep, border: `1px solid ${T.goldBr}`,
    fontSize: 14, fontWeight: 700,
    padding: '8px 12px', borderRadius: 4, cursor: 'pointer', minHeight: 36, minWidth: 36,
  },

  lockBanner: {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '10px 16px',
    background: 'rgba(212,165,75,0.14)',
    borderBottom: `1px solid ${T.gold}`,
    color: T.goldBr,
    fontFamily: "'Oswald', sans-serif", fontSize: 12, fontWeight: 700, letterSpacing: 2,
  },
  lockBannerBtn: {
    marginLeft: 'auto',
    background: T.gold, color: T.bgDeep, border: 'none',
    padding: '4px 10px', borderRadius: 3, cursor: 'pointer',
    fontFamily: "'Oswald', sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: 1.5,
  },

  tabBar: {
    display: 'flex',
    borderBottom: `1px solid ${T.rim}`,
    background: 'rgba(4,18,14,0.5)',
    position: 'sticky', top: 'calc(82px + env(safe-area-inset-top, 0px))', zIndex: 9,
  },
  tab: {
    flex: 1, background: 'transparent', border: 'none', color: 'rgba(245,238,220,0.5)',
    padding: '10px 6px 12px', cursor: 'pointer',
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
    borderBottom: '2px solid transparent', transition: 'all 150ms',
  },
  tabActive: {
    flex: 1, background: 'rgba(212,165,75,0.06)', border: 'none', color: T.ivory,
    padding: '10px 6px 12px', cursor: 'pointer',
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
    borderBottom: `2px solid ${T.gold}`,
  },
  tabLabel: { fontFamily: "'Oswald', sans-serif", fontSize: 12, fontWeight: 700, letterSpacing: 2 },
  tabSub: { fontFamily: "'Barlow Condensed', sans-serif", fontSize: 9, color: T.gold, letterSpacing: 1, fontWeight: 500 },

  content: { flex: 1, overflowY: 'auto', paddingBottom: 'calc(110px + env(safe-area-inset-bottom, 0px))' },

  // BRACKET
  bracketView: { padding: 0 },
  roundTabs: {
    display: 'flex', gap: 6, padding: '12px 12px 8px',
    overflowX: 'auto', WebkitOverflowScrolling: 'touch',
  },
  roundTab: {
    flex: 1, minWidth: 60,
    background: 'rgba(212,165,75,0.04)',
    border: `1px solid ${T.rim}`,
    color: 'rgba(245,238,220,0.6)',
    padding: '8px 6px', borderRadius: 4, cursor: 'pointer',
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
  },
  roundTabActive: {
    flex: 1, minWidth: 60,
    background: 'rgba(212,165,75,0.16)',
    border: `1px solid ${T.gold}`, color: T.ivory,
    padding: '8px 6px', borderRadius: 4, cursor: 'pointer',
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
  },
  roundShort: { fontFamily: "'Oswald', sans-serif", fontSize: 13, fontWeight: 700, letterSpacing: 1.5 },
  roundProgress: { fontFamily: "'Barlow Condensed', sans-serif", fontSize: 10, color: T.gold, fontWeight: 600 },

  bracketToolbar: {
    padding: '4px 12px 8px',
    display: 'flex', alignItems: 'center', gap: 10,
    flexWrap: 'wrap',
  },
  toolbarBtn: {
    background: 'rgba(212,165,75,0.08)',
    border: `1px solid ${T.rim}`, color: T.ivory,
    padding: '6px 12px', borderRadius: 4, cursor: 'pointer',
    fontFamily: "'Oswald', sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: 1.5,
  },
  toolbarBtnActive: {
    background: T.gold, color: T.bgDeep, border: `1px solid ${T.goldBr}`,
    padding: '6px 12px', borderRadius: 4, cursor: 'pointer',
    fontFamily: "'Oswald', sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: 1.5,
  },
  toolbarHint: {
    fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, color: 'rgba(245,238,220,0.5)',
    flex: 1, letterSpacing: 0.3,
  },

  matchList: {
    padding: '4px 12px 16px',
    display: 'flex', flexDirection: 'column', gap: 12,
  },

  matchCard: {
    background: T.bgCard,
    border: `1px solid ${T.rim}`,
    borderRadius: 6, overflow: 'hidden',
  },
  matchCardChamp: {
    border: `2px solid ${T.gold}`,
    boxShadow: `0 0 32px rgba(212,165,75,0.4)`,
  },
  matchHeader: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '8px 12px',
    background: 'rgba(0,0,0,0.3)',
    borderBottom: `1px solid ${T.rim}`,
  },
  matchHeaderLabel: {
    fontFamily: "'Oswald', sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: 2, color: T.gold,
  },
  matchHeaderRight: { display: 'flex', gap: 6, alignItems: 'center' },
  matchHeaderTag: {
    fontFamily: "'Oswald', sans-serif", fontSize: 9, fontWeight: 700, letterSpacing: 1.5,
    color: T.gold, background: 'rgba(212,165,75,0.18)',
    padding: '2px 8px', borderRadius: 3,
  },
  matchHeaderForfeit: {
    fontFamily: "'Oswald', sans-serif", fontSize: 9, fontWeight: 700, letterSpacing: 1.5,
    color: T.red, background: 'rgba(199,72,74,0.18)',
    padding: '2px 8px', borderRadius: 3,
  },

  teamRow: {
    display: 'flex', alignItems: 'center', minHeight: 70,
    padding: '8px 10px 8px 12px', cursor: 'pointer', gap: 4,
    transition: 'all 150ms',
  },
  teamRowWinner: { background: 'rgba(212,165,75,0.10)', boxShadow: `inset 4px 0 0 ${T.gold}` },
  teamRowChamp: { background: `linear-gradient(135deg, ${T.gold} 0%, ${T.goldBr} 100%)` },
  teamRowLoser: { opacity: 0.4 },
  teamRowEmpty: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    minHeight: 64, padding: '8px 12px',
  },
  teamRowEmptyText: {
    color: 'rgba(245,238,220,0.5)',
    fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12, letterSpacing: 2, fontStyle: 'italic',
  },
  teamSeed: {
    width: 32, flexShrink: 0,
    color: T.goldBr,
    fontFamily: "'Oswald', sans-serif", fontSize: 22, fontWeight: 700,
    textAlign: 'center', position: 'relative',
  },
  teamSeedEditable: {
    background: 'rgba(212,165,75,0.12)',
    border: `1px dashed ${T.gold}`, borderRadius: 4,
    cursor: 'pointer', padding: '4px 0',
  },
  piTag: {
    position: 'absolute', top: -4, right: -2,
    background: T.gold, color: T.bgDeep,
    fontSize: 8, fontWeight: 700, padding: '1px 4px', borderRadius: 2,
    fontFamily: "'Oswald', sans-serif",
  },
  teamPlayers: {
    flex: 1, display: 'flex', flexDirection: 'column', gap: 4,
    justifyContent: 'center', minWidth: 0,
  },
  teamPlayerName: {
    fontFamily: "'Oswald', sans-serif", fontSize: 14, fontWeight: 600, letterSpacing: 0.5,
    color: T.ivory, textTransform: 'uppercase',
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  },
  tbd: { color: 'rgba(245,238,220,0.4)', fontWeight: 400, letterSpacing: 2, fontStyle: 'italic' },
  winnerCheck: { flexShrink: 0, paddingLeft: 4 },

  playerSlotEmpty: {
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '7px 10px',
    border: `1px dashed rgba(212,165,75,0.35)`, borderRadius: 4,
    background: 'rgba(0,0,0,0.2)',
    cursor: 'pointer', minHeight: 26, width: '100%',
    color: 'inherit', fontFamily: 'inherit',
  },
  playerSlotEmptyLabel: {
    color: 'rgba(245,238,220,0.7)',
    fontFamily: "'Oswald', sans-serif", fontSize: 10, fontWeight: 500, letterSpacing: 1.3,
  },
  plus: { color: T.goldBr, fontSize: 18, fontWeight: 700, lineHeight: 1 },
  playerSlotFilled: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '3px 4px', minHeight: 22, gap: 6,
  },
  playerSlotName: {
    fontFamily: "'Oswald', sans-serif", fontSize: 14, fontWeight: 600, letterSpacing: 0.5,
    color: T.ivory, textTransform: 'uppercase',
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1,
  },
  removeBtn: {
    width: 24, height: 24,
    border: `1px solid ${T.red}`, color: T.red,
    background: 'rgba(199,72,74,0.1)', borderRadius: '50%',
    fontSize: 16, fontWeight: 700, cursor: 'pointer', lineHeight: 1,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: 0, flexShrink: 0,
  },

  vsRow: { display: 'flex', alignItems: 'center', gap: 8, padding: '0 16px' },
  vsLine: { flex: 1, height: 1, background: T.rim },
  vsLabel: { fontFamily: "'Oswald', sans-serif", fontSize: 10, fontWeight: 600, letterSpacing: 2, color: 'rgba(245,238,220,0.5)' },
  vsScore: { fontFamily: "'Oswald', sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: 1, color: T.goldBr },
  scoreButton: {
    background: 'rgba(212,165,75,0.12)', border: `1px solid ${T.gold}`,
    color: T.goldBr, borderRadius: 4, padding: '4px 8px', cursor: 'pointer',
    fontFamily: "'Oswald', sans-serif", fontSize: 10, fontWeight: 600, letterSpacing: 1.5,
  },
  shareButton: {
    background: 'rgba(212,165,75,0.12)', border: `1px solid ${T.gold}`,
    color: T.goldBr, borderRadius: 4, padding: '4px 8px', cursor: 'pointer',
    fontSize: 12, fontWeight: 600,
  },

  // SEED EDITOR
  seedEditorCurrent: {
    fontFamily: "'Oswald', sans-serif", fontSize: 11,
    color: T.ivory, opacity: 0.85,
    marginTop: 4,
  },
  seedExplain: {
    padding: '8px 16px 12px',
    fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12,
    color: 'rgba(245,238,220,0.7)', borderBottom: `1px solid ${T.rim}`,
  },
  seedList: { padding: 8, overflowY: 'auto', flex: 1 },
  seedItem: {
    display: 'flex', alignItems: 'center', gap: 10,
    width: '100%', padding: '12px',
    background: 'rgba(212,165,75,0.04)',
    border: `1px solid ${T.rim}`, borderRadius: 6,
    marginBottom: 6, cursor: 'pointer', textAlign: 'left',
    color: T.ivory, fontFamily: 'inherit',
  },
  seedItemCurrent: { background: 'rgba(212,165,75,0.18)', border: `1px solid ${T.gold}` },
  seedItemBadge: {
    width: 36, height: 36, borderRadius: '50%',
    background: T.gold, color: T.bgDeep,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontFamily: "'Oswald', sans-serif", fontSize: 18, fontWeight: 700,
    flexShrink: 0, position: 'relative',
  },
  piTagSmall: {
    position: 'absolute', top: -3, right: -3,
    background: T.bgDeep, color: T.goldBr,
    fontSize: 7, padding: '1px 3px', borderRadius: 2,
    fontFamily: "'Oswald', sans-serif", fontWeight: 700, letterSpacing: 0.5,
  },
  seedItemBody: { flex: 1, minWidth: 0 },
  seedItemName: {
    fontFamily: "'Oswald', sans-serif", fontSize: 13, fontWeight: 600,
    color: T.ivory, textTransform: 'uppercase', letterSpacing: 0.3,
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  },
  seedItemEmpty: { color: 'rgba(245,238,220,0.4)', fontStyle: 'italic' },
  seedItemCurrentLabel: {
    fontFamily: "'Oswald', sans-serif", fontSize: 9, fontWeight: 700, letterSpacing: 1.5,
    color: T.gold,
  },
  seedItemSwap: {
    fontFamily: "'Oswald', sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: 1.5,
    color: T.gold, opacity: 0.7,
  },

  // SCHEDULE
  scheduleView: { padding: '16px 12px 24px', display: 'flex', flexDirection: 'column', gap: 24 },
  schedFinished: {
    padding: '20px 16px', textAlign: 'center',
    background: 'rgba(212,165,75,0.1)', border: `1px solid ${T.gold}`, borderRadius: 8,
    fontFamily: "'Oswald', sans-serif", fontSize: 16, fontWeight: 700, letterSpacing: 2, color: T.goldBr,
  },
  schedUpcoming: { padding: '32px 16px', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center' },
  schedUpcomingTitle: { fontFamily: "'Oswald', sans-serif", fontSize: 18, fontWeight: 700, letterSpacing: 3, color: T.gold },
  schedUpcomingDate: { fontFamily: "'Barlow Condensed', sans-serif", fontSize: 14, color: T.ivoryDim, letterSpacing: 1 },
  schedSection: { display: 'flex', flexDirection: 'column', gap: 10 },
  schedSectionLabel: {
    display: 'flex', alignItems: 'center', gap: 8,
    fontFamily: "'Oswald', sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: 2, color: T.red,
  },
  schedNextTime: { marginLeft: 'auto', fontFamily: "'Oswald', sans-serif", fontSize: 11, color: T.gold, letterSpacing: 0.5 },
  schedMatchRow: { display: 'flex', gap: 8 },
  schedTableCard: {
    flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
    padding: '12px 8px 10px',
    background: T.bgCard, border: `1px solid ${T.rim}`, borderRadius: 8,
    minWidth: 0,
  },
  schedTableNum: { fontFamily: "'Oswald', sans-serif", fontSize: 9, fontWeight: 700, letterSpacing: 2, color: T.gold },
  schedTeamRow: {
    width: '100%', display: 'flex', alignItems: 'center', gap: 6,
    padding: '5px 6px', borderRadius: 4, background: 'rgba(255,255,255,0.03)',
  },
  schedTeamWinner: { background: 'rgba(212,165,75,0.12)', border: `1px solid rgba(212,165,75,0.3)` },
  schedTeamSeed: { fontFamily: "'Oswald', sans-serif", fontSize: 10, fontWeight: 700, color: T.gold, minWidth: 14, textAlign: 'center' },
  schedTeamName: { fontFamily: "'Oswald', sans-serif", fontSize: 11, fontWeight: 600, color: T.ivory, letterSpacing: 0.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 },
  schedVs: { fontFamily: "'Oswald', sans-serif", fontSize: 9, fontWeight: 700, letterSpacing: 1.5, color: 'rgba(245,238,220,0.3)' },
  schedResult: { fontFamily: "'Oswald', sans-serif", fontSize: 10, fontWeight: 700, color: T.goldBr, letterSpacing: 1 },
  schedTbd: { fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, color: 'rgba(245,238,220,0.3)', fontStyle: 'italic', padding: '8px 0' },
  schedStarted: { fontFamily: "'Barlow Condensed', sans-serif", fontSize: 10, color: T.gold, letterSpacing: 0.5 },
  liveDot: { width: 7, height: 7, borderRadius: '50%', background: T.red, flexShrink: 0, animation: 'pulse 1.5s infinite' },

  timeSlot: {
    display: 'flex', minHeight: 140,
    borderBottom: `1px solid ${T.rim}`,
    background: 'rgba(0,0,0,0.15)',
  },
  timeSlotLive: { background: 'rgba(199,72,74,0.08)', boxShadow: `inset 4px 0 0 ${T.red}` },
  timeSlotPast: { opacity: 0.45 },
  slotTime: {
    width: 130, minWidth: 130, padding: '10px 8px',
    background: T.bgCard,
    borderRight: `1px solid ${T.rim}`,
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3,
    flexShrink: 0,
  },
  slotLiveBadge: {
    background: T.red, color: T.ivory,
    fontFamily: "'Oswald', sans-serif", fontSize: 9, fontWeight: 700, letterSpacing: 1.5,
    padding: '2px 6px', borderRadius: 3,
  },
  slotNextBadge: {
    background: T.gold, color: T.bgDeep,
    fontFamily: "'Oswald', sans-serif", fontSize: 9, fontWeight: 700, letterSpacing: 1.5,
    padding: '2px 6px', borderRadius: 3,
  },
  slotTimeMain: {
    fontFamily: "'Oswald', sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: 0.5,
    color: T.gold, textAlign: 'center', lineHeight: 1.3,
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
  },
  slotTimeDuration: { fontFamily: "'Barlow Condensed', sans-serif", fontSize: 10, color: 'rgba(245,238,220,0.5)' },
  slotTimeEditHint: { marginLeft: 4, fontSize: 9, opacity: 0.5, cursor: 'pointer' },
  slotEstBadge: {
    display: 'inline-block', fontSize: 8, fontWeight: 700, letterSpacing: 1,
    color: '#e8a020', background: 'rgba(232,160,32,0.15)', border: '1px solid rgba(232,160,32,0.4)',
    borderRadius: 3, padding: '1px 4px',
  },
  slotTableStarted: {
    fontFamily: "'Barlow Condensed', sans-serif", fontSize: 10, color: T.gold,
    letterSpacing: 0.5, marginTop: 'auto', paddingTop: 6, textAlign: 'center',
  },
  slotStartBtn: {
    marginTop: 'auto', width: '90%', padding: '5px 0',
    background: 'rgba(212,165,75,0.2)', border: `1px solid ${T.gold}`, borderRadius: 4,
    color: T.gold, fontFamily: "'Oswald', sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: 1.5,
    cursor: 'pointer',
  },
  slotTimeInput: {
    fontFamily: "'Oswald', sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: 0.5,
    color: T.gold, background: 'rgba(212,165,75,0.12)', border: `1px solid ${T.gold}`,
    borderRadius: 4, padding: '2px 4px', width: 108, textAlign: 'center', outline: 'none',
  },
  slotMatches: { flex: 1, display: 'flex', background: T.bgCard },
  slotMatch: { flex: 1, padding: 10, display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center', justifyContent: 'flex-start', paddingTop: 12 },
  slotMatchEmpty: { background: 'rgba(255,255,255,0.03)' },
  tableLabel: { fontFamily: "'Oswald', sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: 1.5, color: T.gold },
  matchEmpty: { fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, color: 'rgba(245,238,220,0.5)', fontStyle: 'italic' },
  matchTeam: { display: 'flex', gap: 6, alignItems: 'center', width: '100%' },
  matchTeamWinner: { color: T.goldBr },
  matchTeamSeed: {
    fontFamily: "'Oswald', sans-serif", fontSize: 11, fontWeight: 700, color: T.gold,
    minWidth: 22, textAlign: 'center',
  },
  matchTeamNames: { display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0, flex: 1, overflow: 'hidden' },
  matchTeamNameBold: { fontFamily: "'Oswald', sans-serif", fontSize: 13, fontWeight: 700, color: T.ivory, letterSpacing: 0.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  playerSmall: {
    fontFamily: "'Oswald', sans-serif", fontSize: 10, fontWeight: 600, color: T.ivory,
    letterSpacing: 0.3, textTransform: 'uppercase',
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  },
  scheduleVs: { fontFamily: "'Oswald', sans-serif", fontSize: 9, fontWeight: 600, color: 'rgba(245,238,220,0.5)', letterSpacing: 1.5 },
  matchScoreSmall: { fontFamily: "'Oswald', sans-serif", fontSize: 9, color: T.goldBr, marginTop: 4, letterSpacing: 0.5 },
  matchIncomplete: { fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, color: 'rgba(245,238,220,0.5)', fontStyle: 'italic' },

  scheduleFooter: {
    marginTop: 16, padding: 12,
    background: 'rgba(212,165,75,0.08)', border: `1px solid ${T.gold}`, borderRadius: 6,
  },
  scheduleNote: { fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12, color: T.ivory, lineHeight: 1.5, marginBottom: 6 },

  // PLAYERS
  playersView: { padding: '0 0 16px', display: 'flex', flexDirection: 'column' },

  // Sub-tabs
  subTabBar: { display: 'flex', borderBottom: `1px solid ${T.rim}`, marginBottom: 12, gap: 0 },
  subTab: {
    flex: 1, padding: '10px 4px', background: 'transparent', border: 'none', borderBottom: '2px solid transparent',
    color: 'rgba(245,238,220,0.5)', fontFamily: "'Oswald', sans-serif", fontSize: 12, fontWeight: 700,
    letterSpacing: 2, cursor: 'pointer', transition: 'color 0.15s',
  },
  subTabActive: {
    flex: 1, padding: '10px 4px', background: 'transparent', border: 'none', borderBottom: `2px solid ${T.gold}`,
    color: T.gold, fontFamily: "'Oswald', sans-serif", fontSize: 12, fontWeight: 700,
    letterSpacing: 2, cursor: 'pointer',
  },

  // Teams grid
  teamsGrid: { display: 'flex', gap: 10, padding: '0 12px' },
  teamsSide: { flex: 1, display: 'flex', flexDirection: 'column', gap: 6 },
  teamsSideLabel: { fontFamily: "'Oswald', sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: 3, color: T.gold, opacity: 0.7, marginBottom: 4, textAlign: 'center' },
  teamCard: {
    display: 'flex', alignItems: 'stretch', gap: 0,
    background: T.bgCard, border: `1px solid ${T.rim}`, borderRadius: 6, overflow: 'hidden',
  },
  teamCardSeed: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    padding: '6px 10px', background: T.bgSoft, borderRight: `1px solid ${T.rim}`, minWidth: 36,
  },
  teamSeedNum: { fontFamily: "'Oswald', sans-serif", fontSize: 18, fontWeight: 700, color: T.gold, lineHeight: 1 },
  teamPiTag: { fontFamily: "'Oswald', sans-serif", fontSize: 8, fontWeight: 700, letterSpacing: 1, color: T.goldBr, marginTop: 2 },
  teamCardSlots: { flex: 1, display: 'flex', flexDirection: 'column' },
  teamSlot: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '6px 10px', borderBottom: `1px solid ${T.rim}`, gap: 6, minHeight: 32,
  },
  teamSlotEmpty: { background: 'rgba(255,255,255,0.02)' },
  teamSlotName: { fontFamily: "'Oswald', sans-serif", fontSize: 13, fontWeight: 600, color: T.ivory, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  teamSlotPlaceholder: { fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, color: 'rgba(245,238,220,0.3)', fontStyle: 'italic', flex: 1 },
  teamSlotEdit: { fontSize: 11, color: T.gold, opacity: 0.5, flexShrink: 0 },
  teamNameSlot: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '5px 10px', borderBottom: `1px solid ${T.gold}`, gap: 6, minHeight: 28,
    background: 'rgba(212,165,75,0.06)',
  },
  teamNameSlotEditing: { padding: '3px 6px', borderBottom: `1px solid ${T.gold}`, background: 'rgba(212,165,75,0.1)' },
  teamNameText: { fontFamily: "'Oswald', sans-serif", fontSize: 13, fontWeight: 700, color: T.gold, letterSpacing: 0.5, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  teamNamePlaceholder: { fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, color: 'rgba(212,165,75,0.4)', fontStyle: 'italic', flex: 1 },
  teamNameInput: {
    width: '100%', background: 'transparent', border: 'none', outline: 'none',
    fontFamily: "'Oswald', sans-serif", fontSize: 13, fontWeight: 700, color: T.gold,
    letterSpacing: 0.5, textTransform: 'uppercase', padding: '2px 0',
  },

  // Alternates
  altView: { padding: '0 12px', display: 'flex', flexDirection: 'column', gap: 10 },
  altInfo: { fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12, color: 'rgba(245,238,220,0.5)', lineHeight: 1.5, padding: '8px 0' },
  altAddRow: { display: 'flex', gap: 8 },
  altInput: {
    flex: 1, background: T.bgCard, border: `1px solid ${T.rim}`, borderRadius: 6,
    color: T.ivory, fontFamily: "'Oswald', sans-serif", fontSize: 14, fontWeight: 600,
    padding: '10px 12px', textTransform: 'uppercase', outline: 'none',
  },
  altAddBtn: {
    background: 'rgba(212,165,75,0.18)', color: T.gold, border: `1px solid ${T.gold}`,
    fontFamily: "'Oswald', sans-serif", fontSize: 12, fontWeight: 700, letterSpacing: 1,
    padding: '0 14px', borderRadius: 6, cursor: 'pointer',
  },
  altEmpty: { fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13, color: 'rgba(245,238,220,0.35)', textAlign: 'center', padding: '24px 0', fontStyle: 'italic' },
  altRow: {
    display: 'flex', alignItems: 'center', gap: 10, padding: '12px',
    background: T.bgCard, border: `1px solid ${T.rim}`, borderRadius: 6,
  },
  altName: { flex: 1, fontFamily: "'Oswald', sans-serif", fontSize: 15, fontWeight: 600, color: T.ivory, textTransform: 'uppercase' },
  altActions: { display: 'flex', gap: 6 },
  altAssignBtn: {
    background: 'rgba(212,165,75,0.15)', color: T.gold, border: `1px solid ${T.gold}`,
    fontFamily: "'Oswald', sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: 1,
    padding: '6px 12px', borderRadius: 5, cursor: 'pointer',
  },
  altRemoveBtn: {
    background: 'rgba(200,50,50,0.1)', color: T.red, border: `1px solid rgba(200,50,50,0.3)`,
    fontFamily: "'Oswald', sans-serif", fontSize: 13, fontWeight: 700,
    padding: '6px 10px', borderRadius: 5, cursor: 'pointer',
  },
  altAssignPanel: {
    background: T.bgCard, border: `1px solid ${T.gold}`, borderRadius: 8,
    padding: 14, display: 'flex', flexDirection: 'column', gap: 10,
  },
  altAssignTitle: { fontFamily: "'Oswald', sans-serif", fontSize: 13, color: T.ivory, letterSpacing: 0.5 },
  altAssignList: { display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 300, overflowY: 'auto' },
  altAssignTeam: { display: 'flex', alignItems: 'center', gap: 10 },
  altAssignSeed: { fontFamily: "'Oswald', sans-serif", fontSize: 13, fontWeight: 700, color: T.gold, minWidth: 32 },
  altAssignSlots: { flex: 1, display: 'flex', gap: 6 },
  altAssignSlotBtn: {
    flex: 1, fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12, fontWeight: 600,
    padding: '6px 8px', borderRadius: 5, cursor: 'pointer', textAlign: 'left',
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  },
  altAssignSlotEmpty: { background: 'rgba(212,165,75,0.12)', color: T.gold, border: `1px solid ${T.gold}` },
  altAssignSlotReplace: { background: 'rgba(200,50,50,0.1)', color: '#e07070', border: `1px solid rgba(200,50,50,0.3)` },
  altCancelBtn: {
    alignSelf: 'flex-start', background: 'transparent', color: 'rgba(245,238,220,0.5)',
    border: `1px solid ${T.rim}`, fontFamily: "'Oswald', sans-serif", fontSize: 11, fontWeight: 700,
    letterSpacing: 1, padding: '6px 14px', borderRadius: 5, cursor: 'pointer',
  },
  sectionHeader: { padding: '4px 4px 12px' },
  sectionTitle: { fontFamily: "'Oswald', sans-serif", fontSize: 14, fontWeight: 700, letterSpacing: 3, color: T.gold },
  sectionSub: { fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12, color: 'rgba(245,238,220,0.5)', marginTop: 2 },
  playerList: { display: 'flex', flexDirection: 'column', gap: 5 },
  playerRow: {
    display: 'flex', alignItems: 'center', gap: 10, padding: '12px',
    background: T.bgCard, border: `1px solid ${T.rim}`, borderRadius: 4, minHeight: 44,
  },
  playerRowEditing: {
    display: 'flex', alignItems: 'center', gap: 10, padding: '12px',
    background: 'rgba(212,165,75,0.12)', border: `1px solid ${T.gold}`, borderRadius: 4,
    boxShadow: '0 0 0 3px rgba(212,165,75,0.18)', minHeight: 44,
  },
  playerNum: { width: 26, color: T.gold, fontFamily: "'Oswald', sans-serif", fontSize: 14, fontWeight: 700, flexShrink: 0 },
  playerName: {
    flex: 1, fontFamily: "'Oswald', sans-serif", fontSize: 15, fontWeight: 600, letterSpacing: 0.5,
    color: T.ivory, textTransform: 'uppercase',
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'pointer',
  },
  playerInput: {
    flex: 1, background: 'transparent', border: 'none', color: T.ivory,
    fontFamily: "'Oswald', sans-serif", fontSize: 15, fontWeight: 600, letterSpacing: 0.5,
    textTransform: 'uppercase', padding: 0, outline: 'none', minWidth: 0,
  },
  playerTeamBadge: {
    background: 'rgba(212,165,75,0.16)', color: T.gold, border: `1px solid ${T.gold}`,
    fontFamily: "'Oswald', sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: 1.5,
    padding: '4px 8px', borderRadius: 3, flexShrink: 0, cursor: 'pointer',
  },
  playerAvailableBadge: {
    background: 'rgba(255,255,255,0.04)', color: 'rgba(245,238,220,0.5)', border: `1px solid ${T.rim}`,
    fontFamily: "'Oswald', sans-serif", fontSize: 10, fontWeight: 600, letterSpacing: 1.5,
    padding: '4px 8px', borderRadius: 3, flexShrink: 0, cursor: 'pointer',
  },
  playerScheduleBtn: {
    width: 32, height: 32, background: 'rgba(212,165,75,0.08)',
    border: `1px solid ${T.rim}`, borderRadius: 4, cursor: 'pointer',
    fontSize: 14, color: T.gold, padding: 0,
  },

  // SHEETS
  sheetBackdrop: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 200,
    display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
    animation: 'fadeIn 200ms ease',
  },
  sheet: {
    background: T.bgMid,
    borderTopLeftRadius: 18, borderTopRightRadius: 18,
    width: '100%', maxWidth: '480px', maxHeight: '85vh',
    display: 'flex', flexDirection: 'column',
    paddingBottom: 'env(safe-area-inset-bottom, 0px)',
    animation: 'slideUp 280ms cubic-bezier(0.2, 0.9, 0.3, 1)',
    boxShadow: '0 -10px 40px rgba(0,0,0,0.5)',
    border: `1px solid ${T.rim}`, borderBottom: 'none',
  },
  sheetHandleWrap: { display: 'flex', justifyContent: 'center', padding: '10px 0 4px', cursor: 'pointer' },
  sheetHandle: { width: 44, height: 4, background: 'rgba(245,238,220,0.32)', borderRadius: 2 },
  sheetHeader: {
    display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
    padding: '4px 16px 12px', borderBottom: `1px solid ${T.rim}`,
  },
  sheetTitle: { fontFamily: "'Oswald', sans-serif", fontSize: 16, fontWeight: 700, letterSpacing: 2.5, color: T.ivory },
  sheetSub: { fontFamily: "'Oswald', sans-serif", fontSize: 11, fontWeight: 600, letterSpacing: 2, color: T.gold, marginTop: 4 },
  sheetClose: {
    width: 32, height: 32,
    background: 'rgba(212,165,75,0.08)', border: `1px solid ${T.rim}`, color: T.ivory,
    borderRadius: '50%', fontSize: 22, cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: 0, flexShrink: 0, lineHeight: 1,
  },
  searchWrap: { padding: '12px 16px 8px' },
  searchInput: {
    width: '100%', padding: '10px 14px',
    background: 'rgba(0,0,0,0.3)', border: `1px solid ${T.rim}`, borderRadius: 6,
    color: T.ivory, fontFamily: "'Barlow Condensed', sans-serif", fontSize: 14, outline: 'none',
  },
  pickerList: { overflowY: 'auto', paddingBottom: 16, flex: 1 },
  pickerItem: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '12px 16px', borderBottom: `1px solid ${T.rim}`,
    cursor: 'pointer', minHeight: 56, gap: 10,
  },
  pickerItemCurrent: { background: 'rgba(212,165,75,0.10)' },
  pickerLeft: { flex: 1, minWidth: 0 },
  pickerName: {
    fontFamily: "'Oswald', sans-serif", fontSize: 16, fontWeight: 600, letterSpacing: 0.5,
    color: T.ivory, textTransform: 'uppercase',
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  },
  pickerStatus: {
    fontFamily: "'Oswald', sans-serif", fontSize: 10, fontWeight: 600, letterSpacing: 1.2,
    color: T.gold, marginTop: 2,
  },
  pickerAdd: {
    width: 30, height: 30, borderRadius: '50%',
    border: `1.5px solid ${T.gold}`, color: T.gold,
    fontSize: 18, fontWeight: 700,
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, lineHeight: 1,
  },
  pickerHere: {
    background: T.gold, color: T.bgDeep,
    fontFamily: "'Oswald', sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: 1.5,
    padding: '4px 10px', borderRadius: 3, flexShrink: 0,
  },
  pickerDivider: {
    padding: '8px 16px', fontFamily: "'Oswald', sans-serif", fontSize: 10, fontWeight: 700,
    letterSpacing: 2, color: T.gold, background: 'rgba(212,165,75,0.08)',
    borderBottom: `1px solid ${T.rim}`, borderTop: `1px solid ${T.rim}`,
  },

  // SCORE EDITOR
  modalBackdrop: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 300,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: 16, animation: 'fadeIn 200ms ease',
  },
  scoreModal: {
    background: T.bgMid, border: `1px solid ${T.rim}`, borderRadius: 12,
    width: '100%', maxWidth: 440, maxHeight: '90vh', overflowY: 'auto',
    animation: 'scaleIn 250ms cubic-bezier(0.2, 0.9, 0.3, 1)',
  },
  scoreHeader: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '16px 20px', borderBottom: `1px solid ${T.rim}`,
  },
  scoreFormat: {
    fontFamily: "'Oswald', sans-serif", fontSize: 10, fontWeight: 600, letterSpacing: 2,
    color: 'rgba(245,238,220,0.7)', marginTop: 2,
  },
  scoreBody: { padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 16 },
  gameLabel: {
    fontFamily: "'Oswald', sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: 2,
    color: T.gold, textAlign: 'center', marginBottom: 8,
  },
  scoreGameInputs: { display: 'flex', gap: 10 },
  scoreTeamCol: {
    flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
    padding: '14px 10px 10px',
    background: 'rgba(255,255,255,0.03)', border: `1px solid ${T.rim}`, borderRadius: 8,
    transition: 'border-color 0.15s, background 0.15s',
  },
  scoreTeamColWin: {
    background: 'rgba(212,165,75,0.08)', border: `1px solid ${T.gold}`,
  },
  scoreTeamSeed: {
    fontFamily: "'Oswald', sans-serif", fontSize: 12, fontWeight: 700, color: T.goldBr,
    background: 'rgba(212,165,75,0.18)', borderRadius: 4, padding: '2px 8px', letterSpacing: 1,
  },
  scoreTeamPlayers: {
    fontFamily: "'Oswald', sans-serif", fontSize: 12, color: T.ivory,
    lineHeight: 1.4, textAlign: 'center', letterSpacing: 0.3,
  },
  scoreInput: {
    width: '100%', padding: '12px 0',
    background: 'rgba(0,0,0,0.3)', border: `1px solid rgba(212,165,75,0.2)`, borderRadius: 6,
    color: T.ivory,
    fontFamily: "'Oswald', sans-serif", fontSize: 36, fontWeight: 700, textAlign: 'center', outline: 'none',
  },
  scoreInputWin: {
    color: T.goldBr, border: `1px solid rgba(212,165,75,0.5)`,
  },
  scoreWinTag: {
    fontFamily: "'Oswald', sans-serif", fontSize: 9, fontWeight: 700, letterSpacing: 2,
    color: T.bgDeep, background: T.gold, borderRadius: 3, padding: '2px 10px',
  },
  scoreActions: { display: 'flex', flexDirection: 'column', gap: 8, padding: '16px 20px', borderTop: `1px solid ${T.rim}` },
  scoreSaveBtn: {
    background: T.gold, color: T.bgDeep, border: 'none',
    borderRadius: 6, padding: '12px 14px', cursor: 'pointer',
    fontFamily: "'Oswald', sans-serif", fontSize: 12, fontWeight: 700, letterSpacing: 1.5,
  },

  // MODAL
  modal: {
    background: T.bgMid, border: `1px solid ${T.rim}`, borderRadius: 10,
    padding: 20, width: '100%', maxWidth: 360,
    display: 'flex', flexDirection: 'column', gap: 8,
    animation: 'scaleIn 250ms cubic-bezier(0.2, 0.9, 0.3, 1)',
  },
  modalTitle: { fontFamily: "'Oswald', sans-serif", fontSize: 16, fontWeight: 700, letterSpacing: 2.5, color: T.gold },
  modalDesc: { fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13, color: 'rgba(245,238,220,0.5)', marginBottom: 6 },
  modalOption: {
    background: 'rgba(212,165,75,0.04)', border: `1px solid ${T.rim}`, borderRadius: 6,
    padding: '12px 14px', cursor: 'pointer', textAlign: 'left',
    color: T.ivory, fontFamily: 'inherit',
  },
  modalOptionDanger: {
    background: 'rgba(199,72,74,0.08)', border: `1px solid rgba(199,72,74,0.4)`, borderRadius: 6,
    padding: '12px 14px', cursor: 'pointer', textAlign: 'left',
    color: T.ivory, fontFamily: 'inherit',
  },
  modalOptionTitle: { fontFamily: "'Oswald', sans-serif", fontSize: 13, fontWeight: 700, letterSpacing: 1.5, marginBottom: 3, color: T.ivory },
  modalOptionDesc: { fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12, color: 'rgba(245,238,220,0.5)' },
  modalCancel: {
    background: 'transparent', border: `1px solid ${T.rim}`, color: 'rgba(245,238,220,0.5)',
    borderRadius: 6, padding: '10px 14px', cursor: 'pointer',
    fontFamily: "'Oswald', sans-serif", fontSize: 11, fontWeight: 600, letterSpacing: 2, marginTop: 4,
  },

  // SHARE
  shareModal: {
    background: T.bgMid, border: `1px solid ${T.rim}`, borderRadius: 12,
    width: '100%', maxWidth: 400, maxHeight: '90vh', overflowY: 'auto',
    padding: 16, animation: 'scaleIn 250ms cubic-bezier(0.2, 0.9, 0.3, 1)',
  },
  shareCard: {
    background: `linear-gradient(180deg, ${T.bgMid} 0%, ${T.bg} 100%)`,
    border: `2px solid ${T.gold}`, borderRadius: 8,
    padding: '24px 20px', textAlign: 'center',
    boxShadow: `0 0 30px rgba(212,165,75,0.3)`,
  },
  shareCardStars: { display: 'flex', justifyContent: 'center', gap: 6, marginBottom: 8 },
  shareBrandTitle: {
    fontFamily: "'Oswald', sans-serif", fontSize: 22, fontWeight: 700, letterSpacing: 4,
    color: T.ivory, lineHeight: 1,
  },
  shareBrandSub: {
    fontFamily: "'Oswald', sans-serif", fontSize: 9, fontWeight: 500, letterSpacing: 3,
    color: T.gold, marginTop: 4, marginBottom: 16,
  },
  shareUpsetBadge: {
    background: T.red, color: T.ivory,
    fontFamily: "'Oswald', sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: 2,
    padding: '4px 10px', borderRadius: 3, display: 'inline-block', marginBottom: 8,
  },
  shareForfeitBadge: {
    background: 'rgba(199,72,74,0.2)', color: T.red, border: `1px solid ${T.red}`,
    fontFamily: "'Oswald', sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: 2,
    padding: '4px 10px', borderRadius: 3, display: 'inline-block', marginBottom: 8,
  },
  shareMatchLabel: {
    fontFamily: "'Oswald', sans-serif", fontSize: 11, fontWeight: 600, letterSpacing: 2,
    color: T.gold, marginBottom: 12,
  },
  shareWinnerBlock: { padding: 12, background: 'rgba(212,165,75,0.1)', borderRadius: 6, marginBottom: 8 },
  shareWinnerLabel: { fontFamily: "'Oswald', sans-serif", fontSize: 9, fontWeight: 700, letterSpacing: 2, color: T.gold, marginBottom: 4 },
  shareWinnerNames: {
    fontFamily: "'Oswald', sans-serif", fontSize: 18, fontWeight: 700, color: T.ivory,
    display: 'flex', justifyContent: 'center', gap: 6, alignItems: 'center', flexWrap: 'wrap',
  },
  shareSlash: { color: T.gold, opacity: 0.6 },
  shareSeed: { fontFamily: "'Oswald', sans-serif", fontSize: 10, color: T.gold, marginTop: 4, letterSpacing: 1.5 },
  shareDefeated: { fontFamily: "'Oswald', sans-serif", fontSize: 9, fontWeight: 600, letterSpacing: 2, color: 'rgba(245,238,220,0.5)', marginBottom: 4 },
  shareLoserBlock: { padding: 8, opacity: 0.7 },
  shareLoserNames: { fontFamily: "'Oswald', sans-serif", fontSize: 14, color: T.ivory },
  shareLoserSeed: { fontFamily: "'Oswald', sans-serif", fontSize: 9, color: T.gold, marginTop: 2, letterSpacing: 1 },
  shareScore: {
    fontFamily: "'Oswald', sans-serif", fontSize: 16, fontWeight: 700,
    color: T.goldBr, padding: 10, marginTop: 12,
    background: 'rgba(0,0,0,0.3)', borderRadius: 4, letterSpacing: 1,
  },
  shareFooter: {
    fontFamily: "'Oswald', sans-serif", fontSize: 9, fontWeight: 600, letterSpacing: 2,
    color: T.gold, marginTop: 16, opacity: 0.7,
  },
  shareActions: { display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 },
  shareBtn: {
    background: T.gold, color: T.bgDeep, border: 'none',
    borderRadius: 6, padding: '12px', cursor: 'pointer',
    fontFamily: "'Oswald', sans-serif", fontSize: 12, fontWeight: 700, letterSpacing: 1.5,
  },
  shareBtnAlt: {
    background: 'rgba(212,165,75,0.12)', color: T.gold, border: `1px solid ${T.gold}`,
    borderRadius: 6, padding: '10px', cursor: 'pointer',
    fontFamily: "'Oswald', sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: 1.5,
  },
  shareHint: {
    fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11,
    color: 'rgba(245,238,220,0.5)', textAlign: 'center', marginTop: 8,
  },

  // PLAYER SCHEDULE
  psList: { padding: 12, overflowY: 'auto', flex: 1 },
  psEmpty: { padding: 30, textAlign: 'center', color: 'rgba(245,238,220,0.5)' },
  psRow: {
    display: 'flex', alignItems: 'center', gap: 12,
    padding: 12, marginBottom: 6,
    background: 'rgba(212,165,75,0.04)', border: `1px solid ${T.rim}`, borderRadius: 6,
  },
  psWin: { background: 'rgba(212,165,75,0.14)', borderColor: T.gold },
  psLose: { opacity: 0.5 },
  psTime: { textAlign: 'center', minWidth: 70 },
  psTimeText: { fontFamily: "'Oswald', sans-serif", fontSize: 12, fontWeight: 700, color: T.goldBr, letterSpacing: 0.5 },
  psTableText: { fontFamily: "'Barlow Condensed', sans-serif", fontSize: 10, color: 'rgba(245,238,220,0.5)' },
  psMain: { flex: 1, minWidth: 0 },
  psMatchLabel: { fontFamily: "'Oswald', sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: 1.5, color: T.gold, marginBottom: 2 },
  psOpponent: { fontFamily: "'Oswald', sans-serif", fontSize: 13, color: T.ivory, lineHeight: 1.3 },
  psScore: { fontFamily: "'Oswald', sans-serif", fontSize: 11, color: T.goldBr, marginTop: 4, letterSpacing: 0.5 },
  psWinBadge: { fontFamily: "'Oswald', sans-serif", fontSize: 10, fontWeight: 700, color: T.bgDeep, background: T.gold, padding: '4px 8px', borderRadius: 3, letterSpacing: 1.5 },
  psLoseBadge: { fontFamily: "'Oswald', sans-serif", fontSize: 10, fontWeight: 700, color: T.red, background: 'rgba(199,72,74,0.2)', border: `1px solid ${T.red}`, padding: '4px 8px', borderRadius: 3, letterSpacing: 1.5 },
  psPendingBadge: { fontFamily: "'Oswald', sans-serif", fontSize: 9, fontWeight: 600, color: 'rgba(245,238,220,0.6)', background: 'rgba(212,165,75,0.08)', border: `1px solid ${T.rim}`, padding: '4px 6px', borderRadius: 3, letterSpacing: 1 },

  // STATS
  statsView: { padding: '12px 12px 16px' },

  statsPulse: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 18 },
  statsPulseTile: {
    padding: '12px 10px 10px', textAlign: 'center',
    background: 'rgba(212,165,75,0.05)', border: `1px solid ${T.rim}`, borderRadius: 8,
  },
  statsPulseVal: { fontFamily: "'Oswald', sans-serif", fontSize: 28, fontWeight: 700, color: T.ivory, lineHeight: 1 },
  statsPulseDenom: { fontSize: 14, fontWeight: 400, opacity: 0.5 },
  statsPulseLabel: { fontFamily: "'Oswald', sans-serif", fontSize: 8, fontWeight: 700, letterSpacing: 2, color: T.gold, marginTop: 5 },
  statsPulseSub: { fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, color: T.ivoryDim, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },

  statsSection: { marginBottom: 18 },
  statsSectionTitle: { fontFamily: "'Oswald', sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: 2.5, color: T.gold, marginBottom: 8 },
  statsEmpty: { padding: 14, textAlign: 'center', color: 'rgba(245,238,220,0.5)', fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12, background: 'rgba(212,165,75,0.04)', border: `1px solid ${T.rim}`, borderRadius: 6 },

  hotGrid: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 },
  hotCard: {
    padding: '12px 14px',
    background: 'rgba(212,165,75,0.05)', border: `1px solid ${T.rim}`, borderRadius: 8,
  },
  hotLabel: { fontFamily: "'Oswald', sans-serif", fontSize: 8, fontWeight: 700, letterSpacing: 2, color: T.gold, marginBottom: 6, opacity: 0.8 },
  hotWin: { fontFamily: "'Oswald', sans-serif", fontSize: 13, color: T.ivory, fontWeight: 600 },
  hotVerb: { fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, color: 'rgba(245,238,220,0.5)', fontStyle: 'italic', marginBottom: 4 },
  hotLose: { fontFamily: "'Oswald', sans-serif", fontSize: 12, color: 'rgba(245,238,220,0.6)' },
  hotSeed: { fontFamily: "'Oswald', sans-serif", fontSize: 9, fontWeight: 700, letterSpacing: 1, color: T.gold, marginLeft: 6, padding: '2px 6px', background: 'rgba(212,165,75,0.18)', borderRadius: 2 },
  hotMeta: { fontFamily: "'Barlow Condensed', sans-serif", fontSize: 10, color: 'rgba(245,238,220,0.4)', marginTop: 5 },
  hotScore: { fontFamily: "'Oswald', sans-serif", fontSize: 12, color: T.goldBr, marginTop: 4, fontWeight: 700 },

  undefeatedGrid: { display: 'flex', flexDirection: 'column', gap: 6 },
  undefeatedCard: {
    display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
    background: 'rgba(212,165,75,0.1)', border: `1px solid rgba(212,165,75,0.4)`, borderRadius: 7,
  },
  undefeatedSeed: { fontFamily: "'Oswald', sans-serif", fontSize: 11, fontWeight: 700, color: T.bgDeep, background: T.gold, padding: '2px 8px', borderRadius: 3, flexShrink: 0 },
  undefeatedNames: { fontFamily: "'Oswald', sans-serif", fontSize: 13, color: T.ivory, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  undefeatedWins: { fontFamily: "'Oswald', sans-serif", fontSize: 14, fontWeight: 700, color: T.gold, flexShrink: 0 },

  lbRow: {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '10px 12px', marginBottom: 4,
    background: 'rgba(212,165,75,0.04)', border: `1px solid ${T.rim}`, borderRadius: 4,
  },
  lbRank: { width: 26, color: T.gold, fontFamily: "'Oswald', sans-serif", fontSize: 14, fontWeight: 700 },
  lbName: { flex: 1, fontFamily: "'Oswald', sans-serif", fontSize: 13, color: T.ivory, letterSpacing: 0.5 },
  lbTeam: { flex: 1, display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 },
  lbTeamSeed: { fontFamily: "'Oswald', sans-serif", fontSize: 11, fontWeight: 700, color: T.gold, background: 'rgba(212,165,75,0.18)', padding: '2px 6px', borderRadius: 3, flexShrink: 0 },
  lbTeamNames: { fontFamily: "'Oswald', sans-serif", fontSize: 12, color: T.ivory, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  lbRecord: { fontFamily: "'Oswald', sans-serif", fontSize: 11, fontWeight: 700, color: T.goldBr, textAlign: 'right' },
  lbDiff: { fontFamily: "'Oswald', sans-serif", fontSize: 10, color: 'rgba(245,238,220,0.5)', marginTop: 2 },

  // CHAMPION
  champBadge: {
    position: 'fixed',
    bottom: 'calc(16px + env(safe-area-inset-bottom, 0px))', left: '50%',
    transform: 'translateX(-50%)',
    background: `linear-gradient(135deg, ${T.gold}, ${T.goldBr})`,
    padding: '12px 18px', borderRadius: 10,
    boxShadow: '0 8px 28px rgba(212,165,75,0.5)',
    display: 'flex', alignItems: 'center', gap: 12, zIndex: 50,
    width: 'calc(100% - 32px)', maxWidth: 440,
    animation: 'slideUp 400ms cubic-bezier(0.2, 0.9, 0.3, 1)',
  },
  champEmoji: { fontSize: 28, flexShrink: 0 },
  champLabel: { fontFamily: "'Oswald', sans-serif", fontSize: 9, fontWeight: 700, letterSpacing: 2.5, color: T.bgDeep, opacity: 0.7, marginBottom: 2 },
  champNames: {
    fontFamily: "'Oswald', sans-serif", fontSize: 14, fontWeight: 700, letterSpacing: 0.5,
    color: T.bgDeep, textTransform: 'uppercase',
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  },

  // TOAST
  toast: {
    position: 'fixed', top: 'calc(80px + env(safe-area-inset-top, 0px))',
    left: '50%', transform: 'translateX(-50%)',
    background: 'rgba(4,18,14,0.92)', color: T.ivory,
    padding: '8px 16px', borderRadius: 20,
    fontFamily: "'Oswald', sans-serif", fontSize: 12, fontWeight: 600, letterSpacing: 1.5,
    border: `1px solid ${T.gold}`, zIndex: 400,
    animation: 'slideDown 250ms cubic-bezier(0.2, 0.9, 0.3, 1)',
  },

  // TV MODE
  tvShell: {
    height: '100vh', width: '100vw', overflow: 'hidden',
    background: `radial-gradient(ellipse at top, ${T.bgMid}, ${T.bgDeep})`,
    color: T.ivory,
    fontFamily: "'Barlow Condensed', sans-serif",
    padding: '12px 16px',
    boxSizing: 'border-box',
    display: 'flex', flexDirection: 'column', gap: 10,
  },
  tvBrandBar: {
    display: 'flex', alignItems: 'center', gap: 20,
    padding: '10px 20px', flexShrink: 0,
    background: 'rgba(0,0,0,0.5)', border: `1px solid ${T.gold}`, borderRadius: 10,
  },
  tvBrandLeft: { display: 'flex', alignItems: 'center', gap: 14, flex: 1 },
  tvStarRow: { display: 'flex', gap: 5 },
  tvBrandTitle: { fontFamily: "'Oswald', sans-serif", fontSize: 34, fontWeight: 700, letterSpacing: 5, color: T.ivory, lineHeight: 1 },
  tvBrandSub: { fontFamily: "'Oswald', sans-serif", fontSize: 13, fontWeight: 600, letterSpacing: 3, color: T.gold, marginTop: 4 },
  tvTopCountdown: { display: 'flex', alignItems: 'center', gap: 10, padding: '6px 16px', background: 'rgba(200,50,50,0.15)', border: `1px solid ${T.red}`, borderRadius: 8 },
  tvTopCountdownText: { fontFamily: "'Oswald', sans-serif", fontSize: 28, fontWeight: 700, color: T.red, letterSpacing: 2 },
  tvClock: { fontFamily: "'Oswald', sans-serif", fontSize: 38, fontWeight: 700, color: T.goldBr, letterSpacing: 2 },
  tvExitBtn: {
    background: 'rgba(212,165,75,0.12)', color: T.gold, border: `1px solid ${T.gold}`,
    padding: '8px 14px', borderRadius: 6, cursor: 'pointer',
    fontFamily: "'Oswald', sans-serif", fontSize: 12, fontWeight: 700, letterSpacing: 2,
    flexShrink: 0,
  },
  tvChampionTakeover: {
    flex: 1, display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center', gap: 16,
    background: `radial-gradient(ellipse at center, rgba(212,165,75,0.3), transparent 70%)`,
  },
  tvChampStars: { display: 'flex', gap: 10, marginBottom: 8 },
  tvChampLabel: { fontFamily: "'Oswald', sans-serif", fontSize: 22, fontWeight: 600, letterSpacing: 8, color: T.gold },
  tvChampNames: { fontFamily: "'Oswald', sans-serif", fontSize: 96, fontWeight: 700, color: T.ivory, textAlign: 'center', lineHeight: 1.05, letterSpacing: 2 },
  tvChampSeed: { fontFamily: "'Oswald', sans-serif", fontSize: 20, fontWeight: 600, letterSpacing: 5, color: T.goldBr, marginTop: 8 },
  tvChampSubline: { fontFamily: "'Oswald', sans-serif", fontSize: 14, fontWeight: 500, letterSpacing: 4, color: 'rgba(212,165,75,0.5)', marginTop: 4 },
  tvLiveDot: { width: 14, height: 14, borderRadius: '50%', background: T.red, animation: 'pulse 1.5s infinite', flexShrink: 0 },
  tvLiveBar: {
    flexShrink: 0,
    background: 'rgba(0,0,0,0.55)', border: `1px solid ${T.red}`, borderRadius: 10,
    padding: '10px 14px',
  },
  tvLiveBarHeader: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 },
  tvLiveBarLabel: { fontFamily: "'Oswald', sans-serif", fontSize: 16, fontWeight: 700, letterSpacing: 4, color: T.red },
  tvLiveBarTime: { fontFamily: "'Oswald', sans-serif", fontSize: 16, fontWeight: 600, color: T.ivory, letterSpacing: 1, opacity: 0.8 },
  tvLiveCardsRow: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 },
  tvLiveCard: {
    background: T.bgCard, border: `1px solid ${T.gold}`, borderRadius: 10,
    padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8,
  },
  tvLiveCardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${T.rim}`, paddingBottom: 8, marginBottom: 2 },
  tvLiveCardTable: { fontFamily: "'Oswald', sans-serif", fontSize: 20, fontWeight: 700, letterSpacing: 2, color: T.goldBr },
  tvLiveCardLabel: { fontFamily: "'Oswald', sans-serif", fontSize: 11, fontWeight: 600, letterSpacing: 1.5, color: T.gold, opacity: 0.8 },
  tvLiveCardEmpty: { fontFamily: "'Oswald', sans-serif", fontSize: 18, color: 'rgba(245,238,220,0.3)', textAlign: 'center', padding: '12px 0' },
  tvLiveCardBody: { display: 'flex', flexDirection: 'column', gap: 4 },
  tvLiveTeam: { display: 'flex', alignItems: 'center', gap: 12, padding: '4px 0' },
  tvLiveTeamWin: { opacity: 1 },
  tvLiveTeamLose: { opacity: 0.4 },
  tvLiveSeed: { fontFamily: "'Oswald', sans-serif", fontSize: 32, fontWeight: 700, color: T.goldBr, minWidth: 40, textAlign: 'center', lineHeight: 1 },
  tvLiveNames: { flex: 1, minWidth: 0 },
  tvLiveName: { fontFamily: "'Oswald', sans-serif", fontSize: 22, fontWeight: 600, color: T.ivory, lineHeight: 1.25, textTransform: 'uppercase', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  tvLiveVs: { fontFamily: "'Oswald', sans-serif", fontSize: 13, fontWeight: 700, color: T.gold, letterSpacing: 3, textAlign: 'center', padding: '2px 0' },
  tvLiveWinCheck: { fontFamily: "'Oswald', sans-serif", fontSize: 24, color: T.gold, fontWeight: 700, flexShrink: 0 },

  tvTickerStrip: {
    background: 'rgba(0,0,0,0.5)', border: `1px solid ${T.gold}`, borderRadius: 6,
    padding: '8px 0', overflow: 'hidden', whiteSpace: 'nowrap', flexShrink: 0,
  },
  tvTickerText: {
    fontFamily: "'Oswald', sans-serif", fontSize: 16, fontWeight: 600, letterSpacing: 2,
    color: T.goldBr, paddingLeft: '100%',
    animation: 'ticker 60s linear infinite',
  },

  // TV Match Card (used in TVBracketView)
  tvmcHeader:      { display: 'flex', alignItems: 'center', padding: '4px 8px', background: T.bgSoft, borderBottom: `1px solid ${T.rim}`, flexShrink: 0 },
  tvmcHeaderFinal: { background: T.goldDark, borderBottom: `1px solid ${T.gold}`, padding: '8px 12px' },
  tvmcLabel:       { color: T.ivoryDim, fontSize: 10, fontFamily: 'Oswald, sans-serif', letterSpacing: 0.8, opacity: 0.75 },
  tvmcLabelFinal:  { color: T.goldGlow, fontSize: 13, fontWeight: 700, letterSpacing: 2, opacity: 1 },
  tvmcSlot:        { display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', flex: 1, minHeight: 0 },
  tvmcSlotFinalPad:{ padding: '16px 14px' },
  tvmcSlotWin:     { background: T.gold },
  tvmcSlotChamp:   { background: T.goldGlow },
  tvmcSlotLose:    { opacity: 0.35 },
  tvmcSeed:        { color: T.gold, fontSize: 16, fontWeight: 700, fontFamily: 'Oswald, sans-serif', minWidth: 22, textAlign: 'center', flexShrink: 0 },
  tvmcSeedFinal:   { fontSize: 30, minWidth: 36, color: T.goldBr },
  tvmcNames:       { flex: 1, minWidth: 0 },
  tvmcName:        { color: T.ivory, fontSize: 14, fontFamily: 'Barlow Condensed, sans-serif', fontWeight: 600, lineHeight: 1.25, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  tvmcSubNames:    { color: T.ivory, fontSize: 10, fontFamily: 'Barlow Condensed, sans-serif', fontWeight: 500, opacity: 0.5, lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 1 },
  tvmcNameFinal:   { fontSize: 26, fontWeight: 700, fontFamily: 'Oswald, sans-serif', letterSpacing: 0.5 },

  // TV Schedule display
  tvSchedGrid: { flex: 1, display: 'flex', flexDirection: 'column', gap: 8, overflow: 'hidden', minHeight: 0 },
  tvSchedSlot: {
    flex: 1,
    background: 'rgba(0,0,0,0.35)', border: `1px solid ${T.rim}`, borderRadius: 10,
    padding: '10px 18px', display: 'flex', alignItems: 'center', gap: 20,
  },
  tvSchedSlotLive: { background: 'rgba(200,50,50,0.12)', borderColor: T.red },
  tvSchedSlotPast: { opacity: 0.3 },
  tvSchedTime: {
    fontFamily: "'Oswald', sans-serif", fontSize: 24, fontWeight: 700, color: T.gold,
    letterSpacing: 1, minWidth: 150, display: 'flex', alignItems: 'center',
  },
  tvSchedTables: { flex: 1, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 },
  tvSchedMatch: { display: 'flex', flexDirection: 'column', gap: 3 },
  tvSchedTableNum: { fontFamily: "'Oswald', sans-serif", fontSize: 12, fontWeight: 700, letterSpacing: 2, color: T.goldBr, opacity: 0.7, marginBottom: 2 },
  tvSchedTeam: { display: 'flex', alignItems: 'center', gap: 8 },
  tvSchedWinner: { opacity: 1 },
  tvSchedLoser: { opacity: 0.35 },
  tvSchedSeed: { fontFamily: "'Oswald', sans-serif", fontSize: 22, fontWeight: 700, color: T.goldBr, minWidth: 28 },
  tvSchedNames: { fontFamily: "'Oswald', sans-serif", fontSize: 20, fontWeight: 600, color: T.ivory, letterSpacing: 0.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  tvSchedCheck: { fontFamily: "'Oswald', sans-serif", fontSize: 18, color: T.gold, fontWeight: 700, flexShrink: 0 },
  tvSchedVs: { fontFamily: "'Oswald', sans-serif", fontSize: 11, fontWeight: 700, color: T.gold, letterSpacing: 2, opacity: 0.6 },
  tvSchedEmpty: { fontFamily: "'Oswald', sans-serif", fontSize: 16, color: 'rgba(245,238,220,0.2)', padding: '6px 0' },
  tvSchedEst: { marginLeft: 8, fontSize: 11, fontWeight: 700, letterSpacing: 1, color: '#e8a020', opacity: 0.9 },

  // PRINT
  printBackdrop: { position: 'fixed', inset: 0, background: '#fff', zIndex: 1000, overflowY: 'auto', padding: 20 },
  printContainer: { maxWidth: 900, margin: '0 auto', background: '#fff', color: '#1a1a1a', fontFamily: 'Arial, sans-serif' },
  printHeader: { textAlign: 'center', marginBottom: 30, paddingBottom: 20, borderBottom: '2px solid #000' },
  printTitle: { fontSize: 24, fontWeight: 700, margin: '0 0 5px 0', letterSpacing: 1.5 },
  printSubtitle: { fontSize: 14, color: '#666', margin: '0 0 15px 0' },
  printBtn: { background: '#D4A54B', color: '#0E382E', border: 'none', padding: '10px 20px', borderRadius: 4, fontWeight: 700, cursor: 'pointer', marginRight: 10, fontSize: 14 },
  printCloseBtn: { background: '#ddd', border: 'none', padding: '10px 20px', borderRadius: 4, fontWeight: 700, cursor: 'pointer', fontSize: 14 },
  printTable: { width: '100%', borderCollapse: 'collapse', marginBottom: 30 },
  printTh: { padding: 12, textAlign: 'left', fontSize: 12, border: '1px solid #ddd', background: '#f0ede2' },
  printTd: { padding: 12, textAlign: 'left', fontSize: 11, border: '1px solid #ddd', verticalAlign: 'top' },
  printTimeCell: { fontWeight: 700, backgroundColor: '#D4A54B', color: '#0E382E', minWidth: 100 },
  printEmpty: { color: '#999', fontStyle: 'italic' },
  printMatch: { fontSize: 11, lineHeight: 1.5 },
  printVs: { textAlign: 'center', fontWeight: 700, color: '#D4A54B', margin: '4px 0' },
  printFooter: { textAlign: 'center', paddingTop: 20, borderTop: '2px solid #000', fontSize: 13, fontWeight: 700 },

  // Desktop bracket
  desktopWrap:    { overflow: 'hidden', flex: 1, padding: '12px 12px 20px', display: 'flex', flexDirection: 'column' },
  dmcColLabel:    { position: 'absolute', textAlign: 'center', color: T.gold, fontSize: 13, fontFamily: 'Oswald, sans-serif', letterSpacing: 2, opacity: 0.85, pointerEvents: 'none' },
  dmc:            { background: T.bgCard, border: `1px solid ${T.rim}`, borderRadius: 7, overflow: 'hidden', display: 'flex', flexDirection: 'column' },
  dmcHeader:      { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '3px 6px', background: T.bgSoft, borderBottom: `1px solid ${T.rim}`, flexShrink: 0 },
  dmcLabel:       { color: T.ivoryDim, fontSize: 11, fontFamily: 'Oswald, sans-serif', letterSpacing: 0.8, opacity: 0.75 },
  dmcBtns:        { display: 'flex', gap: 2 },
  dmcBtn:         { background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 11, padding: '0 2px', opacity: 0.7, lineHeight: 1 },
  dmcSlot:        { display: 'flex', alignItems: 'center', gap: 7, padding: '7px 9px', flex: 1, minHeight: 0 },
  dmcSlotWin:     { background: T.gold },
  dmcSlotChamp:   { background: T.goldGlow },
  dmcSlotLose:    { opacity: 0.4 },
  dmcSlotEmpty:   { display: 'flex', alignItems: 'center', gap: 7, padding: '7px 9px', flex: 1, opacity: 0.3 },
  dmcDivider:     { height: 1, background: T.rim, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'visible' },
  dmcScore:       { fontFamily: "'Oswald', sans-serif", fontSize: 9, fontWeight: 700, letterSpacing: 1, color: T.goldBr, background: T.bgCard, padding: '0 4px', position: 'relative' },
  dmcSeed:        { color: T.gold, fontSize: 14, fontWeight: 700, fontFamily: 'Oswald, sans-serif', minWidth: 18, textAlign: 'center', flexShrink: 0 },
  dmcSeedEmpty:   { color: T.ivoryDim, fontSize: 14, fontFamily: 'Oswald, sans-serif', minWidth: 18, textAlign: 'center', flexShrink: 0 },
  dmcPiTag:       { fontSize: 8, marginLeft: 1, opacity: 0.7 },
  dmcPlayerNames: { display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0, gap: 1 },
  dmcTeamName:    { color: T.gold, fontSize: 12, fontFamily: 'Oswald, sans-serif', fontWeight: 700, letterSpacing: 0.5, lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  dmcPName:       { color: T.ivory, fontSize: 13, fontFamily: 'Barlow Condensed, sans-serif', fontWeight: 600, lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  dmcNameTbd:     { color: T.ivoryDim, fontSize: 13, fontFamily: 'Barlow Condensed, sans-serif' },

  // Auth
  loginBtn:     { background: 'transparent', border: 'none', color: T.bgSoft, padding: '4px 8px', borderRadius: 6, cursor: 'pointer', fontSize: 11, fontFamily: 'Oswald, sans-serif', letterSpacing: 1, opacity: 0.5 },
  adminBadgeBtn:{ background: '#0d3d22', border: `1px solid ${T.gold}`, color: T.gold, padding: '4px 12px', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontFamily: 'Oswald, sans-serif', letterSpacing: 1 },
  overlay:      { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  loginModal:   { background: T.bg, border: `1px solid ${T.gold}`, borderRadius: 14, padding: 32, display: 'flex', flexDirection: 'column', gap: 14, width: 300, boxShadow: `0 0 40px rgba(212,165,75,0.2)` },
  loginTitle:   { color: T.gold, fontSize: 20, fontWeight: 700, fontFamily: 'Oswald, sans-serif', letterSpacing: 2, textAlign: 'center', marginBottom: 4 },
  loginInput:   { background: T.bgDeep, border: `1px solid ${T.rim}`, borderRadius: 8, padding: '11px 14px', color: T.ivory, fontSize: 15, outline: 'none', fontFamily: 'Barlow Condensed, sans-serif' },
  loginError:   { color: T.red, fontSize: 13, textAlign: 'center' },
  loginSubmit:  { background: T.gold, border: 'none', color: T.bgDeep, padding: '13px', borderRadius: 8, cursor: 'pointer', fontSize: 15, fontWeight: 700, fontFamily: 'Oswald, sans-serif', letterSpacing: 1 },
};

// ═══════════════════════════════════════════════════════════════════════════
// GLOBAL CSS
// ═══════════════════════════════════════════════════════════════════════════
const globalCSS = `
@import url('https://fonts.googleapis.com/css2?family=Oswald:wght@300;400;500;600;700&family=Barlow+Condensed:wght@400;500;600;700&display=swap');

* { box-sizing: border-box; -webkit-tap-highlight-color: transparent; -webkit-touch-callout: none; }
html, body { margin: 0; padding: 0; background: ${T.bgDeep}; }
body { overscroll-behavior-y: contain; }

input, button, textarea {
  font-family: inherit;
  -webkit-appearance: none; -moz-appearance: none; appearance: none;
}
button { user-select: none; }
input::-webkit-outer-spin-button, input::-webkit-inner-spin-button {
  -webkit-appearance: none; margin: 0;
}
input[type=number] { -moz-appearance: textfield; }

@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes slideUp { from { transform: translateY(40px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
@keyframes slideDown { from { transform: translate(-50%, -20px); opacity: 0; } to { transform: translate(-50%, 0); opacity: 1; } }
@keyframes scaleIn { from { transform: scale(0.94); opacity: 0; } to { transform: scale(1); opacity: 1; } }
@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.55; } }
@keyframes ticker { 0% { transform: translateX(0); } 100% { transform: translateX(-100%); } }

button:active { transform: scale(0.98); transition: transform 80ms; }
button:disabled { opacity: 0.5; cursor: not-allowed; }

.drop-item-hover:hover { background: rgba(242,162,58,0.08) !important; }

@media print {
  body * { visibility: hidden; }
  [data-print-area], [data-print-area] * { visibility: visible; }
  .no-print { display: none !important; }
}
`;
