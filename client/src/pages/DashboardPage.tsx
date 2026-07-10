import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Sparkles } from 'lucide-react';
import { apiFetch } from '../lib/supabase';
import { CosmicCard, Mascot } from '../components/CosmicUI';
import { ANIMALS, QUICK_CHIPS, getMood, formatINR, MONEY_TIPS } from '../lib/cosmicTheme';

interface ParseResponse {
  success: boolean;
  amount?: number;
  description?: string;
  requiresConfirmation?: boolean;
  isSplit?: boolean;
  totalBill?: number;
  yourShare?: number;
  splitCount?: number;
  pendingId?: string;
  saved?: boolean;
  highAmount?: boolean;
  error?: string;
}

export default function DashboardPage() {
  const [message, setMessage] = useState('');
  const [todayTotal, setTodayTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState<ParseResponse | null>(null);
  const [successFlash, setSuccessFlash] = useState(false);
  const [error, setError] = useState('');
  const [tipIndex, setTipIndex] = useState(() => Math.floor(Math.random() * MONEY_TIPS.length));

  const refreshTotal = useCallback(() => {
    apiFetch('/api/expenses/today-total')
      .then((d) => setTodayTotal(d.total))
      .catch(() => {});
  }, []);

  useEffect(() => { refreshTotal(); }, [refreshTotal]);

  useEffect(() => {
    const interval = setInterval(() => {
      setTipIndex((i) => (i + 1) % MONEY_TIPS.length);
    }, 8000);
    return () => clearInterval(interval);
  }, []);

  const mood = getMood(todayTotal);
  const tip = MONEY_TIPS[tipIndex];

  const submitExpense = async () => {
    if (!message.trim() || loading) return;
    setLoading(true);
    setError('');

    try {
      const result: ParseResponse = await apiFetch('/api/expenses/parse', {
        method: 'POST',
        body: JSON.stringify({ message: message.trim() }),
      });

      if (!result.success) {
        setError(result.error ?? 'Could not parse — try again!');
        return;
      }

      if (result.requiresConfirmation && result.pendingId) {
        setPending(result);
      } else if (result.saved) {
        setMessage('');
        setSuccessFlash(true);
        refreshTotal();
        setTimeout(() => setSuccessFlash(false), 2000);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to log expense');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (!pending?.pendingId || confirming) return;
    setConfirming(true);
    try {
      await apiFetch('/api/expenses/confirm', {
        method: 'POST',
        body: JSON.stringify({ pendingId: pending.pendingId }),
      });
      setPending(null);
      setMessage('');
      setSuccessFlash(true);
      refreshTotal();
      setTimeout(() => setSuccessFlash(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Confirm failed');
    } finally {
      setConfirming(false);
    }
  };

  const handleCancel = async () => {
    if (pending?.pendingId) {
      await apiFetch('/api/expenses/cancel', {
        method: 'POST',
        body: JSON.stringify({ pendingId: pending.pendingId }),
      }).catch(() => {});
    }
    setPending(null);
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="text-center mb-8">
        <h1 className="font-display text-3xl font-bold text-white mb-2">
          {ANIMALS.fox.emoji} Home Planet
        </h1>
        <p className="text-white/50">Log your cosmic credits, cadet!</p>
      </div>

      <CosmicCard className="mb-6 text-center animate-pulse-glow">
        <p className="text-sm text-white/50 uppercase tracking-wider mb-1">Today&apos;s Budget Mood</p>
        <div className={`font-display text-4xl font-bold ${mood.color} flex items-center justify-center gap-3`}>
          <span className="text-5xl">{mood.emoji}</span>
          {mood.label}
        </div>
        <p className="text-white/60 mt-2">{formatINR(todayTotal)} spent today</p>
      </CosmicCard>

      <AnimatePresence>
        {successFlash && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          >
            <div className="text-center">
              <Mascot animal="bunny" size="lg" message="Expense logged! +10 XP!" />
              <p className="font-display text-2xl text-cosmos-mint mt-4">Mission Complete! ✨</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {pending && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          >
            <motion.div
              initial={{ y: 50, scale: 0.9 }}
              animate={{ y: 0, scale: 1 }}
              className="glass-cosmic rounded-3xl p-8 max-w-md w-full text-center"
            >
              <span className="text-5xl">🪐</span>
              <h3 className="font-display text-2xl font-bold text-cosmos-amber mt-4">Split Detected!</h3>
              {pending.isSplit && (
                <div className="my-6 space-y-2 text-lg">
                  <p>Total bill: <strong className="text-cosmos-pink">{formatINR(pending.totalBill!)}</strong></p>
                  <p>Split among: <strong>{pending.splitCount}</strong> explorers</p>
                  <p className="font-display text-3xl text-cosmos-mint">Your share: {formatINR(pending.yourShare!)}</p>
                </div>
              )}
              {!pending.isSplit && pending.highAmount && (
                <p className="my-6 text-cosmos-amber">Whoa! That&apos;s a big spend. Confirm?</p>
              )}
              <p className="text-white/60 mb-6">{pending.description}</p>
              <div className="flex gap-3">
                <button onClick={handleCancel} className="btn-cosmic-secondary flex-1">Abort</button>
                <button onClick={handleConfirm} disabled={confirming} className="btn-cosmic-primary flex-1">
                  {confirming ? '...' : 'Confirm 🚀'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <CosmicCard>
        <div className="flex items-center gap-3 mb-4">
          <Sparkles className="text-cosmos-mint" size={20} />
          <p className="font-display font-semibold text-lg">What did you spend today?</p>
        </div>

        <div className="flex gap-2 mb-4">
          <input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submitExpense()}
            placeholder="spent 800 on dinner with 3 friends"
            className="flex-1 px-4 py-4 rounded-2xl bg-white/5 border border-white/10 focus:border-cosmos-mint focus:outline-none text-base"
            disabled={loading}
          />
          <button
            onClick={submitExpense}
            disabled={loading || !message.trim()}
            className="btn-cosmic-primary px-5 flex items-center justify-center"
          >
            <Send size={20} />
          </button>
        </div>

        {error && <p className="text-cosmos-pink text-sm mb-3">{error}</p>}

        <div className="flex flex-wrap gap-2">
          {QUICK_CHIPS.map((chip) => (
            <button
              key={chip.label}
              onClick={() => setMessage((m) => m + chip.prefix)}
              className="chip-cosmic text-xs"
            >
              {chip.label}
            </button>
          ))}
        </div>
      </CosmicCard>

      <motion.div
        key={tipIndex}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="mt-6 glass-cosmic rounded-2xl p-4 border border-cosmos-mint/20"
      >
        <div className="flex items-start gap-3">
          <span className="text-2xl shrink-0">{tip.emoji}</span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-cosmos-amber mb-1">
              🦉 Wise Owl says · {tip.tag}
            </p>
            <p className="text-sm text-white/70 leading-relaxed">{tip.text}</p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
