import { z } from 'zod';
import { buildCoachSkillsPrompt, buildEmailSkillsPrompt, buildReportSkillsPrompt, getEnabledSkillIds, } from './capabilities.js';
import { buildMissionContextPrompt } from './userContext.js';
import { chatCompletionJson } from '../lib/llm.js';
const AgentASchema = z.object({
    categorized_transactions: z.array(z.object({
        transaction_id: z.string(),
        category: z.enum(['LEAK', 'WORTHY_ESSENTIAL', 'INVESTMENT']),
        reasoning: z.string(),
    })),
    category_breakdown: z.object({
        LEAK: z.number(),
        WORTHY_ESSENTIAL: z.number(),
        INVESTMENT: z.number(),
    }),
    behavioral_summary: z.string(),
    saving_opportunities: z.array(z.object({
        title: z.string(),
        description: z.string(),
        estimated_savings_inr: z.number(),
    })),
    total_spend: z.number(),
});
const EmailSectionSchema = z.object({
    headline: z.string(),
    bullets: z.array(z.string()),
});
const AgentBSchema = z.object({
    markdown: z.string(),
    title: z.string(),
    email_sections: z.record(EmailSectionSchema).optional(),
});
export async function runAgentA(profile, transactions) {
    const missionContext = buildMissionContextPrompt(profile);
    const skillsPrompt = buildCoachSkillsPrompt(profile.agent_assistance_preferences);
    const systemPrompt = `You are a personal financial coach analyzing expense data for a young Indian professional.
Use a warm, playful tone — like a wise fox astronaut guiding a space cadet through their spending galaxy.
${missionContext}
${skillsPrompt}

For each transaction, assign exactly one category:
- LEAK — discretionary spend that could be reduced
- WORTHY_ESSENTIAL — necessary and justified spend
- INVESTMENT — wealth-building or future-oriented spend

After categorizing all transactions:
1. Compute total per category as PERCENTAGES (must sum to 100)
2. Identify top 3 behavioral patterns
3. Write a personalized 3-sentence coaching summary
4. List top 3 saving opportunities with estimated rupee amounts (within user's income range)

Return ONLY valid JSON matching this structure:
{
  "categorized_transactions": [{"transaction_id": "uuid", "category": "LEAK|WORTHY_ESSENTIAL|INVESTMENT", "reasoning": "..."}],
  "category_breakdown": {"LEAK": 35, "WORTHY_ESSENTIAL": 65, "INVESTMENT": 0},
  "behavioral_summary": "...",
  "saving_opportunities": [{"title": "...", "description": "...", "estimated_savings_inr": 1000}],
  "total_spend": 5000
}`;
    const userPrompt = JSON.stringify({
        transactions: transactions.map((t) => ({
            transaction_id: t.id,
            amount_inr: t.amount,
            description: t.description,
            raw_message: t.raw_message,
            logged_at: t.logged_at,
        })),
    });
    const content = await chatCompletionJson('A', {
        messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.4,
    });
    return AgentASchema.parse(JSON.parse(content));
}
export async function runAgentB(profile, agentAOutput, periodLabel, previousBreakdown) {
    const missionContext = buildMissionContextPrompt(profile);
    const skillsPrompt = buildReportSkillsPrompt(profile.agent_assistance_preferences);
    const emailSkillsPrompt = buildEmailSkillsPrompt(profile.agent_assistance_preferences);
    const enabledIds = getEnabledSkillIds(profile.agent_assistance_preferences).filter((id) => id !== 'EMAIL_MISSION_REPORTS');
    const systemPrompt = `You are a financial report designer for a cosmic adventure-themed expense app.
Create a beautiful markdown report card titled like an astronaut mission debrief.
${missionContext}
${skillsPrompt}
${emailSkillsPrompt}

Sections required (core):
1. Header with user name, period, date
2. Category Summary with percentages (LEAK, WORTHY_ESSENTIAL, INVESTMENT) — use emoji planets 🪐💫🚀
3. Behavioral Coaching blockquote from the summary
4. Top Saving Opportunities numbered list with rupee estimates
5. Closing motivational line with space/animal theme

Verify percentages sum to ~100%. Include week-over-week notes if previous data provided.

Return JSON:
{
  "markdown": "full markdown report with ALL enabled skill sections",
  "title": "report title",
  "email_sections": {
    "SKILL_ID": { "headline": "short title", "bullets": ["2-4 concise lines for email"] }
  }
}

Include email_sections keys for each enabled skill: ${enabledIds.join(', ')}`;
    const userPrompt = JSON.stringify({
        user: { name: profile.name, city: profile.city, age: profile.age },
        period: periodLabel,
        category_breakdown: agentAOutput.category_breakdown,
        behavioral_summary: agentAOutput.behavioral_summary,
        saving_opportunities: agentAOutput.saving_opportunities,
        total_spend: agentAOutput.total_spend,
        previous_breakdown: previousBreakdown ?? null,
    });
    const content = await chatCompletionJson('B', {
        messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.5,
    });
    const parsed = AgentBSchema.parse(JSON.parse(content));
    return {
        markdown: parsed.markdown,
        title: parsed.title,
        emailSections: parsed.email_sections ?? {},
    };
}
