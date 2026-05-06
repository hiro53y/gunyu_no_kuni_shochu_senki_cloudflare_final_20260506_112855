import type { GameState, SaveData } from '../types/game';

export const SAVE_VERSION = 1;
const SAVE_KEY = 'gunyu_no_kuni_save_v1';
const TUTORIAL_KEY = 'gunyu_no_kuni_tutorial_skipped';

export interface LoadResult {
  ok: boolean;
  state: GameState | null;
  error: string | null;
}

function storageAvailable(): boolean {
  try {
    return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
  } catch {
    return false;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function hasRecordValue(record: Record<string, unknown>, key: string): boolean {
  return isRecord(record[key]);
}

function validateGameState(value: unknown): value is GameState {
  if (!isRecord(value)) {
    return false;
  }
  if (
    typeof value.turn !== 'number' ||
    typeof value.actionPoints !== 'number' ||
    typeof value.maxActionPoints !== 'number' ||
    typeof value.selectedRegionId !== 'string' ||
    !hasRecordValue(value, 'regions') ||
    !hasRecordValue(value, 'factions') ||
    !hasRecordValue(value, 'officers') ||
    !Array.isArray(value.logs) ||
    !Array.isArray(value.selectedOfficerIds)
  ) {
    return false;
  }

  const regions = value.regions as Record<string, unknown>;
  const factions = value.factions as Record<string, unknown>;
  const officers = value.officers as Record<string, unknown>;
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

export function serializeGameState(state: GameState): string {
  const saveData: SaveData = {
    version: SAVE_VERSION,
    savedAt: new Date().toISOString(),
    state,
  };
  return JSON.stringify(saveData);
}

export function deserializeSaveData(raw: string): LoadResult {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) {
      return { ok: false, state: null, error: 'セーブデータの形式が不正。' };
    }
    if (parsed.version !== SAVE_VERSION) {
      return { ok: false, state: null, error: 'セーブデータのversionが対応していない。' };
    }
    if (!isRecord(parsed.state)) {
      return { ok: false, state: null, error: 'セーブデータにゲーム状態が含まれていない。' };
    }
    if (!validateGameState(parsed.state)) {
      return { ok: false, state: null, error: 'ゲーム状態の整合性チェックに失敗。' };
    }
    return { ok: true, state: parsed.state, error: null };
  } catch {
    return { ok: false, state: null, error: 'セーブデータの読み込みに失敗。JSONが壊れている可能性がある。' };
  }
}

export function saveGame(state: GameState): { ok: boolean; message: string } {
  if (!storageAvailable()) {
    return { ok: false, message: 'localStorageを利用できない。' };
  }
  try {
    window.localStorage.setItem(SAVE_KEY, serializeGameState(state));
    return { ok: true, message: 'セーブした。' };
  } catch {
    return { ok: false, message: 'セーブに失敗した。容量またはブラウザ設定を確認。' };
  }
}

export function loadGame(): LoadResult {
  if (!storageAvailable()) {
    return { ok: false, state: null, error: 'localStorageを利用できない。' };
  }
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) {
      return { ok: false, state: null, error: 'セーブデータがない。' };
    }
    return deserializeSaveData(raw);
  } catch {
    return { ok: false, state: null, error: 'ロード中にブラウザエラーが発生。' };
  }
}

export function deleteSave(): { ok: boolean; message: string } {
  if (!storageAvailable()) {
    return { ok: false, message: 'localStorageを利用できない。' };
  }
  try {
    window.localStorage.removeItem(SAVE_KEY);
    return { ok: true, message: 'セーブデータを削除した。' };
  } catch {
    return { ok: false, message: 'セーブ削除に失敗した。' };
  }
}

export function hasSave(): boolean {
  if (!storageAvailable()) {
    return false;
  }
  return window.localStorage.getItem(SAVE_KEY) !== null;
}

export function getTutorialSkipped(): boolean {
  if (!storageAvailable()) {
    return false;
  }
  return window.localStorage.getItem(TUTORIAL_KEY) === '1';
}

export function setTutorialSkipped(): void {
  if (!storageAvailable()) {
    return;
  }
  window.localStorage.setItem(TUTORIAL_KEY, '1');
}
