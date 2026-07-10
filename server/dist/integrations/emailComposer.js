import { buildUserMissionContext } from '../agents/userContext.js';
import { getEnabledSkills } from '../agents/capabilities.js';
import { BRAND } from '../lib/brand.js';
const SKILL_EMOJI = {
    EXPENSE_COACHING: '🪐',
    CIBIL_CREDIT: '💳',
    SAVINGS_GOALS: '🎯',
    INVESTMENT_GUIDANCE: '🚀',
    DEBT_PAYOFF: '⛓️',
    EMERGENCY_FUND: '🛡️',
    BUDGET_PLANNING: '📊',
    TAX_BASICS: '📋',
    INCOME_VS_SPEND: '⚖️',
    EMAIL_MISSION_REPORTS: '📧',
    WEEKLY_CHALLENGES: '🏅',
    SUBSCRIPTION_AUDIT: '🔍',
};
const SKILL_LABEL = {
    EXPENSE_COACHING: 'Expense coaching',
    CIBIL_CREDIT: 'CIBIL & credit tips',
    SAVINGS_GOALS: 'Savings goals',
    INVESTMENT_GUIDANCE: 'SIP & investments',
    DEBT_PAYOFF: 'Debt payoff',
    EMERGENCY_FUND: 'Emergency fund',
    BUDGET_PLANNING: 'Monthly budget',
    TAX_BASICS: 'Tax-saving basics',
    INCOME_VS_SPEND: 'Income vs spend',
    WEEKLY_CHALLENGES: 'Weekly challenge',
    SUBSCRIPTION_AUDIT: 'Subscription audit',
};
function escapeHtml(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
export function composeMissionEmailHtml(input) {
    const { profile, periodLabel, agentAOutput, emailSections, reportUrl } = input;
    const ctx = buildUserMissionContext(profile);
    const breakdown = agentAOutput.category_breakdown;
    const skills = getEnabledSkills(profile.agent_assistance_preferences).filter((s) => s.id !== 'EMAIL_MISSION_REPORTS');
    const sections = { ...emailSections };
    if (!sections.EXPENSE_COACHING) {
        sections.EXPENSE_COACHING = {
            headline: 'Expense coaching',
            bullets: [
                `Leak ${breakdown.LEAK}% · Essential ${breakdown.WORTHY_ESSENTIAL}% · Invest ${breakdown.INVESTMENT}%`,
                agentAOutput.behavioral_summary,
                ...agentAOutput.saving_opportunities.slice(0, 2).map((o) => `${o.title}: save ~₹${o.estimated_savings_inr.toLocaleString('en-IN')}`),
            ],
        };
    }
    const skillBadges = ctx.enabled_skill_ids
        .filter((id) => id !== 'EMAIL_MISSION_REPORTS')
        .map((id) => `${SKILL_EMOJI[id] ?? '✨'} ${SKILL_LABEL[id] ?? id}`)
        .join(' · ');
    const sectionBlocks = skills
        .map((skill) => {
        const section = sections[skill.id];
        if (!section)
            return '';
        const bullets = section.bullets.map((b) => `<li>${escapeHtml(b)}</li>`).join('');
        return `
        <div style="margin:16px 0;padding:16px;background:#f8f4ff;border-radius:12px;border-left:4px solid #7c3aed;">
          <h3 style="margin:0 0 8px;color:#5b21b6;">${SKILL_EMOJI[skill.id] ?? '✨'} ${escapeHtml(section.headline || SKILL_LABEL[skill.id] || skill.id)}</h3>
          <ul style="margin:0;padding-left:20px;color:#374151;">${bullets}</ul>
        </div>`;
    })
        .join('');
    return `<!DOCTYPE html>
<html>
<body style="font-family:Segoe UI,system-ui,sans-serif;background:#1a1a2e;margin:0;padding:24px;">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;">
    <div style="background:linear-gradient(135deg,#667eea,#764ba2);padding:24px;text-align:center;color:white;">
      <div style="font-size:32px;">🪐</div>
      <h1 style="margin:8px 0 4px;font-size:22px;">Mission Debrief</h1>
      <p style="margin:0;opacity:0.9;font-size:14px;">${escapeHtml(periodLabel)}</p>
    </div>
    <div style="padding:24px;">
      <p style="color:#6b7280;font-size:13px;margin:0 0 16px;">
        Captain <strong>${escapeHtml(profile.name)}</strong> · ${escapeHtml(profile.city)}<br>
        Income: <strong>${escapeHtml(ctx.income_range_label)}/mo</strong> · Sources: ${escapeHtml(ctx.income_sources.join(', ') || '—')}<br>
        Your crew: ${escapeHtml(skillBadges)}
      </p>
      <div style="display:flex;gap:8px;margin-bottom:20px;flex-wrap:wrap;">
        <span style="background:#fef3c7;padding:6px 12px;border-radius:20px;font-size:12px;">🪐 Leak ${breakdown.LEAK}%</span>
        <span style="background:#dbeafe;padding:6px 12px;border-radius:20px;font-size:12px;">⭐ Essential ${breakdown.WORTHY_ESSENTIAL}%</span>
        <span style="background:#d1fae5;padding:6px 12px;border-radius:20px;font-size:12px;">🚀 Invest ${breakdown.INVESTMENT}%</span>
      </div>
      ${sectionBlocks}
      <p style="margin:24px 0 8px;text-align:center;">
        <a href="${escapeHtml(reportUrl)}" style="display:inline-block;background:#7c3aed;color:white;padding:12px 24px;border-radius:24px;text-decoration:none;font-weight:600;">
          View full debrief in app →
        </a>
      </p>
      <p style="font-size:11px;color:#9ca3af;text-align:center;margin-top:16px;">
        📎 Full report attached as PDF · ${escapeHtml(BRAND.name)} · ${escapeHtml(BRAND.tagline)}
      </p>
    </div>
  </div>
</body>
</html>`;
}
