import { Router } from 'express';
import { supabaseAdmin } from '../lib/supabase.js';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import { parseExpenseMessage } from '../parser/expenseParser.js';

const router = Router();

router.post('/parse', requireAuth, async (req: AuthRequest, res) => {
  const userId = req.userId!;
  const { message } = req.body as { message?: string };

  if (!message?.trim()) {
    return res.status(400).json({ error: 'Message is required' });
  }

  const { data: profile } = await supabaseAdmin.from('users').select('id').eq('id', userId).maybeSingle();
  if (!profile) {
    return res.status(403).json({ error: 'Complete onboarding first' });
  }

  const result = parseExpenseMessage(message);

  if (!result.success) {
    return res.json(result);
  }

  if (result.requiresConfirmation) {
    const { data: pending, error } = await supabaseAdmin
      .from('pending_confirmations')
      .insert({
        user_id: userId,
        total_bill: result.totalBill ?? result.amount!,
        your_share: result.yourShare ?? result.amount!,
        split_count: result.splitCount ?? 1,
        description: result.description!,
        raw_message: message.trim(),
      })
      .select('id')
      .single();

    if (error) return res.status(500).json({ error: error.message });

    return res.json({ ...result, pendingId: pending.id });
  }

  const { data: tx, error } = await supabaseAdmin
    .from('transactions')
    .insert({
      user_id: userId,
      amount: result.amount!,
      description: result.description!,
      raw_message: message.trim(),
      category: null,
      is_split: false,
    })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json({ ...result, saved: true, transaction: tx });
});

router.post('/confirm', requireAuth, async (req: AuthRequest, res) => {
  const userId = req.userId!;
  const { pendingId } = req.body as { pendingId?: string };

  if (!pendingId) return res.status(400).json({ error: 'pendingId is required' });

  const { data: pending } = await supabaseAdmin
    .from('pending_confirmations')
    .select('*')
    .eq('id', pendingId)
    .eq('user_id', userId)
    .maybeSingle();

  if (!pending) return res.status(404).json({ error: 'Pending confirmation not found or expired' });
  if (new Date(pending.expires_at) < new Date()) {
    await supabaseAdmin.from('pending_confirmations').delete().eq('id', pendingId);
    return res.status(410).json({ error: 'Confirmation expired — please log again' });
  }

  const isSplit = pending.split_count > 1 && pending.total_bill !== pending.your_share;

  const { data: tx, error } = await supabaseAdmin
    .from('transactions')
    .insert({
      user_id: userId,
      amount: pending.your_share,
      description: pending.description,
      raw_message: pending.raw_message,
      category: null,
      is_split: isSplit,
      total_bill: isSplit ? pending.total_bill : null,
      split_count: isSplit ? pending.split_count : null,
    })
    .select()
    .single();

  await supabaseAdmin.from('pending_confirmations').delete().eq('id', pendingId);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true, transaction: tx });
});

router.post('/cancel', requireAuth, async (req: AuthRequest, res) => {
  const userId = req.userId!;
  const { pendingId } = req.body as { pendingId?: string };
  if (!pendingId) return res.status(400).json({ error: 'pendingId is required' });

  await supabaseAdmin.from('pending_confirmations').delete().eq('id', pendingId).eq('user_id', userId);
  res.json({ success: true });
});

router.get('/', requireAuth, async (req: AuthRequest, res) => {
  const userId = req.userId!;
  const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10));
  const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit ?? '20'), 10)));
  const search = String(req.query.search ?? '').trim();
  const category = String(req.query.category ?? '').trim();
  const month = String(req.query.month ?? '').trim();

  let query = supabaseAdmin
    .from('transactions')
    .select('*', { count: 'exact' })
    .eq('user_id', userId)
    .order('logged_at', { ascending: false })
    .range((page - 1) * limit, page * limit - 1);

  if (search) query = query.ilike('description', `%${search}%`);
  if (category && ['LEAK', 'WORTHY_ESSENTIAL', 'INVESTMENT'].includes(category)) {
    query = query.eq('category', category);
  }
  if (month && /^\d{4}-\d{2}$/.test(month)) {
    const [y, m] = month.split('-').map(Number);
    const start = new Date(y, m - 1, 1).toISOString();
    const end = new Date(y, m, 0, 23, 59, 59).toISOString();
    query = query.gte('logged_at', start).lte('logged_at', end);
  }

  const { data, error, count } = await query;
  if (error) return res.status(500).json({ error: error.message });

  res.json({ transactions: data ?? [], total: count ?? 0, page, limit });
});

router.get('/today-total', requireAuth, async (req: AuthRequest, res) => {
  const userId = req.userId!;
  const start = new Date();
  start.setHours(0, 0, 0, 0);

  const { data } = await supabaseAdmin
    .from('transactions')
    .select('amount')
    .eq('user_id', userId)
    .gte('logged_at', start.toISOString());

  const total = (data ?? []).reduce((sum, t) => sum + Number(t.amount), 0);
  res.json({ total: Math.round(total * 100) / 100 });
});

export default router;
