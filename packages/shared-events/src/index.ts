
export const GAME_EVENTS = {
  // Room lifecycle
  ROOM_CREATED: 'room.created',
  ROOM_UPDATED: 'room.updated',
  ROOM_PLAYER_JOINED: 'room.player.joined',
  ROOM_PLAYER_LEFT: 'room.player.left',
  ROOM_PLAYER_READY: 'room.player.ready',
  ROOM_GAME_STARTING: 'room.game.starting',

  // Game lifecycle
  GAME_STARTED: 'game.started',
  GAME_STATE_SYNC: 'game.state.sync',
  GAME_FINISHED: 'game.finished',
  GAME_PLAYER_BANKRUPT: 'game.player.bankrupt',
  GAME_PLAYER_DISCONNECTED: 'game.player.disconnected',
  GAME_PLAYER_RECONNECTED: 'game.player.reconnected',

  // Turn flow
  TURN_STARTED: 'turn.started',
  TURN_DICE_ROLLED: 'turn.dice.rolled',
  TURN_PLAYER_MOVED: 'turn.player.moved',
  TURN_ENDED: 'turn.ended',
  

  // Property
  PROPERTY_LANDED: 'property.landed',
  PROPERTY_PURCHASED: 'property.purchased',
  PROPERTY_SKIPPED: 'property.skipped',
  PROPERTY_MORTGAGED: 'property.mortgaged',
  PROPERTY_UNMORTGAGED: 'property.unmortgaged',
  PROPERTY_HOUSE_BUILT: 'property.house.built',
  PROPERTY_HOTEL_BUILT: 'property.hotel.built',
  PROPERTY_HOUSE_SOLD: 'property.house.sold',

  // Rent
  RENT_COLLECTED: 'rent.collected',
  RENT_WAIVED: 'rent.waived',

  // Jail
  JAIL_SENT: 'jail.sent',
  JAIL_PAID_FINE: 'jail.paid.fine',
  JAIL_USED_CARD: 'jail.used.card',
  JAIL_ROLLED_DOUBLES: 'jail.rolled.doubles',
  JAIL_FAILED_ROLL: 'jail.failed.roll',

  // Cards
  CARD_DRAWN: 'card.drawn',
  CARD_EFFECT_APPLIED: 'card.effect.applied',

  // Tax / special spaces
  TAX_PAID: 'tax.paid',
  VACATION_POOL_UPDATED: 'vacation.pool.updated',
  VACATION_POOL_COLLECTED: 'vacation.pool.collected',
  START_PASSED: 'start.passed',

  // Trade
  TRADE_INITIATED: 'trade.initiated',
  TRADE_COUNTERED: 'trade.countered',
  TRADE_ACCEPTED: 'trade.accepted',
  TRADE_REJECTED: 'trade.rejected',
  TRADE_CANCELLED: 'trade.cancelled',
  TRADE_COMPLETED: 'trade.completed',

  // Auction
  AUCTION_STARTED: 'auction.started',
  AUCTION_BID_PLACED: 'auction.bid.placed',
  AUCTION_SOLD: 'auction.sold',
  AUCTION_NO_BIDS: 'auction.no.bids',

  // Payment / wallet
  PAYMENT_CONFIRMED: 'payment.confirmed',
  WALLET_UPDATED: 'wallet.updated',

  // Errors
  GAME_ERROR: 'game.error',
} as const;

export const REDIS_CHANNELS = {
  GAME_EVENTS: 'umukino:game-events',
  PAYMENT_EVENTS: 'umukino:payment-events',
  NOTIFICATION_EVENTS: 'umukino:notification-events',
} as const;

export const REDIS_KEYS = {
  gameState: (gameId: string) => `game:${gameId}:state`,
  roomState: (roomId: string) => `room:${roomId}:state`,
  playerSocket: (userId: string) => `socket:${userId}`,
  gameAuction: (gameId: string) => `game:${gameId}:auction`,
  rateLimitAction: (userId: string, action: string) =>
    `ratelimit:${userId}:${action}`,
} as const;

export type GameEventType = (typeof GAME_EVENTS)[keyof typeof GAME_EVENTS];
