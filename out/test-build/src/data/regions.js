"use strict";
// ===========================================================================
// 地域定義 v2.1 — 八洲全15地域
// world_v2.md の地理表に対応
// マップ座標 (x, y) はSVGマップで使用する。0-100の正規化座標。
// ===========================================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.TERRAIN_BONUSES = exports.REGION_TEMPLATES = void 0;
exports.buildInitialRegions = buildInitialRegions;
exports.getRegionMapPos = getRegionMapPos;
exports.REGION_TEMPLATES = [
    {
        id: '01', name: '暁原', reading: 'あけはら',
        terrain: 'plain', product: '米',
        factionId: 'akatsuki', power: 3,
        adjacentIds: ['03', '04', '06', '11'],
        initSatisfaction: 70, mapX: 50, mapY: 52,
    },
    {
        id: '02', name: '黒鉄野', reading: 'くろがねの',
        terrain: 'mountain', product: '鉄',
        factionId: 'kurogane', power: 6,
        adjacentIds: ['03', '04'],
        initSatisfaction: 60, mapX: 76, mapY: 38,
    },
    {
        id: '03', name: '鋼津', reading: 'はがねづ',
        terrain: 'port', product: '鉄砲',
        factionId: 'kurogane', power: 5,
        adjacentIds: ['01', '02', '06'],
        initSatisfaction: 65, mapX: 70, mapY: 56,
    },
    {
        id: '04', name: '雷鳴峠', reading: 'らいめいとうげ',
        terrain: 'pass', product: '木材',
        factionId: 'kurogane', power: 4,
        adjacentIds: ['01', '02', '09'],
        initSatisfaction: 55, mapX: 64, mapY: 30,
    },
    {
        id: '05', name: '紫苑湊', reading: 'しおんみなと',
        terrain: 'port', product: '交易品',
        factionId: 'shion', power: 7,
        adjacentIds: ['06', '07'],
        initSatisfaction: 75, mapX: 60, mapY: 76,
    },
    {
        id: '06', name: '紅葉野', reading: 'もみじの',
        terrain: 'field', product: '米',
        factionId: 'shion', power: 5,
        adjacentIds: ['01', '03', '05', '07'],
        initSatisfaction: 70, mapX: 52, mapY: 68,
    },
    {
        id: '07', name: '潮咲', reading: 'しおさき',
        terrain: 'coast', product: '塩',
        factionId: 'shion', power: 3,
        adjacentIds: ['05', '06', '15'],
        initSatisfaction: 65, mapX: 38, mapY: 84,
    },
    {
        id: '08', name: '白鷺嶺', reading: 'しらさぎね',
        terrain: 'mountain', product: '馬',
        factionId: 'shirasagi', power: 6,
        adjacentIds: ['09', '11'],
        initSatisfaction: 65, mapX: 24, mapY: 36,
    },
    {
        id: '09', name: '雪見野', reading: 'ゆきみの',
        terrain: 'snow', product: '毛皮',
        factionId: 'shirasagi', power: 4,
        adjacentIds: ['04', '08', '10'],
        initSatisfaction: 60, mapX: 36, mapY: 18,
    },
    {
        id: '10', name: '焔ノ郷', reading: 'ほのおのさと',
        terrain: 'volcano', product: '硫黄',
        factionId: 'honoo', power: 5,
        adjacentIds: ['09', '14'],
        initSatisfaction: 65, mapX: 56, mapY: 14,
    },
    {
        id: '11', name: '千歳森', reading: 'ちとせのもり',
        terrain: 'forest', product: '薬草',
        factionId: 'rengein', power: 3,
        adjacentIds: ['01', '08', '12', '13'],
        initSatisfaction: 80, mapX: 32, mapY: 54,
    },
    {
        id: '12', name: '鈴音山', reading: 'すずねやま',
        terrain: 'mountain_temple', product: '経典',
        factionId: 'rengein', power: 5,
        adjacentIds: ['11', '13'],
        initSatisfaction: 80, mapX: 22, mapY: 70,
    },
    {
        id: '13', name: '黄泉沼', reading: 'よみぬま',
        terrain: 'cursed', product: '瘴気',
        factionId: 'youma', power: 6,
        adjacentIds: ['11', '12', '14'],
        initSatisfaction: 0, mapX: 44, mapY: 42,
    },
    {
        id: '14', name: '鬼哭原', reading: 'きこくはら',
        terrain: 'wasteland', product: '—',
        factionId: 'youma', power: 4,
        adjacentIds: ['10', '13'],
        initSatisfaction: 0, mapX: 70, mapY: 18,
    },
    {
        id: '15', name: '浪間', reading: 'なみま',
        terrain: 'islands', product: '海産物',
        factionId: 'ronin', power: 3,
        adjacentIds: ['07'],
        initSatisfaction: 60, mapX: 18, mapY: 88,
    },
];
/**
 * 地形別の合戦補正。世界設計書 §3 と §spec_v2 §6.5 に対応。
 */
exports.TERRAIN_BONUSES = {
    plain: { atkPct: 0, defPct: 0, healPct: 0, note: '平野：補正なし' },
    mountain: { atkPct: 5, defPct: 10, healPct: 0, note: '山地：弓+10% 守備+10%' },
    port: { atkPct: 5, defPct: 0, healPct: 5, note: '港湾：補給+5% 攻撃+5%' },
    pass: { atkPct: 0, defPct: 15, healPct: 0, note: '峠：守備+15%' },
    field: { atkPct: 10, defPct: 0, healPct: 5, note: '田園：機動+10%' },
    coast: { atkPct: 10, defPct: 0, healPct: 0, note: '海岸：機動+10%' },
    snow: { atkPct: -5, defPct: 5, healPct: -5, note: '雪原：行動低下' },
    volcano: { atkPct: 15, defPct: 0, healPct: -5, note: '火山：火属性+15%' },
    forest: { atkPct: 0, defPct: 10, healPct: 5, note: '森：守備+10%' },
    mountain_temple: { atkPct: 0, defPct: 5, healPct: 20, note: '神域：回復+20%' },
    cursed: { atkPct: 0, defPct: 0, healPct: -10, note: '魔境：人間勢力-10% 妖魔+20%' },
    wasteland: { atkPct: 5, defPct: -5, healPct: 0, note: '荒野：守備低下' },
    islands: { atkPct: 5, defPct: 5, healPct: 0, note: '群島：海戦補正' },
};
/** 初期 GameState の Region レコードを構築する */
function buildInitialRegions() {
    const out = {};
    for (const t of exports.REGION_TEMPLATES) {
        out[t.id] = {
            id: t.id,
            name: t.name,
            reading: t.reading,
            terrain: t.terrain,
            product: t.product,
            factionId: t.factionId,
            power: t.power,
            satisfaction: t.initSatisfaction,
            buildLevels: { farm: 1, wall: 1, market: 1, forge: 1 },
            adjacentIds: [...t.adjacentIds],
            scoutProgress: {},
        };
    }
    return out;
}
/** マップ座標を返す（UIで使う） */
function getRegionMapPos(id) {
    const t = exports.REGION_TEMPLATES.find((r) => r.id === id);
    return t ? { x: t.mapX, y: t.mapY } : null;
}
