import { BOARD_SPACES, COLOR_GROUP_SIZES } from '@umukino/board-data';
import {
  GameState, Player, PropertyState, SpaceType, TurnPhase,
} from '@umukino/shared-types';

export type BotDifficulty = 'aggressive' | 'hard' | 'strategic';

const MIN_CASH_BUFFER = 5000;
const BUILD_RESERVE = 15000;
const AGGRESSIVE_MIN_CASH = 2000;
const AGGRESSIVE_BUILD_RESERVE = 8000;

interface RiskAnalysis {
  opponentThreat: number;
  liquidAssets: number;
  netWorth: number;
  propertyValue: number;
}

function colorGroupSize(color: string): number {
  return COLOR_GROUP_SIZES[color as keyof typeof COLOR_GROUP_SIZES] ?? 3;
}

function ownedInGroup(state: GameState, playerId: string, color: string): number[] {
  return state.properties
    .filter(p => {
      const s = BOARD_SPACES[p.spaceIndex];
      return s?.color === color && p.ownerId === playerId;
    })
    .map(p => p.spaceIndex);
}

function countGroupOwnership(state: GameState, color: string): { mine: number; total: number } {
  const indices = BOARD_SPACES
    .map((s, i) => ({ s, i }))
    .filter(({ s }) => s?.color === color && s?.type === SpaceType.PROPERTY)
    .map(({ i }) => i);
  const mine = indices.filter(idx =>
    state.properties.find(p => p.spaceIndex === idx)?.ownerId === state.players[state.currentPlayerIndex]?.id,
  ).length;
  return { mine, total: indices.length };
}

function propertyNetWorth(state: GameState, player: Player): number {
  let worth = player.balance;
  for (const idx of player.properties) {
    const prop = state.properties.find(p => p.spaceIndex === idx);
    const space = BOARD_SPACES[idx];
    if (!prop || !space?.price) continue;
    worth += space.price;
    if (prop.hotel) worth += (space.hotelPrice || 0) + (space.housePrice || 0) * 4;
    else worth += prop.houses * (space.housePrice || 0);
    if (prop.mortgaged) worth -= Math.floor(space.price * 0.4);
  }
  return worth;
}

function findUnrelatedProperties(state: GameState, playerId: string): number[] {
  const playerProps = state.properties.filter(p => p.ownerId === playerId).map(p => p.spaceIndex);
  const unrelated: number[] = [];

  for (const propIdx of playerProps) {
    const space = BOARD_SPACES[propIdx];
    if (!space?.color) continue;

    const groupCount = BOARD_SPACES
      .filter((s, i) => s?.color === space.color && (state.properties.find(p => p.spaceIndex === i)?.ownerId ?? null) === playerId)
      .length;
    const groupTotal = colorGroupSize(space.color);

    if (groupCount < groupTotal) {
      unrelated.push(propIdx);
    }
  }

  return unrelated;
}

/**
 * Advanced Bot Brain with Strategic Decision Making
 * Supports multiple difficulty levels with adaptive strategies
 */
export class BotBrain {
  constructor(private readonly difficulty: BotDifficulty = 'hard') {}

  decide(state: GameState, bot: Player): { action: string; amount?: number; spaceIndex?: number } | null {
    switch (state.turnPhase) {
      case TurnPhase.ROLL:
        return { action: 'roll' };
      case TurnPhase.BUY_DECISION:
        return this.decideBuy(state, bot);
      case TurnPhase.AUCTION:
        return this.decideAuction(state, bot);
      case TurnPhase.JAIL_DECISION:
        return this.decideJail(state, bot);
      case TurnPhase.END:
        return this.decideEndPhase(state, bot);
      case TurnPhase.PAYING_RENT:
        return this.decidePayRent(state, bot);
      default:
        return null;
    }
  }

  private riskAnalysis(state: GameState, bot: Player): RiskAnalysis {
    const opponents = state.players.filter(p => p.id !== bot.id && p.status !== 'BANKRUPT');
    const botWorth = propertyNetWorth(state, bot);

    let opponentThreat = 0;
    for (const opp of opponents) {
      const oppWorth = propertyNetWorth(state, opp);
      if (oppWorth > botWorth * 1.5) opponentThreat += 30;
      if (oppWorth > botWorth * 1.2) opponentThreat += 15;
    }

    return {
      opponentThreat: Math.min(opponentThreat, 100),
      liquidAssets: bot.balance,
      netWorth: botWorth,
      propertyValue: botWorth - bot.balance,
    };
  }

  private decideBuy(state: GameState, bot: Player): { action: string } {
    const space = BOARD_SPACES[bot.position];
    const price = space?.price || 0;

    if (!price) return { action: 'skip-buy' };

    const minCash = this.difficulty === 'aggressive' ? AGGRESSIVE_MIN_CASH : MIN_CASH_BUFFER;
    const afterBuy = bot.balance - price;
    if (afterBuy < minCash) return { action: 'skip-buy' };

    const risk = this.riskAnalysis(state, bot);

    // Aggressive: Buy almost everything
    if (this.difficulty === 'aggressive') {
      if (space.color && afterBuy > AGGRESSIVE_MIN_CASH) {
        return { action: 'buy' };
      }
      if ([SpaceType.AIRPORT, SpaceType.UTILITY].includes(space.type as SpaceType)) {
        if (afterBuy > AGGRESSIVE_MIN_CASH * 2) return { action: 'buy' };
      }
    }

    // Strategic monopoly completion
    const color = space.color;
    if (color) {
      const { mine, total } = countGroupOwnership(state, color);
      if (mine + 1 >= total) return { action: 'buy' };
      if (mine >= 2 && afterBuy > MIN_CASH_BUFFER * 2) return { action: 'buy' };
      if (mine === 1 && afterBuy > MIN_CASH_BUFFER * 3 && risk.opponentThreat < 40) {
        return { action: 'buy' };
      }
    }

    // Utility/Airport analysis
    if (space.type === SpaceType.AIRPORT) {
      const airportCount = state.properties.filter(
        p => BOARD_SPACES[p.spaceIndex]?.type === SpaceType.AIRPORT && p.ownerId === bot.id,
      ).length;
      if (airportCount >= 1 && afterBuy > MIN_CASH_BUFFER * 1.5) return { action: 'buy' };
      if (airportCount === 0 && afterBuy > MIN_CASH_BUFFER * 2) return { action: 'buy' };
    }

    if (space.type === SpaceType.UTILITY && bot.balance > price + MIN_CASH_BUFFER * 3) {
      return { action: 'buy' };
    }

    // Competitive blocking
    if (risk.opponentThreat > 60 && afterBuy > minCash) {
      return { action: 'buy' };
    }

    return { action: 'skip-buy' };
  }

  private decideAuction(state: GameState, bot: Player): { action: string; amount?: number } {
    const auction = state.activeAuction;
    if (!auction) return { action: 'finalize-auction' };

    const space = BOARD_SPACES[auction.spaceIndex];
    const marketValue = space?.price || auction.startPrice;
    const currentBid = auction.currentBid;
    const minBid = currentBid + Math.max(500, Math.floor(marketValue * 0.05));
    const maxBid = Math.floor(marketValue * (this.difficulty === 'aggressive' ? 1.5 : 1.2));

    // Aggressive: bid aggressively
    if (this.difficulty === 'aggressive') {
      if (bot.balance >= minBid + AGGRESSIVE_MIN_CASH) {
        const color = space?.color;
        if (color) {
          const { mine, total } = countGroupOwnership(state, color);
          if (mine + 1 >= total) {
            return { action: 'bid', amount: Math.min(minBid * 1.3, maxBid) };
          }
          if (mine > 0) {
            return { action: 'bid', amount: Math.min(minBid * 1.1, maxBid) };
          }
        }
        if (minBid < marketValue * 0.7) {
          return { action: 'bid', amount: minBid };
        }
      }
    }

    if (bot.balance < minBid + MIN_CASH_BUFFER) {
      if (auction.currentBidderId === bot.id) return { action: 'finalize-auction' };
      return { action: 'finalize-auction' };
    }

    // Strategic bidding
    const color = space?.color;
    if (color) {
      const { mine, total } = countGroupOwnership(state, color);
      if (mine + 1 >= total && minBid <= maxBid) {
        return { action: 'bid', amount: Math.min(minBid * 1.15, maxBid) };
      }
    }

    // Good value check
    if (minBid <= marketValue * 0.8 && minBid <= maxBid) {
      return { action: 'bid', amount: minBid };
    }

    return { action: 'finalize-auction' };
  }

  private decideJail(state: GameState, bot: Player): { action: string } {
    const risk = this.riskAnalysis(state, bot);
    const fine = 5000;

    // Aggressive: Pay and get out
    if (this.difficulty === 'aggressive') {
      if (bot.balance > fine + AGGRESSIVE_MIN_CASH) {
        return { action: 'jail-pay' };
      }
    }

    if (bot.jailFreeCards > 0) return { action: 'jail-card' };

    if (risk.opponentThreat > 70 && bot.balance > fine + BUILD_RESERVE) {
      return { action: 'jail-pay' };
    }

    if (bot.balance > fine + MIN_CASH_BUFFER) return { action: 'jail-pay' };
    return { action: 'roll' };
  }

  private decideEndPhase(state: GameState, bot: Player): { action: string; spaceIndex?: number } {
    const risk = this.riskAnalysis(state, bot);

    // Building decisions
    const canBuild = state.properties.filter(p => p.ownerId === bot.id && !p.mortgaged);
    for (const prop of canBuild) {
      const space = BOARD_SPACES[prop.spaceIndex];
      if (!space?.housePrice) continue;

      const color = space.color;
      if (!color) continue;

      const { mine, total } = countGroupOwnership(state, color);
      if (mine < total) continue;

      // Aggressive building
      if (this.difficulty === 'aggressive') {
        const buildCost = space.housePrice || 5000;
        if (bot.balance > buildCost + AGGRESSIVE_BUILD_RESERVE && prop.houses < 4) {
          return { action: 'build-house', spaceIndex: prop.spaceIndex };
        }
        if (bot.balance > (space.hotelPrice || 20000) + AGGRESSIVE_BUILD_RESERVE && prop.houses === 4 && !prop.hotel) {
          return { action: 'build-hotel', spaceIndex: prop.spaceIndex };
        }
      }

      // Strategic building
      const buildCost = space.housePrice || 5000;
      if (bot.balance > buildCost + BUILD_RESERVE && prop.houses < 4) {
        const rentMultiplier = 4 - prop.houses;
        if (rentMultiplier > 2 || risk.opponentThreat > 50) {
          return { action: 'build-house', spaceIndex: prop.spaceIndex };
        }
      }

      if (bot.balance > (space.hotelPrice || 20000) + BUILD_RESERVE && prop.houses === 4 && !prop.hotel) {
        return { action: 'build-hotel', spaceIndex: prop.spaceIndex };
      }
    }

    return { action: 'end-turn' };
  }

  private decidePayRent(state: GameState, bot: Player): { action: string; spaceIndex?: number } {
    if (bot.balance < 0) {
      const unrelated = findUnrelatedProperties(state, bot.id);
      for (const propIdx of unrelated) {
        const prop = state.properties.find(p => p.spaceIndex === propIdx);
        if (!prop || prop.mortgaged || prop.hotel) continue;
        const space = BOARD_SPACES[propIdx];
        if (space?.price) {
          const mortgageValue = Math.floor(space.price * 0.5);
          if (mortgageValue > 0) {
            return { action: 'mortgage', spaceIndex: propIdx };
          }
        }
      }
    }

    return { action: 'pay' };
  }
}
