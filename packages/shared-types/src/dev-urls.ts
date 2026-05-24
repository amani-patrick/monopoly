/**
 * IPv4 loopback for inter-service HTTP/Redis in local dev.
 * Node may resolve `localhost` to ::1, which breaks services listening on 127.0.0.1 only.
 * Browser-facing URLs should still use `localhost` (see FRONTEND_URL, NEXT_PUBLIC_*).
 */
export const LOCAL_HOST = '127.0.0.1';

export const localServiceUrl = (port: number) => `http://${LOCAL_HOST}:${port}`;

export const LOCAL_SERVICE_URLS = {
  auth: localServiceUrl(3001),
  game: localServiceUrl(3002),
  ws: localServiceUrl(3003),
  wallet: localServiceUrl(3004),
  room: localServiceUrl(3005),
  leaderboard: localServiceUrl(3006),
  notification: localServiceUrl(3007),
  bot: localServiceUrl(3008),
  apiGateway: localServiceUrl(4000),
} as const;

/** Default when REDIS_URL is unset in local npm dev (docker-compose maps host port 6380). */
export const LOCAL_REDIS_URL = `redis://${LOCAL_HOST}:6379`;
