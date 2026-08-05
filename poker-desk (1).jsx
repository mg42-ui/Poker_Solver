import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";

/* ============================================================
   ENGINE  — verified against exact enumeration (see notes)
   ============================================================ */

const RANKS = "23456789TJQKA";
const SUITS = "shdc";
const SUIT_GLYPH = ["\u2660", "\u2665", "\u2666", "\u2663"];
const cardRank = (id) => (id / 4) | 0;
const cardSuit = (id) => id % 4;
const cardStr = (id) => RANKS[cardRank(id)] + SUITS[cardSuit(id)];

const CAT = { HIGH: 0, PAIR: 1, TWOPAIR: 2, TRIPS: 3, STRAIGHT: 4, FLUSH: 5, BOAT: 6, QUADS: 7, SF: 8 };
const CAT_NAMES = ["High card", "Pair", "Two pair", "Trips", "Straight", "Flush", "Full house", "Quads", "Straight flush"];

function pack(cat, k) {
  let v = cat;
  for (let i = 0; i < 5; i++) v = v * 15 + (k[i] === undefined ? 0 : k[i] + 2);
  return v;
}

function straightHigh(present) {
  let run = 0;
  for (let r = 12; r >= 0; r--) {
    if (present[r]) { run++; if (run >= 5) return r + 4; } else run = 0;
  }
  if (present[12] && present[3] && present[2] && present[1] && present[0]) return 3;
  return -1;
}

function evaluate(cards) {
  const rc = new Int8Array(13), sc = new Int8Array(4);
  for (let i = 0; i < cards.length; i++) { rc[(cards[i] / 4) | 0]++; sc[cards[i] % 4]++; }
  let flushSuit = -1;
  for (let s = 0; s < 4; s++) if (sc[s] >= 5) { flushSuit = s; break; }
  if (flushSuit >= 0) {
    const fp = new Array(13).fill(false), franks = [];
    for (let i = 0; i < cards.length; i++) {
      if (cards[i] % 4 === flushSuit) { const r = (cards[i] / 4) | 0; fp[r] = true; franks.push(r); }
    }
    const sfh = straightHigh(fp);
    if (sfh >= 0) return pack(CAT.SF, [sfh]);
    franks.sort((a, b) => b - a);
    return pack(CAT.FLUSH, franks.slice(0, 5));
  }
  let quad = -1; const trips = [], pairs = [];
  for (let r = 12; r >= 0; r--) {
    if (rc[r] === 4) { if (quad < 0) quad = r; }
    else if (rc[r] === 3) trips.push(r);
    else if (rc[r] === 2) pairs.push(r);
  }
  if (quad >= 0) {
    let k = -1;
    for (let r = 12; r >= 0; r--) if (r !== quad && rc[r] > 0) { k = r; break; }
    return pack(CAT.QUADS, [quad, k]);
  }
  if (trips.length >= 2) return pack(CAT.BOAT, [trips[0], trips[1]]);
  if (trips.length === 1 && pairs.length >= 1) return pack(CAT.BOAT, [trips[0], pairs[0]]);
  const present = new Array(13);
  for (let r = 0; r < 13; r++) present[r] = rc[r] > 0;
  const sh = straightHigh(present);
  if (sh >= 0) return pack(CAT.STRAIGHT, [sh]);
  if (trips.length === 1) {
    const k = [];
    for (let r = 12; r >= 0 && k.length < 2; r--) if (r !== trips[0] && rc[r] > 0) k.push(r);
    return pack(CAT.TRIPS, [trips[0], k[0], k[1]]);
  }
  if (pairs.length >= 2) {
    let k = -1;
    for (let r = 12; r >= 0; r--) if (r !== pairs[0] && r !== pairs[1] && rc[r] > 0) { k = r; break; }
    return pack(CAT.TWOPAIR, [pairs[0], pairs[1], k]);
  }
  if (pairs.length === 1) {
    const k = [];
    for (let r = 12; r >= 0 && k.length < 3; r--) if (r !== pairs[0] && rc[r] > 0) k.push(r);
    return pack(CAT.PAIR, [pairs[0], k[0], k[1], k[2]]);
  }
  const k = [];
  for (let r = 12; r >= 0 && k.length < 5; r--) if (rc[r] > 0) k.push(r);
  return pack(CAT.HIGH, k);
}

const categoryOf = (score) => Math.floor(score / Math.pow(15, 5));
function handName(score) {
  const c = categoryOf(score);
  if (c === CAT.SF && Math.floor(score / Math.pow(15, 4)) % 15 - 2 === 12) return "Royal flush";
  return CAT_NAMES[c];
}

const RANKED_SEED = ("AA KK QQ JJ AKs TT AQs AKo 99 AJs KQs 88 ATs AQo KJs 77 QJs KTs AJo A9s JTs KQo A8s QTs 66 " +
  "A7s K9s T9s ATo A5s A6s Q9s J9s KJo 55 A4s QJo T8s K8s A3s 98s J8s JTo K7s A2s 44 Q8s KTo 87s T7s 97s " +
  "K6s QTo 33 K5s 76s J7s 86s Q7s A9o 22 K4s 65s T9o 96s Q6s J9o K3s 75s 54s Q5s K2s 85s T6s A8o 64s Q4s " +
  "98o J6s 53s 95s Q3s K9o T8o Q2s 43s 74s J5s 87o T5s J4s 63s 97o A7o J3s 84s 42s 76o T4s A5o J2s 52s 32s " +
  "86o T3s 93s A6o K8o 65o 62s T2s Q9o 73s 92s A4o 96o 75o 82s Q8o 54o J8o A3o 83s 64o 85o T7o J7o 72s A2o " +
  "K7o 53o 95o 74o 43o Q7o 63o K6o 94s T6o 84o J6o 52o Q6o K5o 73o 32o 42o 62o 93o J5o 83o T5o K4o Q5o 82o " +
  "72o 92o J4o K3o 94o Q4o T4o J3o K2o Q3o T3o J2o Q2o T2o").trim().split(/\s+/);

function allHandCodes() {
  const out = new Set();
  for (let i = 12; i >= 0; i--) for (let j = 12; j >= 0; j--) {
    if (i === j) out.add(RANKS[i] + RANKS[j]);
    else if (i > j) out.add(RANKS[i] + RANKS[j] + "s");
    else out.add(RANKS[j] + RANKS[i] + "o");
  }
  return [...out];
}
const RANKING = (() => {
  const seen = new Set(), list = [];
  for (const h of RANKED_SEED) if (!seen.has(h)) { seen.add(h); list.push(h); }
  for (const h of allHandCodes()) if (!seen.has(h)) { seen.add(h); list.push(h); }
  return list;
})();
const combosOf = (c) => (c.length === 2 ? 6 : c[2] === "s" ? 4 : 12);
const HAND_PCT = (() => {
  const m = {}; let cum = 0;
  for (const h of RANKING) { cum += combosOf(h); m[h] = cum / 1326; }
  return m;
})();
const HAND_INDEX = (() => { const m = {}; RANKING.forEach((h, i) => (m[h] = i)); return m; })();

function codeForHoleCards(a, b) {
  let r1 = cardRank(a), r2 = cardRank(b);
  const suited = cardSuit(a) === cardSuit(b);
  if (r1 < r2) { const t = r1; r1 = r2; r2 = t; }
  if (r1 === r2) return RANKS[r1] + RANKS[r2];
  return RANKS[r1] + RANKS[r2] + (suited ? "s" : "o");
}
const ALL_COMBOS = (() => {
  const out = [];
  for (let i = 0; i < 52; i++) for (let j = i + 1; j < 52; j++) out.push([i, j, codeForHoleCards(i, j)]);
  return out;
})();
const rangeCombos = (pct) => ALL_COMBOS.filter((c) => HAND_PCT[c[2]] <= pct);

/* Does this holding have a real draw the hole cards contribute to? */
function drawStrength(hole, board) {
  if (board.length < 3 || board.length >= 5) return 0;
  const all = [hole[0], hole[1], ...board];
  const sc = [0, 0, 0, 0], scH = [0, 0, 0, 0];
  for (const c of all) sc[cardSuit(c)]++;
  for (const c of hole) scH[cardSuit(c)]++;
  let d = 0;
  for (let s = 0; s < 4; s++) if (sc[s] === 4 && scH[s] >= 1) d = Math.max(d, 0.85);
  const rp = new Array(13).fill(false), rpB = new Array(13).fill(false);
  for (const c of all) rp[cardRank(c)] = true;
  for (const c of board) rpB[cardRank(c)] = true;
  for (let hi = 12; hi >= 3; hi--) {
    let cnt = 0, cntB = 0;
    for (let k = 0; k < 5; k++) {
      const r = hi - k; if (r < 0) continue;
      if (rp[r]) cnt++; if (rpB[r]) cntB++;
    }
    if (cnt === 4 && cnt > cntB) d = Math.max(d, 0.68);
  }
  return d;
}

/* An opponent's range is their preflop range REWEIGHTED by how each holding
   actually connects with this board and by the action they took. A player who
   bets is polarised toward hands that hit plus some air; a player who calls is
   condensed around medium strength. Ignoring this was the single biggest
   source of error in the old model. */
const ACTION_WEIGHT = {
  bet: (s) => Math.pow(s, 3.4) + 0.095,
  raise: (s) => Math.pow(s, 5) + 0.07,
  "3bet": (s) => Math.pow(s, 7) + 0.05,
  call: (s) => Math.exp(-Math.pow(s - 0.6, 2) / 0.0648) + 0.05,
};

function buildRange(dead, board, pct, action) {
  const pool = [];
  for (const c of ALL_COMBOS) {
    if (dead[c[0]] || dead[c[1]]) continue;
    if (HAND_PCT[c[2]] > pct) continue;
    pool.push({ a: c[0], b: c[1] });
  }
  if (!pool.length) {
    for (const c of ALL_COMBOS) if (!dead[c[0]] && !dead[c[1]]) pool.push({ a: c[0], b: c[1] });
  }
  const f = ACTION_WEIGHT[action];
  if (board.length < 3 || !f) {
    if (board.length < 3) return pool.map((p) => ({ a: p.a, b: p.b, w: 1, str: 1 - HAND_PCT[codeForHoleCards(p.a, p.b)] }));
    const sc0 = pool.map((p) => ({ a: p.a, b: p.b, sc: evaluate([p.a, p.b, ...board]), d: drawStrength([p.a, p.b], board) }));
    const o0 = [...sc0].sort((x, y) => x.sc - y.sc);
    const dn = Math.max(1, o0.length - 1);
    for (let i = 0; i < o0.length; i++) o0[i].pctl = i / dn;
    return sc0.map((p) => ({ a: p.a, b: p.b, w: 1, str: Math.min(1, p.pctl + p.d * 0.3) }));
  }

  const scored = pool.map((p) => ({
    a: p.a, b: p.b,
    sc: evaluate([p.a, p.b, ...board]),
    d: drawStrength([p.a, p.b], board),
  }));
  const order = [...scored].sort((x, y) => x.sc - y.sc);
  const denom = Math.max(1, order.length - 1);
  for (let i = 0; i < order.length; i++) order[i].pctl = i / denom;
  return scored.map((p) => {
    const str = Math.min(1, p.pctl + p.d * 0.3);
    return { a: p.a, b: p.b, w: f(str), str };
  });
}

function makeRng(seed) {
  let s = (seed >>> 0) || 88675123;
  return function () {
    s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

/* Incremental Monte Carlo so the readout converges live instead of freezing. */
function createSim(hero, board, opponents, seed) {
  const rng = makeRng(seed);
  const nOpp = opponents.length;
  const dead = new Uint8Array(52);
  for (const c of hero) dead[c] = 1;
  for (const c of board) dead[c] = 1;
  const pools = opponents.map((o) => {
    const r = o.pool || buildRange(dead, board, Math.max(0.02, Math.min(1, o.pct)), o.action);
    const cum = new Float64Array(r.length);
    let t = 0;
    for (let i = 0; i < r.length; i++) { t += r[i].w; cum[i] = t; }
    return { r, cum, total: t };
  });
  function drawFrom(pool, rng) {
    const x = rng() * pool.total;
    let lo = 0, hi = pool.cum.length - 1;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (pool.cum[mid] < x) lo = mid + 1; else hi = mid; }
    return pool.r[lo];
  }
  const acc = { win: 0, tie: 0, lose: 0, n: 0, dist: new Float64Array(9) };
  const used = new Uint8Array(52);
  const oppHands = new Array(nOpp);
  const runBoard = new Array(5);
  const need = 5 - board.length;


  function run(iters) {
    let done = 0, guard = 0;
    while (done < iters && guard < iters * 40) {
      guard++;
      used.set(dead);
      let ok = true;
      for (let o = 0; o < nOpp; o++) {
        const pool = pools[o];
        let picked = null;
        for (let t = 0; t < 40; t++) {
          const c = drawFrom(pool, rng);
          if (!used[c.a] && !used[c.b]) { picked = c; break; }
        }
        if (!picked) { ok = false; break; }
        used[picked.a] = 1; used[picked.b] = 1;
        oppHands[o] = picked;
      }
      if (!ok) continue;
      for (let i = 0; i < board.length; i++) runBoard[i] = board[i];
      for (let i = 0; i < need; i++) {
        let c;
        do { c = (rng() * 52) | 0; } while (used[c]);
        used[c] = 1;
        runBoard[board.length + i] = c;
      }
      const hs = evaluate([hero[0], hero[1], ...runBoard]);
      acc.dist[categoryOf(hs)]++;
      let best = hs, tied = 1, beaten = false;
      for (let o = 0; o < nOpp; o++) {
        const s = evaluate([oppHands[o].a, oppHands[o].b, ...runBoard]);
        if (s > best) { beaten = true; break; }
        if (s === best) tied++;
      }
      if (beaten) acc.lose++;
      else if (tied > 1) acc.tie += 1 / tied;
      else acc.win++;
      acc.n++; done++;
    }
    const n = acc.n || 1;
    const eq = (acc.win + acc.tie) / n;
    let strong = 0;
    for (let c = CAT.TRIPS; c <= CAT.SF; c++) strong += acc.dist[c];
    return {
      win: acc.win / n, tie: acc.tie / n, lose: acc.lose / n,
      equity: eq, n: acc.n,
      dist: Array.from(acc.dist, (x) => x / n),
      strong: strong / n,
      se: Math.sqrt(Math.max(eq * (1 - eq), 1e-9) / n),
    };
  }
  return { run };
}

/* The strongest `frac` of a range by weight - i.e. what continues against a bet. */
function continuingRange(range, frac) {
  const sorted = [...range].sort((x, y) => y.str - x.str);
  const total = sorted.reduce((a, p) => a + p.w, 0);
  const want = total * Math.max(0.02, Math.min(1, frac));
  const out = [];
  let acc = 0;
  for (const p of sorted) { if (acc >= want) break; out.push(p); acc += p.w; }
  return out.length ? out : [sorted[0]];
}

/* How much to bet or raise, chosen by expected value rather than by rule of thumb.
   For each candidate size we work out how much of their range can profitably
   continue (minimum defence frequency, bent by how much they actually fold),
   then measure our equity against ONLY that continuing range - which is stronger
   than their whole range. Bigger bets win the pot more often but run into a
   better range when called; this finds where that trade-off peaks. */
function sizingAdvice({ hero, board, dead, opponents, pot, toCall, stack, iters = 5000 }) {
  if (board.length < 3 && board.length !== 0) return null;
  const P = pot, C = toCall;
  const room = Math.max(0, stack - C);
  if (room <= 0) return null;

  const fracs = C > 0 ? [0.5, 0.75, 1.0] : [0.25, 0.33, 0.5, 0.66, 1.0, 1.5];
  const cands = fracs.map((f) => ({ f, R: C + f * (P + C) }));
  cands.push({ f: null, R: stack, allin: true });

  const ranges = opponents.map((o) =>
    o.pool || buildRange(dead, board, Math.max(0.02, Math.min(1, o.pct)), o.action === "none" ? "call" : o.action)
  );

  const out = [];
  const seen = new Set();
  for (const cd of cands) {
    const R = Math.min(cd.R, stack);
    if (R <= C || R < 0.02) continue;
    const key = R.toFixed(2);
    if (seen.has(key)) continue;
    seen.add(key);

    // their price to call, and the share of range that should defend
    const X = R - C;
    const Y = P + R;
    const mdf = Y / (Y + X);
    let foldAll = 1;
    const pools = [];
    for (let i = 0; i < opponents.length; i++) {
      const el = opponents[i].elasticity ?? 1;
      const defend = Math.max(0.05, Math.min(1, mdf * el));
      foldAll *= 1 - defend;
      pools.push({ pool: continuingRange(ranges[i], defend) });
    }
    const eq = createSim(hero, board, pools, 7000 + Math.round(R * 13)).run(iters).equity;
    const ev = foldAll * P + (1 - foldAll) * (eq * (P + R - C) - (1 - eq) * R);
    out.push({ size: R, frac: cd.f, allin: !!cd.allin, foldPct: foldAll, eqIfCalled: eq, ev });
  }
  if (!out.length) return null;
  out.sort((a, b) => b.ev - a.ev);
  return { best: out[0], all: out.sort((a, b) => a.size - b.size) };
}

/* If a call is losing right now, how much more must we win later to justify it? */
function impliedNeed(eq, pot, toCall) {
  const ev = eq * pot - (1 - eq) * toCall;
  if (ev >= 0 || eq <= 0.001) return null;
  return -ev / eq;
}

/* ============================================================
   POKER MATH HELPERS
   ============================================================ */

const requiredEquity = (pot, toCall) => (toCall <= 0 ? 0 : toCall / (pot + toCall));
const evCall = (eq, pot, toCall) => eq * pot - (1 - eq) * toCall;
// bet B into pot-before-bet P must work this often as a pure bluff
const bluffBreakeven = (P, B) => (B <= 0 ? 0 : B / (P + B));
const mdf = (P, B) => (B <= 0 ? 1 : P / (P + B));

/* Raise sizing. The amount you RAISE TO, when the pot already contains their
   bet, is: toCall + f x (pot + toCall). At f = 1 that is a true pot-sized
   raise -- pot + 2 x toCall -- which is the number most players get wrong,
   usually by raising far too small. */
const raiseTo = (f, pot, toCall) => toCall + f * (pot + toCall);
const betSize = (f, pot) => f * pot;

/* How often they must fold for this to profit, given that you still have
   equity on the times you get called. Returns 0 if it is already +EV
   without any folds at all. */
function foldNeeded(risk, potWon, eq) {
  const whenCalled = eq * (potWon + risk) - (1 - eq) * risk;
  if (whenCalled >= 0) return 0;
  return whenCalled / (whenCalled - potWon);
}

function sizingOptions({ eq, pot, toCall, stack, wet, nOpp }) {
  const facing = toCall > 0;
  const raw = facing
    ? [
        { label: "Min raise", amt: 2 * toCall, why: "Cheap, but gives them a great price to continue." },
        { label: "Half pot", amt: raiseTo(0.5, pot, toCall), why: "Standard value raise. Folds out air, keeps worse hands in." },
        { label: "Pot raise", amt: raiseTo(1, pot, toCall), why: "Charges draws the maximum. Polarising \u2014 they fold everything weak." },
        { label: "All in", amt: stack, why: "No further decisions. Best when the pot is already large relative to stacks." },
      ]
    : [
        { label: "\u2153 pot", amt: betSize(1 / 3, pot), why: "Keeps their weak hands in on a dry board." },
        { label: "\u00bd pot", amt: betSize(0.5, pot), why: "The default. Builds a pot without folding out worse." },
        { label: "\u00be pot", amt: betSize(0.75, pot), why: "Charges draws properly on a wet board." },
        { label: "All in", amt: stack, why: "Maximum pressure, no turn or river to navigate." },
      ];

  const opts = raw.map((o) => {
    const amt = Math.min(o.amt, stack);
    const potIfCalled = facing ? pot + amt + Math.max(0, amt - toCall) : pot + 2 * amt;
    return {
      ...o, amt,
      allIn: amt >= stack - 1e-9,
      committed: amt >= stack * 0.33,
      potIfCalled,
      foldPct: foldNeeded(amt, pot, eq),
      evIfCalled: eq * (pot + amt) - (1 - eq) * amt,
    };
  });

  // Which one to lead with.
  let pick;
  if (eq >= 0.8) pick = wet > 55 ? 2 : 1;
  else if (eq >= 0.62) pick = wet > 55 ? 2 : 1;
  else if (eq >= 0.5) pick = facing ? 1 : 1;
  else if (eq >= 0.35) pick = 0;
  else pick = facing ? 1 : 2;                 // semi-bluff wants fold equity
  if (nOpp > 2 && eq < 0.6) pick = Math.max(0, pick - 1);   // bluff less multiway
  // if the raise would leave a stub behind, just move in
  if (stack - opts[pick].amt < opts[pick].amt * 0.75) pick = 3;
  opts[Math.min(pick, opts.length - 1)].best = true;
  return opts;
}

function boardTexture(board) {
  if (board.length < 3) return null;
  const sc = [0, 0, 0, 0], rc = new Array(13).fill(0);
  for (const c of board) { sc[cardSuit(c)]++; rc[cardRank(c)]++; }
  const maxSuit = Math.max(...sc);
  const paired = rc.some((x) => x >= 2);
  const trips = rc.some((x) => x >= 3);
  const ranks = board.map(cardRank).sort((a, b) => b - a);
  let straightish = 0;
  for (let hi = 12; hi >= 3; hi--) {
    let cnt = 0;
    for (let k = 0; k < 5; k++) { const r = hi - k; if (r >= 0 && rc[r] > 0) cnt++; }
    if (cnt >= 3) straightish = Math.max(straightish, cnt);
  }
  let wet = 0;
  if (maxSuit >= 3) wet += 40; else if (maxSuit === 2) wet += 14;
  if (straightish >= 4) wet += 32; else if (straightish === 3) wet += 18;
  if (paired) wet += 12;
  if (ranks[0] >= 10) wet += 8;
  wet = Math.min(100, wet);
  const tags = [];
  if (maxSuit >= 5) tags.push("flush on board");
  else if (maxSuit >= 3) tags.push("flush possible");
  else if (maxSuit === 2) tags.push("backdoor flush");
  if (trips) tags.push("trips on board");
  else if (paired) tags.push("paired");
  if (straightish >= 4) tags.push("straight possible");
  else if (straightish === 3) tags.push("connected");
  if (ranks[0] <= 8) tags.push("low board");
  if (!tags.length) tags.push("dry / disconnected");
  return { wet, tags, maxSuit, paired };
}

/* Bayesian shrinkage: small samples pulled toward population priors, so
   3 observed hands never reads as "nit". k = pseudo-count weight. */
function shrink(observed, n, prior, k) {
  return (observed + prior * k) / (n + k);
}
const PRIOR = { vpip: 0.26, pfr: 0.18, af: 2.0, foldCbet: 0.5 };
const K = 14;

function villainStats(v) {
  const n = Math.max(0, v.hands || 0);
  const vpip = shrink(v.vpipCount || 0, n, PRIOR.vpip, K);
  const pfr = shrink(v.pfrCount || 0, n, PRIOR.pfr, K);
  const aggr = (v.aggAct || 0), pass = (v.passAct || 0);
  const af = (aggr + PRIOR.af * 6) / Math.max(1, pass + 6);
  const fcN = v.cbetFaced || 0;
  const foldCbet = shrink(v.cbetFolded || 0, fcN, PRIOR.foldCbet, 8);
  const conf = n / (n + K);
  let tag = "unread", tagNote = "not enough hands yet";
  if (n >= 8) {
    if (vpip < 0.17 && pfr < 0.13) { tag = "nit"; tagNote = "folds a lot — respect their raises, steal relentlessly"; }
    else if (vpip < 0.26 && pfr / Math.max(vpip, 0.01) > 0.6) { tag = "TAG"; tagNote = "tight-aggressive — solid, avoid marginal spots"; }
    else if (vpip > 0.42 && af > 2.6) { tag = "maniac"; tagNote = "bets everything — widen calls, let them bluff into you"; }
    else if (vpip > 0.4 && pfr / Math.max(vpip, 0.01) < 0.4) { tag = "station"; tagNote = "calls too much — value bet thin, never bluff"; }
    else if (vpip > 0.3 && af > 2.2) { tag = "LAG"; tagNote = "loose-aggressive — call down lighter"; }
    else { tag = "reg"; tagNote = "balanced-ish — play straightforward"; }
  }
  return { n, vpip, pfr, af, foldCbet, conf, tag, tagNote };
}

const ACTION_TIGHTEN = { none: 1, call: 0.8, bet: 0.62, raise: 0.34, "3bet": 0.16 };

function rangeForOpponent(v, action, street) {
  const s = v ? villainStats(v) : { vpip: PRIOR.vpip, conf: 0 };
  let pct = s.vpip;
  // Preflop there is no board, so aggression can only narrow the range numerically.
  // Postflop the board-aware reweighting in buildRange does that work instead,
  // so we only widen slightly to avoid tightening twice.
  if (street === 0) pct *= ACTION_TIGHTEN[action] ?? 1;
  else pct *= (0.5 + 0.5 * (ACTION_TIGHTEN[action] ?? 1));
  return Math.max(0.02, Math.min(1, pct));
}

/* Position-based raise-first-in thresholds (6-max, as fraction of all hands) */
const RFI = { UTG: 0.16, MP: 0.2, CO: 0.28, BTN: 0.45, SB: 0.42, BB: 0.3 };
const POSITIONS = ["UTG", "MP", "CO", "BTN", "SB", "BB"];

/* ============================================================
   STORAGE
   ============================================================ */
const mem = {};
const store = {
  async get(key, fb) {
    try { const r = await window.storage.get(key); return r && r.value ? JSON.parse(r.value) : (mem[key] ?? fb); }
    catch { return mem[key] ?? fb; }
  },
  async set(key, val) {
    mem[key] = val;
    try { await window.storage.set(key, JSON.stringify(val)); return true; } catch { return false; }
  },
};

/* ============================================================
   UI PRIMITIVES
   ============================================================ */

function Card({ id, size = "md", onClick, dim }) {
  if (id === null || id === undefined) {
    return <button className={`card slot ${size}`} onClick={onClick} aria-label="Empty card slot">+</button>;
  }
  const r = RANKS[cardRank(id)], s = cardSuit(id);
  const red = s === 1 || s === 2;
  return (
    <button className={`card ${size} ${red ? "red" : "black"} ${dim ? "dim" : ""}`} onClick={onClick}
      aria-label={`${r} of ${["spades", "hearts", "diamonds", "clubs"][s]}`}>
      <span className="cr">{r}</span><span className="cs">{SUIT_GLYPH[s]}</span>
    </button>
  );
}

function Stat({ label, value, sub, tone }) {
  return (
    <div className="stat">
      <div className="stat-l">{label}</div>
      <div className={`stat-v ${tone || ""}`}>{value}</div>
      {sub && <div className="stat-s">{sub}</div>}
    </div>
  );
}

function Num({ label, value, onChange, step = 1, suffix }) {
  return (
    <label className="numf">
      <span>{label}</span>
      <div className="numf-in">
        <input type="number" value={value} step={step} min={0}
          onChange={(e) => onChange(Math.max(0, parseFloat(e.target.value) || 0))} />
        {suffix && <em>{suffix}</em>}
      </div>
    </label>
  );
}

/* ============================================================
   CARD PICKER
   ============================================================ */
/* ============================================================
   MAIN
   ============================================================ */

const SLOT_LABELS = ["card 1", "card 2", "flop", "flop", "flop", "turn", "river"];

const fmt = (n) => (n >= 100 ? n.toFixed(0) : n >= 10 ? n.toFixed(1) : n.toFixed(2));

const STREETS = [
  { key: "pre", name: "Preflop", cards: 0, note: "2 cards, no board" },
  { key: "flop", name: "Flop", cards: 3, note: "3 board cards" },
  { key: "turn", name: "Turn", cards: 4, note: "4th card" },
  { key: "river", name: "River", cards: 5, note: "5th card" },
];

export default function PokerDesk() {
  const [tab, setTab] = useState("table");
  const [typed, setTyped] = useState("");
  const [hole, setHole] = useState([null, null]);
  const [board, setBoard] = useState([null, null, null, null, null]);
  const [nPlayers, setNPlayers] = useState(3);
  const [position, setPosition] = useState("BTN");
  const [pot, setPot] = useState(10);
  const [toCall, setToCall] = useState(4);
  const [stack, setStack] = useState(100);
  const [bb, setBB] = useState(1);
  const [sim, setSim] = useState(null);
  const [scan, setScan] = useState(null);
  const [scanning, setScanning] = useState(false);

  const [villains, setVillains] = useState([]);
  const [seats, setSeats] = useState([]); // [{villainId, action}]
  const [sessions, setSessions] = useState([]);
  const [hands, setHands] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [sigma, setSigma] = useState(90);

  /* ---- persistence ---- */
  useEffect(() => {
    (async () => {
      const d = await store.get("poker:data", null);
      if (d) {
        setVillains(d.villains || []);
        setSessions(d.sessions || []);
        setHands(d.hands || []);
        if (d.sigma) setSigma(d.sigma);
      }
      setLoaded(true);
    })();
  }, []);
  useEffect(() => {
    if (!loaded) return;
    store.set("poker:data", { villains, sessions, hands, sigma });
  }, [villains, sessions, hands, sigma, loaded]);

  /* ---- seats follow player count ---- */
  useEffect(() => {
    setSeats((prev) => {
      const want = nPlayers - 1;
      const next = prev.slice(0, want);
      while (next.length < want) next.push({ villainId: null, action: "none", folded: false });
      return next;
    });
  }, [nPlayers]);

  // Slot order is simply the order you enter cards: 2 hole, then up to 5 board.
  const slots = [hole[0], hole[1], ...board];
  const nextSlot = slots.findIndex((c) => c === null);
  const filled = slots.filter((c) => c !== null).length;
  const knownBoard = board.filter((c) => c !== null);
  const usedCards = slots.filter((c) => c !== null);
  const heroReady = hole[0] !== null && hole[1] !== null;
  // The street is whatever the board says it is - no separate control to touch.
  const street = knownBoard.length >= 5 ? 3 : knownBoard.length === 4 ? 2 : knownBoard.length >= 3 ? 1 : 0;
  const boardReady = [0, 3, 4, 5].includes(knownBoard.length);
  // cards must be contiguous: no gaps between entered board cards
  const contiguous = board.every((c, i) => (c === null) === (i >= knownBoard.length));
  const ready = heroReady && boardReady && contiguous;

  const setSlot = (i, id) => {
    if (i < 2) setHole((h) => h.map((c, j) => (j === i ? id : c)));
    else setBoard((b) => b.map((c, j) => (j === i - 2 ? id : c)));
  };
  const addCard = (id) => { if (nextSlot >= 0) setSlot(nextSlot, id); };
  const undo = () => { if (filled > 0) setSlot(filled - 1, null); };
  const parseTyped = (txt) => {
    const clean = txt.replace(/[^0-9a-zA-Z]/g, "").toUpperCase();
    const ids = [];
    for (let i = 0; i + 1 < clean.length; i += 2) {
      const r = RANKS.indexOf(clean[i]);
      const su = SUITS.indexOf(clean[i + 1].toLowerCase());
      if (r < 0 || su < 0) return null;
      const id = r * 4 + su;
      if (ids.includes(id)) return null;
      ids.push(id);
    }
    return ids.length ? ids : null;
  };
  const applyTyped = () => {
    const ids = parseTyped(typed);
    if (!ids) return;
    setHole([ids[0] ?? null, ids[1] ?? null]);
    setBoard([0, 1, 2, 3, 4].map((i) => ids[i + 2] ?? null));
    setTyped("");
  };

  const opponents = useMemo(
    () => seats.filter((s) => !s.folded).map((s) => ({
      pct: rangeForOpponent(villains.find((v) => v.id === s.villainId), s.action, street),
      action: s.action,
    })),
    [seats, villains, street]
  );

  /* ---- live convergent simulation ---- */
  const simRef = useRef(0);
  useEffect(() => {
    const token = ++simRef.current;
    if (!ready) { setSim(null); return; }
    setScan(null);
    const engine = createSim(hole, knownBoard, opponents, 0x9e37 + street * 7717 + (hole[0] || 0) * 131);
    const TARGET = 80000, SLICE = 8000;
    let acc = null;
    const tick = () => {
      if (simRef.current !== token) return;
      acc = engine.run(SLICE);
      setSim(acc);
      if (acc.n < TARGET) setTimeout(tick, 0);
    };
    setTimeout(tick, 0);
    return () => { simRef.current++; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hole[0], hole[1], board.join(","), street, JSON.stringify(opponents), ready]);

  /* ---- derived math ---- */
  const eq = sim ? sim.equity : 0;
  const req = requiredEquity(pot, toCall);
  const ev = evCall(eq, pot, toCall);
  const potBefore = Math.max(0.01, pot - toCall);
  const spr = pot > 0 ? stack / pot : 0;
  const texture = boardTexture(knownBoard);
  const madeHand = ready && knownBoard.length >= 3 ? handName(evaluate([...hole, ...knownBoard])) : null;
  const preCode = heroReady ? codeForHoleCards(hole[0], hole[1]) : null;
  const prePct = preCode ? HAND_PCT[preCode] : null;
  const preRank = preCode ? HAND_INDEX[preCode] + 1 : null;

  const nOppActive = opponents.length;

  const sizing = useMemo(() => {
    if (!sim) return null;
    return sizingOptions({
      eq, pot, toCall, stack,
      wet: texture ? texture.wet : 25,
      nOpp: nOppActive,
    });
  }, [sim, eq, pot, toCall, stack, texture, nOppActive]);

  const verdict = useMemo(() => {
    if (!sim) return null;
    const edge = eq - req;
    const reasons = [];
    let action, tone, size = null;

    if (toCall <= 0) {
      // we can check or bet
      const strong = eq > 0.62, medium = eq > 0.45;
      const wetness = texture ? texture.wet : 0;
      if (strong) {
        action = "BET FOR VALUE";
        tone = "good";
        const frac = wetness > 55 ? 0.75 : eq > 0.8 ? 0.66 : 0.5;
        size = potBefore * frac;
        reasons.push(`You are ahead ${(eq * 100).toFixed(1)}% of the time — worse hands can still pay you.`);
        reasons.push(wetness > 55 ? "Wet board: size up to charge draws." : "Dry board: a smaller bet keeps their weak hands in.");
      } else if (medium) {
        action = "CHECK";
        tone = "neutral";
        reasons.push("Marginal equity — showdown value without a clear value target.");
        reasons.push("Betting mostly folds out worse and gets called by better.");
      } else {
        const fe = bluffBreakeven(potBefore, potBefore * 0.6);
        action = eq < 0.2 && nOppActive === 1 ? "BLUFF OR CHECK" : "CHECK / FOLD";
        tone = "bad";
        size = eq < 0.2 && nOppActive === 1 ? potBefore * 0.6 : null;
        reasons.push(`Low equity (${(eq * 100).toFixed(1)}%). A 60%-pot bluff needs them to fold ${(fe * 100).toFixed(0)}% of the time.`);
        if (nOppActive > 1) reasons.push(`${nOppActive} opponents \u2014 bluffs need every one of them to fold, which compounds against you.`);
      }
    } else {
      if (edge > 0.15 && eq > 0.6) {
        action = "RAISE";
        tone = "good";
        size = (pot + toCall) * 0.7;
        reasons.push(`Equity ${(eq * 100).toFixed(1)}% vs ${(req * 100).toFixed(1)}% needed — a big edge. Calling leaves money behind.`);
      } else if (edge > 0.02) {
        action = "CALL";
        tone = "good";
        reasons.push(`You need ${(req * 100).toFixed(1)}% to break even and you have ${(eq * 100).toFixed(1)}%.`);
        reasons.push(`Each call like this is worth ${ev >= 0 ? "+" : ""}${(ev / bb).toFixed(2)} bb on average.`);
      } else if (edge > -0.04) {
        action = "MARGINAL — CALL OR FOLD";
        tone = "neutral";
        reasons.push("Essentially break-even. Position, implied odds, and how well you know them decide it.");
        if (spr > 4 && street < 3) reasons.push("Deep stacks and cards to come favour continuing with draws.");
      } else {
        action = "FOLD";
        tone = "bad";
        reasons.push(`You need ${(req * 100).toFixed(1)}% but only have ${(eq * 100).toFixed(1)}%.`);
        reasons.push(`Calling costs ${(ev / bb).toFixed(2)} bb every time you do it.`);
      }
    }

    if (street === 0 && prePct !== null) {
      const thr = RFI[position];
      if (toCall <= 0 || toCall <= bb) {
        reasons.unshift(prePct <= thr
          ? `${preCode} is in the top ${(prePct * 100).toFixed(0)}% — inside a standard ${position} opening range (${(thr * 100).toFixed(0)}%).`
          : `${preCode} is top ${(prePct * 100).toFixed(0)}%, outside a standard ${position} open (${(thr * 100).toFixed(0)}%). Folding is fine.`);
      } else {
        reasons.unshift(`${preCode} ranks #${preRank} of 169 (top ${(prePct * 100).toFixed(0)}%).`);
      }
    }
    if (texture && texture.wet > 60 && street < 3) reasons.push(`Board is wet (${texture.wet}/100) — your equity is fragile on later cards.`);
    if (spr > 0 && spr < 1.5 && eq > 0.5) reasons.push(`SPR ${spr.toFixed(1)} — this is a commitment spot; plan to get it all in.`);
    return { action, tone, size, reasons, edge };
  }, [sim, eq, req, ev, toCall, pot, potBefore, texture, spr, street, prePct, preCode, preRank, position, bb, nOppActive]);

  /* ---- next-card scanner ---- */
  const runScan = useCallback(() => {
    if (!ready || street >= 3) return;
    setScanning(true);
    setTimeout(() => {
      const dead = new Set([...hole, ...knownBoard]);
      const rows = [];
      for (let c = 0; c < 52; c++) {
        if (dead.has(c)) continue;
        const s = createSim(hole, [...knownBoard, c], opponents, 555 + c * 31);
        rows.push({ card: c, eq: s.run(2200).equity });
      }
      rows.sort((a, b) => b.eq - a.eq);
      setScan(rows);
      setScanning(false);
    }, 20);
  }, [ready, street, hole, knownBoard, opponents]);

  /* ---- actions ---- */
  const clearAll = () => { setHole([null, null]); setBoard([null, null, null, null, null]); setSim(null); setScan(null); };

  const logHand = (result) => {
    if (!verdict) return;
    const entry = {
      id: Date.now(), t: Date.now(), street: STREETS[street].name,
      hand: preCode, board: knownBoard.map(cardStr).join(" "),
      equity: eq, required: req, advised: verdict.action, took: result.took,
      net: result.net, players: nPlayers,
    };
    setHands((h) => [entry, ...h].slice(0, 500));
  };

  /* ---- ledger math ---- */
  const ledger = useMemo(() => {
    const sorted = [...sessions].sort((a, b) => a.t - b.t);
    let cum = 0;
    const curve = sorted.map((s) => { cum += s.net; return { ...s, cum, label: new Date(s.t).toLocaleDateString() }; });
    const totalNet = cum;
    const totalHands = sorted.reduce((a, s) => a + (s.hands || 0), 0);
    const totalHours = sorted.reduce((a, s) => a + (s.hours || 0), 0);
    const bbPer100 = totalHands > 0 ? (totalNet / bb) / (totalHands / 100) : 0;
    const perHour = totalHours > 0 ? totalNet / totalHours : 0;
    // observed sd across sessions, normalised per 100 hands
    let sd = sigma;
    let sdSource = "assumed";
    if (sorted.length >= 5) {
      const rates = sorted.filter((s) => s.hands >= 20).map((s) => (s.net / bb) / (s.hands / 100));
      if (rates.length >= 5) {
        const m = rates.reduce((a, b) => a + b, 0) / rates.length;
        const v = rates.reduce((a, b) => a + (b - m) ** 2, 0) / (rates.length - 1);
        const avgHands = totalHands / rates.length;
        sd = Math.sqrt(v * (avgHands / 100));
        sdSource = "observed";
      }
    }
    const se = totalHands > 0 ? sd / Math.sqrt(totalHands / 100) : 0;
    const ci = [bbPer100 - 1.96 * se, bbPer100 + 1.96 * se];
    const bankrollBB = (sessions.length ? totalNet : 0) / bb;
    const ror = (B) => (bbPer100 <= 0 ? 1 : Math.exp((-2 * bbPer100 * B) / (sd * sd)));
    return { curve, totalNet, totalHands, totalHours, bbPer100, perHour, sd, sdSource, se, ci, ror, bankrollBB };
  }, [sessions, bb, sigma]);

  const leaks = useMemo(() => {
    if (!hands.length) return null;
    let agree = 0, byType = {};
    for (const h of hands) {
      const a = (h.advised || "").split(" ")[0];
      const t = (h.took || "").toUpperCase();
      const match = a.startsWith(t) || t.startsWith(a);
      if (match) agree++;
      else {
        const k = `${a} → you ${t}`;
        byType[k] = byType[k] || { n: 0, net: 0 };
        byType[k].n++; byType[k].net += h.net || 0;
      }
    }
    const worst = Object.entries(byType).sort((a, b) => a[1].net - b[1].net).slice(0, 4);
    return { rate: agree / hands.length, n: hands.length, worst };
  }, [hands]);

  return (
    <div className="root">
      <style>{CSS}</style>
      <header className="top">
        <div className="brand">
          <span className="mark">{SUIT_GLYPH[0]}</span>
          <div>
            <h1>Edge</h1>
            <p>equity, pot odds and a ledger that remembers</p>
          </div>
        </div>
        <nav className="tabs">
          {[["table", "Table"], ["villains", "Opponents"], ["ledger", "Ledger"]].map(([k, l]) => (
            <button key={k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>{l}</button>
          ))}
        </nav>
      </header>

      {tab === "table" && (
        <main className="grid">
          {/* ---------------- LEFT: input ---------------- */}
          <section className="panel">
            <div className="rail">
              {STREETS.map((st, i) => (
                <div key={st.key} className={`stop ${i === street ? "on" : ""} ${i < street ? "past" : ""}`}>
                  <b>{st.name}</b><i>{st.note}</i>
                </div>
              ))}
            </div>

            <div className="block">
              <div className="entryhead">
                <div className="blabel">Tap cards in order &mdash; hand, then board</div>
                <div className="ebtns">
                  <button className="ghost sm" onClick={undo} disabled={filled === 0}>undo</button>
                  <button className="ghost sm" onClick={clearAll} disabled={filled === 0}>clear</button>
                </div>
              </div>

              <div className="slots">
                {slots.map((c, i) => (
                  <div key={i} className={`slotwrap ${i === nextSlot ? "target" : ""} ${i === 1 ? "gap" : ""}`}>
                    <Card id={c} size="md" onClick={() => (c === null ? null : setSlot(i, null))} />
                    <i>{SLOT_LABELS[i]}</i>
                  </div>
                ))}
              </div>

              {texture && (
                <div className="texture">
                  <div className="wetbar"><div style={{ width: `${texture.wet}%` }} /></div>
                  <span>{texture.tags.join(" \u00b7 ")}</span>
                </div>
              )}

              <div className="gridpick">
                {[0, 1, 2, 3].map((su) => (
                  <div className="gridrow" key={su}>
                    {Array.from({ length: 13 }, (_, k) => {
                      const id = (12 - k) * 4 + su;
                      const isUsed = usedCards.includes(id);
                      return (
                        <button key={id} disabled={isUsed || nextSlot < 0}
                          className={`gcard ${su === 1 || su === 2 ? "red" : "black"} ${isUsed ? "used" : ""}`}
                          onClick={() => addCard(id)}>
                          {RANKS[12 - k]}<i>{SUIT_GLYPH[su]}</i>
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>

              <input className="typein" value={typed} placeholder="or type it: ahks qs7c2d"
                onChange={(e) => setTyped(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && applyTyped()}
                onBlur={applyTyped} />
            </div>

            <div className="block">
              <div className="blabel">Money</div>
              <div className="nums">
                <Num label="Pot (their bet included)" value={pot} onChange={setPot} />
                <Num label="To call" value={toCall} onChange={setToCall} />
                <Num label="Your stack" value={stack} onChange={setStack} />
                <Num label="Big blind" value={bb} onChange={setBB} step={0.5} />
              </div>
              <div className="quickbets">
                {[["⅓ pot", 1 / 3], ["½ pot", 0.5], ["⅔ pot", 2 / 3], ["pot", 1]].map(([l, f]) => (
                  <button key={l} onClick={() => setToCall(+(pot * f).toFixed(2))}>{l}</button>
                ))}
                <button onClick={() => setToCall(0)}>no bet</button>
              </div>
            </div>

            <div className="block">
              <div className="blabel">Who else is in the pot</div>

              <div className="oppcount">
                {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                  <button key={n} className={n === seats.length ? "on" : ""}
                    onClick={() => setNPlayers(n + 1)}>{n}</button>
                ))}
                <span>{seats.length === 1 ? "opponent" : "opponents"}</span>
              </div>

              <div className="opps">
                {seats.map((st, i) => {
                  const v = villains.find((x) => x.id === st.villainId);
                  const vs = v ? villainStats(v) : null;
                  const pct = rangeForOpponent(v, st.action, street);
                  const initial = v ? v.name.trim()[0].toUpperCase() : "?";
                  const set = (patch) => setSeats((p) => p.map((x, j) => (j === i ? { ...x, ...patch } : x)));
                  return (
                    <div className={`opp ${st.folded ? "out" : ""}`} key={i}>
                      <div className="opp-top">
                        <span className={`av ${vs ? "t-" + vs.tag : "t-unread"}`}>{initial}</span>
                        <select value={st.villainId || ""}
                          onChange={(e) => set({ villainId: e.target.value || null })}>
                          <option value="">Unknown player</option>
                          {villains.map((v2) => <option key={v2.id} value={v2.id}>{v2.name}</option>)}
                        </select>
                        {vs && vs.n >= 8 && <span className={`tag t-${vs.tag}`}>{vs.tag}</span>}
                        <button className={`foldbtn ${st.folded ? "on" : ""}`}
                          onClick={() => set({ folded: !st.folded })}
                          title={st.folded ? "bring back into the hand" : "mark as folded"}>
                          {st.folded ? "folded" : "fold"}
                        </button>
                      </div>
                      {!st.folded && (
                        <div className="opp-bot">
                          <div className="pills">
                            {[["none", "\u2014"], ["call", "called"], ["bet", "bet"], ["raise", "raised"], ["3bet", "3-bet"]].map(([k, l]) => (
                              <button key={k} className={st.action === k ? "on" : ""}
                                onClick={() => set({ action: k })}>{l}</button>
                            ))}
                          </div>
                          <div className="rangeviz" title={`playing about ${(pct * 100).toFixed(0)}% of hands`}>
                            <div className="rv-bar"><div style={{ width: `${Math.min(100, pct * 100)}%` }} /></div>
                            <b>{(pct * 100).toFixed(0)}%</b>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <label className="numf posrow">
                <span>Your position</span>
                <div className="seg">
                  {POSITIONS.map((pz) => (
                    <button key={pz} className={pz === position ? "on" : ""} onClick={() => setPosition(pz)}>{pz}</button>
                  ))}
                </div>
              </label>

              <p className="hint">
                The bar is how wide a range that player is being given. Tracked opponents use their own
                stats; unknown players start at a typical 26%. Marking an action narrows it to hands that
                actually fit this board.
              </p>
            </div>

            <button className="ghost wide" onClick={clearAll}>Clear cards</button>
          </section>

          {/* ---------------- RIGHT: readout ---------------- */}
          <section className="panel readout">
            {!ready || !sim ? (
              <div className="empty">
                <p>{!ready
                  ? `Pick your two cards${street > 0 ? ` and the ${STREETS[street].cards} board cards` : ""} to see the math.`
                  : "Running simulations\u2026"}</p>
              </div>
            ) : (
              <>
                {/* SIGNATURE: the line */}
                <div className="line-wrap">
                  <div className="line-head">
                    <div>
                      <div className="eq">{(eq * 100).toFixed(1)}<em>%</em></div>
                      <div className="eq-l">
                        your equity {sim && <span className="se">±{(sim.se * 196).toFixed(2)}</span>}
                      </div>
                    </div>
                    <div className="line-right">
                      {madeHand && <div className="made">{madeHand}</div>}
                      <div className="iters">{sim ? sim.n.toLocaleString() : 0} simulations</div>
                    </div>
                  </div>

                  <div className="line">
                    <div className="seg-win" style={{ width: `${sim.win * 100}%` }} />
                    <div className="seg-tie" style={{ width: `${sim.tie * 100}%` }} />
                    <div className="seg-lose" style={{ width: `${sim.lose * 100}%` }} />
                    {toCall > 0 && (
                      <div className="marker" style={{ left: `${req * 100}%` }}>
                        <span>break-even {(req * 100).toFixed(1)}%</span>
                      </div>
                    )}
                  </div>
                  <div className="line-key">
                    <span><i className="k-win" />win {(sim.win * 100).toFixed(1)}%</span>
                    <span><i className="k-tie" />split {(sim.tie * 100).toFixed(1)}%</span>
                    <span><i className="k-lose" />lose {(sim.lose * 100).toFixed(1)}%</span>
                  </div>
                </div>

                {verdict && (
                  <div className={`verdict v-${verdict.tone}`}>
                    <div className="v-top">
                      <span className="v-act">{verdict.action}</span>
                      {verdict.size ? <span className="v-size">size ≈ {verdict.size.toFixed(1)} ({(verdict.size / bb).toFixed(1)} bb)</span> : null}
                    </div>
                    <ul>{verdict.reasons.map((r, i) => <li key={i}>{r}</li>)}</ul>
                  </div>
                )}

                <div className="stats">
                  <Stat label="Need to call" value={toCall > 0 ? `${(req * 100).toFixed(1)}%` : "—"} sub="pot odds" />
                  <Stat label="Your edge" value={`${verdict && verdict.edge >= 0 ? "+" : ""}${(((eq - req)) * 100).toFixed(1)}%`}
                    tone={eq - req >= 0 ? "good" : "bad"} sub="equity − required" />
                  <Stat label="EV of calling" value={`${ev >= 0 ? "+" : ""}${(ev / bb).toFixed(2)} bb`}
                    tone={ev >= 0 ? "good" : "bad"} sub="per decision" />
                  <Stat label="SPR" value={pot > 0 ? spr.toFixed(1) : "—"} sub="stack ÷ pot" />
                  <Stat label="They must fold" value={`${(bluffBreakeven(potBefore, potBefore * 0.66) * 100).toFixed(0)}%`} sub="for a ⅔ pot bluff" />
                  <Stat label="You must defend" value={`${(mdf(potBefore, toCall) * 100).toFixed(0)}%`} sub="min defence frequency" />
                  <Stat label="Trips or better" value={`${(sim.strong * 100).toFixed(1)}%`} sub="how you finish" />
                  <Stat label="Pot in bb" value={(pot / bb).toFixed(1)} sub={`${nPlayers} in the pot`} />
                </div>

                {sizing && (
                  <div className="sizing">
                    <div className="blabel">{toCall > 0 ? "If you raise" : "If you bet"}</div>
                    {sizing.map((o) => (
                      <div className={`sz ${o.best ? "best" : ""}`} key={o.label}>
                        <div className="sz-l">
                          <b>{o.label}</b>
                          {o.best && <em>pick this</em>}
                          {o.allIn && <i className="jam">all in</i>}
                          {!o.allIn && o.committed && <i className="warn">commits you</i>}
                        </div>
                        <div className="sz-amt">
                          <b>{fmt(o.amt)}</b>
                          <span>{(o.amt / bb).toFixed(1)} bb</span>
                        </div>
                        <div className="sz-meta">
                          <span>pot becomes {fmt(o.potIfCalled)}</span>
                          <span className={o.evIfCalled >= 0 ? "good" : "bad"}>
                            {o.evIfCalled >= 0 ? "+" : ""}{(o.evIfCalled / bb).toFixed(1)} bb if called
                          </span>
                          <span>{o.foldPct > 0 ? `needs ${(o.foldPct * 100).toFixed(0)}% folds` : "profitable with no folds"}</span>
                        </div>
                        <p>{o.why}</p>
                      </div>
                    ))}
                    <p className="hint">
                      \u201cIf called\u201d assumes they call with the same range they have now. In reality
                      bigger bets get called by stronger hands, so treat the large sizes as optimistic.
                    </p>
                  </div>
                )}

                {sim.dist && street < 3 && (
                  <div className="dist">
                    <div className="blabel">How this hand finishes by the river</div>
                    {sim.dist.map((p, i) => ({ p, i }))
                      .filter((x) => x.p > 0.004)
                      .sort((a, b) => b.i - a.i)
                      .map((x) => (
                        <div className="drow" key={x.i}>
                          <span>{CAT_NAMES[x.i]}</span>
                          <div className="dbar"><div style={{ width: `${Math.min(100, x.p * 100)}%` }} /></div>
                          <b>{(x.p * 100).toFixed(1)}%</b>
                        </div>
                      ))}
                  </div>
                )}

                {street < 3 && (
                  <div className="scan">
                    <div className="scan-head">
                      <span>Next card scanner</span>
                      <button className="ghost" onClick={runScan} disabled={scanning}>
                        {scanning ? "scanning…" : scan ? "re-scan" : "scan every card"}
                      </button>
                    </div>
                    {scan && (
                      <div className="scan-body">
                        <div className="scan-col">
                          <h4>best for you</h4>
                          {scan.slice(0, 6).map((r) => (
                            <div className="scan-row" key={r.card}>
                              <Card id={r.card} size="sm" />
                              <div className="scan-bar"><div className="up" style={{ width: `${r.eq * 100}%` }} /></div>
                              <span>{(r.eq * 100).toFixed(0)}%</span>
                            </div>
                          ))}
                        </div>
                        <div className="scan-col">
                          <h4>worst for you</h4>
                          {scan.slice(-6).reverse().map((r) => (
                            <div className="scan-row" key={r.card}>
                              <Card id={r.card} size="sm" />
                              <div className="scan-bar"><div className="down" style={{ width: `${r.eq * 100}%` }} /></div>
                              <span>{(r.eq * 100).toFixed(0)}%</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="logbar">
                  <span>Log what you actually did</span>
                  <div>
                    {["Fold", "Call", "Raise", "Check", "Bet"].map((a) => (
                      <button key={a} className="ghost" onClick={() => {
                        const net = parseFloat(prompt(`Result of the hand in chips (negative if you lost)?`, "0"));
                        if (isNaN(net)) return;
                        logHand({ took: a, net });
                      }}>{a}</button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </section>
        </main>
      )}

      {tab === "villains" && (
        <Villains villains={villains} setVillains={setVillains} />
      )}

      {tab === "ledger" && (
        <Ledger ledger={ledger} sessions={sessions} setSessions={setSessions} bb={bb} sigma={sigma}
          setSigma={setSigma} hands={hands} setHands={setHands} leaks={leaks}
          allData={{ villains, sessions, hands, sigma }}
          onImport={(d) => { if (d.villains) setVillains(d.villains); if (d.sessions) setSessions(d.sessions); if (d.hands) setHands(d.hands); }} />
      )}
    </div>
  );
}

/* ============================================================
   OPPONENTS
   ============================================================ */
function Villains({ villains, setVillains }) {
  const [name, setName] = useState("");
  const add = () => {
    if (!name.trim()) return;
    setVillains((v) => [...v, {
      id: String(Date.now()), name: name.trim(), hands: 0, vpipCount: 0, pfrCount: 0,
      aggAct: 0, passAct: 0, cbetFaced: 0, cbetFolded: 0, notes: "",
    }]);
    setName("");
  };
  const bump = (id, field, d = 1) => setVillains((v) => v.map((x) => x.id === id ? { ...x, [field]: Math.max(0, (x[field] || 0) + d) } : x));
  const upd = (id, patch) => setVillains((v) => v.map((x) => x.id === id ? { ...x, ...patch } : x));

  return (
    <main className="single">
      <div className="panel">
        <div className="blabel">Add an opponent</div>
        <div className="addrow">
          <input placeholder="name or seat, e.g. “big stack seat 4”" value={name}
            onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} />
          <button className="solid" onClick={add}>Add</button>
        </div>
        <p className="hint">
          After each hand, tap what they did. Early on the read stays close to a typical player and moves
          toward what you have seen as the sample grows — so four hands never makes someone look like a rock.
        </p>
      </div>

      {villains.length === 0 && <div className="panel empty"><p>No opponents tracked yet. Add one above and their range narrows on the table screen as you log hands.</p></div>}

      {villains.map((v) => {
        const s = villainStats(v);
        return (
          <div className="panel villain" key={v.id}>
            <div className="v-head">
              <div>
                <h3>{v.name}</h3>
                <div className="v-sub">
                  <span className={`tag t-${s.tag}`}>{s.tag}</span>
                  <span>{s.n} hands · read confidence {(s.conf * 100).toFixed(0)}%</span>
                </div>
              </div>
              <button className="ghost" onClick={() => setVillains((p) => p.filter((x) => x.id !== v.id))}>remove</button>
            </div>

            <div className="vstats">
              <Stat label="VPIP" value={`${(s.vpip * 100).toFixed(0)}%`} sub="plays this many hands" />
              <Stat label="PFR" value={`${(s.pfr * 100).toFixed(0)}%`} sub="raises preflop" />
              <Stat label="Aggression" value={s.af.toFixed(1)} sub="bets+raises ÷ calls" />
              <Stat label="Folds to c-bet" value={`${(s.foldCbet * 100).toFixed(0)}%`} sub="flop" />
            </div>

            <div className="conf"><div style={{ width: `${s.conf * 100}%` }} /></div>
            <p className="tagnote">{s.tagNote}</p>

            <div className="counters">
              {[
                ["hands", "Hand dealt"], ["vpipCount", "Put money in"], ["pfrCount", "Raised preflop"],
                ["aggAct", "Bet / raised"], ["passAct", "Called / checked"], ["cbetFaced", "Faced a c-bet"],
                ["cbetFolded", "Folded to c-bet"],
              ].map(([f, l]) => (
                <div className="ctr" key={f}>
                  <span>{l}</span>
                  <div>
                    <button onClick={() => bump(v.id, f, -1)}>−</button>
                    <b>{v[f] || 0}</b>
                    <button onClick={() => bump(v.id, f, 1)}>+</button>
                  </div>
                </div>
              ))}
            </div>

            <div className="exploits">
              <h4>How to attack them</h4>
              <ul>
                {s.foldCbet > 0.58 && s.n >= 8 && <li>Folds to c-bets {(s.foldCbet * 100).toFixed(0)}% — bet the flop almost every time you take the lead.</li>}
                {s.foldCbet < 0.38 && s.n >= 8 && <li>Rarely folds to c-bets — check your air, bet only real hands.</li>}
                {s.vpip > 0.4 && <li>Plays {(s.vpip * 100).toFixed(0)}% of hands, so their range is weak. Value bet thinner and call down wider.</li>}
                {s.vpip < 0.18 && s.n >= 8 && <li>Very tight. When they raise, believe them. Steal their blinds constantly.</li>}
                {s.af > 3 && <li>Highly aggressive — their bets mean less. Trap with strong hands and let them bluff.</li>}
                {s.af < 1.2 && s.n >= 8 && <li>Passive. A raise from them is the nuts. Their calls mean a real but capped hand.</li>}
                {s.pfr / Math.max(s.vpip, 0.01) < 0.35 && s.n >= 8 && <li>Calls far more than raises preflop — they arrive with weak, speculative hands. Punish on high boards.</li>}
                {s.n < 8 && <li>Log a few more hands before leaning on any read.</li>}
              </ul>
            </div>

            <textarea placeholder="Notes — showdowns, tells, sizing habits…" value={v.notes || ""}
              onChange={(e) => upd(v.id, { notes: e.target.value })} />
          </div>
        );
      })}
    </main>
  );
}

/* ============================================================
   LEDGER
   ============================================================ */
function Ledger({ ledger, sessions, setSessions, bb, sigma, setSigma, hands, setHands, leaks, allData, onImport }) {
  const [f, setF] = useState({ net: "", hands: "", hours: "", stake: "", note: "" });
  const add = () => {
    const net = parseFloat(f.net);
    if (isNaN(net)) return;
    setSessions((s) => [...s, {
      id: Date.now(), t: Date.now(), net,
      hands: parseInt(f.hands) || 0, hours: parseFloat(f.hours) || 0,
      stake: f.stake, note: f.note,
    }]);
    setF({ net: "", hands: "", hours: "", stake: "", note: "" });
  };
  const money = (n) => `${n >= 0 ? "+" : "−"}${Math.abs(n).toFixed(2)}`;

  const exportData = () => {
    const blob = new Blob([JSON.stringify(allData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "poker-data.json"; a.click();
    URL.revokeObjectURL(url);
  };
  const importData = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const r = new FileReader();
    r.onload = () => { try { onImport(JSON.parse(r.result)); } catch { alert("That file could not be read."); } };
    r.readAsText(file);
  };

  return (
    <main className="single">
      <div className="panel">
        <div className="bigstats">
          <Stat label="All time" value={money(ledger.totalNet)} tone={ledger.totalNet >= 0 ? "good" : "bad"}
            sub={`${sessions.length} sessions`} />
          <Stat label="Win rate" value={`${ledger.bbPer100 >= 0 ? "+" : ""}${ledger.bbPer100.toFixed(2)}`}
            tone={ledger.bbPer100 >= 0 ? "good" : "bad"} sub="bb / 100 hands" />
          <Stat label="Per hour" value={money(ledger.perHour)} tone={ledger.perHour >= 0 ? "good" : "bad"}
            sub={`${ledger.totalHours.toFixed(1)} hours`} />
          <Stat label="Hands" value={ledger.totalHands.toLocaleString()} sub="tracked" />
        </div>

        {ledger.curve.length > 1 && (
          <div className="chart">
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={ledger.curve} margin={{ top: 8, right: 8, bottom: 4, left: -18 }}>
                <CartesianGrid stroke="#2A2E3A" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: "#8A8FA0", fontSize: 10 }} stroke="#2A2E3A" />
                <YAxis tick={{ fill: "#8A8FA0", fontSize: 10 }} stroke="#2A2E3A" />
                <Tooltip contentStyle={{ background: "#1C1F27", border: "1px solid #2A2E3A", color: "#E8E3D8", fontSize: 12 }} />
                <ReferenceLine y={0} stroke="#8A8FA0" strokeDasharray="3 3" />
                <Line type="monotone" dataKey="cum" stroke="#C89B3C" strokeWidth={2} dot={false} name="running total" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {ledger.totalHands > 500 && (
          <div className="variance">
            <h4>What the numbers actually prove</h4>
            <p>
              Over {ledger.totalHands.toLocaleString()} hands your true win rate sits, with 95% confidence, somewhere
              between <b className={ledger.ci[0] >= 0 ? "good" : "bad"}>{ledger.ci[0].toFixed(1)}</b> and{" "}
              <b className={ledger.ci[1] >= 0 ? "good" : "bad"}>{ledger.ci[1].toFixed(1)}</b> bb/100
              (standard deviation {ledger.sd.toFixed(0)} bb/100, {ledger.sdSource}).
              {ledger.ci[0] < 0 && ledger.ci[1] > 0 && " That interval crosses zero — this sample cannot yet tell a winner from a loser."}
            </p>
            {ledger.bbPer100 > 0 && (
              <p>
                Risk of ruin at your current rate: <b>{(ledger.ror(300) * 100).toFixed(1)}%</b> with a 300 bb roll,{" "}
                <b>{(ledger.ror(1000) * 100).toFixed(1)}%</b> with 1,000 bb, <b>{(ledger.ror(2500) * 100).toFixed(2)}%</b> with 2,500 bb.
              </p>
            )}
          </div>
        )}

        <div className="addsession">
          <div className="blabel">Log a session</div>
          <div className="srow">
            <input placeholder="net won/lost" value={f.net} onChange={(e) => setF({ ...f, net: e.target.value })} />
            <input placeholder="hands" value={f.hands} onChange={(e) => setF({ ...f, hands: e.target.value })} />
            <input placeholder="hours" value={f.hours} onChange={(e) => setF({ ...f, hours: e.target.value })} />
            <input placeholder="stake" value={f.stake} onChange={(e) => setF({ ...f, stake: e.target.value })} />
            <input placeholder="note" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} />
            <button className="solid" onClick={add}>Save</button>
          </div>
          <label className="numf inline">
            <span>Assumed standard deviation (bb/100) until you have enough sessions</span>
            <input type="number" value={sigma} onChange={(e) => setSigma(parseFloat(e.target.value) || 90)} />
          </label>
        </div>

        <div className="slist">
          {[...sessions].sort((a, b) => b.t - a.t).slice(0, 12).map((s) => (
            <div className="srowout" key={s.id}>
              <span className="sdate">{new Date(s.t).toLocaleDateString()}</span>
              <span className={`snet ${s.net >= 0 ? "good" : "bad"}`}>{money(s.net)}</span>
              <span className="sdim">{s.hands || 0} hands · {(s.hours || 0)}h {s.stake ? `· ${s.stake}` : ""}</span>
              <span className="snote">{s.note}</span>
              <button className="x" onClick={() => setSessions((p) => p.filter((x) => x.id !== s.id))}>×</button>
            </div>
          ))}
        </div>

        <div className="io">
          <button className="ghost" onClick={exportData}>Export all data</button>
          <label className="ghost file">Import<input type="file" accept="application/json" onChange={importData} /></label>
        </div>
      </div>

      {leaks && (
        <div className="panel">
          <div className="blabel">Leak finder</div>
          <p className="lead">
            You followed the maths on <b>{(leaks.rate * 100).toFixed(0)}%</b> of {leaks.n} logged decisions.
          </p>
          {leaks.worst.length > 0 && (
            <div className="leaks">
              {leaks.worst.map(([k, d]) => (
                <div className="leak" key={k}>
                  <span>{k}</span>
                  <b className={d.net >= 0 ? "good" : "bad"}>{money(d.net)}</b>
                  <i>{d.n}×</i>
                </div>
              ))}
            </div>
          )}
          <div className="hlist">
            {hands.slice(0, 10).map((h) => (
              <div className="hrow" key={h.id}>
                <b>{h.hand}</b>
                <span className="sdim">{h.board || "preflop"}</span>
                <span>{(h.equity * 100).toFixed(0)}% eq</span>
                <span className="sdim">said {h.advised.toLowerCase()} · you {h.took.toLowerCase()}</span>
                <b className={h.net >= 0 ? "good" : "bad"}>{money(h.net)}</b>
              </div>
            ))}
          </div>
          {hands.length > 0 && <button className="ghost" onClick={() => setHands([])}>Clear hand log</button>}
        </div>
      )}
    </main>
  );
}

/* ============================================================
   STYLE
   ============================================================ */
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap');

.root{
  --ground:#14161C; --panel:#1C1F27; --panel2:#20242E; --edge:#2C3140;
  --bone:#E8E3D8; --dim:#8A8FA0; --brass:#C89B3C; --oxblood:#C4453F; --jade:#3E9E7A;
  --sans:'Archivo',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
  --mono:'JetBrains Mono',ui-monospace,'SF Mono',Menlo,monospace;
  background:var(--ground); color:var(--bone); font-family:var(--sans);
  min-height:100vh; padding:18px; font-variant-numeric:tabular-nums;
}
.root *{box-sizing:border-box}
.root button{font-family:var(--sans); cursor:pointer}
.root button:focus-visible,.root input:focus-visible,.root select:focus-visible,.root textarea:focus-visible{
  outline:2px solid var(--brass); outline-offset:2px}
.good{color:var(--jade)} .bad{color:var(--oxblood)}

.top{display:flex;justify-content:space-between;align-items:flex-end;gap:16px;flex-wrap:wrap;
  border-bottom:1px solid var(--edge); padding-bottom:14px; margin-bottom:18px}
.brand{display:flex;gap:12px;align-items:center}
.mark{font-size:30px;color:var(--brass);line-height:1}
.brand h1{margin:0;font-size:24px;font-weight:700;letter-spacing:-0.02em}
.brand p{margin:2px 0 0;font-size:11px;color:var(--dim);font-family:var(--mono);letter-spacing:0.02em}
.tabs{display:flex;gap:2px;background:var(--panel);border:1px solid var(--edge);border-radius:2px;padding:2px}
.tabs button{background:none;border:0;color:var(--dim);padding:7px 16px;font-size:12px;
  font-weight:600;letter-spacing:0.04em;text-transform:uppercase;border-radius:1px}
.tabs button.on{background:var(--brass);color:#14161C}

.grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.05fr);gap:16px;align-items:start}
.single{display:flex;flex-direction:column;gap:16px;max-width:1000px}
.panel{background:var(--panel);border:1px solid var(--edge);border-radius:3px;padding:16px}
.block{margin-bottom:18px}
.blabel{font-size:10px;text-transform:uppercase;letter-spacing:0.14em;color:var(--dim);
  font-family:var(--mono);margin-bottom:9px}

/* street rail — a real sequence, so it gets a real sequence device */
.entryhead{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;gap:10px}
.entryhead .blabel{margin-bottom:0}
.ebtns{display:flex;gap:5px}
.ghost.sm{padding:4px 9px;font-size:10px}
.slots{display:flex;gap:5px;align-items:flex-start;margin-bottom:12px;flex-wrap:wrap}
.slotwrap{display:flex;flex-direction:column;align-items:center;gap:4px;position:relative}
.slotwrap.gap{margin-right:14px}
.slotwrap i{font-style:normal;font-size:8px;color:#5A6070;font-family:var(--mono);
  text-transform:uppercase;letter-spacing:0.06em}
.slotwrap.target .card.slot{border-color:var(--brass);color:var(--brass);
  box-shadow:0 0 0 2px rgba(200,155,60,.22)}
.slotwrap.target i{color:var(--brass)}
.gridpick{display:flex;flex-direction:column;gap:3px;margin-bottom:10px}
.gridrow{display:grid;grid-template-columns:repeat(13,1fr);gap:3px}
.gcard{background:var(--bone);color:#14161C;border:0;border-radius:2px;padding:7px 0 5px;
  font-size:13px;font-weight:700;display:flex;flex-direction:column;align-items:center;
  line-height:1;font-family:var(--sans);min-height:34px;justify-content:center}
.gcard i{font-style:normal;font-size:9px;opacity:.75;margin-top:1px}
.gcard.red{color:#B02A25}
.gcard:hover:not(.used):not(:disabled){outline:2px solid var(--brass)}
.gcard.used,.gcard:disabled{opacity:.14;cursor:not-allowed}
.typein{width:100%;background:var(--ground);border:1px solid var(--edge);color:var(--bone);
  font-family:var(--mono);font-size:12px;padding:8px 10px;border-radius:2px}
.typein::placeholder{color:#4E5464}
.rail{display:grid;grid-template-columns:repeat(4,1fr);gap:1px;background:var(--edge);
  border:1px solid var(--edge);margin-bottom:20px}
.stop{background:var(--panel2);padding:10px 8px;text-align:left;display:flex;flex-direction:column;gap:3px}
.stop b{font-size:13px;color:var(--dim);font-weight:600}
.stop i{font-size:9px;color:#5A6070;font-style:normal;font-family:var(--mono)}
.stop.past b{color:#6E7488}
.stop.on{background:var(--ground);box-shadow:inset 0 2px 0 var(--brass)}
.stop.on b{color:var(--bone)}

/* cards */
.cards{display:flex;gap:7px;align-items:center;flex-wrap:wrap}
.card{border-radius:3px;border:1px solid #0000;display:flex;align-items:center;justify-content:center;
  gap:1px;background:var(--bone);color:#14161C;font-family:var(--sans);font-weight:700;padding:0;
  box-shadow:0 1px 3px rgba(0,0,0,.45)}
.card.lg{width:50px;height:70px;font-size:20px;flex-direction:column;gap:0}
.card.md{width:38px;height:52px;font-size:15px;flex-direction:column}
.card.sm{width:26px;height:34px;font-size:11px;flex-direction:column}
.card .cs{font-size:.82em;line-height:1}
.card .cr{line-height:1.05}
.card.red{color:#B02A25}
.card.slot{background:none;border:1px dashed var(--edge);color:var(--edge);font-size:18px;box-shadow:none}
.card.slot:hover{border-color:var(--brass);color:var(--brass)}
.handmeta{margin-left:6px;font-family:var(--mono)}
.handmeta b{display:block;font-size:17px;color:var(--brass)}
.handmeta span{font-size:10px;color:var(--dim)}

.texture{display:flex;align-items:center;gap:10px;margin-top:10px}
.wetbar{width:80px;height:3px;background:var(--edge);border-radius:2px;overflow:hidden}
.wetbar div{height:100%;background:linear-gradient(90deg,var(--jade),var(--brass),var(--oxblood))}
.texture span{font-size:10px;color:var(--dim);font-family:var(--mono)}

/* inputs */
.nums{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.numf{display:flex;flex-direction:column;gap:5px}
.numf>span{font-size:10px;color:var(--dim);font-family:var(--mono);letter-spacing:0.02em}
.numf-in{display:flex;align-items:center;background:var(--ground);border:1px solid var(--edge);border-radius:2px}
.numf input,.addrow input,.srow input,.numf.inline input{background:var(--ground);border:1px solid var(--edge);
  color:var(--bone);font-family:var(--mono);font-size:13px;padding:7px 9px;border-radius:2px;width:100%}
.numf-in input{border:0;background:none}
.numf-in em{font-size:10px;color:var(--dim);padding-right:8px;font-style:normal}
.numf.inline{flex-direction:row;align-items:center;gap:10px;margin-top:10px}
.numf.inline input{width:90px}
.quickbets{display:flex;gap:5px;margin-top:9px;flex-wrap:wrap}
.quickbets button{background:var(--panel2);border:1px solid var(--edge);color:var(--dim);
  font-size:10px;padding:5px 9px;border-radius:2px;font-family:var(--mono)}
.quickbets button:hover{color:var(--brass);border-color:var(--brass)}
.row2{display:grid;gap:12px}
.seg{display:flex;flex-wrap:wrap;gap:2px}
.seg button{background:var(--ground);border:1px solid var(--edge);color:var(--dim);font-family:var(--mono);
  font-size:11px;padding:5px 0;border-radius:2px;flex:1;min-width:34px}
.seg button.on{background:var(--brass);color:#14161C;border-color:var(--brass);font-weight:700}

/* opponents */
.oppcount{display:flex;align-items:center;gap:3px;margin-bottom:11px}
.oppcount button{background:var(--ground);border:1px solid var(--edge);color:var(--dim);
  font-family:var(--mono);font-size:12px;width:30px;height:28px;border-radius:2px}
.oppcount button.on{background:var(--brass);color:#14161C;border-color:var(--brass);font-weight:700}
.oppcount span{font-size:10px;color:var(--dim);font-family:var(--mono);margin-left:7px}
.opps{display:flex;flex-direction:column;gap:6px}
.opp{background:var(--ground);border:1px solid var(--edge);border-radius:3px;padding:9px 10px}
.opp.out{opacity:.4}
.opp-top{display:flex;align-items:center;gap:8px}
.av{width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;
  font-family:var(--mono);font-size:11px;font-weight:700;flex-shrink:0}
.opp-top select{background:none;border:0;color:var(--bone);font-size:12px;flex:1;min-width:0;
  font-family:var(--sans);padding:2px 0}
.opp-top select:hover{color:var(--brass)}
.foldbtn{background:none;border:1px solid var(--edge);color:var(--dim);font-size:9px;
  padding:3px 8px;border-radius:2px;font-family:var(--mono);text-transform:uppercase;letter-spacing:0.05em}
.foldbtn:hover{color:var(--oxblood);border-color:var(--oxblood)}
.foldbtn.on{background:var(--oxblood);border-color:var(--oxblood);color:var(--bone)}
.opp-bot{display:flex;align-items:center;gap:10px;margin-top:8px}
.pills{display:flex;gap:2px;flex:1}
.pills button{background:var(--panel2);border:1px solid var(--edge);color:var(--dim);
  font-size:10px;padding:4px 7px;border-radius:2px;font-family:var(--mono);flex:1}
.pills button.on{background:var(--brass);border-color:var(--brass);color:#14161C;font-weight:700}
.rangeviz{display:flex;align-items:center;gap:6px;width:84px;flex-shrink:0}
.rv-bar{flex:1;height:4px;background:var(--edge);border-radius:2px;overflow:hidden}
.rv-bar div{height:100%;background:var(--brass)}
.rangeviz b{font-family:var(--mono);font-size:10px;color:var(--brass);width:26px;text-align:right}
.posrow{margin-top:12px}

/* sizing */
.sizing{background:var(--ground);border:1px solid var(--edge);padding:13px;border-radius:3px}
.sz{border-top:1px solid var(--edge);padding:9px 0 8px;display:grid;
  grid-template-columns:1fr auto;gap:2px 10px;align-items:baseline}
.sz:first-of-type{border-top:0;padding-top:2px}
.sz.best{background:rgba(200,155,60,.06);margin:0 -13px;padding-left:13px;padding-right:13px;
  box-shadow:inset 3px 0 0 var(--brass)}
.sz-l{display:flex;align-items:baseline;gap:7px}
.sz-l b{font-size:13px;font-weight:600}
.sz-l em{font-style:normal;font-size:8px;text-transform:uppercase;letter-spacing:0.1em;
  color:var(--brass);font-family:var(--mono)}
.sz-l i{font-style:normal;font-size:8px;text-transform:uppercase;letter-spacing:0.08em;
  font-family:var(--mono);padding:2px 5px;border-radius:2px}
.sz-l .jam{background:var(--oxblood);color:var(--bone)}
.sz-l .warn{background:#3A2F33;color:#E39B7B}
.sz-amt{text-align:right;font-family:var(--mono)}
.sz-amt b{font-size:16px;font-weight:700;color:var(--bone)}
.sz-amt span{display:block;font-size:9px;color:var(--dim)}
.sz-meta{grid-column:1/-1;display:flex;gap:12px;flex-wrap:wrap;margin-top:3px}
.sz-meta span{font-size:9px;color:#6A7080;font-family:var(--mono)}
.sz p{grid-column:1/-1;font-size:11px;color:#8E8A80;margin:4px 0 0;line-height:1.5}
.seats{display:flex;flex-direction:column;gap:5px;margin-top:12px}
.seat{display:flex;align-items:center;gap:6px}
.seat-n{font-family:var(--mono);font-size:10px;color:var(--dim);width:22px}
.seat select{background:var(--ground);border:1px solid var(--edge);color:var(--bone);font-size:11px;
  padding:5px;border-radius:2px;flex:1;min-width:0;font-family:var(--sans)}
.seat-r{font-family:var(--mono);font-size:11px;color:var(--brass);width:34px;text-align:right}
.hint{font-size:10px;color:#6A7080;line-height:1.5;margin:9px 0 0;font-family:var(--mono)}
.tag{font-size:9px;text-transform:uppercase;letter-spacing:0.06em;padding:2px 5px;border-radius:2px;
  font-family:var(--mono);font-weight:700}
.t-nit,.t-TAG,.t-reg{background:#2A3340;color:#8FB4D9}
.t-station,.t-maniac,.t-LAG{background:#3A2A2A;color:#E39B7B}
.t-unread{background:var(--edge);color:var(--dim)}

/* readout */
.readout{display:flex;flex-direction:column;gap:16px}
.empty{color:var(--dim);font-size:13px;text-align:center;padding:50px 20px;font-family:var(--mono);line-height:1.7}

/* SIGNATURE: the line */
.line-wrap{background:var(--ground);border:1px solid var(--edge);padding:16px;border-radius:3px}
.line-head{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px}
.eq{font-family:var(--mono);font-size:52px;font-weight:700;line-height:.9;color:var(--bone);letter-spacing:-0.03em}
.eq em{font-size:20px;font-style:normal;color:var(--dim);margin-left:2px}
.eq-l{font-size:10px;color:var(--dim);font-family:var(--mono);margin-top:6px;text-transform:uppercase;letter-spacing:0.1em}
.se{color:#5A6070;margin-left:4px;text-transform:none}
.line-right{text-align:right}
.made{font-size:14px;color:var(--brass);font-weight:600}
.iters{font-size:9px;color:#5A6070;font-family:var(--mono);margin-top:4px}
.line{position:relative;height:26px;display:flex;background:var(--edge);border-radius:2px;overflow:visible}
.seg-win{background:var(--jade)} .seg-tie{background:#5E6472} .seg-lose{background:#3A2F33}
.line>div{height:100%;transition:width .18s linear}
.line .marker{position:absolute;top:-6px;bottom:-6px;width:2px;background:var(--bone);transition:left .18s;z-index:2}
.line .marker span{position:absolute;top:-16px;left:50%;transform:translateX(-50%);white-space:nowrap;
  font-family:var(--mono);font-size:9px;color:var(--bone);letter-spacing:0.04em}
.line-key{display:flex;gap:16px;margin-top:10px}
.line-key span{display:flex;align-items:center;gap:5px;font-size:10px;color:var(--dim);font-family:var(--mono)}
.line-key i{width:8px;height:8px;border-radius:1px;display:block}
.k-win{background:var(--jade)} .k-tie{background:#5E6472} .k-lose{background:#3A2F33}

.verdict{border-left:3px solid var(--edge);padding:13px 15px;background:var(--panel2);border-radius:0 3px 3px 0}
.v-good{border-left-color:var(--jade)} .v-bad{border-left-color:var(--oxblood)} .v-neutral{border-left-color:var(--brass)}
.v-top{display:flex;justify-content:space-between;align-items:baseline;gap:10px;flex-wrap:wrap}
.v-act{font-size:19px;font-weight:700;letter-spacing:0.01em}
.v-good .v-act{color:var(--jade)} .v-bad .v-act{color:var(--oxblood)} .v-neutral .v-act{color:var(--brass)}
.v-size{font-family:var(--mono);font-size:11px;color:var(--dim)}
.verdict ul{margin:9px 0 0;padding-left:16px}
.verdict li{font-size:12px;color:#B8B4AA;line-height:1.6;margin-bottom:3px}

.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:1px;background:var(--edge);border:1px solid var(--edge)}
.stat{background:var(--panel);padding:10px}
.stat-l{font-size:9px;color:var(--dim);font-family:var(--mono);text-transform:uppercase;letter-spacing:0.07em}
.stat-v{font-family:var(--mono);font-size:18px;font-weight:700;margin-top:4px}
.stat-s{font-size:9px;color:#5A6070;font-family:var(--mono);margin-top:2px}

.dist{background:var(--ground);border:1px solid var(--edge);padding:13px;border-radius:3px}
.drow{display:grid;grid-template-columns:88px 1fr 44px;gap:9px;align-items:center;margin-bottom:4px}
.drow span{font-size:10px;color:var(--dim);font-family:var(--mono)}
.drow .dbar{height:5px;background:var(--edge);border-radius:2px;overflow:hidden}
.drow .dbar div{height:100%;background:var(--brass)}
.drow b{font-family:var(--mono);font-size:10px;color:var(--bone);text-align:right}
.scan{background:var(--ground);border:1px solid var(--edge);padding:13px;border-radius:3px}
.scan-head{display:flex;justify-content:space-between;align-items:center}
.scan-head span{font-size:10px;text-transform:uppercase;letter-spacing:0.12em;color:var(--dim);font-family:var(--mono)}
.scan-body{display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-top:12px}
.scan-col h4{font-size:9px;text-transform:uppercase;letter-spacing:0.1em;color:#5A6070;margin:0 0 7px;font-family:var(--mono)}
.scan-row{display:flex;align-items:center;gap:7px;margin-bottom:4px}
.scan-bar{flex:1;height:4px;background:var(--edge);border-radius:2px;overflow:hidden}
.scan-bar .up{height:100%;background:var(--jade)} .scan-bar .down{height:100%;background:var(--oxblood)}
.scan-row span{font-family:var(--mono);font-size:10px;color:var(--dim);width:28px;text-align:right}

.logbar{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;
  border-top:1px solid var(--edge);padding-top:13px}
.logbar>span{font-size:10px;color:var(--dim);font-family:var(--mono);text-transform:uppercase;letter-spacing:0.08em}
.logbar>div{display:flex;gap:4px}
.ghost{background:none;border:1px solid var(--edge);color:var(--dim);font-size:11px;padding:6px 11px;
  border-radius:2px;font-family:var(--mono)}
.ghost:hover{color:var(--brass);border-color:var(--brass)}
.ghost:disabled{opacity:.4;cursor:default}
.ghost.wide{width:100%}
.solid{background:var(--brass);border:0;color:#14161C;font-weight:700;font-size:12px;padding:8px 16px;border-radius:2px}
.file{position:relative;overflow:hidden;display:inline-block;text-align:center}
.file input{position:absolute;inset:0;opacity:0;cursor:pointer;width:100%}

/* villains */
.addrow{display:flex;gap:8px}
.addrow input{flex:1}
.villain textarea{width:100%;background:var(--ground);border:1px solid var(--edge);color:var(--bone);
  font-family:var(--sans);font-size:12px;padding:9px;border-radius:2px;min-height:56px;margin-top:12px;resize:vertical}
.v-head{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:14px}
.v-head h3{margin:0;font-size:17px;font-weight:600}
.v-sub{display:flex;align-items:center;gap:9px;margin-top:5px;font-size:10px;color:var(--dim);font-family:var(--mono)}
.vstats{display:grid;grid-template-columns:repeat(4,1fr);gap:1px;background:var(--edge);border:1px solid var(--edge)}
.conf{height:2px;background:var(--edge);margin-top:10px}
.conf div{height:100%;background:var(--brass)}
.tagnote{font-size:11px;color:var(--dim);margin:7px 0 0;font-style:italic}
.counters{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:6px;margin-top:14px}
.ctr{background:var(--ground);border:1px solid var(--edge);padding:7px 9px;border-radius:2px;
  display:flex;justify-content:space-between;align-items:center;gap:8px}
.ctr span{font-size:10px;color:var(--dim);font-family:var(--mono)}
.ctr div{display:flex;align-items:center;gap:6px}
.ctr button{background:var(--panel2);border:1px solid var(--edge);color:var(--bone);width:20px;height:20px;
  border-radius:2px;font-size:13px;line-height:1;padding:0}
.ctr b{font-family:var(--mono);font-size:13px;min-width:20px;text-align:center}
.exploits{margin-top:14px;border-top:1px solid var(--edge);padding-top:12px}
.exploits h4{font-size:10px;text-transform:uppercase;letter-spacing:0.12em;color:var(--brass);margin:0 0 8px;font-family:var(--mono)}
.exploits ul{margin:0;padding-left:16px}
.exploits li{font-size:12px;color:#B8B4AA;line-height:1.6;margin-bottom:4px}

/* ledger */
.bigstats{display:grid;grid-template-columns:repeat(4,1fr);gap:1px;background:var(--edge);border:1px solid var(--edge)}
.bigstats .stat-v{font-size:22px}
.chart{margin-top:18px}
.variance{background:var(--ground);border:1px solid var(--edge);padding:14px;border-radius:3px;margin-top:16px}
.variance h4{font-size:10px;text-transform:uppercase;letter-spacing:0.12em;color:var(--brass);margin:0 0 9px;font-family:var(--mono)}
.variance p{font-size:12px;color:#B8B4AA;line-height:1.7;margin:0 0 8px}
.addsession{margin-top:18px}
.srow{display:grid;grid-template-columns:repeat(5,1fr) auto;gap:6px}
.slist{margin-top:14px;display:flex;flex-direction:column;gap:1px}
.srowout{display:grid;grid-template-columns:80px 80px 1fr 1.2fr 24px;gap:9px;align-items:center;
  padding:7px 0;border-bottom:1px solid var(--edge);font-size:11px}
.sdate{font-family:var(--mono);color:var(--dim)}
.snet{font-family:var(--mono);font-weight:700}
.sdim{color:var(--dim);font-family:var(--mono);font-size:10px}
.snote{color:#B8B4AA;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.x{background:none;border:0;color:var(--dim);font-size:14px;padding:0}
.x:hover{color:var(--oxblood)}
.io{display:flex;gap:8px;margin-top:16px}
.lead{font-size:13px;color:#B8B4AA;margin:0 0 12px}
.leaks{display:flex;flex-direction:column;gap:5px;margin-bottom:14px}
.leak{display:grid;grid-template-columns:1fr auto 40px;gap:10px;align-items:center;background:var(--ground);
  border:1px solid var(--edge);padding:8px 11px;border-radius:2px;font-size:11px}
.leak b{font-family:var(--mono)}
.leak i{font-family:var(--mono);font-size:10px;color:var(--dim);font-style:normal;text-align:right}
.hlist{display:flex;flex-direction:column;gap:1px;margin-bottom:12px}
.hrow{display:grid;grid-template-columns:44px 1.1fr 60px 1.6fr 66px;gap:9px;align-items:center;
  padding:6px 0;border-bottom:1px solid var(--edge);font-size:11px}
.hrow b{font-family:var(--mono)}

/* picker */
.picker-wrap{position:fixed;inset:0;background:rgba(8,9,12,.8);display:flex;align-items:center;
  justify-content:center;z-index:100;padding:16px}
.picker{background:var(--panel);border:1px solid var(--edge);border-radius:3px;padding:16px;max-width:560px;width:100%}
.picker-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:14px}
.picker-head span{font-size:11px;text-transform:uppercase;letter-spacing:0.1em;color:var(--dim);font-family:var(--mono)}
.picker-head .x{font-size:10px;font-family:var(--mono)}
.deck{display:flex;flex-direction:column;gap:4px}
.deck-row{display:grid;grid-template-columns:repeat(13,1fr);gap:4px}
.pcard{background:var(--bone);color:#14161C;border:0;border-radius:2px;padding:6px 0;font-size:12px;
  font-weight:700;display:flex;flex-direction:column;align-items:center;line-height:1.1}
.pcard i{font-style:normal;font-size:10px}
.pcard.red{color:#B02A25}
.pcard:hover:not(.used){outline:2px solid var(--brass)}
.pcard.used{opacity:.16;cursor:not-allowed}

@media (max-width:900px){
  .grid{grid-template-columns:1fr}
  .stats,.bigstats,.vstats{grid-template-columns:repeat(2,1fr)}
  .srow{grid-template-columns:1fr 1fr}
  .scan-body{grid-template-columns:1fr}
  .eq{font-size:42px}
  .gcard{font-size:11px;min-height:30px;padding:5px 0 4px}
  .gcard i{font-size:7px}
  .gridrow{gap:2px}
  .slots{gap:4px}
  .opp-bot{flex-wrap:wrap}
  .rangeviz{width:100%}
  .sz-meta{gap:8px}
  .srowout{grid-template-columns:70px 70px 1fr 24px}
  .snote{display:none}
  .hrow{grid-template-columns:40px 1fr 50px 60px}
  .hrow span:nth-child(4){display:none}
}
@media (prefers-reduced-motion:reduce){ .root *{transition:none!important} }
`;
