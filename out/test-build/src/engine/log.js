"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.addLog = addLog;
function addLog(state, type, message) {
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
