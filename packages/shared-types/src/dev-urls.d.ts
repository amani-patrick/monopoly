/**
 * IPv4 loopback for inter-service HTTP/Redis in local dev.
 * Node may resolve `localhost` to ::1, which breaks services listening on 127.0.0.1 only.
 * Browser-facing URLs should still use `localhost` (see FRONTEND_URL, NEXT_PUBLIC_*).
 */
export declare const LOCAL_HOST = "127.0.0.1";
export declare const localServiceUrl: (port: number) => string;
export declare const LOCAL_SERVICE_URLS: {
    readonly auth: string;
    readonly game: string;
    readonly ws: string;
    readonly wallet: string;
    readonly room: string;
    readonly leaderboard: string;
    readonly notification: string;
    readonly apiGateway: string;
};
/** Default when REDIS_URL is unset in local npm dev (docker-compose maps host port 6380). */
export declare const LOCAL_REDIS_URL = "redis://127.0.0.1:6379";
//# sourceMappingURL=dev-urls.d.ts.map