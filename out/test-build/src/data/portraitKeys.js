"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.KNOWN_PORTRAIT_KEYS = void 0;
exports.normalizePortraitKey = normalizePortraitKey;
const generals_1 = require("./generals");
const GENERIC_KEYS = {
    normal: 'generic_normal',
    attacker: 'generic_attacker',
    defender: 'generic_defender',
    strategist: 'generic_strategist',
    commander: 'generic_commander',
    sniper: 'generic_sniper',
    wild: 'generic_wild',
    gem: 'generic_gem',
};
const UNIQUE_KEYS = new Map(generals_1.UNIQUE_GENERAL_TEMPLATES.map((g) => [g.id, g.portraitKey]));
exports.KNOWN_PORTRAIT_KEYS = new Set([
    ...generals_1.UNIQUE_GENERAL_TEMPLATES.map((g) => g.portraitKey),
    ...Object.values(GENERIC_KEYS),
    'youma_grunt',
]);
function normalizePortraitKey(general) {
    const uniqueKey = UNIQUE_KEYS.get(general.id);
    if (uniqueKey)
        return uniqueKey;
    if (general.factionId === 'youma' || general.homeFactionId === 'youma')
        return 'youma_grunt';
    if (exports.KNOWN_PORTRAIT_KEYS.has(general.portraitKey))
        return general.portraitKey;
    return GENERIC_KEYS[general.trait] ?? 'generic_normal';
}
