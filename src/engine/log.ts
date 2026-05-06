import type { GameState, LogType } from '../types/game';

export function addLog(state: GameState, type: LogType, message: string): GameState {
  const log = {
    id: `log_${state.turn}_${state.logs.length}_${state.rngSeed}`,
    turn: state.turn,
    type,
    message,
    createdAt: Date.now(),
  };

  return {
    ...state,
    logs: [log, ...state.logs].slice(0, 90),
  };
}
