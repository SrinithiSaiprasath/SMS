/**
 * Agent skill registry — drives onboarding preferences and report/email sections.
 */
export const INCOME_SOURCES = [
    'SALARY',
    'FREELANCE',
    'INTERNSHIP_STIPEND',
    'FAMILY_SUPPORT',
    'SIDE_HUSTLE',
    'SCHOLARSHIP',
    'RENTAL_INCOME',
    'OTHER',
];
export const MIN_INCOME_INR = 500;
export const MAX_INCOME_INR = 10_000_000;
export const AGENT_SKILLS = [
    {
        id: 'EXPENSE_COACHING',
        label: 'Expense coaching & leak detection',
        tier: 'core',
        default: true,
        coachPrompt: 'Classify every transaction as LEAK, WORTHY_ESSENTIAL, or INVESTMENT. Surface top leak patterns and rupee-saving opportunities within the user income range.',
        reportPrompt: 'Always include: category summary, behavioral coaching blockquote, and top saving opportunities.',
        emailPrompt: 'Summarize leak/essential/invest % and top 3 saving opportunities in INR.',
    },
    {
        id: 'CIBIL_CREDIT',
        label: 'CIBIL score & credit health tips',
        tier: 'core',
        coachPrompt: 'Flag credit-related spend (EMIs, card swipes). Mention utilization impact on CIBIL when relevant.',
        reportPrompt: 'Add a "## CIBIL & Credit Health" section with 2–3 actionable tips for this user.',
        emailPrompt: 'One headline + 2 bullets on CIBIL/credit health.',
    },
    {
        id: 'SAVINGS_GOALS',
        label: 'Savings goals & milestone tracking',
        tier: 'planning',
        coachPrompt: 'Suggest concrete monthly savings targets based on leak %, income range, and income mix.',
        reportPrompt: 'Add a "## Savings Goals" section with a suggested target and progress framing.',
        emailPrompt: 'Suggested monthly savings target in INR based on income range.',
    },
    {
        id: 'INVESTMENT_GUIDANCE',
        label: 'SIP & investment nudges',
        tier: 'planning',
        coachPrompt: 'Identify INVESTMENT-category spend and nudge toward SIP consistency if leaks are high.',
        reportPrompt: 'Add a "## Investment Nudges" section with a simple SIP suggestion in INR.',
        emailPrompt: 'One SIP suggestion in INR appropriate for income range.',
    },
    {
        id: 'DEBT_PAYOFF',
        label: 'Debt payoff strategies',
        tier: 'planning',
        coachPrompt: 'Spot EMI/debt payments. Prioritize payoff when leaks compete with debt, within income capacity.',
        reportPrompt: 'Add a "## Debt Payoff" section with payoff priority and one next action.',
        emailPrompt: 'Debt payoff priority and one next action.',
    },
    {
        id: 'EMERGENCY_FUND',
        label: 'Emergency fund builder',
        tier: 'planning',
        coachPrompt: 'Recommend emergency fund size (3–6 months essentials) based on living situation and income range.',
        reportPrompt: 'Add an "## Emergency Fund" section with target amount and monthly contribution suggestion.',
        emailPrompt: 'Emergency fund target in INR and monthly contribution.',
    },
    {
        id: 'BUDGET_PLANNING',
        label: 'Monthly budget & 50-30-20 planning',
        tier: 'planning',
        coachPrompt: 'Apply 50-30-20 using income midpoint or lower bound for variable income. Express splits in INR.',
        reportPrompt: 'Add a "## Monthly Budget" section with needs/wants/savings split in INR estimates.',
        emailPrompt: '50-30-20 split in INR from planning basis amount.',
    },
    {
        id: 'TAX_BASICS',
        label: 'Tax-saving basics (80C, HRA, etc.)',
        tier: 'advanced',
        coachPrompt: 'Light-touch FY tips — 80C, HRA when spend patterns suggest missed savings.',
        reportPrompt: 'Add a "## Tax Tips" appendix with 2–3 India-specific basics (no personalized tax advice).',
        emailPrompt: 'One tax-saving tip relevant to the user.',
    },
    {
        id: 'INCOME_VS_SPEND',
        label: 'Income vs spend ratio analysis',
        tier: 'core',
        coachPrompt: 'Compare total spend to income lower/upper/midpoint. Flag if spend exceeds upper bound.',
        reportPrompt: 'Add an "## Income vs Spend" table or bullet comparison using income range.',
        emailPrompt: 'Spend vs income range comparison in one line + one insight.',
    },
    {
        id: 'EMAIL_MISSION_REPORTS',
        label: 'Email mission debriefs',
        tier: 'delivery',
        default: true,
        coachPrompt: null,
        reportPrompt: null,
        emailPrompt: null,
        usesEmail: true,
    },
    {
        id: 'WEEKLY_CHALLENGES',
        label: 'Weekly money challenges & streaks',
        tier: 'engagement',
        coachPrompt: 'Propose one specific weekly challenge tied to their top leak category, sized to income range.',
        reportPrompt: 'Add a "## This Week\'s Challenge" section with one measurable mission and success criteria.',
        emailPrompt: 'This week\'s measurable money challenge.',
    },
    {
        id: 'SUBSCRIPTION_AUDIT',
        label: 'Subscription & leak audits',
        tier: 'advanced',
        coachPrompt: 'Detect recurring subscriptions from descriptions (OTT, SaaS, gym). Flag cut candidates.',
        reportPrompt: 'Add a "## Subscription Audit" section listing suspected recurring charges and cut candidates.',
        emailPrompt: 'Suspected subscriptions and one cut candidate.',
    },
];
export const AGENT_ASSISTANCE_OPTIONS = AGENT_SKILLS.filter((s) => s.id !== 'EMAIL_MISSION_REPORTS').map(({ id, label, tier, ...rest }) => ({
    id,
    label,
    tier,
    ...('default' in rest ? { default: rest.default } : {}),
}));
const LEGACY_SKILL_MAP = {
    MISSION_DOCS: 'EMAIL_MISSION_REPORTS',
};
export function normalizeSkillIds(preferences = []) {
    const mapped = preferences.map((id) => LEGACY_SKILL_MAP[id] ?? id);
    const alwaysOn = AGENT_SKILLS.filter((s) => 'default' in s && s.default).map((s) => s.id);
    return [...new Set([...alwaysOn, ...mapped])];
}
export function getEnabledSkillIds(preferences = []) {
    return normalizeSkillIds(preferences);
}
export function getEnabledSkills(preferences = []) {
    const ids = new Set(getEnabledSkillIds(preferences));
    return AGENT_SKILLS.filter((s) => ids.has(s.id));
}
export function buildCoachSkillsPrompt(preferences = []) {
    const blocks = getEnabledSkills(preferences)
        .filter((s) => s.coachPrompt)
        .map((s) => `[${s.id}] ${s.coachPrompt}`);
    return blocks.length ? `\n\nEnabled skills — apply these:\n${blocks.join('\n')}` : '';
}
export function buildReportSkillsPrompt(preferences = []) {
    const blocks = getEnabledSkills(preferences)
        .filter((s) => s.id !== 'EXPENSE_COACHING' && s.reportPrompt)
        .map((s) => `[${s.id}] ${s.reportPrompt}`);
    return blocks.length ? `\n\nAdditional report sections from enabled skills:\n${blocks.join('\n')}` : '';
}
export function buildEmailSkillsPrompt(preferences = []) {
    const blocks = getEnabledSkills(preferences)
        .filter((s) => s.emailPrompt)
        .map((s) => `[${s.id}] ${s.emailPrompt}`);
    return blocks.length
        ? `\n\nFor email_sections JSON, include one entry per enabled skill (except EMAIL_MISSION_REPORTS):\n${blocks.join('\n')}`
        : '';
}
export function buildAgentContextFromProfile(profile) {
    const enabled = getEnabledSkillIds(profile.agent_assistance_preferences);
    return {
        income_sources: profile.income_sources ?? [],
        income_lower_inr: profile.income_lower_inr ?? 5000,
        income_upper_inr: profile.income_upper_inr ?? 15000,
        enabled_assistance: enabled,
        enabled_skills: getEnabledSkills(profile.agent_assistance_preferences),
        uses_email: enabled.includes('EMAIL_MISSION_REPORTS'),
    };
}
