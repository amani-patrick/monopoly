import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { GameState, GameCard, Trade, Auction } from '@umukino/shared-types';

interface ChatMessage {
  id: string;
  userId: string;
  displayName: string;
  text: string;
  ts: string;
}

interface GameStore {
  // Auth
  currentUserId: string | null;
  currentUserName: string | null;
  accessToken: string | null;

  // Game state
  gameState: GameState | null;
  connected: boolean;
  gameOver: boolean;

  // UI state
  loading: boolean;
  statusMessage: string | null;
  errorMessage: string | null;
  pendingCard: GameCard | null;
  activeTrade: Trade | null;
  activeAuction: Auction | null;
  selectedSpaceIndex: number | null;
  showPropertyPanel: boolean;

  // Chat
  chatMessages: ChatMessage[];

  // Actions
  setLoading: (loading: boolean) => void;
  setStatusMessage: (message: string | null) => void;
  setErrorMessage: (message: string | null) => void;
  clearStatus: () => void;
  clearError: () => void;
  setGameState: (state: GameState) => void;
  setConnected: (connected: boolean) => void;
  setGameOver: (over: boolean) => void;
  setPendingCard: (card: GameCard | null) => void;
  setActiveTrade: (trade: Trade | null) => void;
  setActiveAuction: (auction: Auction | null) => void;
  setSelectedSpace: (index: number | null) => void;
  addChatMessage: (msg: ChatMessage) => void;
  clearChat: () => void;
  setAuth: (userId: string, userName: string, token: string) => void;
  clearAuth: () => void;
  reset: () => void;
}

const initialState = {
  currentUserId: null,
  currentUserName: null,
  accessToken: null,
  gameState: null,
  connected: false,
  gameOver: false,
  loading: false,
  statusMessage: null,
  errorMessage: null,
  pendingCard: null,
  activeTrade: null,
  activeAuction: null,
  selectedSpaceIndex: null,
  showPropertyPanel: false,
  chatMessages: [],
};

export const useGameStore = create<GameStore>()(
  devtools(
    persist(
      (set, get) => ({
        ...initialState,

        setGameState: (gameState) => {
          const prev = get().gameState;
          // Sync auction and trade from game state
          set({
            gameState,
            activeAuction: gameState.activeAuction,
            activeTrade: gameState.activeTrade,
            pendingCard: gameState.pendingCard,
          });
        },

        setConnected: (connected) => set({ connected }),

        setGameOver: (gameOver) => set({ gameOver }),

        setPendingCard: (pendingCard) => set({ pendingCard }),

        setActiveTrade: (activeTrade) => set({ activeTrade }),

        setActiveAuction: (activeAuction) => set({ activeAuction }),

        setSelectedSpace: (selectedSpaceIndex) => set({ selectedSpaceIndex }),

        setLoading: (loading) => set({ loading }),
        setStatusMessage: (statusMessage) => set({ statusMessage }),
        setErrorMessage: (errorMessage) => set({ errorMessage }),
        clearStatus: () => set({ statusMessage: null }),
        clearError: () => set({ errorMessage: null }),

        addChatMessage: (msg) => set((state) => ({
          chatMessages: [...state.chatMessages.slice(-99), msg], // keep last 100
        })),

        clearChat: () => set({ chatMessages: [] }),

        setAuth: (currentUserId, currentUserName, accessToken) => {
          set({ currentUserId, currentUserName, accessToken });
          if (typeof window !== 'undefined') {
            localStorage.setItem('accessToken', accessToken);
          }
        },

        clearAuth: () => {
          set({ currentUserId: null, currentUserName: null, accessToken: null });
          if (typeof window !== 'undefined') {
            localStorage.removeItem('accessToken');
          }
        },

        reset: () => set({ ...initialState }),
      }),
      {
        name: 'umukino-store',
        // Only persist non-sensitive UI identity — tokens are managed separately in useAuth
        partialize: (state) => ({
          currentUserId: state.currentUserId,
          currentUserName: state.currentUserName,
          // accessToken intentionally excluded — stored/read via localStorage in useAuth only
        }),
      },
    ),
  ),
);
