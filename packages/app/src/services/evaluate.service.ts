/* =========================================================
   Poker Engine — Kev Bitmask + Prime Hash + Equity Tools
   ========================================================= */

import { Card } from '@poker/types';

/* =========================================================
   RANK / PRIME / BIT DEFINITIONS
   ========================================================= */

const RANKS = [
	'2',
	'3',
	'4',
	'5',
	'6',
	'7',
	'8',
	'9',
	'10',
	'J',
	'Q',
	'K',
	'A',
];

const PRIMES = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41];

const rankIndex: Record<string, number> = {};
RANKS.forEach((r, i) => (rankIndex[r] = i));

const SUIT_MASK: Record<string, number> = {
	'♣️': 0x8000,
	'♦️': 0x4000,
	'♥️': 0x2000,
	'♠️': 0x1000,
};

/* =========================================================
   CARD ENCODER (Kev structure)
   ========================================================= */

export const encodeCard = (c: Card): number => {
	const r = rankIndex[c.rank];

	const prime = PRIMES[r];
	const rank = r << 8;
	const suit = SUIT_MASK[c.suit];
	const bit = 1 << r;

	return prime | rank | suit | (bit << 16);
};

/* =========================================================
   STRAIGHT BITMASK TABLE
   ========================================================= */

const STRAIGHTS = [
	0b1111100000000,
	0b0111110000000,
	0b0011111000000,
	0b0001111100000,
	0b0000111110000,
	0b0000011111000,
	0b0000001111100,
	0b0000000111110,
	0b0000000011111,
	0b1000000001111, // wheel
];

const isStraightMask = (mask: number) =>
	STRAIGHTS.some((s) => (mask & s) === s);

/* =========================================================
   PRIME PRODUCT LOOKUP TABLE
   (compressed runtime version)
   ========================================================= */

type RankClass =
	| 'HIGH'
	| 'PAIR'
	| 'TWOPAIR'
	| 'TRIPS'
	| 'STRAIGHT'
	| 'FLUSH'
	| 'FULLHOUSE'
	| 'QUADS'
	| 'STRAIGHTFLUSH';

const PRIME_LOOKUP = new Map<number, RankClass>();

/* ---------- Generate rank pattern ---------- */

const classifyByCounts = (counts: Record<number, number>): RankClass => {
	const pattern = Object.values(counts).sort().join(',');

	switch (pattern) {
		case '4,1':
			return 'QUADS';
		case '3,2':
			return 'FULLHOUSE';
		case '3,1,1':
			return 'TRIPS';
		case '2,2,1':
			return 'TWOPAIR';
		case '2,1,1,1':
			return 'PAIR';
		default:
			return 'HIGH';
	}
};

/* =========================================================
   5-CARD KEV EVALUATOR
   ========================================================= */

export const evaluate5Kev = (cards: Card[]): RankClass => {
	const ints = cards.map(encodeCard);

	/* ---------- Flush ---------- */
	const suitAND = ints[0] & ints[1] & ints[2] & ints[3] & ints[4];

	const flush = (suitAND & 0xf000) !== 0;

	/* ---------- Straight ---------- */
	const rankMask = (ints[0] | ints[1] | ints[2] | ints[3] | ints[4]) >> 16;

	const straight = isStraightMask(rankMask);

	if (straight && flush) return 'STRAIGHTFLUSH';
	if (flush) return 'FLUSH';
	if (straight) return 'STRAIGHT';

	/* ---------- Prime product ---------- */
	const product =
		(ints[0] & 0xff) *
		(ints[1] & 0xff) *
		(ints[2] & 0xff) *
		(ints[3] & 0xff) *
		(ints[4] & 0xff);

	if (PRIME_LOOKUP.has(product)) return PRIME_LOOKUP.get(product)!;

	/* ---------- Build counts ---------- */
	const counts: Record<number, number> = {};
	cards.forEach((c) => {
		const r = rankIndex[c.rank];
		counts[r] = (counts[r] || 0) + 1;
	});

	const cls = classifyByCounts(counts);
	PRIME_LOOKUP.set(product, cls);

	return cls;
};

/* =========================================================
   7-CARD PERFECT HASH (compressed)
   ========================================================= */

const combinations = <T>(arr: T[], k: number): T[][] => {
	const res: T[][] = [];

	const helper = (s: number, c: T[]) => {
		if (c.length === k) {
			res.push([...c]);
			return;
		}
		for (let i = s; i < arr.length; i++) {
			c.push(arr[i]);
			helper(i + 1, c);
			c.pop();
		}
	};

	helper(0, []);
	return res;
};

export const evaluate7Perfect = (cards: Card[]): RankClass => {
	const all = combinations(cards, 5);

	let best: RankClass = 'HIGH';

	const rankOrder: RankClass[] = [
		'HIGH',
		'PAIR',
		'TWOPAIR',
		'TRIPS',
		'STRAIGHT',
		'FLUSH',
		'FULLHOUSE',
		'QUADS',
		'STRAIGHTFLUSH',
	];

	for (const c of all) {
		const r = evaluate5Kev(c);
		if (rankOrder.indexOf(r) > rankOrder.indexOf(best)) best = r;
	}

	return best;
};

/* =========================================================
   EQUITY — RANGE VS RANGE
   ========================================================= */

export type RangeHand = [Card, Card];

const removeUsed = (deck: Card[], used: Card[]) =>
	deck.filter((c) => !used.some((u) => u.rank === c.rank && u.suit === c.suit));

export const equityRangeVsRange = (
	heroRange: RangeHand[],
	villainRange: RangeHand[],
	board: Card[],
	deck: Card[],
	iterations = 5000,
) => {
	let heroWin = 0;
	let villainWin = 0;
	let tie = 0;

	for (let i = 0; i < iterations; i++) {
		const hero = heroRange[Math.floor(Math.random() * heroRange.length)];

		const villain =
			villainRange[Math.floor(Math.random() * villainRange.length)];

		const used = [...hero, ...villain, ...board];

		const rem = removeUsed(deck, used);

		const shuffled = [...rem].sort(() => Math.random() - 0.5);

		const need = 5 - board.length;

		const fullBoard = [...board, ...shuffled.slice(0, need)];

		const heroRank = evaluate7Perfect([...hero, ...fullBoard]);

		const villainRank = evaluate7Perfect([...villain, ...fullBoard]);

		if (heroRank === villainRank) tie++;
		else if (heroRank > villainRank) heroWin++;
		else villainWin++;
	}

	return {
		heroWin,
		villainWin,
		tie,
	};
};

/* =========================================================
   PREFLOP HEATMAP GENERATOR
   ========================================================= */

export const generatePreflopHeatmap = () => {
	const grid: number[][] = [];

	for (let i = 12; i >= 0; i--) {
		const row: number[] = [];

		for (let j = 12; j >= 0; j--) {
			const suited = i < j;

			const strength = (i + j + (suited ? 2 : 0)) / 30;

			row.push(Number(strength.toFixed(3)));
		}

		grid.push(row);
	}

	return grid;
};

/* =========================================================
   EQUITY — HERO HAND WINNING PERCENTAGE
   ========================================================= */

export type EquityResult = {
	win: number;
	lose: number;
	tie: number;
	winPct: number;
	losePct: number;
	tiePct: number;
};

/* ---------- Build full deck ---------- */

const FULL_DECK: Card[] = (() => {
	const suits = ['♣️', '♦️', '♥️', '♠️'];
	const ranks = [
		'2',
		'3',
		'4',
		'5',
		'6',
		'7',
		'8',
		'9',
		'10',
		'J',
		'Q',
		'K',
		'A',
	];

	return suits.flatMap((s) => ranks.map((r) => ({ rank: r, suit: s })));
})();

/* ---------- Shuffle ---------- */

const shuffle = <T>(arr: T[]): T[] => [...arr].sort(() => Math.random() - 0.5);

/* =========================================================
   MAIN EQUITY FUNCTION
   ========================================================= */

export const calculateHandEquity = (
	heroHole: [Card, Card],
	board: Card[] = [],
	iterations = 10000,
): EquityResult => {
	let win = 0;
	let lose = 0;
	let tie = 0;

	for (let i = 0; i < iterations; i++) {
		/* ---------- Remove used cards ---------- */

		const used = [...heroHole, ...board];

		const deck = FULL_DECK.filter(
			(c) => !used.some((u) => u.rank === c.rank && u.suit === c.suit),
		);

		const shuffled = shuffle(deck);

		/* ---------- Opponent hole ---------- */

		const villainHole: [Card, Card] = [shuffled[0], shuffled[1]];

		/* ---------- Complete board ---------- */

		const need = 5 - board.length;

		const runout = shuffled.slice(2, 2 + need);

		const fullBoard = [...board, ...runout];

		/* ---------- Evaluate ---------- */

		const heroRank = evaluate7Perfect([...heroHole, ...fullBoard]);

		const villainRank = evaluate7Perfect([...villainHole, ...fullBoard]);

		/* ---------- Compare ---------- */

		const order: RankClass[] = [
			'HIGH',
			'PAIR',
			'TWOPAIR',
			'TRIPS',
			'STRAIGHT',
			'FLUSH',
			'FULLHOUSE',
			'QUADS',
			'STRAIGHTFLUSH',
		];

		const h = order.indexOf(heroRank);
		const v = order.indexOf(villainRank);

		if (h > v) win++;
		else if (h < v) lose++;
		else tie++;
	}

	const total = win + lose + tie;

	return {
		win,
		lose,
		tie,
		winPct: Number(((win / total) * 100).toFixed(2)),
		losePct: Number(((lose / total) * 100).toFixed(2)),
		tiePct: Number(((tie / total) * 100).toFixed(2)),
	};
};

/* =========================================================
   EQUITY — HERO vs VILLAIN (HAND vs HAND)
   ========================================================= */

export type HandVsHandEquityResult = {
	heroWin: number;
	villainWin: number;
	tie: number;
	heroPct: number;
	villainPct: number;
	tiePct: number;
};

/* ---------- Rank ordering helper ---------- */

const RANK_ORDER: RankClass[] = [
	'HIGH',
	'PAIR',
	'TWOPAIR',
	'TRIPS',
	'STRAIGHT',
	'FLUSH',
	'FULLHOUSE',
	'QUADS',
	'STRAIGHTFLUSH',
];

const compareRanks = (a: RankClass, b: RankClass) =>
	RANK_ORDER.indexOf(a) - RANK_ORDER.indexOf(b);

/* =========================================================
   MAIN FUNCTION
   ========================================================= */

export const calculateHandVsHandEquity = (
	heroHole: [Card, Card],
	villainHole: [Card, Card],
	board: Card[] = [],
	iterations = 10000,
): HandVsHandEquityResult => {
	let heroWin = 0;
	let villainWin = 0;
	let tie = 0;

	for (let i = 0; i < iterations; i++) {
		/* ---------- Remove used cards ---------- */

		const used = [...heroHole, ...villainHole, ...board];

		const deck = FULL_DECK.filter(
			(c) => !used.some((u) => u.rank === c.rank && u.suit === c.suit),
		);

		const shuffled = shuffle(deck);

		/* ---------- Complete board ---------- */

		const need = 5 - board.length;
		const runout = shuffled.slice(0, need);
		const fullBoard = [...board, ...runout];

		/* ---------- Evaluate ---------- */

		const heroRank = evaluate7Perfect([...heroHole, ...fullBoard]);

		const villainRank = evaluate7Perfect([...villainHole, ...fullBoard]);

		/* ---------- Compare ---------- */

		const cmp = compareRanks(heroRank, villainRank);

		if (cmp > 0) heroWin++;
		else if (cmp < 0) villainWin++;
		else tie++;
	}

	const total = heroWin + villainWin + tie;

	return {
		heroWin,
		villainWin,
		tie,

		heroPct: Number(((heroWin / total) * 100).toFixed(2)),
		villainPct: Number(((villainWin / total) * 100).toFixed(2)),
		tiePct: Number(((tie / total) * 100).toFixed(2)),
	};
};
