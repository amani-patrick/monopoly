"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LOCAL_REDIS_URL = exports.LOCAL_SERVICE_URLS = exports.localServiceUrl = exports.LOCAL_HOST = void 0;
/**
 * IPv4 loopback for inter-service HTTP/Redis in local dev.
 * Node may resolve `localhost` to ::1, which breaks services listening on 127.0.0.1 only.
 * Browser-facing URLs should still use `localhost` (see FRONTEND_URL, NEXT_PUBLIC_*).
 */
exports.LOCAL_HOST = '127.0.0.1';
const localServiceUrl = (port) => `http://${exports.LOCAL_HOST}:${port}`;
exports.localServiceUrl = localServiceUrl;
exports.LOCAL_SERVICE_URLS = {
    auth: (0, exports.localServiceUrl)(3001),
    game: (0, exports.localServiceUrl)(3002),
    ws: (0, exports.localServiceUrl)(3003),
    wallet: (0, exports.localServiceUrl)(3004),
    room: (0, exports.localServiceUrl)(3005),
    leaderboard: (0, exports.localServiceUrl)(3006),
    notification: (0, exports.localServiceUrl)(3007),
    apiGateway: (0, exports.localServiceUrl)(4000),
};
/** Default when REDIS_URL is unset in local npm dev (docker-compose maps host port 6380). */
exports.LOCAL_REDIS_URL = `redis://${exports.LOCAL_HOST}:6379`;
//# sourceMappingURL=dev-urls.js.map