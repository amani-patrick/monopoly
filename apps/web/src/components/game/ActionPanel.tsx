'use client';

import { useState } from 'react';
import 
interface Player {
  id: string;
  userId: string;
  displayName: string;
  balance: number;
  position: number;
  jailed: boolean;
  bankrupt: boolean;
}

interface Property {
  index: number;
  name: string;
  price: number;
  ownerId?: string;
  houses: number;
  hotel: boolean;
  mortgaged: boolean;
}

interface GameState {
  players: Player[];
  properties: Property[];
  currentPlayerIndex: number;
  phase: string;
  settings: any;
  turn: number;
}

interface ActionPanelProps {
  gameState: GameState;
  myId?: string;
  actions: {
    rollDice: () => void;
    buyProperty: () => void;
    skipBuy: () => void;
    buildHouse: (spaceIndex: number) => void;
    buildHotel: (spaceIndex: number) => void;
    mortgageProperty: (spaceIndex: number) => void;
    unmortgageProperty: (spaceIndex: number) => void;
    payJailFine: () => void;
    useJailCard: () => void;
    endTurn: () => void;
    initiateTrade: (data: any) => void;
  };
}

export const ActionPanel = ({ gameState, myId, actions }: ActionPanelProps) => {
  const [selectedProperty, setSelectedProperty] = useState<number | null>(null);
  
  const currentPlayer = gameState.players[gameState.currentPlayerIndex];
  const isMyTurn = currentPlayer?.userId === myId;
  const myProperties = gameState.properties.filter(p => p.ownerId === currentPlayer?.userId);

  const renderActions = () => {
    switch (gameState.phase) {
      case 'waiting':
        return (
          <div className="text-center py-4">
            <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <p className="text-gray-400 text-sm">Waiting for other players...</p>
          </div>
        );

      case 'rolling':
        return (
          <button
            onClick={actions.rollDice}
            disabled={!isMyTurn}
            className="w-full py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-700 
                     disabled:cursor-not-allowed rounded-lg font-bold transition-colors"
          >
            🎲 Roll Dice
          </button>
        );

      case 'buying':
        return (
          <div className="space-y-2">
            <button
              onClick={actions.buyProperty}
              disabled={!isMyTurn}
              className="w-full py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-700 
                       disabled:cursor-not-allowed rounded-lg font-bold transition-colors"
            >
              💰 Buy Property
            </button>
            <button
              onClick={actions.skipBuy}
              disabled={!isMyTurn}
              className="w-full py-2 bg-gray-600 hover:bg-gray-700 disabled:bg-gray-700 
                       disabled:cursor-not-allowed rounded-lg transition-colors"
            >
              Skip
            </button>
          </div>
        );

      case 'managing':
        return (
          <div className="space-y-3">
            <h4 className="font-semibold text-sm text-purple-400">Manage Properties</h4>
            
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {myProperties.map(property => (
                <div key={property.index} className="space-y-1">
                  <div className="text-xs text-gray-400">{property.name}</div>
                  <div className="flex gap-1">
                    {!property.hotel && (
                      <button
                        onClick={() => actions.buildHouse(property.index)}
                        className="flex-1 px-2 py-1 text-xs bg-blue-600 hover:bg-blue-700 
                                 rounded transition-colors"
                      >
                        🏠 House
                      </button>
                    )}
                    {property.houses === 4 && !property.hotel && (
                      <button
                        onClick={() => actions.buildHotel(property.index)}
                        className="flex-1 px-2 py-1 text-xs bg-purple-600 hover:bg-purple-700 
                                 rounded transition-colors"
                      >
                        🏨 Hotel
                      </button>
                    )}
                    {!property.mortgaged ? (
                      <button
                        onClick={() => actions.mortgageProperty(property.index)}
                        className="flex-1 px-2 py-1 text-xs bg-yellow-600 hover:bg-yellow-700 
                                 rounded transition-colors"
                      >
                        💸 Mortgage
                      </button>
                    ) : (
                      <button
                        onClick={() => actions.unmortgageProperty(property.index)}
                        className="flex-1 px-2 py-1 text-xs bg-green-600 hover:bg-green-700 
                                 rounded transition-colors"
                      >
                        🔓 Unmortgage
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            
            <button
              onClick={actions.endTurn}
              disabled={!isMyTurn}
              className="w-full py-2 bg-gray-600 hover:bg-gray-700 disabled:bg-gray-700 
                       disabled:cursor-not-allowed rounded-lg transition-colors"
            >
              End Turn
            </button>
          </div>
        );

      case 'jailed':
        return (
          <div className="space-y-2">
            <button
              onClick={actions.payJailFine}
              disabled={!isMyTurn}
              className="w-full py-2 bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-700 
                       disabled:cursor-not-allowed rounded-lg transition-colors"
            >
              💰 Pay Fine (500 RWF)
            </button>
            <button
              onClick={actions.useJailCard}
              disabled={!isMyTurn}
              className="w-full py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 
                       disabled:cursor-not-allowed rounded-lg transition-colors"
            >
              🃏 Use Get Out of Jail Card
            </button>
            <button
              onClick={actions.rollDice}
              disabled={!isMyTurn}
              className="w-full py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-700 
                       disabled:cursor-not-allowed rounded-lg transition-colors"
            >
              🎲 Try Rolling Doubles
            </button>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="space-y-4">
      <div className="text-sm text-gray-400">
        <span>Turn {gameState.turn}</span>
        <span className="mx-2">•</span>
        <span>Phase: {gameState.phase}</span>
      </div>
      
      {renderActions()}
      
      {!isMyTurn && gameState.phase !== 'waiting' && (
        <div className="text-center text-gray-400 text-sm">
          Waiting for {currentPlayer?.displayName}...
        </div>
      )}
    </div>
  );
};