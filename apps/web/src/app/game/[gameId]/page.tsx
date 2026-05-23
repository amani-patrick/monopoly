'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useGameStore } from '@/store/game.store';
import { GameBoard } from '@/components/game/GameBoard';
import { PlayerPanel } from '@/components/game/PlayerPanel';
import { ActionPanel } from '@/components/game/ActionPanel';
import { ChatPanel } from '@/components/game/ChatPanel';
import { TradeModal } from '@/components/game/TradeModal';
import { AuctionModal } from '@/components/game/AuctionModal';
import { CardModal } from '@/components/game/CardModal';
import { GameOverModal } from '@/components/game/GameOverModal';
import { toast } from '@/components/ui/Toaster';

interface GamePageProps {
  params: { gameId: string };
}

export default function GamePage({ params }: GamePageProps) {
  const { gameId } = params;
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);

  const {
    gameState, setGameState, setConnected: setStoreConnected,
    addChatMessage, currentUserId,
  } = useGameStore();

  // ============================================================
  // SOCKET CONNECTION
  // ============================================================

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) { window.location.href = '/auth/login'; return; }

    const socket = io(process.env.NEXT_PUBLIC_WS_URL!, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 10,
    });

    socketRef.current = socket;

    // ---- Connection events ----
    socket.on('connect', () => {
      setConnected(true);
      setStoreConnected(true);
      socket.emit('game:join', { gameId });
    });

    socket.on('disconnect', (reason) => {
      setConnected(false);
      setStoreConnected(false);
      if (reason !== 'io client disconnect') {
        toast.warning('Connection lost. Reconnecting...');
      }
    });

    socket.on('connect_error', (err) => {
      console.error('WS connect error:', err.message);
      toast.error('Failed to connect to game server');
    });

    // ---- Game state sync ----
    socket.on('game.state.sync', ({ state }) => {
      setGameState(state);
    });

    // ---- Turn events ----
    socket.on('turn.started', ({ playerId }) => {
      const isMe = playerId === currentUserId;
      toast.info(isMe ? "It's your turn!" : 'Opponent is playing...');
    });

    socket.on('turn.dice.rolled', ({ playerId, d1, d2, total }) => {
      const name = gameState?.players.find(p => p.userId === playerId)?.displayName;
      toast.info(`${name} rolled ${d1} + ${d2} = ${total}`);
    });

    socket.on('turn.player.moved', ({ playerId, from, to }) => {
      // Animate player piece on board - handled in GameBoard component
    });

    // ---- Property events ----
    socket.on('property.purchased', ({ playerId, spaceIndex, price }) => {
      const name = gameState?.players.find(p => p.userId === playerId)?.displayName;
      toast.success(`${name} bought property for ${price.toLocaleString()} RWF`);
    });

    socket.on('rent.collected', ({ from, to, amount, spaceIndex }) => {
      const toName = gameState?.players.find(p => p.userId === to)?.displayName;
      const fromName = gameState?.players.find(p => p.userId === from)?.displayName;
      if (to === currentUserId) {
        toast.success(`Collected ${amount.toLocaleString()} RWF rent from ${fromName}`);
      } else if (from === currentUserId) {
        toast.warning(`Paid ${amount.toLocaleString()} RWF rent to ${toName}`);
      }
    });

    // ---- Jail events ----
    socket.on('jail.sent', ({ playerId }) => {
      const name = gameState?.players.find(p => p.userId === playerId)?.displayName;
      toast.warning(`${name} was sent to Prison!`);
    });

    // ---- Card events ----
    socket.on('card.drawn', ({ card }) => {
      useGameStore.getState().setPendingCard(card);
    });

    // ---- Trade events ----
    socket.on('trade.initiated', ({ trade }) => {
      if (trade.toPlayerId === currentUserId) {
        useGameStore.getState().setActiveTrade(trade);
        toast.info('You have a trade offer!');
      }
    });

    // ---- Auction events ----
    socket.on('auction.started', ({ auction }) => {
      useGameStore.getState().setActiveAuction(auction);
      toast.info('Auction started!');
    });

    socket.on('auction.bid.placed', ({ playerId, amount }) => {
      const name = gameState?.players.find(p => p.userId === playerId)?.displayName;
      toast.info(`${name} bid ${amount.toLocaleString()} RWF`);
    });

    socket.on('auction.sold', ({ winnerId, amount }) => {
      const name = gameState?.players.find(p => p.userId === winnerId)?.displayName;
      toast.success(`${name} won the auction for ${amount.toLocaleString()} RWF`);
      useGameStore.getState().setActiveAuction(null);
    });

    // ---- Game over ----
    socket.on('game.finished', ({ winnerId, state }) => {
      setGameState(state);
      useGameStore.getState().setGameOver(true);
    });

    socket.on('game.player.bankrupt', ({ playerId }) => {
      const name = gameState?.players.find(p => p.userId === playerId)?.displayName;
      toast.error(`${name} went bankrupt!`);
    });

    // ---- Player presence ----
    socket.on('game.player.disconnected', ({ playerId }) => {
      const name = gameState?.players.find(p => p.userId === playerId)?.displayName;
      toast.warning(`${name} disconnected`);
    });

    socket.on('game.player.reconnected', ({ playerId }) => {
      const name = gameState?.players.find(p => p.userId === playerId)?.displayName;
      toast.success(`${name} reconnected`);
    });

    // ---- Chat ----
    socket.on('chat:message', (msg) => {
      addChatMessage(msg);
    });

    socket.on('chat:banned', ({ reason, until }) => {
      toast.error(`You have been banned: ${reason}`);
    });

    // ---- Errors ----
    socket.on('game.error', ({ message }) => {
      toast.error(message);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [gameId]);

  // ============================================================
  // ACTIONS (exposed to child components via callbacks)
  // ============================================================

  const emit = useCallback((event: string, data?: any) => {
    socketRef.current?.emit(event, { gameId, ...data });
  }, [gameId]);

  const actions = {
    rollDice: () => emit('game:roll'),
    buyProperty: () => emit('game:buy'),
    skipBuy: () => emit('game:skip_buy'),
    placeBid: (amount: number) => emit('game:bid', { amount }),
    buildHouse: (spaceIndex: number) => emit('game:build_house', { spaceIndex }),
    buildHotel: (spaceIndex: number) => emit('game:build_hotel', { spaceIndex }),
    mortgageProperty: (spaceIndex: number) => emit('game:mortgage', { spaceIndex }),
    unmortgageProperty: (spaceIndex: number) => emit('game:unmortgage', { spaceIndex }),
    payJailFine: () => emit('game:jail_pay'),
    useJailCard: () => emit('game:jail_card'),
    endTurn: () => emit('game:end_turn'),
    initiateTrade: (data: any) => emit('game:trade_initiate', data),
    respondTrade: (accept: boolean) => emit('game:trade_respond', { accept }),
    sendChat: (text: string, roomId?: string) =>
      socketRef.current?.emit('chat:message', { gameId, roomId, text }),
  };

  // ============================================================
  // RENDER
  // ============================================================

  if (!gameState) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#0f0f1a]">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-white text-lg">Loading game...</p>
          <p className="text-gray-400 text-sm mt-2">
            {connected ? 'Connected' : 'Connecting...'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f0f1a] text-white flex flex-col">
      {/* Connection indicator */}
      {!connected && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-yellow-600 text-white text-center py-2 text-sm">
          Reconnecting to game server...
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* Left: Player panels */}
        <div className="w-64 flex-shrink-0 p-4 border-r border-white/10 overflow-y-auto">
          <PlayerPanel
            players={gameState.players}
            currentPlayerId={gameState.players[gameState.currentPlayerIndex]?.id}
            myId={currentUserId}
          />
        </div>

        {/* Center: Game board */}
        <div className="flex-1 flex items-center justify-center p-4">
          <GameBoard
            spaces={gameState.properties}
            players={gameState.players}
            vacationPool={gameState.vacationPool}
            settings={gameState.settings}
          />
        </div>

        {/* Right: Action + Chat */}
        <div className="w-80 flex-shrink-0 flex flex-col border-l border-white/10">
          <div className="flex-1 p-4 overflow-y-auto">
            <ActionPanel
              gameState={gameState}
              myId={currentUserId}
              actions={actions}
            />
          </div>
          <div className="h-72 border-t border-white/10">
            <ChatPanel
              messages={useGameStore.getState().chatMessages}
              onSend={actions.sendChat}
              myId={currentUserId}
            />
          </div>
        </div>
      </div>

      {/* Modals */}
      {useGameStore.getState().pendingCard && (
        <CardModal
          card={useGameStore.getState().pendingCard!}
          onClose={() => useGameStore.getState().setPendingCard(null)}
        />
      )}

      {useGameStore.getState().activeTrade && (() => {
        const trade = useGameStore.getState().activeTrade!;
        const fromPlayer = gameState.players.find(p => p.id === trade.fromPlayerId);
        return (
          <TradeModal
            trade={trade}
            fromPlayerName={fromPlayer?.displayName ?? 'Opponent'}
            onAccept={() => actions.respondTrade(true)}
            onReject={() => actions.respondTrade(false)}
          />
        );
      })()}

      {useGameStore.getState().activeAuction && (
        <AuctionModal
          auction={useGameStore.getState().activeAuction!}
          myBalance={gameState.players.find(p => p.userId === currentUserId)?.balance || 0}
          onBid={actions.placeBid}
        />
      )}

      {useGameStore.getState().gameOver && (
        <GameOverModal
          players={gameState.players}
          myId={currentUserId}
        />
      )}
    </div>
  );
}
