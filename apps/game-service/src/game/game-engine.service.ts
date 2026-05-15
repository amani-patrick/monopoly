import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RedisService } from '../redis/redis.service';
import { EventBusService } from '../event-bus/event-bus.service';
import {
  GameState, Player, PropertyState, TurnPhase, PlayerStatus,
  GameStatus, SpaceType, GameCard, CardAction, Trade, TradeStatus,
  Auction, AuctionStatus,
} from '@umukino/shared-types';
import { GAME_EVENTS, REDIS_KEYS } from '@umukino/shared-events';
import {
  BOARD_SPACES, BOARD_CONFIG, SURPRISE_CARDS,
  TREASURE_CARDS, COLOR_GROUP_SIZES,
} from '@umukino/board-data';
import { GameRecord } from './entities/game.entity';
import { v4 as uuid } from 'uuid';

@Injectable()
export class GameEngineService {
  private readonly logger = new Logger(GameEngineService.name);

  constructor(
    @InjectRepository(GameRecord)
    private readonly gameRepo: Repository<GameRecord>,
    private readonly redis: RedisService,
    private readonly eventBus: EventBusService,
  ) {}

  // ============================================================
  // STATE MANAGEMENT
  // ============================================================

  async getState(gameId: string): Promise<GameState> {
    const raw = await this.redis.get(REDIS_KEYS.gameState(gameId));
    if (!raw) throw new BadRequestException(`Game ${gameId} not found`);
    return JSON.parse(raw) as GameState;
  }

  async saveState(state: GameState): Promise<void> {
    await this.redis.set(
      REDIS_KEYS.gameState(state.id),
      JSON.stringify(state),
      60 * 60 * 24, // 24h TTL
    );
  }

  // ============================================================
  // GAME INIT
  // ============================================================

  async initGame(roomId: string, players: Omit<Player, 'properties'>[], settings: GameState['settings']): Promise<GameState> {
    const gameId = uuid();

    const initialProperties: PropertyState[] = BOARD_SPACES
      .filter(s: any) => s.price !== undefined)
      .map(s: any) => ({
        spaceIndex: s.index,
        ownerId: null,
        houses: 0,
        hotel: false,
        mortgaged: false,
      }));

    const gamePlayers: Player[] = players.map((p: any, i: number) => ({
      ...p,
      position: 0,
      balance: settings.startingBalance,
      status: PlayerStatus.ACTIVE,
      jailTurns: 0,
      jailFreeCards: 0,
      doublesCount: 0,
      properties: [],
    }));

    const state: GameState = {
      id: gameId,
      roomId,
      status: GameStatus.ACTIVE,
      players: gamePlayers,
      properties: initialProperties,
      currentPlayerIndex: 0,
      turnPhase: TurnPhase.ROLL,
      diceValues: null,
      lastDiceRoll: null,
      doublesStreak: 0,
      round: 1,
      vacationPool: 0,
      activeAuction: null,
      activeTrade: null,
      pendingCard: null,
      settings,
      log: [],
      winner: null,
      createdAt: new Date().toISOString(),
      startedAt: new Date().toISOString(),
      finishedAt: null,
    };

    await this.saveState(state);

    // Persist game record to Postgres
    await this.gameRepo.save({
      id: gameId,
      roomId,
      status: GameStatus.ACTIVE,
      playerIds: gamePlayers.map(p: any) => p.userId),
      settings,
      startedAt: new Date(),
    });

    await this.eventBus.publish(GAME_EVENTS.GAME_STARTED, { gameId, state });
    this.logger.log(`Game ${gameId} started with ${gamePlayers.length} players`);
    return state;
  }

  // ============================================================
  // DICE & MOVEMENT
  // ============================================================

  async rollDice(gameId: string, playerId: string): Promise<GameState> {
    let state = await this.getState(gameId);
    this.assertTurn(state, playerId, TurnPhase.ROLL);

    const player = this.currentPlayer(state);

    // BUG 5 FIX: enforce SKIP_TURN card — if flagged, consume flag and end turn immediately
    if (player.skipNextTurn) {
      player.skipNextTurn = false;
      state.turnPhase = TurnPhase.END;
      this.log(state, playerId, 'Turn skipped (card effect)', {});
      await this.saveState(state);
      await this.eventBus.publish(GAME_EVENTS.GAME_STATE_SYNC, { gameId: state.id, state });
      return state;
    }

    const d1 = this.rollD6();
    const d2 = this.rollD6();
    const isDoubles = d1 === d2;
    const total = d1 + d2;

    state.diceValues = [d1, d2];
    state.lastDiceRoll = [d1, d2];

    // Jail handling
    if (player.status === PlayerStatus.IN_JAIL) {
      if (isDoubles) {
        player.status = PlayerStatus.ACTIVE;
        player.jailTurns = 0;
        state.doublesStreak = 0; // doubles from jail don't give extra roll
        this.log(state, playerId, 'Rolled doubles to exit jail', { d1, d2 });
        await this.eventBus.publish(GAME_EVENTS.JAIL_ROLLED_DOUBLES, { gameId, playerId });
        state = await this.movePlayer(state, player, total);
      } else {
        player.jailTurns += 1;
        if (player.jailTurns >= BOARD_CONFIG.maxJailTurns) {
          // Force pay fine
          state = await this.payJailFine(state, player);
          state = await this.movePlayer(state, player, total);
        } else {
          this.log(state, playerId, 'Failed jail roll', { d1, d2, jailTurns: player.jailTurns });
          await this.eventBus.publish(GAME_EVENTS.JAIL_FAILED_ROLL, { gameId, playerId, jailTurns: player.jailTurns });
          state.turnPhase = TurnPhase.END;
        }
      }
    } else {
      // Normal roll
      if (isDoubles) {
        state.doublesStreak += 1;
        if (state.doublesStreak >= 3) {
          // 3 doubles = go to jail
          state = this.sendToJail(state, player);
          state.turnPhase = TurnPhase.END;
          await this.saveState(state);
          return state;
        }
      } else {
        state.doublesStreak = 0;
      }

      await this.eventBus.publish(GAME_EVENTS.TURN_DICE_ROLLED, { gameId, playerId, d1, d2, total });
      state = await this.movePlayer(state, player, total);

      // If doubles and not jailed, get another roll
      if (isDoubles && player.status !== PlayerStatus.IN_JAIL && state.turnPhase === TurnPhase.END) {
        state.turnPhase = TurnPhase.ROLL;
      }
    }

    await this.saveState(state);
    await this.eventBus.publish(GAME_EVENTS.GAME_STATE_SYNC, { gameId, state });
    return state;
  }

  private async movePlayer(state: GameState, player: Player, steps: number): Promise<GameState> {
    const oldPos = player.position;
    const newPos = (oldPos + steps) % 40;
    const passedStart = newPos < oldPos && steps > 0;

    player.position = newPos;
    this.log(state, player.id, 'Player moved', { from: oldPos, to: newPos, steps });
    await this.eventBus.publish(GAME_EVENTS.TURN_PLAYER_MOVED, {
      gameId: state.id, playerId: player.id, from: oldPos, to: newPos,
    });

    if (passedStart) {
      player.balance += state.settings.passStartBonus;
      this.log(state, player.id, 'Passed Start, collected bonus', { amount: state.settings.passStartBonus });
      await this.eventBus.publish(GAME_EVENTS.START_PASSED, { gameId: state.id, playerId: player.id, amount: state.settings.passStartBonus });
    }

    return this.handleLanding(state, player, newPos);
  }

  // ============================================================
  // LANDING LOGIC
  // ============================================================

  private async handleLanding(state: GameState, player: Player, spaceIndex: number): Promise<GameState> {
    const space = BOARD_SPACES[spaceIndex];
    this.log(state, player.id, `Landed on: ${space.name}`, { spaceIndex });

    switch (space.type) {
      case SpaceType.CORNER_START:
        state.turnPhase = TurnPhase.END;
        break;

      case SpaceType.CORNER_JAIL:
        state.turnPhase = TurnPhase.END; // just visiting
        break;

      case SpaceType.CORNER_GO_TO_JAIL:
        state = this.sendToJail(state, player);
        state.turnPhase = TurnPhase.END;
        break;

      case SpaceType.CORNER_VACATION:
        if (state.settings.vacationCash && state.vacationPool > 0) {
          player.balance += state.vacationPool;
          this.log(state, player.id, 'Collected vacation pool', { amount: state.vacationPool });
          await this.eventBus.publish(GAME_EVENTS.VACATION_POOL_COLLECTED, {
            gameId: state.id, playerId: player.id, amount: state.vacationPool,
          });
          state.vacationPool = 0;
        }
        state.turnPhase = TurnPhase.END;
        break;

      case SpaceType.TAX:
        const taxAmount = space.taxAmount ?? Math.floor(player.balance * (space.taxPercent ?? 0) / 100);
        player.balance -= taxAmount;
        if (state.settings.vacationCash) state.vacationPool += taxAmount;
        this.log(state, player.id, 'Paid tax', { amount: taxAmount });
        await this.eventBus.publish(GAME_EVENTS.TAX_PAID, { gameId: state.id, playerId: player.id, amount: taxAmount });
        state.turnPhase = TurnPhase.END;
        break;

      case SpaceType.CARD:
        state = await this.drawCard(state, player, space.cardDeck!);
        break;

      case SpaceType.PROPERTY:
      case SpaceType.AIRPORT:
      case SpaceType.UTILITY:
        state = await this.handlePropertyLanding(state, player, spaceIndex);
        break;

      default:
        state.turnPhase = TurnPhase.END;
    }

    return state;
  }

  // ============================================================
  // PROPERTY LANDING
  // ============================================================

  private async handlePropertyLanding(state: GameState, player: Player, spaceIndex: number): Promise<GameState> {
    const propState = state.properties.find(p: any) => p.spaceIndex === spaceIndex)!;
    const space = BOARD_SPACES[spaceIndex];

    await this.eventBus.publish(GAME_EVENTS.PROPERTY_LANDED, { gameId: state.id, playerId: player.id, spaceIndex });

    if (!propState.ownerId) {
      // Unowned — offer to buy
      state.turnPhase = TurnPhase.BUY_DECISION;
      return state;
    }

    if (propState.ownerId === player.id) {
      state.turnPhase = TurnPhase.END;
      return state;
    }

    if (propState.mortgaged) {
      state.turnPhase = TurnPhase.END;
      return state;
    }

    const owner = state.players.find(p: any) => p.id === propState.ownerId)!;

    // No rent from jailed owner (if setting enabled)
    if (state.settings.noRentInJail && owner.status === PlayerStatus.IN_JAIL) {
      await this.eventBus.publish(GAME_EVENTS.RENT_WAIVED, { gameId: state.id, reason: 'owner_in_jail' });
      state.turnPhase = TurnPhase.END;
      return state;
    }

    const rent = this.calculateRent(state, propState, space, player);
    state = await this.transferMoney(state, player, owner, rent);
    this.log(state, player.id, 'Paid rent', { to: owner.id, amount: rent, spaceIndex });
    await this.eventBus.publish(GAME_EVENTS.RENT_COLLECTED, { gameId: state.id, from: player.id, to: owner.id, amount: rent, spaceIndex });

    // BUG 6 FIX: pass creditorId (owner) so anti-collusion proxy can detect sacrifice patterns
    state = await this.checkBankruptcy(state, player, owner.id);
    state.turnPhase = TurnPhase.END;
    return state;
  }

  private calculateRent(state: GameState, propState: PropertyState, space: any, renter: Player): number {
    const ownerId = propState.ownerId!;

    if (space.type === SpaceType.UTILITY) {
      const ownerUtils = state.properties.filter(
        p => BOARD_SPACES[p.spaceIndex]?.type === SpaceType.UTILITY && p.ownerId === ownerId,
      ).length;
      const mult = BOARD_CONFIG.utilityMultipliers[ownerUtils - 1];
      const diceTotal = (state.lastDiceRoll![0] + state.lastDiceRoll![1]);
      return diceTotal * mult * 1000; // scale for RWF
    }

    if (space.type === SpaceType.AIRPORT) {
      const ownerAirports = state.properties.filter(
        p => BOARD_SPACES[p.spaceIndex]?.type === SpaceType.AIRPORT && p.ownerId === ownerId,
      ).length;
      return BOARD_CONFIG.airportRents[ownerAirports - 1];
    }

    // City property
    if (propState.hotel) return space.rent[5];
    if (propState.houses > 0) return space.rent[propState.houses];

    // Base rent — check for full color group
    const groupSize = COLOR_GROUP_SIZES[space.group] ?? 1;
    const ownerGroupCount = state.properties.filter(
      p => BOARD_SPACES[p.spaceIndex]?.group === space.group && p.ownerId === ownerId,
    ).length;

    const hasFullSet = ownerGroupCount >= groupSize;
    const baseRent = space.rent[0];
    return hasFullSet && state.settings.doubleRentFullSet ? baseRent * 2 : baseRent;
  }

  // ============================================================
  // BUY / AUCTION
  // ============================================================

  async buyProperty(gameId: string, playerId: string): Promise<GameState> {
    let state = await this.getState(gameId);
    this.assertTurn(state, playerId, TurnPhase.BUY_DECISION);

    const player = this.currentPlayer(state);
    const space = BOARD_SPACES[player.position];

    if (!space.price) throw new BadRequestException('Space has no price');
    if (player.balance < space.price) throw new BadRequestException('Insufficient balance');

    player.balance -= space.price;
    const propState = state.properties.find(p: any) => p.spaceIndex === player.position)!;
    propState.ownerId = player.id;
    player.properties.push(player.position);

    this.log(state, playerId, 'Bought property', { spaceIndex: player.position, price: space.price });
    await this.eventBus.publish(GAME_EVENTS.PROPERTY_PURCHASED, {
      gameId, playerId, spaceIndex: player.position, price: space.price,
    });

    state.turnPhase = TurnPhase.END;
    await this.saveState(state);
    return state;
  }

  async skipBuy(gameId: string, playerId: string): Promise<GameState> {
    let state = await this.getState(gameId);
    this.assertTurn(state, playerId, TurnPhase.BUY_DECISION);

    const player = this.currentPlayer(state);
    const space = BOARD_SPACES[player.position];

    if (state.settings.auctionEnabled) {
      state = await this.startAuction(state, player.position, space.price! / 2);
    } else {
      await this.eventBus.publish(GAME_EVENTS.PROPERTY_SKIPPED, { gameId, playerId, spaceIndex: player.position });
      state.turnPhase = TurnPhase.END;
    }

    await this.saveState(state);
    return state;
  }

  private async startAuction(state: GameState, spaceIndex: number, startPrice: number): Promise<GameState> {
    const auction: Auction = {
      id: uuid(),
      gameId: state.id,
      spaceIndex,
      startPrice,
      currentBid: 0,
      currentBidderId: null,
      bids: [],
      status: AuctionStatus.ACTIVE,
      endsAt: new Date(Date.now() + BOARD_CONFIG.auctionTimeSeconds * 1000).toISOString(),
    };
    state.activeAuction = auction;
    state.turnPhase = TurnPhase.AUCTION;
    await this.eventBus.publish(GAME_EVENTS.AUCTION_STARTED, { gameId: state.id, auction });
    return state;
  }

  async placeBid(gameId: string, playerId: string, amount: number): Promise<GameState> {
    let state = await this.getState(gameId);
    if (state.turnPhase !== TurnPhase.AUCTION || !state.activeAuction) {
      throw new BadRequestException('No active auction');
    }

    const player = state.players.find(p: any) => p.id === playerId);
    if (!player) throw new BadRequestException('Player not in game');
    if (player.balance < amount) throw new BadRequestException('Insufficient balance');
    if (amount <= state.activeAuction.currentBid) throw new BadRequestException('Bid must exceed current bid');
    if (amount < state.activeAuction.startPrice) throw new BadRequestException('Bid below starting price');

    state.activeAuction.currentBid = amount;
    state.activeAuction.currentBidderId = playerId;
    state.activeAuction.bids.push({ playerId, amount, timestamp: new Date().toISOString() });

    await this.eventBus.publish(GAME_EVENTS.AUCTION_BID_PLACED, { gameId, playerId, amount });
    await this.saveState(state);
    return state;
  }

  async finalizeAuction(gameId: string): Promise<GameState> {
    let state = await this.getState(gameId);
    if (!state.activeAuction) return state;

    const auction = state.activeAuction;
    if (auction.currentBidderId && auction.currentBid >= auction.startPrice) {
      const winner = state.players.find(p: any) => p.id === auction.currentBidderId)!;
      winner.balance -= auction.currentBid;
      const propState = state.properties.find(p: any) => p.spaceIndex === auction.spaceIndex)!;
      propState.ownerId = winner.id;
      winner.properties.push(auction.spaceIndex);
      auction.status = AuctionStatus.SOLD;
      await this.eventBus.publish(GAME_EVENTS.AUCTION_SOLD, { gameId, winnerId: winner.id, amount: auction.currentBid });
    } else {
      auction.status = AuctionStatus.NO_BIDS;
      await this.eventBus.publish(GAME_EVENTS.AUCTION_NO_BIDS, { gameId });
    }

    state.activeAuction = null;
    state.turnPhase = TurnPhase.END;
    await this.saveState(state);
    return state;
  }

  // ============================================================
  // HOUSES & HOTELS
  // ============================================================

  async buildHouse(gameId: string, playerId: string, spaceIndex: number): Promise<GameState> {
    let state = await this.getState(gameId);
    const player = state.players.find(p: any) => p.id === playerId)!;
    const propState = state.properties.find(p: any) => p.spaceIndex === spaceIndex)!;
    const space = BOARD_SPACES[spaceIndex];

    if (propState.ownerId !== playerId) throw new BadRequestException('You do not own this property');
    if (propState.mortgaged) throw new BadRequestException('Property is mortgaged');
    if (propState.hotel) throw new BadRequestException('Property already has a hotel');
    if (propState.houses >= BOARD_CONFIG.maxHouses) throw new BadRequestException('Max houses reached, build a hotel');

    // Must own full color group
    const groupSize = COLOR_GROUP_SIZES[space.group!];
    const owned = state.properties.filter(p: any) => BOARD_SPACES[p.spaceIndex]?.group === space.group && p.ownerId === playerId).length;
    if (owned < groupSize) throw new BadRequestException('Must own full color group to build');

    // Must build evenly across group
    const groupProps = state.properties.filter(p: any) => BOARD_SPACES[p.spaceIndex]?.group === space.group && p.ownerId === playerId);
    const minHouses = Math.min(...groupProps.map(p: any) => p.houses));
    if (propState.houses > minHouses) throw new BadRequestException('Must build evenly across all properties in group');

    if (player.balance < space.housePrice!) throw new BadRequestException('Insufficient balance');

    player.balance -= space.housePrice!;
    propState.houses += 1;

    this.log(state, playerId, 'Built house', { spaceIndex, houses: propState.houses });
    await this.eventBus.publish(GAME_EVENTS.PROPERTY_HOUSE_BUILT, { gameId, playerId, spaceIndex, houses: propState.houses });
    await this.saveState(state);
    return state;
  }

  async buildHotel(gameId: string, playerId: string, spaceIndex: number): Promise<GameState> {
    let state = await this.getState(gameId);
    const player = state.players.find(p: any) => p.id === playerId)!;
    const propState = state.properties.find(p: any) => p.spaceIndex === spaceIndex)!;
    const space = BOARD_SPACES[spaceIndex];

    if (propState.ownerId !== playerId) throw new BadRequestException('You do not own this property');
    if (propState.hotel) throw new BadRequestException('Already has a hotel');
    if (propState.houses < BOARD_CONFIG.maxHouses) throw new BadRequestException('Need 4 houses before building hotel');
    if (player.balance < space.hotelPrice!) throw new BadRequestException('Insufficient balance');

    player.balance -= space.hotelPrice!;
    propState.houses = 0;
    propState.hotel = true;

    this.log(state, playerId, 'Built hotel', { spaceIndex });
    await this.eventBus.publish(GAME_EVENTS.PROPERTY_HOTEL_BUILT, { gameId, playerId, spaceIndex });
    await this.saveState(state);
    return state;
  }

  // BUG 8 FIX: sellHouse and sellHotel — players must be able to sell buildings to raise cash
  async sellHouse(gameId: string, playerId: string, spaceIndex: number): Promise<GameState> {
    let state = await this.getState(gameId);
    const player = state.players.find(p: any) => p.id === playerId)!;
    const propState = state.properties.find(p: any) => p.spaceIndex === spaceIndex)!;
    const space = BOARD_SPACES[spaceIndex];

    if (propState.ownerId !== playerId) throw new BadRequestException('You do not own this property');
    if (propState.hotel) throw new BadRequestException('Sell hotel first (use sellHotel)');
    if (propState.houses < 1) throw new BadRequestException('No houses to sell');

    // Must sell evenly across color group
    const groupProps = state.properties.filter(
      p => BOARD_SPACES[p.spaceIndex]?.group === space.group && p.ownerId === playerId,
    );
    const maxHouses = Math.max(...groupProps.map(p: any) => p.houses));
    if (propState.houses < maxHouses) {
      throw new BadRequestException('Must sell houses evenly across all properties in group');
    }

    // Refund at 50% of build cost
    const refund = Math.floor((space.housePrice ?? 0) / 2);
    player.balance += refund;
    propState.houses -= 1;

    this.log(state, playerId, 'Sold house', { spaceIndex, houses: propState.houses, refund });
    await this.eventBus.publish(GAME_EVENTS.PROPERTY_HOUSE_SOLD, { gameId, playerId, spaceIndex, houses: propState.houses, refund });
    await this.saveState(state);
    return state;
  }

  async sellHotel(gameId: string, playerId: string, spaceIndex: number): Promise<GameState> {
    let state = await this.getState(gameId);
    const player = state.players.find(p: any) => p.id === playerId)!;
    const propState = state.properties.find(p: any) => p.spaceIndex === spaceIndex)!;
    const space = BOARD_SPACES[spaceIndex];

    if (propState.ownerId !== playerId) throw new BadRequestException('You do not own this property');
    if (!propState.hotel) throw new BadRequestException('No hotel to sell');

    // Refund hotel at 50%, revert to 4 houses
    const refund = Math.floor((space.hotelPrice ?? 0) / 2);
    player.balance += refund;
    propState.hotel = false;
    propState.houses = BOARD_CONFIG.maxHouses; // revert to 4 houses

    this.log(state, playerId, 'Sold hotel', { spaceIndex, refund });
    await this.eventBus.publish(GAME_EVENTS.PROPERTY_HOUSE_SOLD, { gameId, playerId, spaceIndex, refund, wasHotel: true });
    await this.saveState(state);
    return state;
  }

  // ============================================================
  // MORTGAGE
  // ============================================================

  async mortgageProperty(gameId: string, playerId: string, spaceIndex: number): Promise<GameState> {
    let state = await this.getState(gameId);
    const player = state.players.find(p: any) => p.id === playerId)!;
    const propState = state.properties.find(p: any) => p.spaceIndex === spaceIndex)!;
    const space = BOARD_SPACES[spaceIndex];

    if (propState.ownerId !== playerId) throw new BadRequestException('You do not own this property');
    if (propState.mortgaged) throw new BadRequestException('Already mortgaged');
    if (propState.houses > 0 || propState.hotel) throw new BadRequestException('Sell buildings first');

    player.balance += space.mortgage!;
    propState.mortgaged = true;

    await this.eventBus.publish(GAME_EVENTS.PROPERTY_MORTGAGED, { gameId, playerId, spaceIndex, amount: space.mortgage });
    await this.saveState(state);
    return state;
  }

  async unmortgageProperty(gameId: string, playerId: string, spaceIndex: number): Promise<GameState> {
    let state = await this.getState(gameId);
    const player = state.players.find(p: any) => p.id === playerId)!;
    const propState = state.properties.find(p: any) => p.spaceIndex === spaceIndex)!;
    const space = BOARD_SPACES[spaceIndex];
    const cost = Math.floor(space.mortgage! * 1.1);

    if (propState.ownerId !== playerId) throw new BadRequestException('You do not own this property');
    if (!propState.mortgaged) throw new BadRequestException('Not mortgaged');
    if (player.balance < cost) throw new BadRequestException('Insufficient balance');

    player.balance -= cost;
    propState.mortgaged = false;

    await this.eventBus.publish(GAME_EVENTS.PROPERTY_UNMORTGAGED, { gameId, playerId, spaceIndex, cost });
    await this.saveState(state);
    return state;
  }

  // ============================================================
  // JAIL ACTIONS
  // ============================================================

  async payJailFine(state: GameState, player: Player): Promise<GameState> {
    if (player.balance < BOARD_CONFIG.jailFine) {
      throw new BadRequestException('Insufficient balance to pay jail fine');
    }
    player.balance -= BOARD_CONFIG.jailFine;
    player.status = PlayerStatus.ACTIVE;
    player.jailTurns = 0;
    if (state.settings.vacationCash) state.vacationPool += BOARD_CONFIG.jailFine;
    await this.eventBus.publish(GAME_EVENTS.JAIL_PAID_FINE, { gameId: state.id, playerId: player.id });
    return state;
  }

  async useJailFreeCard(gameId: string, playerId: string): Promise<GameState> {
    let state = await this.getState(gameId);
    const player = this.currentPlayer(state);
    if (player.id !== playerId) throw new BadRequestException('Not your turn');
    if (player.status !== PlayerStatus.IN_JAIL) throw new BadRequestException('Not in jail');
    if (player.jailFreeCards < 1) throw new BadRequestException('No get-out-of-jail-free cards');

    player.jailFreeCards -= 1;
    player.status = PlayerStatus.ACTIVE;
    player.jailTurns = 0;
    state.turnPhase = TurnPhase.ROLL;

    await this.eventBus.publish(GAME_EVENTS.JAIL_USED_CARD, { gameId, playerId });
    await this.saveState(state);
    return state;
  }

  // ============================================================
  // CARDS
  // ============================================================

  private async drawCard(state: GameState, player: Player, deckType: any): Promise<GameState> {
    const deck = deckType === 'SURPRISE' ? SURPRISE_CARDS : TREASURE_CARDS;
    const card: GameCard = deck[Math.floor(Math.random() * deck.length)];

    state.pendingCard = card;
    state.turnPhase = TurnPhase.CARD_DRAWN;
    await this.eventBus.publish(GAME_EVENTS.CARD_DRAWN, { gameId: state.id, playerId: player.id, card });

    state = await this.applyCard(state, player, card);
    return state;
  }

  private async applyCard(state: GameState, player: Player, card: GameCard): Promise<GameState> {
    switch (card.action as CardAction) {
      case 'GAIN':
        player.balance += card.amount!;
        break;
      case 'LOSE':
        player.balance -= card.amount!;
        if (state.settings.vacationCash) state.vacationPool += card.amount!;
        state = await this.checkBankruptcy(state, player);
        break;
      case 'GO_TO_JAIL':
        state = this.sendToJail(state, player);
        break;
      case 'GO_TO_START':
        const oldPos = player.position;
        player.position = 0;
        if (oldPos > 0) player.balance += state.settings.passStartBonus;
        break;
      case 'MOVE_TO':
        const oldPosition = player.position;
        player.position = card.moveTo!;
        if (card.moveTo! < oldPosition) player.balance += state.settings.passStartBonus;
        state = await this.handleLanding(state, player, card.moveTo!);
        return state;
      case 'MOVE_BY':
        const newPos = Math.max(0, (player.position + card.moveBy!) % 40);
        player.position = newPos;
        state = await this.handleLanding(state, player, newPos);
        return state;
      case 'GET_OUT_OF_JAIL_FREE':
        player.jailFreeCards += 1;
        break;
      case 'COLLECT_FROM_PLAYERS':
        for (const other of state.players.filter(p: any) => p.id !== player.id && p.status !== PlayerStatus.BANKRUPT)) {
          const amt = Math.min(card.amount!, other.balance);
          other.balance -= amt;
          player.balance += amt;
        }
        break;
      case 'PAY_TO_PLAYERS':
        for (const other of state.players.filter(p: any) => p.id !== player.id && p.status !== PlayerStatus.BANKRUPT)) {
          const amt = Math.min(card.amount!, player.balance);
          player.balance -= amt;
          other.balance += amt;
        }
        state = await this.checkBankruptcy(state, player);
        break;
      case 'STREET_REPAIRS':
        let total = 0;
        for (const propState of state.properties.filter(p: any) => p.ownerId === player.id)) {
          if (propState.hotel) total += card.hotelCost!;
          else total += propState.houses * card.houseCost!;
        }
        player.balance -= total;
        if (state.settings.vacationCash) state.vacationPool += total;
        state = await this.checkBankruptcy(state, player);
        break;
      case 'SKIP_TURN':
        player.skipNextTurn = true;
        this.log(state, player.id, 'Card: will skip next turn', {});
        break;
    }

    state.pendingCard = null;
    state.turnPhase = TurnPhase.END;
    await this.eventBus.publish(GAME_EVENTS.CARD_EFFECT_APPLIED, { gameId: state.id, playerId: player.id, card });
    return state;
  }

  // ============================================================
  // TRADING
  // ============================================================

  async initiateTrade(gameId: string, fromPlayerId: string, toPlayerId: string, offer: any, request: any, message?: string): Promise<GameState> {
    let state = await this.getState(gameId);

    const trade: Trade = {
      id: uuid(),
      gameId,
      fromPlayerId,
      toPlayerId,
      offer,
      request,
      status: TradeStatus.PENDING,
      message,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + BOARD_CONFIG.tradeExpirySeconds * 1000).toISOString(),
    };

    state.activeTrade = trade;
    state.turnPhase = TurnPhase.TRADE;
    await this.eventBus.publish(GAME_EVENTS.TRADE_INITIATED, { gameId, trade });
    await this.saveState(state);
    return state;
  }

  async respondTrade(gameId: string, playerId: string, accept: boolean): Promise<GameState> {
    let state = await this.getState(gameId);
    if (!state.activeTrade) throw new BadRequestException('No active trade');
    if (state.activeTrade.toPlayerId !== playerId) throw new BadRequestException('Not your trade to respond to');

    if (accept) {
      state = await this.executeTrade(state, state.activeTrade);
      await this.eventBus.publish(GAME_EVENTS.TRADE_ACCEPTED, { gameId });
    } else {
      state.activeTrade.status = TradeStatus.REJECTED;
      await this.eventBus.publish(GAME_EVENTS.TRADE_REJECTED, { gameId });
    }

    state.activeTrade = null;
    state.turnPhase = TurnPhase.END;
    await this.saveState(state);
    return state;
  }

  private async executeTrade(state: GameState, trade: Trade): Promise<GameState> {
    const from = state.players.find(p: any) => p.id === trade.fromPlayerId)!;
    const to = state.players.find(p: any) => p.id === trade.toPlayerId)!;

    // Transfer cash
    from.balance -= trade.offer.cash;
    to.balance += trade.offer.cash;
    to.balance -= trade.request.cash;
    from.balance += trade.request.cash;

    // Transfer properties (offer)
    for (const spaceIdx of trade.offer.properties) {
      const prop = state.properties.find(p: any) => p.spaceIndex === spaceIdx)!;
      prop.ownerId = to.id;
      from.properties = from.properties.filter(p: any) => p !== spaceIdx);
      to.properties.push(spaceIdx);
    }

    // Transfer properties (request)
    for (const spaceIdx of trade.request.properties) {
      const prop = state.properties.find(p: any) => p.spaceIndex === spaceIdx)!;
      prop.ownerId = from.id;
      to.properties = to.properties.filter(p: any) => p !== spaceIdx);
      from.properties.push(spaceIdx);
    }

    // Jail free cards
    from.jailFreeCards -= trade.offer.jailFreeCards;
    to.jailFreeCards += trade.offer.jailFreeCards;
    to.jailFreeCards -= trade.request.jailFreeCards;
    from.jailFreeCards += trade.request.jailFreeCards;

    await this.eventBus.publish(GAME_EVENTS.TRADE_COMPLETED, { gameId: state.id, trade });
    return state;
  }

  // ============================================================
  // TURN END
  // ============================================================

  async endTurn(gameId: string, playerId: string): Promise<GameState> {
    let state = await this.getState(gameId);
    this.assertTurn(state, playerId, TurnPhase.END);

    // BUG 10 FIX: expire stale pending trades before ending turn
    if (state.activeTrade && new Date(state.activeTrade.expiresAt) < new Date()) {
      this.log(state, playerId, 'Trade expired', { tradeId: state.activeTrade.id });
      await this.eventBus.publish(GAME_EVENTS.TRADE_CANCELLED, { gameId, tradeId: state.activeTrade.id });
      state.activeTrade = null;
    }

    // Advance to next active player
    let nextIdx = (state.currentPlayerIndex + 1) % state.players.length;
    let attempts = 0;
    while (state.players[nextIdx].status === PlayerStatus.BANKRUPT && attempts < state.players.length) {
      nextIdx = (nextIdx + 1) % state.players.length;
      attempts++;
    }

    const activePlayers = state.players.filter(p: any) => p.status !== PlayerStatus.BANKRUPT);
    if (activePlayers.length === 1) {
      return this.finishGame(state, activePlayers[0].id);
    }

    // BUG 4 FIX: detect wrap-around relative to first active player, not index 0
    const firstActiveIdx = state.players.findIndex(p: any) => p.status !== PlayerStatus.BANKRUPT);
    const wrappedAround = nextIdx <= firstActiveIdx && state.currentPlayerIndex > nextIdx;
    if (wrappedAround) state.round += 1;

    state.currentPlayerIndex = nextIdx;
    state.turnPhase = TurnPhase.ROLL;
    state.diceValues = null;

    await this.eventBus.publish(GAME_EVENTS.TURN_ENDED, { gameId, nextPlayerId: state.players[nextIdx].id });
    await this.saveState(state);
    return state;
  }

  // ============================================================
  // BANKRUPTCY & FINISH
  // ============================================================

  private async checkBankruptcy(state: GameState, player: Player, creditorId?: string): Promise<GameState> {
    if (player.balance >= 0) return state;

    // Try to raise money via mortgaging
    const raisable = state.properties
      .filter(p: any) => p.ownerId === player.id && !p.mortgaged && !p.hotel && p.houses === 0)
      .reduce((sum: number, p: any) => sum + (BOARD_SPACES[p.spaceIndex]?.mortgage ?? 0), 0);

    if (player.balance + raisable >= 0) return state; // Player can self-rescue via mortgaging

    // Declare bankrupt
    player.status = PlayerStatus.BANKRUPT;
    player.bankruptAt = new Date().toISOString();

    // Release all properties back to bank
    for (const spaceIdx of player.properties) {
      const prop = state.properties.find(p: any) => p.spaceIndex === spaceIdx)!;
      prop.ownerId = null;
      prop.houses = 0;
      prop.hotel = false;
      prop.mortgaged = false;
    }
    player.properties = [];
    player.balance = 0;

    this.log(state, player.id, 'Player bankrupt', { creditorId });
    // BUG 6 FIX: include creditorId so anti-collusion proxy can detect sacrifice patterns
    await this.eventBus.publish(GAME_EVENTS.GAME_PLAYER_BANKRUPT, {
      gameId: state.id,
      playerId: player.id,
      creditorId: creditorId ?? null,
    });

    return state;
  }

  private async finishGame(state: GameState, winnerId: string): Promise<GameState> {
    state.status = GameStatus.FINISHED;
    state.winner = winnerId;
    state.finishedAt = new Date().toISOString();

    // Assign ranks: winner = 1, then active players by balance, then bankrupt players by bankruptAt (last bankrupt = best rank)
    const winner = state.players.find(p: any) => p.id === winnerId)!;
    winner.rank = 1;

    const bankruptPlayers = state.players
      .filter(p: any) => p.status === PlayerStatus.BANKRUPT && p.bankruptAt)
      .sort((a: any, b: any) => new Date(b.bankruptAt!).getTime() - new Date(a.bankruptAt!).getTime()); // most recently bankrupt = 2nd place

    bankruptPlayers.forEach((p: any, i: number) => { p.rank = i + 2; });

    await this.gameRepo.update(state.id, {
      status: GameStatus.FINISHED,
      winnerId,
      finishedAt: new Date(),
    });

    await this.eventBus.publish(GAME_EVENTS.GAME_FINISHED, { gameId: state.id, winnerId, state });
    await this.saveState(state);
    return state;
  }

  // ============================================================
  // HELPERS
  // ============================================================

  private rollD6(): number {
    return Math.floor(Math.random() * 6) + 1;
  }

  private sendToJail(state: GameState, player: Player): GameState {
    player.position = BOARD_CONFIG.jailPosition;
    player.status = PlayerStatus.IN_JAIL;
    player.jailTurns = 0;
    state.doublesStreak = 0;
    this.log(state, player.id, 'Sent to jail', {});
    this.eventBus.publish(GAME_EVENTS.JAIL_SENT, { gameId: state.id, playerId: player.id });
    return state;
  }

  private currentPlayer(state: GameState): Player {
    return state.players[state.currentPlayerIndex];
  }

  private assertTurn(state: GameState, playerId: string, phase: TurnPhase): void {
    const current = this.currentPlayer(state);
    if (current.id !== playerId) throw new BadRequestException('Not your turn');
    if (state.turnPhase !== phase) throw new BadRequestException(`Invalid action for phase: ${state.turnPhase}`);
  }

  private async transferMoney(state: GameState, from: Player, to: Player, amount: number): Promise<GameState> {
    const actual = Math.min(amount, from.balance);
    from.balance -= actual;
    to.balance += actual;
    return state;
  }

  private log(state: GameState, playerId: string, action: string, details: Record<string, unknown>): void {
    state.log.push({ ts: new Date().toISOString(), playerId, action, details });
    if (state.log.length > 200) state.log.shift(); // Keep log bounded
  }
}

