import { shuffleDeck, handValue, type Card } from "./cards";
import { hashServerSeed, freshSeeds, type SeedInput } from "./rng";

/**
 * Blackjack — standard rules, dealer stands on soft 17, one split allowed (no resplit),
 * double on the initial two cards only, 3:2 blackjack payout, push on equal totals.
 *
 * State carries the full shuffled deck position + all hands; cards are dealt by
 * advancing `position` through the provably-fair deck reconstructed from seeds.
 */

export type BlackjackAction = "hit" | "stand" | "double" | "split";
export type HandResult = "win" | "lose" | "push" | "bust" | "blackjack";

export interface BlackjackHand {
  cards: Card[];
  bet: number;
  finished: boolean;
  busted: boolean;
  doubled: boolean;
}

export interface BlackjackState {
  serverSeed: string;
  clientSeed: string;
  nonce: number;
  position: number;
  hands: BlackjackHand[];
  currentHandIndex: number;
  dealerCards: Card[];
  stage: "player" | "done";
}

function encode(st: BlackjackState): string {
  return Buffer.from(JSON.stringify(st)).toString("base64");
}
function decode(s: string): BlackjackState {
  return JSON.parse(Buffer.from(s, "base64").toString());
}

function canSplit(hand: BlackjackHand, alreadySplit: boolean): boolean {
  return !alreadySplit && hand.cards.length === 2 && hand.cards[0].rank === hand.cards[1].rank;
}
function canDouble(hand: BlackjackHand): boolean {
  return hand.cards.length === 2;
}

function playDealer(st: BlackjackState): Card[] {
  const deck = shuffleDeck(st.serverSeed, st.clientSeed, st.nonce);
  const dealerCards = [...st.dealerCards];
  const allBusted = st.hands.every((h) => h.busted);
  if (!allBusted) {
    while (handValue(dealerCards).total < 17) {
      dealerCards.push(deck[st.position]);
      st.position++;
    }
  }
  return dealerCards;
}

function settleHand(hand: BlackjackHand, dealerCards: Card[]): { result: HandResult; profit: number } {
  if (hand.busted) return { result: "bust", profit: -hand.bet };
  const dealerValue = handValue(dealerCards);
  const playerValue = handValue(hand.cards);
  const dealerBust = dealerValue.total > 21;
  if (dealerBust || playerValue.total > dealerValue.total) return { result: "win", profit: hand.bet };
  if (playerValue.total === dealerValue.total) return { result: "push", profit: 0 };
  return { result: "lose", profit: -hand.bet };
}

// ─── Start ────────────────────────────────────────────────────────────────────

export interface BlackjackStartResult {
  playerCards: Card[];
  dealerUpCard: Card;
  dealerCards?: Card[];
  state: string | null;
  serverSeedHash: string;
  clientSeed: string;
  canDouble: boolean;
  canSplit: boolean;
  stage: "player" | "done";
  result?: HandResult;
  profit?: number;
  serverSeed?: string;
}

export function blackjackStart(betAmount: number, seeds: SeedInput = freshSeeds()): BlackjackStartResult {
  const { serverSeed, clientSeed, nonce } = seeds;
  const deck = shuffleDeck(serverSeed, clientSeed, nonce);

  const playerCards = [deck[0], deck[2]];
  const dealerCards = [deck[1], deck[3]];
  const position = 4;

  const hand: BlackjackHand = { cards: playerCards, bet: betAmount, finished: false, busted: false, doubled: false };
  const playerBJ = handValue(playerCards).blackjack;
  const dealerBJ = handValue(dealerCards).blackjack;

  if (playerBJ || dealerBJ) {
    hand.finished = true;
    let result: HandResult;
    let profit: number;
    if (playerBJ && dealerBJ) { result = "push"; profit = 0; }
    else if (playerBJ) { result = "blackjack"; profit = Math.floor(betAmount * 1.5); }
    else { result = "lose"; profit = -betAmount; }

    return {
      playerCards, dealerUpCard: dealerCards[0], dealerCards,
      state: null, serverSeedHash: hashServerSeed(serverSeed), clientSeed,
      canDouble: false, canSplit: false, stage: "done",
      result, profit, serverSeed,
    };
  }

  const st: BlackjackState = {
    serverSeed, clientSeed, nonce, position,
    hands: [hand], currentHandIndex: 0, dealerCards, stage: "player",
  };

  return {
    playerCards, dealerUpCard: dealerCards[0],
    state: encode(st), serverSeedHash: hashServerSeed(serverSeed), clientSeed,
    canDouble: canDouble(hand), canSplit: canSplit(hand, false), stage: "player",
  };
}

// ─── Action ───────────────────────────────────────────────────────────────────

export interface BlackjackActionResult {
  hands: BlackjackHand[];
  currentHandIndex: number;
  stage: "player" | "done";
  state: string | null;
  canDouble: boolean;
  canSplit: boolean;
  dealerCards?: Card[];
  results?: HandResult[];
  profit?: number;
  serverSeed?: string;
}

export function blackjackAction(
  encodedState: string,
  action: BlackjackAction,
): BlackjackActionResult | { error: string } {
  let st: BlackjackState;
  try { st = decode(encodedState); } catch { return { error: "Invalid state" }; }

  const deck = shuffleDeck(st.serverSeed, st.clientSeed, st.nonce);
  const hand = st.hands[st.currentHandIndex];
  const alreadySplit = st.hands.length > 1;

  if (action === "hit") {
    hand.cards.push(deck[st.position]); st.position++;
    if (handValue(hand.cards).total > 21) { hand.busted = true; hand.finished = true; }
    else if (handValue(hand.cards).total === 21) { hand.finished = true; }
  } else if (action === "stand") {
    hand.finished = true;
  } else if (action === "double") {
    if (!canDouble(hand)) return { error: "Cannot double" };
    hand.doubled = true;
    hand.bet *= 2;
    hand.cards.push(deck[st.position]); st.position++;
    if (handValue(hand.cards).total > 21) hand.busted = true;
    hand.finished = true;
  } else if (action === "split") {
    if (!canSplit(hand, alreadySplit)) return { error: "Cannot split" };
    const newHand: BlackjackHand = { cards: [hand.cards[1]], bet: hand.bet, finished: false, busted: false, doubled: false };
    hand.cards = [hand.cards[0]];
    hand.cards.push(deck[st.position]); st.position++;
    newHand.cards.push(deck[st.position]); st.position++;
    st.hands.splice(st.currentHandIndex + 1, 0, newHand);
  }

  // Advance to next unfinished hand
  while (st.currentHandIndex < st.hands.length && st.hands[st.currentHandIndex].finished) {
    st.currentHandIndex++;
  }

  if (st.currentHandIndex >= st.hands.length) {
    const dealerCards = playDealer(st);
    const results: HandResult[] = [];
    let totalProfit = 0;
    for (const h of st.hands) {
      const { result, profit } = settleHand(h, dealerCards);
      results.push(result);
      totalProfit += profit;
    }
    return {
      hands: st.hands, currentHandIndex: st.currentHandIndex, stage: "done",
      state: null, canDouble: false, canSplit: false,
      dealerCards, results, profit: totalProfit, serverSeed: st.serverSeed,
    };
  }

  const current = st.hands[st.currentHandIndex];
  return {
    hands: st.hands, currentHandIndex: st.currentHandIndex, stage: "player",
    state: encode(st),
    canDouble: canDouble(current),
    canSplit: canSplit(current, st.hands.length > 1),
  };
}
