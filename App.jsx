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
const T = {
  // Marty Supreme cinematic palette
  bgDeep:  '#04120E',
  bg:      '#0A2620',
  bgMid:   '#0E382E',
  bgCard:  '#0E342B',
  bgSoft:  '#143E33',

  goldDark: '#8A5F20',
  gold:     '#D4A54B',
  goldBr:   '#F5C86E',
  goldGlow: '#FFDC8C',

  ivory:    '#F5EEDC',
  ivoryDim: '#C8C0AF',
  parchment:'#DAC69E',

  red:      '#C7484A',
  rim:      'rgba(212,165,75,0.30)',
  rimSoft:  'rgba(212,165,75,0.14)',
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
  { time: '4:30 – 4:42', duration: '12 min', round: 'PI',
    matchIds: ['L_PI', 'R_PI', 'L_R1_2'], tables: [1, 2, 3] },
  { time: '4:45 – 4:57', duration: '12 min', round: 'R1',
    matchIds: ['L_R1_3', 'L_R1_4', 'R_R1_2'], tables: [1, 2, 3] },
  { time: '5:00 – 5:12', duration: '12 min', round: 'R1',
    matchIds: ['L_R1_1', 'R_R1_3', 'R_R1_4'], tables: [1, 2, 3] },
  { time: '5:15 – 5:27', duration: '12 min', round: 'R1/QF',
    matchIds: ['R_R1_1', 'L_QF_2', 'R_QF_2'], tables: [1, 2, 3] },
  { time: '5:30 – 5:42', duration: '12 min', round: 'QF',
    matchIds: ['L_QF_1', 'R_QF_1', null], tables: [1, 2, 'Warmup'] },
  { time: '5:45 – 5:57', duration: '12 min', round: 'SF',
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

  return { players, teams, matches, locked: false };
}

function makeMatch() {
  return { slots: [null, null], winner: null, scores: { team1: [], team2: [] }, isForfeit: false };
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

function getLiveSlotInfo() {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const eventDay = new Date(2026, 4, 14); // May 14 2026

  if (today < eventDay) {
    const daysUntil = Math.round((eventDay - today) / 86400000);
    return { status: 'upcoming', index: 0, daysUntil };
  }
  if (today > eventDay) {
    return { status: 'finished', index: SCHEDULE_SLOTS.length - 1 };
  }
  // Event day — use clock
  const slots = SCHEDULE_SLOTS.map(s => parseSlotTime(s.time));
  for (let i = 0; i < slots.length; i++) {
    if (now >= slots[i].start && now <= slots[i].end) return { status: 'live', index: i };
  }
  if (now < slots[0].start) {
    return { status: 'upcoming', index: 0, minutesUntil: Math.ceil((slots[0].start - now) / 60000) };
  }
  for (let i = 0; i < slots.length - 1; i++) {
    if (now > slots[i].end && now < slots[i+1].start) {
      return { status: 'upcoming', index: i+1, minutesUntil: Math.ceil((slots[i+1].start - now) / 60000) };
    }
  }
  return { status: 'finished', index: slots.length - 1 };
}

// Compute hot-takes / leaderboards from current data
function computeStats(data) {
  const teamStats = {}, playerStats = {};
  Object.keys(data.teams).forEach(tid => {
    teamStats[tid] = { wins: 0, losses: 0, pf: 0, pa: 0 };
  });
  data.players.forEach(p => { playerStats[p.id] = { wins: 0, losses: 0, name: p.name }; });

  let biggestUpset = null, closestMatch = null;
  let totalMatches = 0, totalForfeits = 0, totalPoints = 0;

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
    totalPoints += t1Pts + t2Pts;

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

  return { teamStats, playerStats, biggestUpset, closestMatch, totalMatches, totalForfeits, totalPoints };
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
  const [tvMode, setTvMode] = useState(false);
  const [printMode, setPrintMode] = useState(false);
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

  // Load from Supabase + real-time sync for all viewers
  useEffect(() => {
    supabase
      .from('tournament_state')
      .select('data')
      .eq('id', ROOM_ID)
      .single()
      .then(({ data: row }) => {
        if (row?.data) setData(row.data);
        setLoaded(true);
      });

    const channel = supabase
      .channel('tournament')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tournament_state' }, payload => {
        if (payload.new?.data) setData(payload.new.data);
      })
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, []);

  // Save to Supabase — admins only
  useEffect(() => {
    if (!loaded || !isAdmin) return;
    supabase.from('tournament_state').upsert({
      id: ROOM_ID,
      data,
      updated_at: new Date().toISOString(),
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
    if (data.locked) { showToast('Bracket is locked — unlock to make changes'); return; }
    if (editTeamMode) return;
    const team = data.teams[teamId];
    if (!team) return;
    if (team.playerIds.some(p => p === null)) {
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
    if (data.locked) return;
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
    if (data.locked) return;
    setData(prev => {
      const next = cloneData(prev);
      const m = next.matches[matchId];
      m.scores = { team1: t1Scores, team2: t2Scores };
      const t1Wins = t1Scores.filter(s => s[0] > s[1]).length;
      const t2Wins = t2Scores.filter(s => s[0] < s[1]).length;
      let winner = null;
      if (t1Wins > t2Wins) winner = m.slots[0];
      else if (t2Wins > t1Wins) winner = m.slots[1];
      if (winner) {
        if (m.winner && m.winner !== winner) clearDownstream(next, matchId, m.winner);
        m.winner = winner; m.isForfeit = false;
        const flow = FLOW[matchId];
        if (flow) next.matches[flow.next].slots[flow.slot] = winner;
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
    showToast(data.locked ? 'Bracket unlocked' : 'Bracket locked 🔒');
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
      return next;
    });
    setResetMenu(false);
    showToast('Bracket progress cleared');
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

  // TV mode renders separately
  if (tvMode) {
    return <TVDisplay data={data} onExit={() => setTvMode(false)} />;
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
            <div style={S.starRow}>
              <Star size={11} /><Star size={11} /><Star size={11} />
            </div>
            <div style={S.brandTitle}>ATLAS</div>
            <div style={S.brandSubtitle}>SUPREME</div>
            <div style={S.eventLabel}>INVITATIONAL · {EVENT_DATE}</div>
          </div>
          <div style={S.headerActions}>
            <button style={S.iconBtn} onClick={() => setTvMode(true)} title="TV Mode">📺</button>
            {tab === 'schedule' && (
              <button style={S.iconBtn} onClick={() => setPrintMode(true)} title="Print">🖨️</button>
            )}
            {isAdmin && (
              <>
                <button
                  style={data.locked ? S.lockBtnActive : S.iconBtn}
                  onClick={toggleLock}
                  title={data.locked ? 'Unlock bracket' : 'Lock bracket'}
                >
                  {data.locked ? '🔒' : '🔓'}
                </button>
                <button style={S.iconBtn} onClick={() => setResetMenu(true)} title="Reset">↻</button>
              </>
            )}
            {isAdmin ? (
              <button style={S.adminBadgeBtn} onClick={handleLogout} title="Logout">ADMIN ✓</button>
            ) : (
              <button style={S.loginBtn} onClick={() => setShowLogin(true)} title="Admin login">ADMIN</button>
            )}
          </div>
        </header>

        {/* LOCKED BANNER */}
        {isAdmin && data.locked && (
          <div style={S.lockBanner}>
            <span>🔒</span>
            <span>BRACKET LOCKED</span>
            <button style={S.lockBannerBtn} onClick={toggleLock}>UNLOCK</button>
          </div>
        )}

        {/* TAB BAR */}
        <nav style={S.tabBar}>
          {[
            { id: 'bracket',  label: 'BRACKET',  sub: `${stats.complete}/18` },
            { id: 'schedule', label: 'SCHEDULE', sub: '3 TABLES' },
            { id: 'players',  label: 'PLAYERS',  sub: `${stats.placed}/36` },
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
              onTeamTap={isAdmin ? advanceWinner : undefined}
              onScoreEdit={isAdmin ? setScoreEditor : undefined}
              onShareMatch={setShareCard}
              locked={data.locked || !isAdmin}
            />
          ) : (
            <BracketView
              data={data}
              activeRound={activeRound}
              setActiveRound={setActiveRound}
              onTeamTap={isAdmin ? advanceWinner : undefined}
              onSlotTap={isAdmin ? (teamId, slotIndex) => setPicker({ teamId, slotIndex }) : undefined}
              onRemovePlayer={isAdmin ? removePlayer : undefined}
              editTeamMode={editTeamMode}
              setEditTeamMode={setEditTeamMode}
              onScoreEdit={isAdmin ? setScoreEditor : undefined}
              onShareMatch={setShareCard}
              onSeedEdit={isAdmin ? setSeedEditor : undefined}
              locked={data.locked || !isAdmin}
            />
          ))}
          {tab === 'schedule' && (
            <ScheduleView data={data} tableFilter={tableFilter} setTableFilter={setTableFilter} />
          )}
          {tab === 'players' && (
            <PlayersView
              data={data}
              editingPlayer={isAdmin ? editingPlayer : null}
              setEditingPlayer={isAdmin ? setEditingPlayer : () => {}}
              updatePlayerName={isAdmin ? updatePlayerName : () => {}}
              getPlayerTeam={getPlayerTeam}
              onPlayerSchedule={(pid) => setPlayerSchedule({ playerId: pid })}
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
        <div style={S.vsLabel}>VS</div>
        <button style={S.scoreButton} onClick={onScoreEdit} disabled={locked}>📊 SCORE</button>
        {match.winner && (
          <button style={S.shareButton} onClick={onShareMatch}>📤</button>
        )}
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
  const MH = 82, MW = 172, HG = 30, VG = 22, PAD = 44;
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
      const available = containerRef.current.offsetWidth - 48;
      setScale(Math.min(1, available / totalW));
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
        <div style={{ position: 'relative', width: totalW, height: 22, marginBottom: 6 }}>
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
          {team.seed}{team.pi && <span style={S.dmcPiTag}>PI</span>}
        </span>
        <div style={S.dmcPlayerNames}>
          <div style={{ ...S.dmcPName, ...(champWin ? { color: T.bgDeep } : {}), ...(isFinalCard ? { fontSize: 12, fontWeight: 700 } : {}) }}>
            {p1 ? p1.name : '…'}
          </div>
          <div style={{ ...S.dmcPName, ...(champWin ? { color: T.bgDeep } : {}), ...(isFinalCard ? { fontSize: 12, fontWeight: 700 } : {}) }}>
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

  return (
    <div style={{ ...S.dmc, width, ...finalCardStyle }}>
      <div style={{ ...S.dmcHeader, ...(isFinalCard ? { background: T.goldDark, borderBottom: `1px solid ${T.gold}` } : {}) }}>
        <span style={{ ...S.dmcLabel, ...(isFinalCard ? { color: T.goldGlow, fontSize: 11, letterSpacing: 1.5 } : {}) }}>{shortLabel}</span>
        <div style={S.dmcBtns}>
          {!locked && onScoreEdit && (
            <button style={S.dmcBtn}
              onClick={e => { e.stopPropagation(); onScoreEdit({ matchId }); }}
              title="Enter scores">📊</button>
          )}
          {match.winner && onShareMatch && (
            <button style={S.dmcBtn}
              onClick={e => { e.stopPropagation(); onShareMatch({ matchId }); }}
              title="Share">📤</button>
          )}
        </div>
      </div>
      {renderSlot(0)}
      <div style={S.dmcDivider} />
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
function ScheduleView({ data, tableFilter, setTableFilter }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 30000);
    return () => clearInterval(id);
  }, []);
  const live = getLiveSlotInfo();

  return (
    <div style={S.scheduleView}>
      <div style={S.scheduleHeader}>
        <div style={S.scheduleTitle}>TOURNAMENT SCHEDULE</div>
        <div style={S.scheduleSub}>4:30 – 6:30 PM · 1 GAME TO 21 · FINALS BO3</div>
      </div>

      <div style={S.tableFilterRow}>
        {[
          { id: 'all', label: 'ALL TABLES' },
          { id: 1, label: 'TABLE 1' },
          { id: 2, label: 'TABLE 2' },
          { id: 3, label: 'TABLE 3' },
        ].map(opt => (
          <button key={opt.id}
            style={tableFilter === opt.id ? S.tableFilterBtnActive : S.tableFilterBtn}
            onClick={() => setTableFilter(opt.id)}>{opt.label}</button>
        ))}
      </div>

      {live.status === 'live' && (
        <div style={S.liveBanner}>
          <span style={S.liveDot} />
          <span style={S.liveLabel}>LIVE NOW</span>
          <span style={S.liveTime}>{SCHEDULE_SLOTS[live.index].time}</span>
        </div>
      )}
      {live.status === 'upcoming' && live.daysUntil > 0 && (
        <div style={S.upNextBanner}>
          <span style={S.upNextLabel}>TOURNAMENT IN</span>
          <span style={S.upNextTime}>{live.daysUntil} {live.daysUntil === 1 ? 'DAY' : 'DAYS'}</span>
        </div>
      )}
      {live.status === 'upcoming' && live.minutesUntil != null && live.minutesUntil <= 30 && (
        <div style={S.upNextBanner}>
          <span style={S.upNextLabel}>STARTS IN</span>
          <span style={S.upNextTime}>{live.minutesUntil} MIN</span>
        </div>
      )}
      {live.status === 'finished' && (
        <div style={S.finishedBanner}>🏆 TOURNAMENT COMPLETE</div>
      )}

      <div>
        {SCHEDULE_SLOTS.map((slot, idx) => (
          <TimeSlot key={idx} slot={slot} data={data} tableFilter={tableFilter}
            isLive={live.status === 'live' && live.index === idx}
            isPast={(live.status === 'live' && idx < live.index) || live.status === 'finished'}
            isNext={live.status === 'live' && live.index + 1 === idx} />
        ))}
      </div>

      <div style={S.scheduleFooter}>
        <div style={S.scheduleNote}>🏓 <b>Format:</b> 1 game to 21 (rally scoring, win by 2)</div>
        <div style={S.scheduleNote}>🥇 <b>Finals:</b> Best of 3 to 21</div>
        <div style={S.scheduleNote}>⏱️ <b>Pace:</b> 12-min matches, 3-min buffers</div>
      </div>
    </div>
  );
}

function TimeSlot({ slot, data, tableFilter, isLive, isPast, isNext }) {
  const visible = tableFilter === 'all' ? [0, 1, 2] : [tableFilter - 1];
  return (
    <div style={{ ...S.timeSlot, ...(isLive ? S.timeSlotLive : {}), ...(isPast ? S.timeSlotPast : {}) }}>
      <div style={S.slotTime}>
        {isLive && <div style={S.slotLiveBadge}>LIVE</div>}
        {isNext && <div style={S.slotNextBadge}>NEXT</div>}
        {slot.time.split('–').map((t, i) => (
          <div key={i} style={S.slotTimeMain}>{t.trim()}</div>
        ))}
        <div style={S.slotTimeDuration}>{slot.duration}</div>
      </div>
      <div style={S.slotMatches}>
        {visible.map((i, idx) => (
          <SlotMatch key={i}
            matchId={slot.matchIds[i]}
            tableNum={slot.tables[i]}
            data={data}
            isLast={idx === visible.length - 1} />
        ))}
      </div>
    </div>
  );
}

function SlotMatch({ matchId, tableNum, data, isLast }) {
  if (!matchId) {
    return (
      <div style={{ ...S.slotMatch, ...S.slotMatchEmpty,
                    ...(isLast ? {} : { borderRight: `1px solid ${T.rim}` }) }}>
        <div style={S.tableLabel}>{tableNum}</div>
        <div style={S.matchEmpty}>Open / Warmup</div>
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
    <div style={{ ...S.slotMatch, ...(isLast ? {} : { borderRight: `1px solid ${T.rim}` }) }}>
      <div style={S.tableLabel}>TABLE {tableNum}</div>
      {complete ? (
        <>
          <div style={{ ...S.matchTeam, ...(match.winner === t1.id ? S.matchTeamWinner : {}) }}>
            <div style={S.matchTeamSeed}>{t1.side}{t1.seed}</div>
            <div style={S.matchTeamNames}>
              <div style={S.playerSmall}>{p1a.name}</div>
              <div style={S.playerSmall}>{p1b.name}</div>
            </div>
          </div>
          <div style={S.scheduleVs}>VS</div>
          <div style={{ ...S.matchTeam, ...(match.winner === t2.id ? S.matchTeamWinner : {}) }}>
            <div style={S.matchTeamSeed}>{t2.side}{t2.seed}</div>
            <div style={S.matchTeamNames}>
              <div style={S.playerSmall}>{p2a.name}</div>
              <div style={S.playerSmall}>{p2b.name}</div>
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
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// PLAYERS VIEW
// ═══════════════════════════════════════════════════════════════════════════
function PlayersView({ data, editingPlayer, setEditingPlayer, updatePlayerName,
                       getPlayerTeam, onPlayerSchedule }) {
  return (
    <div style={S.playersView}>
      <div style={S.sectionHeader}>
        <div style={S.sectionTitle}>36 PLAYERS</div>
        <div style={S.sectionSub}>Tap name to rename · Tap 📅 for player schedule</div>
      </div>
      <div style={S.playerList}>
        {data.players.map((player, idx) => (
          <PlayerRow
            key={player.id}
            player={player}
            num={idx + 1}
            team={getPlayerTeam(player.id)}
            isEditing={editingPlayer === player.id}
            onEditStart={() => setEditingPlayer(player.id)}
            onEditEnd={() => setEditingPlayer(null)}
            onSave={(name) => { updatePlayerName(player.id, name); setEditingPlayer(null); }}
            onShowSchedule={() => onPlayerSchedule(player.id)}
          />
        ))}
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
function PlayerPicker({ data, picker, onClose, onPick }) {
  const team = data.teams[picker.teamId];
  const [search, setSearch] = useState('');

  const playersWithStatus = useMemo(() => {
    return data.players.map(p => {
      let placedTeam = null;
      Object.values(data.teams).forEach(t => { if (t.playerIds.includes(p.id)) placedTeam = t; });
      return { ...p, placedTeam };
    });
  }, [data]);

  const filtered = playersWithStatus
    .filter(p => p.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (!a.placedTeam && b.placedTeam) return -1;
      if (a.placedTeam && !b.placedTeam) return 1;
      return 0;
    });

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

  const [scores, setScores] = useState(() => {
    if (match.scores.team1.length > 0) {
      return { t1: match.scores.team1, t2: match.scores.team2 };
    }
    return {
      t1: Array.from({ length: numGames }, () => [0, 0]),
      t2: Array.from({ length: numGames }, () => [0, 0]),
    };
  });

  const handleChange = (teamIdx, gameIdx, pointIdx, val) => {
    setScores(prev => {
      const k = teamIdx === 0 ? 't1' : 't2';
      const next = { ...prev, [k]: prev[k].slice() };
      const game = next[k][gameIdx];
      next[k][gameIdx] = [
        pointIdx === 0 ? parseInt(val) || 0 : game[0],
        pointIdx === 1 ? parseInt(val) || 0 : game[1],
      ];
      return next;
    });
  };

  const t1Wins = scores.t1.filter(s => s[0] > s[1]).length;
  const t2Wins = scores.t2.filter(s => s[0] < s[1]).length;
  const winner = t1Wins > t2Wins ? 1 : t2Wins > t1Wins ? 2 : null;

  if (!team1 || !team2) return null;

  const p1a = team1.playerIds[0] ? data.players.find(p => p.id === team1.playerIds[0]) : null;
  const p1b = team1.playerIds[1] ? data.players.find(p => p.id === team1.playerIds[1]) : null;
  const p2a = team2.playerIds[0] ? data.players.find(p => p.id === team2.playerIds[0]) : null;
  const p2b = team2.playerIds[1] ? data.players.find(p => p.id === team2.playerIds[1]) : null;

  return (
    <div style={S.modalBackdrop} onClick={onClose}>
      <div style={S.scoreModal} onClick={e => e.stopPropagation()}>
        <div style={S.scoreHeader}>
          <div>
            <div style={S.sheetTitle}>ENTER SCORES</div>
            <div style={S.scoreFormat}>{formatLabel}</div>
          </div>
          <button style={S.sheetClose} onClick={onClose}>×</button>
        </div>

        <div style={S.scoreBody}>
          {[
            { team: team1, p1: p1a, p2: p1b, scores: scores.t1, key: 0, wins: t1Wins },
            { team: team2, p1: p2a, p2: p2b, scores: scores.t2, key: 1, wins: t2Wins },
          ].map(({ team, p1, p2, scores: s, key, wins }) => (
            <div key={key} style={S.scoreTeamBlock}>
              <div style={S.scoreTeamName}>
                <div style={S.scoreTeamSeed}>{team.side}{team.seed}</div>
                <div style={S.scoreTeamPlayers}>
                  <div>{p1?.name || '...'}</div>
                  <div>{p2?.name || '...'}</div>
                </div>
              </div>
              <div style={S.scoreGames}>
                {s.map((game, i) => (
                  <div key={i} style={S.scoreGame}>
                    {numGames > 1 && <div style={S.gameLabel}>G{i + 1}</div>}
                    <input type="number" min="0" max="30" value={game[0]}
                      onChange={e => handleChange(key, i, 0, e.target.value)}
                      style={S.scoreInput} />
                    <div style={S.scoreSep}>–</div>
                    <input type="number" min="0" max="30" value={game[1]}
                      onChange={e => handleChange(key, i, 1, e.target.value)}
                      style={S.scoreInput} />
                  </div>
                ))}
              </div>
              <div style={S.scoreWins}>
                {isFinal ? `${wins} GAMES` : (wins > 0 ? 'WIN' : '—')}
              </div>
            </div>
          ))}
        </div>

        {winner && (
          <div style={S.scoreWinnerBanner}>
            {winner === 1 ? `${team1.side}${team1.seed}` : `${team2.side}${team2.seed}`} WINS
            {isFinal && ' THE TITLE'}
          </div>
        )}

        <div style={S.scoreActions}>
          <button style={S.scoreSaveBtn} onClick={() => onSave(matchId, scores.t1, scores.t2)}>
            ✓ SAVE SCORES
          </button>
          <div style={S.forfeitRow}>
            <button style={S.forfeitBtn} onClick={() => onForfeit(matchId, team1.id)}>
              ⊘ {team1.side}{team1.seed} FORFEIT
            </button>
            <button style={S.forfeitBtn} onClick={() => onForfeit(matchId, team2.id)}>
              ⊘ {team2.side}{team2.seed} FORFEIT
            </button>
          </div>
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

  return (
    <div style={S.statsView}>
      <div style={S.statsHeadline}>
        <div style={S.statsCard}>
          <div style={S.statsCardLabel}>MATCHES</div>
          <div style={S.statsCardValue}>{stats.totalMatches}</div>
          <div style={S.statsCardSub}>played</div>
        </div>
        <div style={S.statsCard}>
          <div style={S.statsCardLabel}>POINTS</div>
          <div style={S.statsCardValue}>{stats.totalPoints}</div>
          <div style={S.statsCardSub}>scored</div>
        </div>
        <div style={S.statsCard}>
          <div style={S.statsCardLabel}>FORFEITS</div>
          <div style={S.statsCardValue}>{stats.totalForfeits}</div>
          <div style={S.statsCardSub}>walkovers</div>
        </div>
      </div>

      <div style={S.statsSection}>
        <div style={S.statsSectionTitle}>🔥 HOT TAKES</div>
        {stats.biggestUpset ? (
          <UpsetCard upset={stats.biggestUpset} data={data} />
        ) : (
          <div style={S.statsEmpty}>Upsets will appear once seeded teams clash.</div>
        )}
        {stats.closestMatch && <ClosestCard closest={stats.closestMatch} data={data} />}
      </div>

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
          <div style={S.statsSectionTitle}>🥇 TEAM LEADERBOARD</div>
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
                  <div style={S.lbDiff}>{diff >= 0 ? '+' : ''}{diff}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {playerLB.length === 0 && (
        <div style={S.statsEmpty}>📊 Stats will appear as matches are played.</div>
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
  return (
    <div style={S.hotCard}>
      <div style={S.hotLabel}>TIGHTEST MATCH</div>
      <div style={S.hotWin}>
        SEED {t1?.seed} <span style={S.hotVerb}>vs</span> SEED {t2?.seed}
      </div>
      <div style={S.hotMeta}>Won by {closest.margin} · {matchLabel(closest.matchId)}</div>
      <div style={S.hotScore}>{matchScoreString(m)}</div>
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
function ResetMenu({ onClose, onResetBracket, onResetAll }) {
  return (
    <div style={S.modalBackdrop} onClick={onClose}>
      <div style={S.modal} onClick={e => e.stopPropagation()}>
        <div style={S.modalTitle}>RESET OPTIONS</div>
        <div style={S.modalDesc}>What would you like to clear?</div>

        <button style={S.modalOption} onClick={onResetBracket}>
          <div style={S.modalOptionTitle}>RESET BRACKET PROGRESS</div>
          <div style={S.modalOptionDesc}>Clear winners only · keep teams & seeds</div>
        </button>

        <button style={S.modalOptionDanger} onClick={onResetAll}>
          <div style={{ ...S.modalOptionTitle, color: T.red }}>RESET EVERYTHING</div>
          <div style={S.modalOptionDesc}>Restore default players & seeding</div>
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

  const live = getLiveSlotInfo();
  const liveSlot = live.status === 'live' ? SCHEDULE_SLOTS[live.index] : null;
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
    countdown = `STARTS IN ${live.minutesUntil} MIN`;
  }

  return (
    <div style={S.tvShell}>
      <style>{globalCSS}</style>
      <div style={S.tvBrandBar}>
        <div style={S.tvBrandLeft}>
          <div style={S.tvStarRow}><Star size={20} /><Star size={20} /><Star size={20} /></div>
          <div>
            <div style={S.tvBrandTitle}>ATLAS SUPREME</div>
            <div style={S.tvBrandSub}>INVITATIONAL · {EVENT_DATE}</div>
          </div>
        </div>
        <div style={S.tvClock}>
          {now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true })}
        </div>
        <button style={S.tvExitBtn} onClick={onExit}>✕ EXIT TV MODE</button>
      </div>

      {champion && (
        <div style={S.tvChampionTakeover}>
          <div style={S.tvChampStars}>
            {[...Array(5)].map((_, i) => <Star key={i} size={28} />)}
          </div>
          <div style={S.tvChampLabel}>TOURNAMENT CHAMPIONS</div>
          <div style={S.tvChampNames}>
            {champion.playerIds.map(pid => {
              const p = data.players.find(pp => pp.id === pid);
              return <div key={pid}>{p?.name || '—'}</div>;
            })}
          </div>
          <div style={S.tvChampSeed}>
            {champion.side === 'L' ? 'LEFT' : 'RIGHT'} BRACKET · SEED {champion.seed}
          </div>
        </div>
      )}

      {!champion && liveSlot && (
        <div style={S.tvLiveSection}>
          <div style={S.tvSectionHeader}>
            <span style={S.tvLiveDot} />
            <span style={S.tvLiveLabel}>LIVE NOW</span>
            <span style={S.tvLiveTime}>{liveSlot.time}</span>
            {countdown && <span style={S.tvCountdown}>{countdown}</span>}
          </div>
          <div style={S.tvTablesGrid}>
            {[0, 1, 2].map(i => (
              <TVTableCard key={i} tableNum={liveSlot.tables[i]}
                matchId={liveSlot.matchIds[i]} data={data} />
            ))}
          </div>
        </div>
      )}

      {!champion && (
        <div style={S.tvUpcomingSection}>
          <div style={S.tvSectionHeader}>
            <span style={S.tvUpcomingLabel}>SCHEDULE</span>
          </div>
          <div style={S.tvUpcomingList}>
            {SCHEDULE_SLOTS.map((slot, idx) => {
              const isLive = live.status === 'live' && live.index === idx;
              if (isLive) return null;
              const isPast = (live.status === 'live' && idx < live.index) || live.status === 'finished';
              return <TVScheduleRow key={idx} slot={slot} data={data} isPast={isPast} />;
            })}
          </div>
        </div>
      )}

      <div style={S.tvTickerStrip}>
        <TVTicker stats={stats} data={data} />
      </div>
    </div>
  );
}

function TVTableCard({ tableNum, matchId, data }) {
  if (!matchId) {
    return (
      <div style={{ ...S.tvTableCard, ...S.tvTableCardEmpty }}>
        <div style={S.tvTableNum}>{typeof tableNum === 'number' ? `TABLE ${tableNum}` : tableNum}</div>
        <div style={S.tvTableEmpty}>Open / Warmup</div>
      </div>
    );
  }
  const m = data.matches[matchId];
  const t1 = m.slots[0] ? data.teams[m.slots[0]] : null;
  const t2 = m.slots[1] ? data.teams[m.slots[1]] : null;
  const p1a = t1?.playerIds[0] ? data.players.find(p => p.id === t1.playerIds[0]) : null;
  const p1b = t1?.playerIds[1] ? data.players.find(p => p.id === t1.playerIds[1]) : null;
  const p2a = t2?.playerIds[0] ? data.players.find(p => p.id === t2.playerIds[0]) : null;
  const p2b = t2?.playerIds[1] ? data.players.find(p => p.id === t2.playerIds[1]) : null;

  return (
    <div style={S.tvTableCard}>
      <div style={S.tvTableHeader}>
        <div style={S.tvTableNum}>TABLE {tableNum}</div>
        <div style={S.tvMatchLabel}>{matchLabel(matchId)}</div>
      </div>
      <div style={S.tvTeam}>
        <div style={S.tvSeed}>{t1?.seed || '—'}</div>
        <div style={S.tvTeamPlayers}>
          <div style={S.tvPlayerName}>{p1a?.name || '...'}</div>
          <div style={S.tvPlayerName}>{p1b?.name || '...'}</div>
        </div>
      </div>
      <div style={S.tvVsBig}>VS</div>
      <div style={S.tvTeam}>
        <div style={S.tvSeed}>{t2?.seed || '—'}</div>
        <div style={S.tvTeamPlayers}>
          <div style={S.tvPlayerName}>{p2a?.name || '...'}</div>
          <div style={S.tvPlayerName}>{p2b?.name || '...'}</div>
        </div>
      </div>
    </div>
  );
}

function TVScheduleRow({ slot, data, isPast }) {
  return (
    <div style={{ ...S.tvScheduleRow, ...(isPast ? S.tvScheduleRowPast : {}) }}>
      <div style={S.tvScheduleTime}>{slot.time}</div>
      <div style={S.tvScheduleTables}>
        {[0, 1, 2].map(i => {
          const mid = slot.matchIds[i];
          const m = mid ? data.matches[mid] : null;
          const t1 = m && m.slots[0] ? data.teams[m.slots[0]] : null;
          const t2 = m && m.slots[1] ? data.teams[m.slots[1]] : null;
          const w1 = m && m.winner === m.slots[0];
          const w2 = m && m.winner === m.slots[1];
          return (
            <div key={i} style={S.tvScheduleCol}>
              <div style={S.tvScheduleTableLbl}>T{slot.tables[i]}</div>
              {mid ? (
                <div>
                  <div style={{ ...S.tvSchedulePair, ...(w1 ? S.tvScheduleWinner : {}) }}>
                    {t1 ? `${t1.side}${t1.seed}` : '—'}
                  </div>
                  <div style={{ ...S.tvSchedulePair, ...(w2 ? S.tvScheduleWinner : {}) }}>
                    {t2 ? `${t2.side}${t2.seed}` : '—'}
                  </div>
                </div>
              ) : (
                <div style={S.tvScheduleEmpty}>—</div>
              )}
            </div>
          );
        })}
      </div>
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
  if (items.length === 0) {
    items.push('DREAM BIG · ATLAS SUPREME INVITATIONAL · BRING YOUR PADDLE');
  }
  const text = items.join('   ·   ');
  return <div style={S.tvTickerText}>{text}   ·   {text}</div>;
}

// ═══════════════════════════════════════════════════════════════════════════
// PRINT SCHEDULE
// ═══════════════════════════════════════════════════════════════════════════
function PrintSchedule({ data, onClose }) {
  return (
    <div style={S.printBackdrop}>
      <div style={S.printContainer}>
        <div style={S.printHeader}>
          <h1 style={S.printTitle}>ATLAS SUPREME · INVITATIONAL</h1>
          <p style={S.printSubtitle}>{EVENT_DATE} · 4:30 – 6:30 PM · 18 TEAMS</p>
          <button onClick={() => window.print()} style={S.printBtn}>🖨️ PRINT</button>
          <button onClick={onClose} style={S.printCloseBtn}>CLOSE</button>
        </div>
        <table style={S.printTable}>
          <thead><tr>
            <th style={S.printTh}>TIME</th>
            <th style={S.printTh}>TABLE 1</th>
            <th style={S.printTh}>TABLE 2</th>
            <th style={S.printTh}>TABLE 3</th>
          </tr></thead>
          <tbody>
            {SCHEDULE_SLOTS.map((slot, idx) => (
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
  brandBlock: { display: 'flex', flexDirection: 'column', alignItems: 'flex-start' },
  starRow: { display: 'flex', gap: 4, marginBottom: 4 },
  brandTitle: {
    fontFamily: "'Oswald', sans-serif",
    fontSize: 28, fontWeight: 700, letterSpacing: 5, lineHeight: 1, color: T.ivory,
  },
  brandSubtitle: {
    fontFamily: "'Oswald', sans-serif",
    fontSize: 12, fontWeight: 300, letterSpacing: 7, lineHeight: 1, marginTop: 4, color: T.ivory,
  },
  eventLabel: {
    color: T.gold,
    fontFamily: "'Oswald', sans-serif",
    fontSize: 9, fontWeight: 600, letterSpacing: 1.6, marginTop: 8,
  },
  headerActions: { display: 'flex', gap: 6, alignItems: 'center' },
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
  scheduleView: { padding: '12px 12px 16px' },
  scheduleHeader: { padding: '4px 4px 12px' },
  scheduleTitle: {
    fontFamily: "'Oswald', sans-serif", fontSize: 16, fontWeight: 700, letterSpacing: 3, color: T.gold,
  },
  scheduleSub: {
    fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, color: 'rgba(245,238,220,0.7)',
    marginTop: 4, letterSpacing: 0.5,
  },

  tableFilterRow: { display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' },
  tableFilterBtn: {
    flex: 1, minWidth: 70,
    background: 'rgba(212,165,75,0.04)', border: `1px solid ${T.rim}`,
    color: 'rgba(245,238,220,0.6)',
    padding: '6px 8px', borderRadius: 4, cursor: 'pointer',
    fontFamily: "'Oswald', sans-serif", fontSize: 10, fontWeight: 600, letterSpacing: 1.2,
  },
  tableFilterBtnActive: {
    flex: 1, minWidth: 70,
    background: 'rgba(212,165,75,0.18)', border: `1px solid ${T.gold}`,
    color: T.ivory,
    padding: '6px 8px', borderRadius: 4, cursor: 'pointer',
    fontFamily: "'Oswald', sans-serif", fontSize: 10, fontWeight: 600, letterSpacing: 1.2,
  },

  liveBanner: {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '10px 14px', marginBottom: 12,
    background: 'rgba(199,72,74,0.15)', border: `1px solid ${T.red}`, borderRadius: 6,
    animation: 'pulse 2s infinite',
  },
  liveDot: { width: 8, height: 8, borderRadius: '50%', background: T.red, animation: 'pulse 1.5s infinite' },
  liveLabel: {
    fontFamily: "'Oswald', sans-serif", fontSize: 12, fontWeight: 700, letterSpacing: 2.5, color: T.red, flex: 1,
  },
  liveTime: { fontFamily: "'Oswald', sans-serif", fontSize: 13, fontWeight: 700, color: T.ivory },

  upNextBanner: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '10px 14px', marginBottom: 12,
    background: 'rgba(212,165,75,0.12)', border: `1px solid ${T.gold}`, borderRadius: 6,
  },
  upNextLabel: { fontFamily: "'Oswald', sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: 2, color: T.gold },
  upNextTime: { fontFamily: "'Oswald', sans-serif", fontSize: 14, fontWeight: 700, color: T.ivory },

  finishedBanner: {
    padding: '12px 14px', marginBottom: 12,
    background: 'rgba(212,165,75,0.18)', border: `1px solid ${T.gold}`, borderRadius: 6,
    color: T.goldBr,
    fontFamily: "'Oswald', sans-serif", fontSize: 13, fontWeight: 700, letterSpacing: 2, textAlign: 'center',
  },

  timeSlot: {
    display: 'flex', minHeight: 140,
    borderBottom: `1px solid ${T.rim}`,
    background: 'rgba(0,0,0,0.15)',
  },
  timeSlotLive: { background: 'rgba(199,72,74,0.08)', boxShadow: `inset 4px 0 0 ${T.red}` },
  timeSlotPast: { opacity: 0.45 },
  slotTime: {
    width: 84, padding: 12,
    background: T.bgCard,
    borderRight: `1px solid ${T.rim}`,
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2,
    flexShrink: 0,
  },
  slotLiveBadge: {
    background: T.red, color: T.ivory,
    fontFamily: "'Oswald', sans-serif", fontSize: 9, fontWeight: 700, letterSpacing: 1.5,
    padding: '2px 6px', borderRadius: 3, marginBottom: 4,
  },
  slotNextBadge: {
    background: T.gold, color: T.bgDeep,
    fontFamily: "'Oswald', sans-serif", fontSize: 9, fontWeight: 700, letterSpacing: 1.5,
    padding: '2px 6px', borderRadius: 3, marginBottom: 4,
  },
  slotTimeMain: {
    fontFamily: "'Oswald', sans-serif", fontSize: 13, fontWeight: 700, letterSpacing: 1.5,
    color: T.gold, textAlign: 'center', lineHeight: 1.1,
  },
  slotTimeDuration: { fontFamily: "'Barlow Condensed', sans-serif", fontSize: 10, color: 'rgba(245,238,220,0.5)' },
  slotMatches: { flex: 1, display: 'flex', background: T.bgCard },
  slotMatch: { flex: 1, padding: 10, display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center', justifyContent: 'center' },
  slotMatchEmpty: { background: 'rgba(255,255,255,0.03)' },
  tableLabel: { fontFamily: "'Oswald', sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: 1.5, color: T.gold },
  matchEmpty: { fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, color: 'rgba(245,238,220,0.5)', fontStyle: 'italic' },
  matchTeam: { display: 'flex', gap: 6, alignItems: 'center', width: '100%' },
  matchTeamWinner: { color: T.goldBr },
  matchTeamSeed: {
    fontFamily: "'Oswald', sans-serif", fontSize: 11, fontWeight: 700, color: T.gold,
    minWidth: 22, textAlign: 'center',
  },
  matchTeamNames: { display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 },
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
  playersView: { padding: '12px 12px 16px' },
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
  scoreTeamBlock: {
    display: 'flex', flexDirection: 'column', gap: 12,
    padding: 12,
    background: 'rgba(212,165,75,0.04)',
    border: `1px solid ${T.rim}`, borderRadius: 6,
  },
  scoreTeamName: { display: 'flex', gap: 10, alignItems: 'center' },
  scoreTeamSeed: {
    fontFamily: "'Oswald', sans-serif", fontSize: 16, fontWeight: 700, color: T.goldBr,
    minWidth: 36, textAlign: 'center',
    background: 'rgba(212,165,75,0.18)', borderRadius: 4, padding: '4px 8px',
  },
  scoreTeamPlayers: {
    fontFamily: "'Oswald', sans-serif", fontSize: 13, color: T.ivory, lineHeight: 1.3,
  },
  scoreGames: { display: 'flex', flexDirection: 'column', gap: 8 },
  scoreGame: { display: 'flex', alignItems: 'center', gap: 6 },
  gameLabel: { fontFamily: "'Oswald', sans-serif", fontSize: 10, fontWeight: 700, color: T.gold, minWidth: 20 },
  scoreInput: {
    flex: 1, padding: 10,
    background: 'rgba(0,0,0,0.4)', border: `1px solid ${T.rim}`, borderRadius: 4,
    color: T.ivory,
    fontFamily: "'Oswald', sans-serif", fontSize: 18, fontWeight: 700, textAlign: 'center', outline: 'none',
  },
  scoreSep: { color: T.gold, fontWeight: 700, fontSize: 16 },
  scoreWins: {
    fontFamily: "'Oswald', sans-serif", fontSize: 11, fontWeight: 700,
    color: T.goldBr, textAlign: 'center',
    background: 'rgba(212,165,75,0.14)', padding: 4, borderRadius: 4, letterSpacing: 1.5,
  },
  scoreWinnerBanner: {
    padding: '12px 16px', margin: '0 20px',
    background: 'rgba(212,165,75,0.18)', border: `1px solid ${T.gold}`,
    color: T.goldBr,
    fontFamily: "'Oswald', sans-serif", fontSize: 13, fontWeight: 700, textAlign: 'center', letterSpacing: 2,
  },
  scoreActions: { display: 'flex', flexDirection: 'column', gap: 8, padding: '16px 20px', borderTop: `1px solid ${T.rim}` },
  scoreSaveBtn: {
    background: T.gold, color: T.bgDeep, border: 'none',
    borderRadius: 6, padding: '12px 14px', cursor: 'pointer',
    fontFamily: "'Oswald', sans-serif", fontSize: 12, fontWeight: 700, letterSpacing: 1.5,
  },
  forfeitRow: { display: 'flex', gap: 8 },
  forfeitBtn: {
    flex: 1,
    background: 'rgba(199,72,74,0.12)', border: `1px solid ${T.red}`, color: T.red,
    borderRadius: 6, padding: '8px 10px', cursor: 'pointer',
    fontFamily: "'Oswald', sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: 1.2,
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
  statsHeadline: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 16 },
  statsCard: {
    padding: '12px 8px',
    background: 'rgba(212,165,75,0.06)', border: `1px solid ${T.rim}`, borderRadius: 6,
    textAlign: 'center',
  },
  statsCardLabel: { fontFamily: "'Oswald', sans-serif", fontSize: 9, fontWeight: 600, letterSpacing: 1.5, color: T.gold, marginBottom: 4 },
  statsCardValue: { fontFamily: "'Oswald', sans-serif", fontSize: 26, fontWeight: 700, color: T.ivory },
  statsCardSub: { fontFamily: "'Barlow Condensed', sans-serif", fontSize: 10, color: 'rgba(245,238,220,0.5)', marginTop: 2 },

  statsSection: { marginBottom: 18 },
  statsSectionTitle: { fontFamily: "'Oswald', sans-serif", fontSize: 13, fontWeight: 700, letterSpacing: 2, color: T.gold, marginBottom: 8 },
  statsEmpty: { padding: 14, textAlign: 'center', color: 'rgba(245,238,220,0.5)', fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12, background: 'rgba(212,165,75,0.04)', border: `1px solid ${T.rim}`, borderRadius: 6 },

  hotCard: {
    padding: 14,
    background: 'rgba(212,165,75,0.06)', border: `1px solid ${T.rim}`, borderRadius: 6,
    marginBottom: 8,
  },
  hotLabel: { fontFamily: "'Oswald', sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: 2, color: T.gold, marginBottom: 8 },
  hotWin: { fontFamily: "'Oswald', sans-serif", fontSize: 14, color: T.ivory, marginBottom: 4 },
  hotVerb: { fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, color: 'rgba(245,238,220,0.5)', fontStyle: 'italic', marginBottom: 4 },
  hotLose: { fontFamily: "'Oswald', sans-serif", fontSize: 13, color: 'rgba(245,238,220,0.7)' },
  hotSeed: { fontFamily: "'Oswald', sans-serif", fontSize: 9, fontWeight: 700, letterSpacing: 1, color: T.gold, marginLeft: 6, padding: '2px 6px', background: 'rgba(212,165,75,0.18)', borderRadius: 2 },
  hotMeta: { fontFamily: "'Barlow Condensed', sans-serif", fontSize: 10, color: 'rgba(245,238,220,0.5)', marginTop: 6 },
  hotScore: { fontFamily: "'Oswald', sans-serif", fontSize: 12, color: T.goldBr, marginTop: 6 },

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
    minHeight: '100vh', minWidth: '100vw',
    background: `radial-gradient(ellipse at top, ${T.bgMid}, ${T.bgDeep})`,
    color: T.ivory,
    fontFamily: "'Barlow Condensed', sans-serif",
    padding: 24,
    display: 'flex', flexDirection: 'column', gap: 20,
  },
  tvBrandBar: {
    display: 'flex', alignItems: 'center', gap: 24,
    padding: '12px 20px',
    background: 'rgba(0,0,0,0.4)', border: `1px solid ${T.gold}`, borderRadius: 10,
  },
  tvBrandLeft: { display: 'flex', alignItems: 'center', gap: 14, flex: 1 },
  tvStarRow: { display: 'flex', gap: 4 },
  tvBrandTitle: { fontFamily: "'Oswald', sans-serif", fontSize: 28, fontWeight: 700, letterSpacing: 4, color: T.ivory, lineHeight: 1 },
  tvBrandSub: { fontFamily: "'Oswald', sans-serif", fontSize: 11, fontWeight: 600, letterSpacing: 3, color: T.gold, marginTop: 4 },
  tvClock: { fontFamily: "'Oswald', sans-serif", fontSize: 32, fontWeight: 700, color: T.goldBr, letterSpacing: 2 },
  tvExitBtn: {
    background: 'rgba(212,165,75,0.18)', color: T.gold, border: `1px solid ${T.gold}`,
    padding: '8px 16px', borderRadius: 6, cursor: 'pointer',
    fontFamily: "'Oswald', sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: 2,
  },
  tvChampionTakeover: {
    flex: 1, display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center', gap: 12,
    background: `radial-gradient(ellipse at center, rgba(212,165,75,0.25), transparent)`,
  },
  tvChampStars: { display: 'flex', gap: 8, marginBottom: 12 },
  tvChampLabel: { fontFamily: "'Oswald', sans-serif", fontSize: 18, fontWeight: 600, letterSpacing: 6, color: T.gold },
  tvChampNames: { fontFamily: "'Oswald', sans-serif", fontSize: 64, fontWeight: 700, color: T.ivory, textAlign: 'center', lineHeight: 1.1, letterSpacing: 1 },
  tvChampSeed: { fontFamily: "'Oswald', sans-serif", fontSize: 16, fontWeight: 600, letterSpacing: 4, color: T.goldBr, marginTop: 16 },
  tvLiveSection: { background: 'rgba(0,0,0,0.4)', border: `1px solid ${T.red}`, borderRadius: 10, padding: 16 },
  tvSectionHeader: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 },
  tvLiveDot: { width: 12, height: 12, borderRadius: '50%', background: T.red, animation: 'pulse 1.5s infinite' },
  tvLiveLabel: { fontFamily: "'Oswald', sans-serif", fontSize: 14, fontWeight: 700, letterSpacing: 3, color: T.red },
  tvLiveTime: { fontFamily: "'Oswald', sans-serif", fontSize: 16, fontWeight: 700, color: T.ivory, letterSpacing: 1 },
  tvCountdown: { marginLeft: 'auto', fontFamily: "'Oswald', sans-serif", fontSize: 22, fontWeight: 700, color: T.goldBr, letterSpacing: 2 },
  tvUpcomingLabel: { fontFamily: "'Oswald', sans-serif", fontSize: 14, fontWeight: 700, letterSpacing: 3, color: T.gold },
  tvTablesGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 },
  tvTableCard: {
    background: T.bgCard, border: `1px solid ${T.gold}`, borderRadius: 8,
    padding: 14, display: 'flex', flexDirection: 'column', gap: 8,
  },
  tvTableCardEmpty: { borderColor: T.rim, opacity: 0.5 },
  tvTableHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${T.rim}`, paddingBottom: 6 },
  tvTableNum: { fontFamily: "'Oswald', sans-serif", fontSize: 16, fontWeight: 700, letterSpacing: 2, color: T.goldBr },
  tvMatchLabel: { fontFamily: "'Oswald', sans-serif", fontSize: 10, fontWeight: 600, letterSpacing: 1.5, color: T.gold },
  tvTableEmpty: { fontFamily: "'Barlow Condensed', sans-serif", fontSize: 14, color: 'rgba(245,238,220,0.5)', fontStyle: 'italic', textAlign: 'center', padding: 20 },
  tvTeam: { display: 'flex', gap: 10, alignItems: 'center', padding: '6px 0' },
  tvSeed: { fontFamily: "'Oswald', sans-serif", fontSize: 24, fontWeight: 700, color: T.goldBr, minWidth: 32, textAlign: 'center' },
  tvTeamPlayers: { flex: 1, minWidth: 0 },
  tvPlayerName: { fontFamily: "'Oswald', sans-serif", fontSize: 14, fontWeight: 600, color: T.ivory, lineHeight: 1.3, textTransform: 'uppercase', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  tvVsBig: { fontFamily: "'Oswald', sans-serif", fontSize: 11, fontWeight: 600, color: T.gold, letterSpacing: 2, textAlign: 'center' },

  tvUpcomingSection: { background: 'rgba(0,0,0,0.4)', border: `1px solid ${T.rim}`, borderRadius: 10, padding: 16, flex: 1 },
  tvUpcomingList: { display: 'flex', flexDirection: 'column', gap: 6 },
  tvScheduleRow: { display: 'flex', gap: 16, padding: '6px 8px', borderBottom: `1px solid ${T.rim}`, alignItems: 'center' },
  tvScheduleRowPast: { opacity: 0.3 },
  tvScheduleTime: { fontFamily: "'Oswald', sans-serif", fontSize: 13, fontWeight: 700, color: T.gold, minWidth: 100, letterSpacing: 1 },
  tvScheduleTables: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, flex: 1 },
  tvScheduleCol: { display: 'flex', alignItems: 'center', gap: 8 },
  tvScheduleTableLbl: { fontFamily: "'Oswald', sans-serif", fontSize: 9, color: T.gold, opacity: 0.7, minWidth: 22, letterSpacing: 1 },
  tvSchedulePair: { fontFamily: "'Oswald', sans-serif", fontSize: 11, color: T.ivory, letterSpacing: 0.5 },
  tvScheduleWinner: { color: T.goldBr, fontWeight: 700 },
  tvScheduleEmpty: { color: 'rgba(245,238,220,0.3)', fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11 },

  tvTickerStrip: {
    background: 'rgba(0,0,0,0.5)', border: `1px solid ${T.gold}`, borderRadius: 6,
    padding: '8px 0', overflow: 'hidden', whiteSpace: 'nowrap',
  },
  tvTickerText: {
    fontFamily: "'Oswald', sans-serif", fontSize: 14, fontWeight: 600, letterSpacing: 2,
    color: T.goldBr, paddingLeft: '100%',
    animation: 'ticker 60s linear infinite',
  },

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
  desktopWrap:    { overflow: 'hidden', flex: 1, padding: '20px 24px 32px', display: 'flex', flexDirection: 'column' },
  dmcColLabel:    { position: 'absolute', textAlign: 'center', color: T.gold, fontSize: 9, fontFamily: 'Oswald, sans-serif', letterSpacing: 1.5, opacity: 0.6, pointerEvents: 'none' },
  dmc:            { background: T.bgCard, border: `1px solid ${T.rim}`, borderRadius: 7, overflow: 'hidden', display: 'flex', flexDirection: 'column' },
  dmcHeader:      { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '3px 6px', background: T.bgSoft, borderBottom: `1px solid ${T.rim}`, flexShrink: 0 },
  dmcLabel:       { color: T.ivoryDim, fontSize: 9, fontFamily: 'Oswald, sans-serif', letterSpacing: 0.8, opacity: 0.75 },
  dmcBtns:        { display: 'flex', gap: 2 },
  dmcBtn:         { background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 11, padding: '0 2px', opacity: 0.7, lineHeight: 1 },
  dmcSlot:        { display: 'flex', alignItems: 'center', gap: 5, padding: '5px 6px', flex: 1, minHeight: 0 },
  dmcSlotWin:     { background: T.gold },
  dmcSlotChamp:   { background: T.goldGlow },
  dmcSlotLose:    { opacity: 0.4 },
  dmcSlotEmpty:   { display: 'flex', alignItems: 'center', gap: 5, padding: '5px 6px', flex: 1, opacity: 0.3 },
  dmcDivider:     { height: 1, background: T.rim, flexShrink: 0 },
  dmcSeed:        { color: T.gold, fontSize: 11, fontWeight: 700, fontFamily: 'Oswald, sans-serif', minWidth: 14, textAlign: 'center', flexShrink: 0 },
  dmcSeedEmpty:   { color: T.ivoryDim, fontSize: 11, fontFamily: 'Oswald, sans-serif', minWidth: 14, textAlign: 'center', flexShrink: 0 },
  dmcPiTag:       { fontSize: 7, marginLeft: 1, opacity: 0.7 },
  dmcPlayerNames: { display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0, gap: 1 },
  dmcPName:       { color: T.ivory, fontSize: 10, fontFamily: 'Barlow Condensed, sans-serif', fontWeight: 600, lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  dmcNameTbd:     { color: T.ivoryDim, fontSize: 10, fontFamily: 'Barlow Condensed, sans-serif' },

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

@media print {
  body * { visibility: hidden; }
  [data-print-area], [data-print-area] * { visibility: visible; }
}
`;
