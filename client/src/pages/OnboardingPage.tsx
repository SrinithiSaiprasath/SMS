import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { apiFetch } from '../lib/supabase';
import { Starfield, CosmicCard, Mascot, PlanetProgress } from '../components/CosmicUI';
import { LIVING_OPTIONS, FREQ_OPTIONS, INCOME_OPTIONS, ASSISTANCE_OPTIONS, INCOME_RANGE_PRESETS } from '../lib/cosmicTheme';

type StepType = 'text' | 'number' | 'chips' | 'freq' | 'multi' | 'income_range';

type ChipOption = { value: string; label: string; emoji: string; hint?: string };

interface StepDef {
  key: string;
  question: string;
  placeholder?: string;
  type: StepType;
  mascot: 'fox' | 'owl' | 'cat' | 'panda' | 'bunny';
  options?: ChipOption[];
  minSelect?: number;
}

const STEPS: StepDef[] = [
  { key: 'name', question: "What's your captain name?", placeholder: 'Rahul', type: 'text', mascot: 'fox' },
  { key: 'age', question: 'How many space-years old are you?', placeholder: '23', type: 'number', mascot: 'owl' },
  { key: 'city', question: 'Which planet city do you live in?', placeholder: 'Bengaluru', type: 'text', mascot: 'cat' },
  { key: 'living_situation', question: 'Where is your home base?', type: 'chips', mascot: 'panda' },
  { key: 'report_frequency', question: 'How often should we send mission reports?', type: 'freq', mascot: 'bunny' },
  {
    key: 'income_sources',
    question: 'Where does your cosmic fuel (income) come from?',
    type: 'multi',
    mascot: 'fox',
    options: INCOME_OPTIONS,
    minSelect: 1,
  },
  {
    key: 'income_range',
    question: 'How much monthly fuel (INR) do you usually have?',
    type: 'income_range',
    mascot: 'cat',
  },
  {
    key: 'agent_assistance_preferences',
    question: 'What extra help do you want from your AI crew?',
    type: 'multi',
    mascot: 'owl',
    options: ASSISTANCE_OPTIONS,
    minSelect: 1,
  },
];

const DEFAULT_SKILLS = ['EXPENSE_COACHING', 'EMAIL_MISSION_REPORTS'];

export default function OnboardingPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [data, setData] = useState<Record<string, string | number | string[]>>({});
  const [input, setInput] = useState('');
  const [multiSelected, setMultiSelected] = useState<string[]>([]);
  const [incomeLower, setIncomeLower] = useState(10000);
  const [incomeUpper, setIncomeUpper] = useState(15000);
  const [customRange, setCustomRange] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const current = STEPS[step];
  const isLastStep = step === STEPS.length - 1;

  useEffect(() => {
    apiFetch('/api/onboarding/status')
      .then((status) => {
        if (status.completed) {
          navigate('/', { replace: true });
          return;
        }
        if (status.collected_data) {
          setData(status.collected_data);
          const d = status.collected_data;
          if (typeof d.income_lower_inr === 'number') setIncomeLower(d.income_lower_inr);
          if (typeof d.income_upper_inr === 'number') setIncomeUpper(d.income_upper_inr);
        }
        setStep(Math.min(status.step ?? 0, STEPS.length - 1));
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Could not load onboarding');
      })
      .finally(() => setLoading(false));
  }, [navigate]);

  useEffect(() => {
    const key = current?.key;
    if (current?.type === 'multi' && key) {
      const saved = data[key];
      setMultiSelected(
        Array.isArray(saved)
          ? saved
          : key === 'agent_assistance_preferences'
            ? DEFAULT_SKILLS
            : []
      );
    } else if (current?.type === 'income_range') {
      if (typeof data.income_lower_inr === 'number') setIncomeLower(data.income_lower_inr);
      if (typeof data.income_upper_inr === 'number') setIncomeUpper(data.income_upper_inr);
    } else {
      setMultiSelected([]);
    }
  }, [step, current?.key, current?.type, data]);

  const toggleMulti = (value: string) => {
    if (value === 'EXPENSE_COACHING') return;
    setMultiSelected((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
    );
  };

  const saveStepData = async (stepData: Record<string, string | number | string[]>, advance = true) => {
    const newData = { ...data, ...stepData } as Record<string, string | number | string[]>;
    setData(newData);
    setSubmitting(true);
    setError('');

    try {
      await apiFetch('/api/onboarding/step', {
        method: 'POST',
        body: JSON.stringify({ step, data: stepData }),
      });

      if (isLastStep && advance) {
        await apiFetch('/api/onboarding/complete', {
          method: 'POST',
          body: JSON.stringify(newData),
        });
        navigate('/', { replace: true });
      } else if (advance) {
        setStep(step + 1);
        setInput('');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  };

  const saveStep = (fieldValue: string | number | string[]) => {
    saveStepData({ [current.key]: fieldValue });
  };

  const handleTextSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (current.key === 'age') {
      const age = parseInt(input, 10);
      if (age < 16 || age > 100) {
        setError('Age must be between 16 and 100');
        return;
      }
      saveStep(age);
    } else if (input.trim()) {
      saveStep(input.trim());
    }
  };

  const handleIncomeRangeSubmit = () => {
    if (incomeLower < 500) {
      setError('Minimum income is ₹500');
      return;
    }
    if (incomeUpper < incomeLower) {
      setError('Upper limit must be ≥ lower limit');
      return;
    }
    saveStepData({ income_lower_inr: incomeLower, income_upper_inr: incomeUpper });
  };

  const selectPreset = (lower: number, upper: number) => {
    setIncomeLower(lower);
    setIncomeUpper(upper);
    setCustomRange(false);
  };

  const handleMultiSubmit = () => {
    let selected = [...multiSelected];
    if (current.key === 'agent_assistance_preferences') {
      if (!selected.includes('EXPENSE_COACHING')) selected = ['EXPENSE_COACHING', ...selected];
    }
    if (current.key === 'income_sources' && selected.length < 1) {
      setError('Pick at least one income source');
      return;
    }
    saveStep(selected);
  };

  if (loading) {
    return (
      <Starfield className="flex items-center justify-center min-h-screen">
        <p className="text-cosmos-mint font-display text-xl animate-pulse">🛸 Loading your ship...</p>
      </Starfield>
    );
  }

  return (
    <Starfield className="flex items-center justify-center min-h-screen p-4">
      <div className="w-full max-w-lg">
        <p className="text-center text-white/50 text-sm mb-2 font-display">
          Planet {step + 1} of {STEPS.length} — Training Mission
        </p>
        <PlanetProgress current={step + 1} total={STEPS.length} />

        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ x: 100, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -100, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 200, damping: 25 }}
          >
            <CosmicCard className="text-center">
              <Mascot animal={current.mascot} message={current.question} />
              <h2 className="font-display text-2xl font-bold mt-4 mb-2">{current.question}</h2>
              {current.type === 'multi' && (
                <p className="text-white/50 text-sm mb-4">Select all that apply</p>
              )}
              {current.type === 'income_range' && (
                <p className="text-white/50 text-sm mb-4">Pick a range or set custom limits (min ₹500)</p>
              )}

              {current.type === 'text' || current.type === 'number' ? (
                <form onSubmit={handleTextSubmit} className="space-y-4">
                  <input
                    type={current.type}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder={current.placeholder}
                    autoFocus
                    className="w-full px-4 py-4 rounded-2xl bg-white/5 border border-white/10 focus:border-cosmos-mint focus:outline-none text-center text-lg font-semibold"
                  />
                  {error && <p className="text-cosmos-pink text-sm">{error}</p>}
                  <button type="submit" disabled={submitting || !input.trim()} className="btn-cosmic-primary w-full">
                    {submitting ? '🚀...' : 'Next Planet →'}
                  </button>
                </form>
              ) : current.type === 'chips' ? (
                <div className="grid grid-cols-2 gap-3">
                  {LIVING_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      disabled={submitting}
                      onClick={() => saveStep(opt.value)}
                      className="chip-cosmic py-4 flex flex-col items-center gap-1"
                    >
                      <span className="text-2xl">{opt.emoji}</span>
                      <span>{opt.label}</span>
                    </button>
                  ))}
                </div>
              ) : current.type === 'freq' ? (
                <div className="space-y-3">
                  {FREQ_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      disabled={submitting}
                      onClick={() => saveStep(opt.value)}
                      className="chip-cosmic w-full py-4 flex items-center justify-center gap-3"
                    >
                      <span className="text-2xl">{opt.emoji}</span>
                      <span>{opt.label}</span>
                    </button>
                  ))}
                </div>
              ) : current.type === 'income_range' ? (
                <div className="space-y-4 text-left">
                  <div className="grid grid-cols-2 gap-2">
                    {INCOME_RANGE_PRESETS.map((p) => (
                      <button
                        key={p.label}
                        type="button"
                        disabled={submitting}
                        onClick={() => selectPreset(p.lower, p.upper)}
                        className={`chip-cosmic py-3 text-xs flex flex-col items-center gap-1 ${
                          !customRange && incomeLower === p.lower && incomeUpper === p.upper
                            ? 'ring-2 ring-cosmos-mint bg-cosmos-mint/10'
                            : ''
                        }`}
                      >
                        <span className="text-xl">{p.emoji}</span>
                        <span>{p.label}</span>
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => setCustomRange(true)}
                    className={`chip-cosmic w-full py-2 text-xs ${customRange ? 'ring-2 ring-cosmos-amber' : ''}`}
                  >
                    ✏️ Custom range
                  </button>
                  {customRange && (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-white/50 block mb-1">Lower (₹)</label>
                        <input
                          type="number"
                          min={500}
                          value={incomeLower}
                          onChange={(e) => setIncomeLower(Number(e.target.value))}
                          className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 focus:border-cosmos-mint focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-white/50 block mb-1">Upper (₹)</label>
                        <input
                          type="number"
                          min={incomeLower}
                          value={incomeUpper}
                          onChange={(e) => setIncomeUpper(Number(e.target.value))}
                          className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 focus:border-cosmos-mint focus:outline-none"
                        />
                      </div>
                    </div>
                  )}
                  <p className="text-center text-cosmos-mint text-sm">
                    ₹{incomeLower.toLocaleString('en-IN')} – ₹{incomeUpper.toLocaleString('en-IN')} / month
                  </p>
                  {error && <p className="text-cosmos-pink text-sm">{error}</p>}
                  <button
                    type="button"
                    onClick={handleIncomeRangeSubmit}
                    disabled={submitting}
                    className="btn-cosmic-primary w-full"
                  >
                    {submitting ? '🚀...' : 'Next Planet →'}
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto text-left">
                    {current.options?.map((opt) => {
                      const locked = opt.value === 'EXPENSE_COACHING';
                      const selected = locked || multiSelected.includes(opt.value);
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          disabled={submitting || locked}
                          onClick={() => toggleMulti(opt.value)}
                          className={`chip-cosmic py-3 px-2 text-xs flex flex-col items-center gap-1 ${
                            selected ? 'ring-2 ring-cosmos-mint bg-cosmos-mint/10' : ''
                          } ${locked ? 'opacity-80 cursor-default' : ''}`}
                        >
                          <span className="text-xl">{opt.emoji}</span>
                          <span className="text-center leading-tight">{opt.label}</span>
                          {opt.hint ? (
                            <span className="text-[10px] text-cosmos-amber">{opt.hint}</span>
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                  {error && <p className="text-cosmos-pink text-sm">{error}</p>}
                  <button
                    type="button"
                    onClick={handleMultiSubmit}
                    disabled={
                      submitting ||
                      (current.key === 'income_sources' && multiSelected.length < 1)
                    }
                    className="btn-cosmic-primary w-full"
                  >
                    {submitting ? '🚀...' : isLastStep ? '🚀 Launch Mission!' : 'Next Planet →'}
                  </button>
                </div>
              )}
              {error && !['text', 'number', 'multi', 'income_range'].includes(current.type) && (
                <p className="text-cosmos-pink text-sm mt-4">{error}</p>
              )}
            </CosmicCard>
          </motion.div>
        </AnimatePresence>
      </div>
    </Starfield>
  );
}
