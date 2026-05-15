// WS Gateway - written via bash
import {
  WebSocketGateway, WebSocketServer, SubscribeMessage,
  ConnectedSocket, MessageBody, OnGatewayConnection,
  OnGatewayDisconnect, OnGatewayInit,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRedis } from '@liaoliaots/nestjs-redis';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import Redis from 'ioredis';
import { GAME_EVENTS, REDIS_CHANNELS, REDIS_KEYS } from '@umukino/shared-events';

interface AuthSocket extends Socket {
  userId: string; displayName: string; role: string;
  gameId?: string; roomId?: string; isSpectator?: boolean;
}

@WebSocketGateway({
  cors: { origin: process.env.FRONTEND_URL || 'http://localhost:3000', credentials: true },
  transports: ['websocket', 'polling'],
  pingTimeout: 10000, pingInterval: 5000, maxHttpBufferSize: 1e5,
})
@Injectable()
export class GameGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;
  private readonly logger = new Logger(GameGateway.name);
  private userSockets = new Map<string, string>();
  private disconnected = new Map<string, Set<string>>();
  private reconnTimers = new Map<string, NodeJS.Timeout>();
  private gameUrl: string;
  private roomUrl: string;

  constructor(
    private readonly jwt: JwtService,
    private readonly http: HttpService,
    private readonly config: ConfigService,
    @InjectRedis() private readonly redis: Redis,
  ) {
    this.gameUrl = config.get('GAME_SERVICE_URL', 'http://game-service:3002');
    this.roomUrl = config.get('ROOM_SERVICE_URL', 'http://room-service:3005');
  }

  afterInit() { this.logger.log('WS Gateway ready'); this.bridgeRedis(); }

  async handleConnection(socket: AuthSocket) {
    try {
      const token = socket.handshake.auth?.token || (socket.handshake.headers.authorization || '').replace('Bearer ', '');
      if (!token) { socket.disconnect(); return; }
      const p = this.jwt.verify(token) as any;
      socket.userId = p.sub; socket.displayName = p.displayName; socket.role = p.role || 'player';
      this.userSockets.set(socket.userId, socket.id);
      await this.redis.set(REDIS_KEYS.playerSocket(socket.userId), socket.id, 'EX', 86400);
      const t = this.reconnTimers.get(socket.userId);
      if (t) { clearTimeout(t); this.reconnTimers.delete(socket.userId); }
      const ag = await this.redis.get(`user:${socket.userId}:activegame`);
      if (ag) {
        socket.gameId = ag; socket.join(`game:${ag}`);
        const state = await this.callGame('GET', `/games/${ag}`, null, socket.userId).catch(() => null);
        if (state) {
          socket.emit(GAME_EVENTS.GAME_STATE_SYNC, { gameId: ag, state });
          this.server.to(`game:${ag}`).emit(GAME_EVENTS.GAME_PLAYER_RECONNECTED, { gameId: ag, playerId: socket.userId });
          this.disconnected.get(ag)?.delete(socket.userId);
        }
      }
    } catch (e) { this.logger.warn(`Auth fail: ${e.message}`); socket.disconnect(); }
  }

  async handleDisconnect(socket: AuthSocket) {
    if (!socket.userId) return;
    this.userSockets.delete(socket.userId);
    await this.redis.del(REDIS_KEYS.playerSocket(socket.userId));
    if (!socket.gameId || socket.isSpectator) return;
    if (!this.disconnected.has(socket.gameId)) this.disconnected.set(socket.gameId, new Set());
    this.disconnected.get(socket.gameId)!.add(socket.userId);
    this.server.to(`game:${socket.gameId}`).emit(GAME_EVENTS.GAME_PLAYER_DISCONNECTED, { gameId: socket.gameId, playerId: socket.userId });
    const state = await this.callGame('GET', `/games/${socket.gameId}`, null, socket.userId).catch(() => null);
    const isPaid = (state?.settings?.entryFeeRwf ?? 0) > 0;
    const t = setTimeout(async () => {
      if (this.disconnected.get(socket.gameId!)?.has(socket.userId)) {
        this.server.to(`game:${socket.gameId!}`).emit(GAME_EVENTS.GAME_ERROR, { gameId: socket.gameId, message: `${socket.displayName} removed (timeout)` });
        this.disconnected.get(socket.gameId!)?.delete(socket.userId);
        await this.redis.del(`user:${socket.userId}:activegame`);
      }
    }, isPaid ? 90000 : 30000);
    this.reconnTimers.set(socket.userId, t);
  }

  @SubscribeMessage('room:join')
  async onRoomJoin(@ConnectedSocket() s: AuthSocket, @MessageBody() { roomCode }: { roomCode: string }) {
    s.join(`room:${roomCode}`); s.roomId = roomCode;
    const room = await this.callRoom('POST', `/rooms/${roomCode}/join`, {}, s.userId).catch(e => { s.emit(GAME_EVENTS.GAME_ERROR, { message: e.message }); return null; });
    if (room) this.server.to(`room:${roomCode}`).emit(GAME_EVENTS.ROOM_PLAYER_JOINED, { room });
    return { success: !!room, room };
  }

  @SubscribeMessage('room:leave')
  async onRoomLeave(@ConnectedSocket() s: AuthSocket) {
    if (!s.roomId) return;
    await this.callRoom('POST', `/rooms/${s.roomId}/leave`, {}, s.userId).catch(() => null);
    this.server.to(`room:${s.roomId}`).emit(GAME_EVENTS.ROOM_PLAYER_LEFT, { playerId: s.userId });
    s.leave(`room:${s.roomId}`); s.roomId = undefined;
  }

  @SubscribeMessage('room:ready')
  async onReady(@ConnectedSocket() s: AuthSocket) {
    if (!s.roomId) return;
    const room = await this.callRoom('POST', `/rooms/${s.roomId}/ready`, {}, s.userId).catch(() => null);
    if (room) { this.server.to(`room:${s.roomId}`).emit(GAME_EVENTS.ROOM_PLAYER_READY, { room }); }
  }

  @SubscribeMessage('room:start')
  async onStart(@ConnectedSocket() s: AuthSocket, @MessageBody() { roomCode }: { roomCode: string }) {
    try {
      const result = await this.callRoom('POST', `/rooms/${roomCode}/start`, {}, s.userId);
      const sockets = await this.server.in(`room:${roomCode}`).fetchSockets();
      for (const rs of sockets) { rs.join(`game:${result.gameId}`); (rs as any).gameId = result.gameId; }
      this.server.to(`game:${result.gameId}`).emit(GAME_EVENTS.GAME_STARTED, result);
    } catch (e) { s.emit(GAME_EVENTS.GAME_ERROR, { message: e.message }); }
  }

  @SubscribeMessage('game:spectate')
  async onSpectate(@ConnectedSocket() s: AuthSocket, @MessageBody() { roomCode }: { roomCode: string }) {
    try {
      const r = await this.callRoom('POST', `/rooms/${roomCode}/spectate`, {}, s.userId);
      s.join(`game:${r.gameId}`); s.gameId = r.gameId; s.isSpectator = true;
      const state = await this.callGame('GET', `/games/${r.gameId}`, null, s.userId);
      s.emit(GAME_EVENTS.GAME_STATE_SYNC, { gameId: r.gameId, state });
    } catch (e) { s.emit(GAME_EVENTS.GAME_ERROR, { message: e.message }); }
  }

  @SubscribeMessage('game:join')
  async onGameJoin(@ConnectedSocket() s: AuthSocket, @MessageBody() { gameId }: { gameId: string }) {
    s.join(`game:${gameId}`); s.gameId = gameId;
    await this.redis.set(`user:${s.userId}:activegame`, gameId, 'EX', 86400);
    const state = await this.callGame('GET', `/games/${gameId}`, null, s.userId).catch(() => null);
    if (state) s.emit(GAME_EVENTS.GAME_STATE_SYNC, { gameId, state });
  }

  private async gameAction(s: AuthSocket, path: string, extra: object = {}) {
    if (s.isSpectator) { s.emit(GAME_EVENTS.GAME_ERROR, { message: 'Spectators cannot act' }); return; }
    if (!s.gameId) return;
    try {
      const state = await this.callGame('POST', `/games/${s.gameId}${path}`, { playerId: s.userId, ...extra }, s.userId);
      this.server.to(`game:${s.gameId}`).emit(GAME_EVENTS.GAME_STATE_SYNC, { gameId: s.gameId, state });
    } catch (e) { s.emit(GAME_EVENTS.GAME_ERROR, { message: e.message }); }
  }

  @SubscribeMessage('game:roll')        async onRoll(   @ConnectedSocket() s: AuthSocket) { await this.gameAction(s, '/roll'); }
  @SubscribeMessage('game:buy')         async onBuy(    @ConnectedSocket() s: AuthSocket) { await this.gameAction(s, '/buy'); }
  @SubscribeMessage('game:skip_buy')    async onSkip(   @ConnectedSocket() s: AuthSocket) { await this.gameAction(s, '/skip-buy'); }
  @SubscribeMessage('game:end_turn')    async onEnd(    @ConnectedSocket() s: AuthSocket) { await this.gameAction(s, '/end-turn'); }
  @SubscribeMessage('game:jail_pay')    async onJailPay(@ConnectedSocket() s: AuthSocket) { await this.gameAction(s, '/jail-pay'); }
  @SubscribeMessage('game:jail_card')   async onJailCard(@ConnectedSocket() s: AuthSocket){ await this.gameAction(s, '/jail-card'); }

  @SubscribeMessage('game:bid')
  async onBid(@ConnectedSocket() s: AuthSocket, @MessageBody() { amount }: { gameId: string; amount: number }) {
    await this.gameAction(s, '/bid', { amount });
  }
  @SubscribeMessage('game:build_house') async onBH(@ConnectedSocket() s: AuthSocket, @MessageBody() { spaceIndex }: any) { await this.gameAction(s, '/build-house', { spaceIndex }); }
  @SubscribeMessage('game:build_hotel') async onBHo(@ConnectedSocket() s: AuthSocket, @MessageBody() { spaceIndex }: any) { await this.gameAction(s, '/build-hotel', { spaceIndex }); }
  @SubscribeMessage('game:sell_house')  async onSH(@ConnectedSocket() s: AuthSocket, @MessageBody() { spaceIndex }: any) { await this.gameAction(s, '/sell-house', { spaceIndex }); }
  @SubscribeMessage('game:sell_hotel')  async onSHo(@ConnectedSocket() s: AuthSocket, @MessageBody() { spaceIndex }: any) { await this.gameAction(s, '/sell-hotel', { spaceIndex }); }
  @SubscribeMessage('game:mortgage')    async onMort(@ConnectedSocket() s: AuthSocket, @MessageBody() { spaceIndex }: any) { await this.gameAction(s, '/mortgage', { spaceIndex }); }
  @SubscribeMessage('game:unmortgage')  async onUnMort(@ConnectedSocket() s: AuthSocket, @MessageBody() { spaceIndex }: any) { await this.gameAction(s, '/unmortgage', { spaceIndex }); }

  @SubscribeMessage('game:trade_initiate')
  async onTradeInit(@ConnectedSocket() s: AuthSocket, @MessageBody() d: any) {
    if (s.isSpectator) return;
    try {
      const state = await this.callGame('POST', `/games/${s.gameId}/trade-initiate`, { ...d, fromPlayerId: s.userId, userIp: s.handshake.address }, s.userId);
      this.server.to(`game:${s.gameId}`).emit(GAME_EVENTS.TRADE_INITIATED, { trade: state.activeTrade });
      this.server.to(`game:${s.gameId}`).emit(GAME_EVENTS.GAME_STATE_SYNC, { gameId: s.gameId, state });
    } catch (e) { s.emit(GAME_EVENTS.GAME_ERROR, { message: e.message }); }
  }

  @SubscribeMessage('game:trade_respond')
  async onTradeRespond(@ConnectedSocket() s: AuthSocket, @MessageBody() { accept }: { gameId: string; accept: boolean }) {
    await this.gameAction(s, '/trade-respond', { accept });
  }

  @SubscribeMessage('chat:message')
  async onChat(@ConnectedSocket() s: AuthSocket, @MessageBody() { roomId, gameId, text }: any) {
    if (s.isSpectator) { s.emit(GAME_EVENTS.GAME_ERROR, { message: 'Spectators cannot chat' }); return; }
    const rl = await this.redis.get(`rl:chat:${s.userId}`);
    if (rl) { s.emit(GAME_EVENTS.GAME_ERROR, { message: 'Slow down' }); return; }
    await this.redis.set(`rl:chat:${s.userId}`, '1', 'PX', 500);
    try {
      const result = await this.callGame('POST', '/chat/message', { userId: s.userId, displayName: s.displayName, text, roomId, gameId }, s.userId);
      const ch = gameId ? `game:${gameId}` : `room:${roomId}`;
      if (result?.message) this.server.to(ch).emit('chat:message', result.message);
      if (result?.banned) { s.emit('chat:banned', result); s.disconnect(); }
    } catch (e) { s.emit(GAME_EVENTS.GAME_ERROR, { message: e.message }); }
  }

  private bridgeRedis() {
    const sub = this.redis.duplicate();
    sub.subscribe(REDIS_CHANNELS.GAME_EVENTS, REDIS_CHANNELS.PAYMENT_EVENTS);
    sub.on('message', (_ch, msg) => {
      try {
        const { event, data } = JSON.parse(msg);
        if (data?.gameId) this.server.to(`game:${data.gameId}`).emit(event, data);
        if (event === 'wallet.updated' && data?.userId) {
          const sid = this.userSockets.get(data.userId);
          if (sid) this.server.to(sid).emit('wallet:updated', data);
        }
      } catch { /* ignore */ }
    });
  }

  private async callGame(method: string, path: string, body: any, userId: string) {
    const { data } = await firstValueFrom(this.http.request({ method, url: `${this.gameUrl}${path}`, data: body, headers: { 'x-internal': 'ws-gateway', 'x-user-id': userId } }));
    return data;
  }
  private async callRoom(method: string, path: string, body: any, userId: string) {
    const { data } = await firstValueFrom(this.http.request({ method, url: `${this.roomUrl}${path}`, data: body, headers: { 'x-internal': 'ws-gateway', 'x-user-id': userId } }));
    return data;
  }
}
