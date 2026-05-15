// ============================================================
// UMUKINO - Shared Types Package
// ============================================================

// --- Enums ---

export enum PlayerStatus {
  WAITING = 'WAITING',
  ACTIVE = 'ACTIVE',
  IN_JAIL = 'IN_JAIL',
  BANKRUPT = 'BANKRUPT',
  DISCONNECTED = 'DISCONNECTED',
}

export enum SpaceType {
  PROPERTY = 'PROPERTY',
  AIRPORT = 'AIRPORT',
  UTILITY = 'UTILITY',
  TAX = 'TAX',
  CARD = 'CARD',
  CORNER_START = 'CORNER_START',
  CORNER_JAIL = 'CORNER_JAIL',
  CORNER_GO_TO_JAIL = 'CORNER_GO_TO_JAIL',
  CORNER_VACATION = 'CORNER_VACATION',
}

export enum CardDeckType {
  SURPRISE = 'SURPRISE',
  TREASURE = 'TREASURE',
}

export enum GameStatus {
  WAITING = 'WAITING',
  STARTING = 'STARTING',
  ACTIVE = 'ACTIVE',
  PAUSED = 'PAUSED',
  FINISHED = 'FINISHED',
}

export enum TurnPhase {
  ROLL = 'ROLL',
  ACTION = 'ACTION',
  BUY_DECISION = 'BUY_DECISION',
  AUCTION = 'AUCTION',
  TRADE = 'TRADE',
  JAIL_DECISION = 'JAIL_DECISION',
  CARD_DRAWN = 'CARD_DRAWN',
  PAYING_RENT = 'PAYING_RENT',
  END = 'END',
}

export enum PropertyColor {
  BROWN = 'BROWN',
  LIGHT_BLUE = 'LIGHT_BLUE',
  PINK = 'PINK',
  ORANGE = 'ORANGE',
  RED = 'RED',
  YELLOW = 'YELLOW',
  GREEN = 'GREEN',
  DARK_BLUE = 'DARK_BLUE',
}

export enum TradeStatus {
  PENDING = 'PENDING',
  ACCEPTED = 'ACCEPTED',
  REJECTED = 'REJECTED',
  COUNTERED = 'COUNTERED',
  CANCELLED = 'CANCELLED',
}

export enum AuctionStatus {
  ACTIVE = 'ACTIVE',
  SOLD = 'SOLD',
  NO_BIDS = 'NO_BIDS',
  CANCELLED = 'CANCELLED',
}

export enum PaymentProvider {
  MTN_MOMO = 'MTN_MOMO',
  AIRTEL_MONEY = 'AIRTEL_MONEY',
  USDT = 'USDT',
  INTERNAL = 'INTERNAL',
}

export enum TransactionType {
  DEPOSIT = 'DEPOSIT',
  WITHDRAWAL = 'WITHDRAWAL',
  GAME_ENTRY = 'GAME_ENTRY',
  GAME_PAYOUT = 'GAME_PAYOUT',
  IN_GAME_TRANSFER = 'IN_GAME_TRANSFER',
}

export enum TransactionStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  REVERSED = 'REVERSED',
}

// --- Board Space ---

export interface BoardSpace {
  index: number;
  name: string;
  nameKiny: string; // Kinyarwanda name
  type: SpaceType;
  color?: PropertyColor;
  price?: number;          // RWF
  rent?: number[];         // [base, 1h, 2h, 3h, 4h, hotel]
  housePrice?: number;
  hotelPrice?: number;
  mortgage?: number;
  group?: string;          // color group id for airports/utilities
  taxAmount?: number;
  taxPercent?: number;
  cardDeck?: CardDeckType;
  icon?: string;
}

// --- Card ---

export interface GameCard {
  id: string;
  deck: CardDeckType;
  text: string;
  textKiny: string;
  action: CardAction;
  amount?: number;
  moveTo?: number;
  moveBy?: number;
  jailFree?: boolean;
  perPlayer?: boolean;    // collect/pay per player
  streetRepairs?: boolean; // pay per house/hotel
  houseCost?: number;
  hotelCost?: number;
}

export type CardAction =
  | 'GAIN'
  | 'LOSE'
  | 'MOVE_TO'
  | 'MOVE_BY'
  | 'GO_TO_JAIL'
  | 'GET_OUT_OF_JAIL_FREE'
  | 'COLLECT_FROM_PLAYERS'
  | 'PAY_TO_PLAYERS'
  | 'STREET_REPAIRS'
  | 'SKIP_TURN'
  | 'GO_TO_START';

// --- Property Ownership ---

export interface PropertyState {
  spaceIndex: number;
  ownerId: string | null;
  houses: number;         // 0-4
  hotel: boolean;
  mortgaged: boolean;
}

// --- Player ---

export interface Player {
  id: string;
  userId: string;
  displayName: string;
  avatar: string;
  color: string;
  position: number;
  balance: number;        // RWF in-game balance
  status: PlayerStatus;
  jailTurns: number;
  jailFreeCards: number;
  doublesCount: number;
  properties: number[];   // space indices owned
  isBot: boolean;
  connected: boolean;
  bankruptAt?: string;
  rank?: number;
  skipNextTurn?: boolean; // BUG 5 fix: set by SKIP_TURN card, checked at roll time
}

// --- Trade ---

export interface Trade {
  id: string;
  gameId: string;
  fromPlayerId: string;
  toPlayerId: string;
  offer: TradeOffer;
  request: TradeOffer;
  status: TradeStatus;
  message?: string;
  createdAt: string;
  expiresAt: string;
}

export interface TradeOffer {
  cash: number;
  properties: number[];   // space indices
  jailFreeCards: number;
}

// --- Auction ---

export interface Auction {
  id: string;
  gameId: string;
  spaceIndex: number;
  startPrice: number;
  currentBid: number;
  currentBidderId: string | null;
  bids: AuctionBid[];
  status: AuctionStatus;
  endsAt: string;
}

export interface AuctionBid {
  playerId: string;
  amount: number;
  timestamp: string;
}

// --- Game Settings ---

export interface GameSettings {
  maxPlayers: number;       // 2-8
  privateRoom: boolean;
  allowBots: boolean;
  onlyLoggedIn: boolean;
  doubleRentFullSet: boolean;
  vacationCash: boolean;    // free parking jackpot
  auctionEnabled: boolean;
  noRentInJail: boolean;
  startingBalance: number;  // default 150000 RWF (in-game money only)
  passStartBonus: number;   // default 20000 RWF
  entryFeeRwf: number;      // 0 = free lobby, >0 = paid lobby (real RWF from wallet)
  maxTurns?: number;        // optional turn limit
}

// --- Game State (stored in Redis) ---

export interface GameState {
  id: string;
  roomId: string;
  status: GameStatus;
  players: Player[];
  properties: PropertyState[];
  currentPlayerIndex: number;
  turnPhase: TurnPhase;
  diceValues: [number, number] | null;
  lastDiceRoll: [number, number] | null;
  doublesStreak: number;
  round: number;
  vacationPool: number;     // accumulated taxes/fines if vacationCash enabled
  activeAuction: Auction | null;
  activeTrade: Trade | null;
  pendingCard: GameCard | null;
  settings: GameSettings;
  log: GameLogEntry[];
  winner: string | null;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
}

export interface GameLogEntry {
  ts: string;
  playerId: string;
  action: string;
  details: Record<string, unknown>;
}

// --- Room ---

export interface Room {
  id: string;
  code: string;            // short join code e.g. "4j5qu"
  hostId: string;
  name: string;
  settings: GameSettings;
  players: RoomPlayer[];
  status: 'LOBBY' | 'STARTING' | 'IN_GAME' | 'FINISHED';
  gameId: string | null;
  createdAt: string;
}

export interface RoomPlayer {
  userId: string;
  displayName: string;
  avatar: string;
  ready: boolean;
  isBot: boolean;
}

// --- Wallet ---

export interface Wallet {
  id: string;
  userId: string;
  realBalance: number;     // RWF real money
  bonusBalance: number;    // promotional credits
  currency: 'RWF';
  createdAt: string;
  updatedAt: string;
}

export interface Transaction {
  id: string;
  walletId: string;
  userId: string;
  type: TransactionType;
  status: TransactionStatus;
  provider: PaymentProvider;
  amount: number;
  fee: number;
  net: number;
  reference: string;
  gameId?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  completedAt?: string;
}

// --- WebSocket Events ---

export interface WsEvent<T = unknown> {
  event: string;
  gameId: string;
  playerId?: string;
  data: T;
  ts: string;
}

// --- Auth ---

export interface JwtPayload {
  sub: string;
  email: string;
  displayName: string;
  iat?: number;
  exp?: number;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}
