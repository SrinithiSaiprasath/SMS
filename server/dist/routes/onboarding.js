import { Router } from 'express';
import { supabaseAdmin } from '../lib/supabase.js';
import { requireAuth } from '../middleware/auth.js';
import { normalizeIncomeSources, normalizeAssistancePreferences, normalizeIncomeRange, } from '../lib/profileFields.js';
const router = Router();
const LIVING_SITUATIONS = ['PG_RENTAL', 'RENTED_APARTMENT', 'OWN_HOME', 'FAMILY_HOME'];
const FREQUENCIES = ['WEEKLY', 'BIWEEKLY', 'MONTHLY'];
const TOTAL_STEPS = 8;
router.get('/status', requireAuth, async (req, res) => {
    const userId = req.userId;
    const { data: user } = await supabaseAdmin.from('users').select('id').eq('id', userId).maybeSingle();
    if (user) {
        return res.json({ completed: true, step: TOTAL_STEPS });
    }
    const { data: session } = await supabaseAdmin
        .from('onboarding_sessions')
        .select('step, collected_data')
        .eq('user_id', userId)
        .maybeSingle();
    res.json({
        completed: false,
        step: session?.step ?? 0,
        collected_data: session?.collected_data ?? {},
    });
});
router.post('/step', requireAuth, async (req, res) => {
    const userId = req.userId;
    const { step, data } = req.body;
    if (typeof step !== 'number' || step < 0 || step > TOTAL_STEPS - 1) {
        return res.status(400).json({ error: 'Invalid step' });
    }
    const { data: existing } = await supabaseAdmin
        .from('onboarding_sessions')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();
    const merged = { ...(existing?.collected_data ?? {}), ...data };
    const nextStep = step + 1;
    if (existing) {
        await supabaseAdmin
            .from('onboarding_sessions')
            .update({ step: nextStep, collected_data: merged, updated_at: new Date().toISOString() })
            .eq('user_id', userId);
    }
    else {
        await supabaseAdmin.from('onboarding_sessions').insert({
            user_id: userId,
            step: nextStep,
            collected_data: merged,
        });
    }
    res.json({ step: nextStep, collected_data: merged });
});
router.post('/complete', requireAuth, async (req, res) => {
    const userId = req.userId;
    const { data: session } = await supabaseAdmin
        .from('onboarding_sessions')
        .select('collected_data')
        .eq('user_id', userId)
        .maybeSingle();
    const data = session?.collected_data ?? req.body;
    const { name, age, city, living_situation, report_frequency, income_sources, income_lower_inr, income_upper_inr, agent_assistance_preferences, } = data;
    if (!name || typeof name !== 'string' || name.length > 100) {
        return res.status(400).json({ error: 'Name is required (max 100 chars)' });
    }
    const ageNum = Number(age);
    if (!ageNum || ageNum < 16 || ageNum > 100) {
        return res.status(400).json({ error: 'Age must be between 16 and 100' });
    }
    if (!city || typeof city !== 'string' || city.length > 100) {
        return res.status(400).json({ error: 'City is required' });
    }
    if (!LIVING_SITUATIONS.includes(living_situation)) {
        return res.status(400).json({ error: 'Invalid living situation' });
    }
    if (!FREQUENCIES.includes(report_frequency)) {
        return res.status(400).json({ error: 'Invalid report frequency' });
    }
    const incomeList = normalizeIncomeSources(income_sources);
    if ('error' in incomeList) {
        return res.status(400).json({ error: incomeList.error });
    }
    const incomeRange = normalizeIncomeRange(income_lower_inr ?? 5000, income_upper_inr ?? 15000);
    if ('error' in incomeRange) {
        return res.status(400).json({ error: incomeRange.error });
    }
    const assistanceList = normalizeAssistancePreferences(agent_assistance_preferences);
    const insertPayload = {
        id: userId,
        name: name.trim(),
        age: ageNum,
        city: city.trim(),
        living_situation,
        report_frequency,
        income_sources: incomeList,
        income_lower_inr: incomeRange.lower,
        income_upper_inr: incomeRange.upper,
        agent_assistance_preferences: assistanceList,
    };
    const { error } = await supabaseAdmin.from('users').insert(insertPayload);
    if (error) {
        if (error.code === '23505') {
            return res.status(409).json({ error: 'Onboarding already completed' });
        }
        if (error.message?.includes('income_sources') ||
            error.message?.includes('agent_assistance') ||
            error.message?.includes('income_lower') ||
            error.message?.includes('income_upper')) {
            return res.status(500).json({
                error: 'Database missing columns. Run migrations 004 and 005 (npm run migrate)',
            });
        }
        return res.status(500).json({ error: error.message });
    }
    await supabaseAdmin.from('onboarding_sessions').delete().eq('user_id', userId);
    res.json({ success: true });
});
export default router;
