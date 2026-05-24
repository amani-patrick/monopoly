export * from './dev-urls';
export * from './api-responses';
export * from './rbac';

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
  GAME_FEE = 'GAME_FEE',
  GAME_PRIZE = 'GAME_PRIZE',
  GAME_ENTRY = 'GAME_ENTRY',
  GAME_PAYOUT = 'GAME_PAYOUT',
  STORE_PURCHASE = 'STORE_PURCHASE',
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
  nameKiny: string; 
  type: SpaceType;
  color?: PropertyColor;
  price?: number;          
  rent?: number[];         
  housePrice?: number;
  hotelPrice?: number;
  mortgage?: number;
  group?: string;          
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
  perPlayer?: boolean;    
  streetRepairs?: boolean; 
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
  houses: number;         
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
  jailTurns: number; // number of turns spent  in jail
  jailFreeCards: number;
  doublesCount: number;
  properties: number[];   //Array of space's index owned by the player
  isBot: boolean; // for bot indicator
  connected: boolean;
  bankruptAt?: string;
  rank?: number; // rank based on previous matches 
  skipNextTurn?: boolean; //skip next turn i.e on vacation
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
  createdAt: string;
  expiresAt: string;
}

export interface TradeOffer {
  cash: number;
  properties: number[];   // space indices
  jailFreeCards: number;
  //whatever else we want to add in future like "services" (e.g. "I will skip your next turn") or "future considerations" (e.g. "I will give you 10000 RWF if you win the game")

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
  vacationCash: boolean; 
  auctionEnabled: boolean;
  EvenBuild:boolean; // if true, must build evenly across properties in a color group
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
  code: string;            // short join code i.e "4j5qu"
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
  realBalance: number;     
  bonusBalance: number;    
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

export type UserRole = 'player' | 'admin' | 'moderator';

export interface JwtPayload {
  sub: string;
  email: string;
  displayName: string;
  role: UserRole;
  iat?: number;
  exp?: number;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}
