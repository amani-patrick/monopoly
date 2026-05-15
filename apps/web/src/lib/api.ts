import axios, { AxiosInstance, AxiosError } from 'axios';

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

class ApiClient {
  private http: AxiosInstance;

  constructor() {
    this.http = axios.create({ baseURL: BASE, timeout: 15000 });

    // Attach token on every request
    this.http.interceptors.request.use((cfg) => {
      if (typeof window !== 'undefined') {
        const token = localStorage.getItem('accessToken');
        if (token) cfg.headers.Authorization = `Bearer ${token}`;
      }
      return cfg;
    });

    // Auto-refresh on 401
    this.http.interceptors.response.use(
      (res) => res,
      async (err: AxiosError) => {
        if (err.response?.status === 401 && typeof window !== 'undefined') {
          const rt = localStorage.getItem('refreshToken');
          if (rt) {
            try {
              const { data } = await axios.post(`${BASE}/auth/refresh`, { refreshToken: rt });
              localStorage.setItem('accessToken', data.accessToken);
              localStorage.setItem('refreshToken', data.refreshToken);
              err.config!.headers!.Authorization = `Bearer ${data.accessToken}`;
              return this.http.request(err.config!);
            } catch {
              localStorage.clear();
              window.location.href = '/auth/login';
            }
          }
        }
        return Promise.reject(err);
      },
    );
  }

  // ---- Auth ----
  register(email: string, password: string, displayName: string) {
    return this.http.post('/auth/register', { email, password, displayName });
  }
  login(email: string, password: string) {
    return this.http.post('/auth/login', { email, password });
  }
  logout(refreshToken: string) {
    return this.http.post('/auth/logout', { refreshToken });
  }
  getMe() { return this.http.get('/users/me'); }
  updateMe(data: any) { return this.http.put('/users/me', data); }
  changePassword(oldPassword: string, newPassword: string) {
    return this.http.put('/users/me/password', { oldPassword, newPassword });
  }

  // ---- Rooms ----
  createRoom(data: any)  { return this.http.post('/rooms', data); }
  getPublicRooms()       { return this.http.get('/rooms'); }
  getRoomByCode(code: string) { return this.http.get(`/rooms/${code}`); }
  joinRoom(code: string) { return this.http.post(`/rooms/${code}/join`); }
  leaveRoom(code: string){ return this.http.post(`/rooms/${code}/leave`); }

  // ---- Wallet ----
  getBalance()           { return this.http.get('/wallet/balance'); }
  getTransactions(page = 1) { return this.http.get(`/wallet/transactions?page=${page}`); }
  deposit(data: any)     { return this.http.post('/wallet/deposit', data); }
  withdraw(data: any)    { return this.http.post('/wallet/withdraw', data); }

  // ---- Leaderboard ----
  getLeaderboard(type = 'wins') { return this.http.get(`/leaderboard?type=${type}`); }
  getPlayerStats(userId: string){ return this.http.get(`/leaderboard/players/${userId}`); }

  // ---- Game ----
  getGame(gameId: string){ return this.http.get(`/games/${gameId}`); }
}

export const api = new ApiClient();

// Error helper
export function getErrorMsg(err: unknown): string {
  if (axios.isAxiosError(err)) {
    return err.response?.data?.message || err.message || 'Something went wrong';
  }
  return 'Something went wrong';
}
