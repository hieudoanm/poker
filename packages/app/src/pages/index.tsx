import {
	evaluate7Perfect,
	calculateHandVsHandEquity,
} from '@poker/services/evaluate.service';

import { Card } from '@poker/types';
import type { NextPage } from 'next';
import { useMemo, useState } from 'react';

/* =========================================================
   CARD CONSTANTS
   ========================================================= */

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

const suits = ['♣️', '♦️', '♥️', '♠️'];

const fullCards: Card[] = suits.flatMap((suit) =>
	ranks.map((rank) => ({ rank, suit })),
);

/* =========================================================
   HAND NAME MAP
   ========================================================= */

const handNameMap: Record<string, string> = {
	HIGH: 'High Card',
	PAIR: 'One Pair',
	TWOPAIR: 'Two Pair',
	TRIPS: 'Three of a Kind',
	STRAIGHT: 'Straight',
	FLUSH: 'Flush',
	FULLHOUSE: 'Full House',
	QUADS: 'Four of a Kind',
	STRAIGHTFLUSH: 'Straight Flush',
};

/* =========================================================
   CARD UI
   ========================================================= */

const CardComponent = ({ card }: { card: Card }) => (
	<div className="flex h-24 w-16 flex-col items-center justify-center rounded border py-1 text-center">
		<div className="text-2xl">{card.rank}</div>
		<div className="text-2xl">{card.suit}</div>
	</div>
);

/* =========================================================
   PAGE
   ========================================================= */

const HomePage: NextPage = () => {
	const [deck, setDeck] = useState<Card[]>(fullCards);

	const [community, setCommunity] = useState<(Card | null)[]>([
		null,
		null,
		null,
		null,
		null,
	]);

	const [hero, setHero] = useState<(Card | null)[]>([null, null]);

	const [villain, setVillain] = useState<(Card | null)[]>([null, null]);

	/* =======================================================
	   HAND BUILDERS
	   ======================================================= */

	const heroHand = useMemo(
		() => [...hero, ...community].filter(Boolean) as Card[],
		[hero, community],
	);

	const villainHand = useMemo(
		() => [...villain, ...community].filter(Boolean) as Card[],
		[villain, community],
	);

	/* =======================================================
	   RANKS
	   ======================================================= */

	const heroRank = useMemo(() => {
		if (heroHand.length < 5) return null;
		return evaluate7Perfect(heroHand);
	}, [heroHand]);

	const villainRank = useMemo(() => {
		if (villainHand.length < 5) return null;
		return evaluate7Perfect(villainHand);
	}, [villainHand]);

	/* =======================================================
	   EQUITY
	   ======================================================= */

	const equity = useMemo(() => {
		if (hero.includes(null) || villain.includes(null)) return null;

		return calculateHandVsHandEquity(
			hero as [Card, Card],
			villain as [Card, Card],
			community.filter(Boolean) as Card[],
			5000,
		);
	}, [hero, villain, community]);

	/* =======================================================
	   ACTIONS
	   ======================================================= */

	const shuffle = () => {
		const shuffled = [...fullCards].sort(() => Math.random() - 0.5);

		setDeck(shuffled);
		setHero([null, null]);
		setVillain([null, null]);
		setCommunity([null, null, null, null, null]);
	};

	const draw = () => {
		const card = deck[0];
		setDeck((d) => d.slice(1));
		return card;
	};

	const addHero = () => {
		const nullCards = hero.filter((c) => !c);
		if (nullCards.length === 0) return;

		setHero((prev) => {
			const next = [...prev];
			const i = next.findIndex((c) => !c);
			if (i !== -1) next[i] = draw();
			return next;
		});
	};

	const addVillain = () => {
		const nullCards = villain.filter((c) => !c);
		if (nullCards.length === 0) return;

		setVillain((prev) => {
			const next = [...prev];
			const i = next.findIndex((c) => !c);
			if (i !== -1) next[i] = draw();
			return next;
		});
	};

	const addBoard = () => {
		const nullCards = community.filter((c) => !c);
		if (nullCards.length === 0) return;

		setCommunity((prev) => {
			const next = [...prev];
			const i = next.findIndex((c) => !c);
			if (i !== -1) next[i] = draw();
			return next;
		});
	};

	/* =======================================================
	   RENDER
	   ======================================================= */

	return (
		<div className="flex h-screen items-center justify-center p-8">
			<div className="flex flex-col gap-8">
				{/* -------- Page Title -------- */}

				<div className="text-center">
					<h1 className="text-2xl font-bold md:text-3xl">
						Poker Equity Calculator
					</h1>
					<p className="text-sm opacity-60">Hero vs Villain Hand Simulator</p>
				</div>

				{/* -------- Villain -------- */}

				<div className="flex flex-col items-center gap-2">
					<p className="text-sm opacity-60">Villain</p>

					<div className="flex gap-3">
						{villain.map((c, i) =>
							c ? (
								<CardComponent key={i} card={c} />
							) : (
								<div
									key={i}
									className="flex h-24 w-16 items-center justify-center rounded border border-dashed text-xs">
									hole
								</div>
							),
						)}
					</div>

					{villainRank && (
						<p className="text-xs opacity-70">{handNameMap[villainRank]}</p>
					)}
				</div>

				{/* -------- Board -------- */}

				<div className="grid grid-cols-3 items-center justify-center gap-3 md:grid-cols-5">
					{community.map((c, i) =>
						c ? (
							<CardComponent key={i} card={c} />
						) : (
							<div
								key={i}
								className="flex h-24 w-16 items-center justify-center rounded border border-dashed text-xs">
								{i < 3 ? 'flop' : i === 3 ? 'turn' : 'river'}
							</div>
						),
					)}
				</div>

				{/* -------- Hero -------- */}

				<div className="flex flex-col items-center gap-2">
					<p className="text-sm opacity-60">Hero</p>

					<div className="flex gap-3">
						{hero.map((c, i) =>
							c ? (
								<CardComponent key={i} card={c} />
							) : (
								<div
									key={i}
									className="flex h-24 w-16 items-center justify-center rounded border border-dashed text-xs">
									hole
								</div>
							),
						)}
					</div>

					{heroRank && (
						<p className="text-xs opacity-70">{handNameMap[heroRank]}</p>
					)}
				</div>

				{/* -------- Equity -------- */}

				{equity && (
					<div className="space-y-1 text-center text-sm">
						<div>Hero Win: {equity.heroPct}%</div>
						<div>Villain Win: {equity.villainPct}%</div>
						<div>Tie: {equity.tiePct}%</div>
					</div>
				)}

				{/* -------- Actions -------- */}

				<div className="flex flex-wrap justify-center gap-3">
					<button className="btn btn-outline btn-sm" onClick={shuffle}>
						Shuffle
					</button>

					<button
						className="btn btn-outline btn-sm"
						onClick={addHero}
						disabled={hero.filter((c) => !c).length === 0}>
						Add Hero
					</button>

					<button
						className="btn btn-outline btn-sm"
						onClick={addVillain}
						disabled={villain.filter((c) => !c).length === 0}>
						Add Villain
					</button>

					<button
						className="btn btn-outline btn-sm"
						onClick={addBoard}
						disabled={community.filter((c) => !c).length === 0}>
						Add Board
					</button>
				</div>
			</div>
		</div>
	);
};

export default HomePage;
