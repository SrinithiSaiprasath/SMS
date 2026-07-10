import type { UserProfile } from '../types/index.js';
import { getEnabledSkillIds, getEnabledSkills } from './capabilities.js';

const VARIABLE_INCOME_SOURCES = new Set(['FREELANCE', 'SIDE_HUSTLE', 'INTERNSHIP_STIPEND']);

export function formatIncomeRange(lower: number, upper: number): string {
  const fmt = (n: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);
  return `${fmt(lower)}–${fmt(upper)}`;
}

export function buildUserMissionContext(profile: UserProfile) {
  const lower = profile.income_lower_inr ?? 5000;
  const upper = profile.income_upper_inr ?? 15000;
  const midpoint = Math.round((lower + upper) / 2);
  const sources = profile.income_sources ?? [];
  const isVariableIncome = sources.some((s) => VARIABLE_INCOME_SOURCES.has(s));
  const planningBasis = isVariableIncome ? 'lower' : 'midpoint';
  const planningAmount = planningBasis === 'lower' ? lower : midpoint;
  const enabledIds = getEnabledSkillIds(profile.agent_assistance_preferences);

  return {
    income_lower_inr: lower,
    income_upper_inr: upper,
    income_midpoint_inr: midpoint,
    income_range_label: formatIncomeRange(lower, upper),
    income_sources: sources,
    is_variable_income: isVariableIncome,
    planning_basis: planningBasis as 'lower' | 'midpoint',
    planning_amount_inr: planningAmount,
    enabled_skill_ids: enabledIds,
    enabled_skills: getEnabledSkills(profile.agent_assistance_preferences),
    uses_email: enabledIds.includes('EMAIL_MISSION_REPORTS'),
  };
}

export function buildMissionContextPrompt(profile: UserProfile): string {
  const ctx = buildUserMissionContext(profile);
  return `
User mission profile:
- Monthly income range: ${ctx.income_range_label} (midpoint ₹${ctx.income_midpoint_inr.toLocaleString('en-IN')})
- Income sources: ${ctx.income_sources.join(', ') || 'unknown'}
- Living situation: ${profile.living_situation}
- Planning basis for ₹ suggestions: ${ctx.planning_basis} (₹${ctx.planning_amount_inr.toLocaleString('en-IN')})${ctx.is_variable_income ? ' — variable income, be conservative' : ''}
- Enabled skills (include ALL in report/email sections): ${ctx.enabled_skill_ids.join(', ')}

Hard rules:
- Every rupee suggestion must fit within the user's income range
- Compare period spend to lower/upper bounds and midpoint
- Do NOT include sections for disabled skills
- Use India-specific context (INR, CIBIL, 80C, etc.)`;
}
