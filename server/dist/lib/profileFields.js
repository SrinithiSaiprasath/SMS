import { INCOME_SOURCES, AGENT_SKILLS, MIN_INCOME_INR, MAX_INCOME_INR, normalizeSkillIds, } from '../agents/capabilities.js';
export const VALID_INCOME_SOURCES = INCOME_SOURCES;
export const VALID_ASSISTANCE_IDS = AGENT_SKILLS.map((s) => s.id);
export function parseStringArray(val, valid) {
    if (!Array.isArray(val) || val.length === 0)
        return [];
    const arr = val.filter((v) => typeof v === 'string');
    if (valid)
        return arr.filter((v) => valid.includes(v) || v === 'MISSION_DOCS');
    return arr;
}
export function normalizeIncomeSources(val) {
    const list = parseStringArray(val, VALID_INCOME_SOURCES);
    if (list.length === 0)
        return { error: 'Select at least one income source' };
    return list;
}
export function normalizeAssistancePreferences(val) {
    const raw = parseStringArray(val, VALID_ASSISTANCE_IDS);
    return normalizeSkillIds(raw);
}
export function normalizeIncomeRange(lower, upper) {
    const lo = Number(lower);
    const hi = Number(upper);
    if (!Number.isFinite(lo) || !Number.isFinite(hi)) {
        return { error: 'Income range must be valid numbers' };
    }
    if (lo < MIN_INCOME_INR) {
        return { error: `Minimum income is ₹${MIN_INCOME_INR}` };
    }
    if (hi > MAX_INCOME_INR) {
        return { error: 'Income upper limit too high' };
    }
    if (hi < lo) {
        return { error: 'Upper income must be greater than or equal to lower' };
    }
    return { lower: Math.round(lo), upper: Math.round(hi) };
}
