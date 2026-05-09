"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SAVE_VERSION = void 0;
exports.serializeGameState = serializeGameState;
exports.deserializeSaveData = deserializeSaveData;
exports.saveGame = saveGame;
exports.loadGame = loadGame;
exports.deleteSave = deleteSave;
exports.hasSave = hasSave;
exports.getTutorialSkipped = getTutorialSkipped;
exports.setTutorialSkipped = setTutorialSkipped;
exports.SAVE_VERSION = 1;
const SAVE_KEY = 'gunyu_no_kuni_save_v1';
const TUTORIAL_KEY = 'gunyu_no_kuni_tutorial_skipped';
function storageAvailable() {
    try {
        return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
    }
    catch {
        return false;
    }
}
function isRecord(value) {
    return typeof value === 'object' && value !== null;
}
function hasRecordValue(record, key) {
    return isRecord(record[key]);
}
function validateGameState(value) {
    if (!isRecord(value)) {
        return false;
    }
    if (typeof value.turn !== 'number' ||
        typeof value.actionPoints !== 'number' ||
        typeof value.maxActionPoints !== 'number' ||
        typeof value.selectedRegionId !== 'string' ||
        !hasRecordValue(value, 'regions') ||
        !hasRecordValue(value, 'factions') ||
        !hasRecordValue(value, 'officers') ||
        !Array.isArray(value.logs) ||
        !Array.isArray(value.selectedOfficerIds)) {
        return false;
    }
    const regions = value.regions;
    const factions = value.factions;
    const officers = value.officers;
    if (!isRecord(regions[value.selectedRegionId])) {
        return false;
    }
    return Object.values(regions).every((regionValue) => {
        if (!isRecord(regionValue)) {
            return false;
        }
        if (typeof regionValue.id !== 'string' || typeof regionValue.ownerFactionId !== 'string') {
            return false;
        }
        if (!isRecord(factions[regionValue.ownerFactionId])) {
            return false;
        }
        return Array.isArray(regionValue.neighbors);
    }) && Object.values(officers).every((officerValue) => {
        if (!isRecord(officerValue)) {
            return false;
        }
        if (typeof officerValue.id !== 'string' || typeof officerValue.factionId !== 'string') {
            return false;
        }
        return isRecord(factions[officerValue.factionId]) || officerValue.factionId === 'f_ronin';
    });
}
function serializeGameState(state) {
    const saveData = {
        version: exports.SAVE_VERSION,
        savedAt: new Date().toISOString(),
        state,
    };
    return JSON.stringify(saveData);
}
function deserializeSaveData(raw) {
    try {
        const parsed = JSON.parse(raw);
        if (!isRecord(parsed)) {
            return { ok: false, state: null, error: 'セーブデータの形式が不正。' };
        }
        if (parsed.version !== exports.SAVE_VERSION) {
            return { ok: false, state: null, error: 'セーブデータのversionが対応していない。' };
        }
        if (!isRecord(parsed.state)) {
            return { ok: false, state: null, error: 'セーブデータにゲーム状態が含まれていない。' };
        }
        if (!validateGameState(parsed.state)) {
            return { ok: false, state: null, error: 'ゲーム状態の整合性チェックに失敗。' };
        }
        return { ok: true, state: parsed.state, error: null };
    }
    catch {
        return { ok: false, state: null, error: 'セーブデータの読み込みに失敗。JSONが壊れている可能性がある。' };
    }
}
function saveGame(state) {
    if (!storageAvailable()) {
        return { ok: false, message: 'localStorageを利用できない。' };
    }
    try {
        window.localStorage.setItem(SAVE_KEY, serializeGameState(state));
        return { ok: true, message: 'セーブした。' };
    }
    catch {
        return { ok: false, message: 'セーブに失敗した。容量またはブラウザ設定を確認。' };
    }
}
function loadGame() {
    if (!storageAvailable()) {
        return { ok: false, state: null, error: 'localStorageを利用できない。' };
    }
    try {
        const raw = window.localStorage.getItem(SAVE_KEY);
        if (!raw) {
            return { ok: false, state: null, error: 'セーブデータがない。' };
        }
        return deserializeSaveData(raw);
    }
    catch {
        return { ok: false, state: null, error: 'ロード中にブラウザエラーが発生。' };
    }
}
function deleteSave() {
    if (!storageAvailable()) {
        return { ok: false, message: 'localStorageを利用できない。' };
    }
    try {
        window.localStorage.removeItem(SAVE_KEY);
        return { ok: true, message: 'セーブデータを削除した。' };
    }
    catch {
        return { ok: false, message: 'セーブ削除に失敗した。' };
    }
}
function hasSave() {
    if (!storageAvailable()) {
        return false;
    }
    return window.localStorage.getItem(SAVE_KEY) !== null;
}
function getTutorialSkipped() {
    if (!storageAvailable()) {
        return false;
    }
    return window.localStorage.getItem(TUTORIAL_KEY) === '1';
}
function setTutorialSkipped() {
    if (!storageAvailable()) {
        return;
    }
    window.localStorage.setItem(TUTORIAL_KEY, '1');
}
