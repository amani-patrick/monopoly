-- ============================================================
-- UMUKINO — Database Initialization
-- Runs once on first postgres container startup
-- ============================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- for search

-- ============================================================
-- AUTH SERVICE
-- ============================================================

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255),
  google_id VARCHAR(255) UNIQUE,
  display_name VARCHAR(30) NOT NULL,
  avatar VARCHAR(255) DEFAULT 'green',
  role VARCHAR(20) NOT NULL DEFAULT 'player' CHECK (role IN ('player', 'admin', 'moderator')),
  is_verified BOOLEAN NOT NULL DEFAULT false,
  is_banned BOOLEAN NOT NULL DEFAULT false,
  ban_reason TEXT,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id);
CREATE INDEX IF NOT EXISTS idx_users_display_name ON users USING GIN(display_name gin_trgm_ops);

-- ============================================================
-- WALLET SERVICE
-- ============================================================

CREATE TABLE IF NOT EXISTS wallets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  real_balance BIGINT NOT NULL DEFAULT 0 CHECK (real_balance >= 0),
  bonus_balance BIGINT NOT NULL DEFAULT 0 CHECK (bonus_balance >= 0),
  currency VARCHAR(3) NOT NULL DEFAULT 'RWF',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wallets_user_id ON wallets(user_id);

CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  wallet_id UUID NOT NULL REFERENCES wallets(id),
  user_id UUID NOT NULL REFERENCES users(id),
  type VARCHAR(30) NOT NULL CHECK (type IN ('DEPOSIT','WITHDRAWAL','GAME_ENTRY','GAME_PAYOUT','IN_GAME_TRANSFER')),
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','COMPLETED','FAILED','REVERSED')),
  provider VARCHAR(20) NOT NULL CHECK (provider IN ('MTN_MOMO','AIRTEL_MONEY','USDT','INTERNAL')),
  amount BIGINT NOT NULL,
  fee BIGINT NOT NULL DEFAULT 0,
  net BIGINT NOT NULL,
  reference VARCHAR(100) UNIQUE NOT NULL,
  game_id VARCHAR(100),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_reference ON transactions(reference);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at DESC);

-- ============================================================
-- ROOM SERVICE
-- ============================================================

CREATE TABLE IF NOT EXISTS rooms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code VARCHAR(10) UNIQUE NOT NULL,
  host_id UUID NOT NULL REFERENCES users(id),
  name VARCHAR(100) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'LOBBY' CHECK (status IN ('LOBBY','STARTING','IN_GAME','FINISHED')),
  entry_fee_rwf BIGINT NOT NULL DEFAULT 0,
  max_players INT NOT NULL DEFAULT 4 CHECK (max_players BETWEEN 2 AND 8),
  is_private BOOLEAN NOT NULL DEFAULT false,
  prize_pool BIGINT NOT NULL DEFAULT 0,
  prize_distributed BOOLEAN NOT NULL DEFAULT false,
  settings JSONB NOT NULL DEFAULT '{}',
  game_id VARCHAR(100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rooms_code ON rooms(code);
CREATE INDEX IF NOT EXISTS idx_rooms_status ON rooms(status);
CREATE INDEX IF NOT EXISTS idx_rooms_host_id ON rooms(host_id);
CREATE INDEX IF NOT EXISTS idx_rooms_created_at ON rooms(created_at DESC);

-- ============================================================
-- GAME SERVICE
-- ============================================================

CREATE TABLE IF NOT EXISTS game_records (
  id VARCHAR(100) PRIMARY KEY,
  room_id UUID REFERENCES rooms(id),
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  player_ids UUID[] NOT NULL,
  winner_id UUID REFERENCES users(id),
  settings JSONB NOT NULL DEFAULT '{}',
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_game_records_room_id ON game_records(room_id);
CREATE INDEX IF NOT EXISTS idx_game_records_status ON game_records(status);

-- ============================================================
-- CHAT SERVICE
-- ============================================================

CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id),
  display_name VARCHAR(30) NOT NULL,
  text TEXT NOT NULL,
  raw_text TEXT,
  room_id VARCHAR(100),
  game_id VARCHAR(100),
  had_violation BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_room_id ON chat_messages(room_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_game_id ON chat_messages(game_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_user_id ON chat_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON chat_messages(created_at DESC);

CREATE TABLE IF NOT EXISTS user_bans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id),
  reason TEXT NOT NULL,
  until TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_bans_user_id ON user_bans(user_id);
CREATE INDEX IF NOT EXISTS idx_user_bans_until ON user_bans(until);

-- ============================================================
-- PLATFORM REVENUE
-- ============================================================

CREATE TABLE IF NOT EXISTS platform_revenue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID REFERENCES rooms(id),
  amount BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_platform_revenue_created_at ON platform_revenue(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_platform_revenue_room_id ON platform_revenue(room_id);

-- ============================================================
-- SEED: Default admin user
-- Password: Admin@12345 (bcrypt hash — CHANGE IN PRODUCTION)
-- ============================================================

INSERT INTO users (id, email, password_hash, display_name, role, is_verified)
VALUES (
  uuid_generate_v4(),
  'admin@umukino.rw',
  '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TiGniMRv4BNm0s5HTEjVcg7RcMcq',
  'Admin',
  'admin',
  true
) ON CONFLICT (email) DO NOTHING;
