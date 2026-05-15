// ===========================================================================
// セーブ・ロードエンジン v2.1
// localStorage を使用。version mismatch やJSON破損で画面が真っ白にならないよう、
// 失敗時は { ok: false } を返し呼び出し側で復帰可能にする。
// ===========================================================================

import { SAVE_VERSION, type GameState, type SaveData } from '../types/game';
import { normalizePortraitKey } from '../data/portraitKeys';

const SAVE_KEY = 'gunyu_no_kuni_save_v21';
const AUTO_SAVE_KEY = 'gunyu_no_kuni_autosave_v21';

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

/** GameState の最低限の整合性チェック */
function validateGameState(value: unknown): value is GameState {
  if (!isRecord(value)) return false;
  if (typeof value.turn !== 'number') return false;
  if (typeof value.ap !== 'number') return false;
  if (!isRecord(value.factions)) return false;
  if (!isRecord(value.regions)) return false;
  if (!isRecord(value.generals)) return false;
  if (!Array.isArray(value.log)) return false;
  if (!Array.isArray(value.prisoners)) return false;
  if (!Array.isArray(value.roninPool)) return false;
  return true;
}

function normalizeLoadedState(state: GameState): GameState {
  const generals = { ...state.generals };
  for (const [id, general] of Object.entries(state.generals)) {
    const portraitKey = normalizePortraitKey(general);
    if (general.portraitKey !== portraitKey) {
      generals[id] = { ...general, portraitKey };
    }
  }
  return { ...state, generals };
}

export function serializeGameState(state: GameState): string {
  const saveData: SaveData = {
    version: SAVE_VERSION,
    createdAt: new Date().toISOString(),
    state: { ...state, meta: { ...state.meta, lastSavedAt: new Date().toISOString() } },
  };
  return JSON.stringify(saveData);
}

export function deserializeSaveData(raw: string): LoadResult {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) {
      return { ok: false, state: null, error: 'セーブデータの形式が不正です' };
    }
    if (parsed.version !== SAVE_VERSION) {
      return { ok: false, state: null, error: `セーブデータのversionが対応していません（${parsed.version}）` };
    }
    if (!isRecord(parsed.state)) {
      return { ok: false, state: null, error: 'セーブデータにゲーム状態が含まれていません' };
    }
    if (!validateGameState(parsed.state)) {
      return { ok: false, state: null, error: 'ゲーム状態の整合性チェックに失敗しました' };
    }
    return { ok: true, state: normalizeLoadedState(parsed.state), error: null };
  } catch {
    return { ok: false, state: null, error: 'セーブデータの読み込みに失敗しました（JSON破損の可能性）' };
  }
}

function setItem(key: string, state: GameState): { ok: boolean; message: string } {
  if (!storageAvailable()) return { ok: false, message: 'localStorageを利用できません' };
  try {
    window.localStorage.setItem(key, serializeGameState(state));
    return { ok: true, message: 'セーブしました' };
  } catch {
    return { ok: false, message: 'セーブに失敗しました（容量・ブラウザ設定をご確認ください）' };
  }
}

function getItem(key: string): LoadResult {
  if (!storageAvailable()) return { ok: false, state: null, error: 'localStorageを利用できません' };
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return { ok: false, state: null, error: 'セーブデータがありません' };
    return deserializeSaveData(raw);
  } catch {
    return { ok: false, state: null, error: 'ロード中にブラウザエラーが発生しました' };
  }
}

function removeItem(key: string): { ok: boolean; message: string } {
  if (!storageAvailable()) return { ok: false, message: 'localStorageを利用できません' };
  try {
    window.localStorage.removeItem(key);
    return { ok: true, message: '削除しました' };
  } catch {
    return { ok: false, message: '削除に失敗しました' };
  }
}

// --- 公開API ----------------------------------------------------------------

export function saveGame(state: GameState) { return setItem(SAVE_KEY, state); }
export function loadGame(): LoadResult { return getItem(SAVE_KEY); }
export function deleteSave() { return removeItem(SAVE_KEY); }
export function hasSave(): boolean {
  if (!storageAvailable()) return false;
  return window.localStorage.getItem(SAVE_KEY) !== null;
}

export function autoSaveGame(state: GameState) { return setItem(AUTO_SAVE_KEY, state); }
export function loadAutoSave(): LoadResult { return getItem(AUTO_SAVE_KEY); }
export function deleteAutoSave() { return removeItem(AUTO_SAVE_KEY); }
export function hasAutoSave(): boolean {
  if (!storageAvailable()) return false;
  return window.localStorage.getItem(AUTO_SAVE_KEY) !== null;
}
