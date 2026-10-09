/** FSRS-4.5 spaced repetition with default weights (target retention 0.9), mastery and readiness. */
export interface Card { stability: number; difficulty: number; reps: number; lapses: number; last: number; due: number }
export type Grade = 1 | 2 | 3 | 4;
export interface Progress { v: number; cards: Record<string, Card>; answers: Record<string, { r: number; w: number }>; review: Record<string, any>; reviewer: string; last: { id: string; at: number } | null; lastPath: string | null; updatedAt: number }

const w = [0.4872, 1.4003, 3.7145, 13.8206, 5.1618, 1.2298, 0.8975, 0.031, 1.6474, 0.1367, 1.0461, 2.1072, 0.0793, 0.3246, 1.587, 0.2272, 2.8755];
const DECAY = -0.5, FACTOR = 19 / 81, RET = 0.9, DAY = 864e5;
const clampD = (d: number) => Math.min(10, Math.max(1, d));
const R = (t: number, S: number) => Math.pow(1 + FACTOR * t / S, DECAY);
const interval = (S: number) => Math.max(1, Math.round(S / FACTOR * (Math.pow(RET, 1 / DECAY) - 1)));
const D0 = (g: number) => clampD(w[4] - (g - 3) * w[5]);

export const FSRS = {
  DAY,
  retrievability(card: Card | undefined | null, now = Date.now()): number {
    if (!card || !card.last) return 0; return R(Math.max(0, (now - card.last) / DAY), card.stability);
  },
  review(card: Card | undefined | null, g: Grade, now = Date.now()): Card {
    if (!card || !card.reps) { const S = w[g - 1]; return { stability: S, difficulty: D0(g), reps: 1, lapses: g === 1 ? 1 : 0, last: now, due: now + (g === 1 ? 10 * 6e4 : interval(S) * DAY) }; }
    const t = Math.max(0, (now - card.last) / DAY), r = R(t, card.stability);
    const D = clampD(w[7] * D0(4) + (1 - w[7]) * (card.difficulty - w[6] * (g - 3)));
    const S = g === 1
      ? w[11] * Math.pow(D, -w[12]) * (Math.pow(card.stability + 1, w[13]) - 1) * Math.exp(w[14] * (1 - r))
      : card.stability * (1 + Math.exp(w[8]) * (11 - D) * Math.pow(card.stability, -w[9]) * (Math.exp(w[10] * (1 - r)) - 1) * (g === 2 ? w[15] : 1) * (g === 4 ? w[16] : 1));
    return { stability: S, difficulty: D, reps: card.reps + 1, lapses: card.lapses + (g === 1 ? 1 : 0), last: now, due: now + (g === 1 ? 10 * 6e4 : interval(S) * DAY) };
  },
  preview(card: Card | undefined | null, g: Grade, now = Date.now()): number { return FSRS.review(card, g, now).due - now; },
};

interface MasteryGraph { quizFor: Record<string, string[]>; nodes: Record<string, any> }

/** 0.6 × the node card's retrievability + 0.4 × mean of its quiz cards' retrievability and answer accuracy. */
export function mastery(G: MasteryGraph, P: Progress, id: string, now = Date.now()): number {
  const card = P.cards["n:" + id]; const r = FSRS.retrievability(card, now);
  const qs = (G.quizFor[id] || []).map(q => P.cards["q:" + q]).filter(Boolean);
  const qr = qs.length ? qs.reduce((s, c) => s + FSRS.retrievability(c, now), 0) / qs.length : null;
  const tally = P.answers[id]; const acc = tally && tally.r + tally.w ? tally.r / (tally.r + tally.w) : null;
  const others = [qr, acc].filter((x): x is number => x !== null);
  if (card) return Math.max(0, Math.min(1, 0.6 * r + 0.4 * (others.length ? others.reduce((a, b) => a + b, 0) / others.length : r)));
  return others.length ? Math.max(0, Math.min(1, others.reduce((a, b) => a + b, 0) / others.length)) : 0;
}

export function readiness(G: MasteryGraph, P: Progress, id: string, now?: number) {
  const pre: string[] = (G.nodes[id].uses || []).filter((u: string) => G.nodes[u]);
  const known = pre.filter(u => mastery(G, P, u, now) >= 0.7);
  return { total: pre.length, known: known.length, missing: pre.filter(u => !known.includes(u)), ready: known.length === pre.length };
}
