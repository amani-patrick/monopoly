/**
 * Unified Error Response and Communication Types
 * Ensures consistent error handling and response structure across all services
 */

export enum ErrorCode {
  // General errors
  BAD_REQUEST = 'BAD_REQUEST',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  NOT_FOUND = 'NOT_FOUND',
  CONFLICT = 'CONFLICT',
  UNPROCESSABLE_ENTITY = 'UNPROCESSABLE_ENTITY',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  TIMEOUT = 'TIMEOUT',

  // Auth errors
  AUTH_TOKEN_INVALID = 'AUTH_TOKEN_INVALID',
  AUTH_TOKEN_EXPIRED = 'AUTH_TOKEN_EXPIRED',
  AUTH_INSUFFICIENT_PERMISSIONS = 'AUTH_INSUFFICIENT_PERMISSIONS',
  AUTH_MFA_REQUIRED = 'AUTH_MFA_REQUIRED',

  // Game errors
  GAME_NOT_FOUND = 'GAME_NOT_FOUND',
  GAME_INVALID_STATE = 'GAME_INVALID_STATE',
  GAME_NOT_STARTED = 'GAME_NOT_STARTED',
  GAME_ALREADY_FINISHED = 'GAME_ALREADY_FINISHED',
  GAME_INVALID_TURN = 'GAME_INVALID_TURN',
  GAME_INSUFFICIENT_BALANCE = 'GAME_INSUFFICIENT_BALANCE',
  GAME_INVALID_ACTION = 'GAME_INVALID_ACTION',
  GAME_TRADE_REJECTED = 'GAME_TRADE_REJECTED',

  // Anti-collusion errors
  ANTICHEAT_SHADOW_POOL = 'ANTICHEAT_SHADOW_POOL',
  ANTICHEAT_MULTI_ACCOUNT = 'ANTICHEAT_MULTI_ACCOUNT',
  ANTICHEAT_DEVICE_BANNED = 'ANTICHEAT_DEVICE_BANNED',
  ANTICHEAT_NETWORK_RESTRICTED = 'ANTICHEAT_NETWORK_RESTRICTED',

  // Room errors
  ROOM_NOT_FOUND = 'ROOM_NOT_FOUND',
  ROOM_FULL = 'ROOM_FULL',
  ROOM_NOT_JOINABLE = 'ROOM_NOT_JOINABLE',
  ROOM_PLAYER_LIMIT_EXCEEDED = 'ROOM_PLAYER_LIMIT_EXCEEDED',

  // Wallet/Payment errors
  WALLET_INSUFFICIENT_FUNDS = 'WALLET_INSUFFICIENT_FUNDS',
  WALLET_TRANSACTION_FAILED = 'WALLET_TRANSACTION_FAILED',
  WALLET_LOCKED = 'WALLET_LOCKED',

  // Validation errors
  VALIDATION_FAILED = 'VALIDATION_FAILED',
  INVALID_EMAIL = 'INVALID_EMAIL',
  INVALID_PASSWORD = 'INVALID_PASSWORD',
  PASSWORD_REQUIREMENTS_UNMET = 'PASSWORD_REQUIREMENTS_UNMET',
}

export interface ApiErrorResponse {
  code: ErrorCode;
  message: string;
  details?: Record<string, any>;
  timestamp: string;
  traceId: string;
  requestId: string;
  path: string;
  statusCode: number;
}

export interface ApiSuccessResponse<T = any> {
  data: T;
  meta?: {
    timestamp: string;
    requestId: string;
    version: string;
  };
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
}

/**
 * Error class with structured information
 */
export class ApiError extends Error {
  constructor(
    public code: ErrorCode,
    public statusCode: number,
    message: string,
    public details?: Record<string, any>,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}
