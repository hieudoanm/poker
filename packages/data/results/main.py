import itertools
import csv
from collections import Counter

# =========================================================
# CARD SETUP
# =========================================================

RANKS = "23456789TJQKA"
SUITS = "CDHS"

deck = [r + s for r in RANKS for s in SUITS]

TOTAL_HANDS = 2598960


# =========================================================
# HAND EVALUATOR
# =========================================================


def evaluate_hand(hand):
    ranks = sorted([c[0] for c in hand], key=RANKS.index)
    suits = [c[1] for c in hand]

    rank_counts = Counter(ranks)
    counts = sorted(rank_counts.values(), reverse=True)

    is_flush = len(set(suits)) == 1

    # Straight detection
    rank_indices = sorted(RANKS.index(r) for r in ranks)

    is_straight = False

    if rank_indices == list(range(rank_indices[0], rank_indices[0] + 5)):
        is_straight = True

    # Wheel straight (A2345)
    if rank_indices == [0, 1, 2, 3, 12]:
        is_straight = True

    # Classification
    if is_straight and is_flush:
        if ranks[-1] == "A":
            return "Royal Flush"
        return "Straight Flush"

    if counts == [4, 1]:
        return "Four of a Kind"

    if counts == [3, 2]:
        return "Full House"

    if is_flush:
        return "Flush"

    if is_straight:
        return "Straight"

    if counts == [3, 1, 1]:
        return "Three of a Kind"

    if counts == [2, 2, 1]:
        return "Two Pair"

    if counts == [2, 1, 1, 1]:
        return "One Pair"

    return "High Card"


# =========================================================
# ENUMERATE + COUNT + EXPORT
# =========================================================

hands_file = "csv/all_5card_hands_full_enumeration.csv"
totals_file = "csv/category_totals.csv"

category_counts = Counter()

print("Enumerating all 2,598,960 hands...")
print("Calculating totals dynamically...\n")

with open(hands_file, "w", newline="") as f:
    writer = csv.writer(f)

    writer.writerow(
        [
            "Card1",
            "Card2",
            "Card3",
            "Card4",
            "Card5",
            "HandString",
            "Category",
            "CategoryProbabilityPercent",
        ]
    )

    for i, hand in enumerate(itertools.combinations(deck, 5), 1):

        category = evaluate_hand(hand)
        category_counts[category] += 1

        writer.writerow(
            [hand[0], hand[1], hand[2], hand[3], hand[4], " ".join(hand), category, 0]
        )

        if i % 100000 == 0:
            print(f"{i:,} hands processed...")

print("\nEnumeration complete.\n")


# =========================================================
# CALCULATE FINAL PERCENTAGES
# =========================================================

category_pcts = {k: (v / TOTAL_HANDS) * 100 for k, v in category_counts.items()}

print("Computed CATEGORY_TOTALS:\n")

for k, v in sorted(category_counts.items(), key=lambda x: -x[1]):
    print(f"{k:20s} {v:>10,}  ({category_pcts[k]:.6f}%)")


# =========================================================
# WRITE CATEGORY TOTALS FILE
# =========================================================

print("\nWriting category totals to file...\n")

with open(totals_file, "w", newline="") as f:
    writer = csv.writer(f)

    writer.writerow(["Category", "Count", "ProbabilityPercent"])

    for category, count in sorted(category_counts.items(), key=lambda x: -x[1]):
        writer.writerow([category, count, f"{category_pcts[category]:.6f}"])

print(f"Category totals saved → {totals_file}")


# =========================================================
# REWRITE HAND CSV WITH FINAL %
# =========================================================

print("\nRewriting hand CSV with final percentages...\n")

temp_rows = []

with open(hands_file, "r") as f:
    reader = csv.reader(f)
    header = next(reader)

    for row in reader:
        category = row[6]
        pct = category_pcts[category]
        row[7] = f"{pct:.6f}"
        temp_rows.append(row)

with open(hands_file, "w", newline="") as f:
    writer = csv.writer(f)
    writer.writerow(header)
    writer.writerows(temp_rows)

print("Done!")
print(f"Hands CSV saved → {hands_file}")

# =========================================================
# PREFLOP 169 HEATMAP GENERATION
# =========================================================

print("\nGenerating Preflop 169 Heatmap...\n")

heatmap_file = "csv/preflop_169_heatmap.csv"

rank_order = list(RANKS)[::-1]  # A → 2

# Combo counts
PAIR_COMBOS = 6
SUITED_COMBOS = 4
OFFSUIT_COMBOS = 12

TOTAL_PREFLOP_COMBOS = 1326  # C(52,2)

heatmap_rows = []

for r1 in rank_order:
    row = []

    for r2 in rank_order:

        if r1 == r2:
            label = r1 + r2
            combos = PAIR_COMBOS

        else:
            i1 = RANKS.index(r1)
            i2 = RANKS.index(r2)

            # Upper triangle → suited
            if i1 < i2:
                label = r1 + r2 + "s"
                combos = SUITED_COMBOS

            # Lower triangle → offsuit
            else:
                label = r2 + r1 + "o"
                combos = OFFSUIT_COMBOS

        pct = (combos / TOTAL_PREFLOP_COMBOS) * 100

        row.append({"Hand": label, "Combos": combos, "ProbabilityPercent": pct})

    heatmap_rows.append(row)


# =========================================================
# WRITE HEATMAP CSV
# =========================================================

print("Writing heatmap CSV...\n")

with open(heatmap_file, "w", newline="") as f:
    writer = csv.writer(f)

    # Header
    writer.writerow([""] + rank_order)

    for r_label, row in zip(rank_order, heatmap_rows):
        writer.writerow(
            [r_label] + [f"{c['Hand']} ({c['ProbabilityPercent']:.3f}%)" for c in row]
        )

print(f"Heatmap saved → {heatmap_file}")
