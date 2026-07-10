import { useEffect, useState } from 'react';
import { apiFetch } from '../lib/supabase';
import { CosmicCard, Mascot } from '../components/CosmicUI';
import { LIVING_OPTIONS, FREQ_OPTIONS, INCOME_OPTIONS, ASSISTANCE_OPTIONS, INCOME_RANGE_PRESETS } from '../lib/cosmicTheme';

interface Profile {
  name: string;
  age: number;
  city: string;
  living_situation: string;
  report_frequency: string;
  income_sources: string[];
  income_lower_inr: number;
  income_upper_inr: number;
  agent_assistance_preferences: string[];
  last_report_at: string | null;
  auto_reports_enabled: boolean;
}

interface EmailDelivery {
  id: string;
  report_id: string;
  subject: string;
  status: string;
  error_message: string | null;
  sent_at: string | null;
  created_at: string;
}

export default function SettingsPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [nextReportAt, setNextReportAt] = useState<string | null>(null);
  const [deliveries, setDeliveries] = useState<EmailDelivery[]>([]);
  const [city, setCity] = useState('');
  const [living, setLiving] = useState('');
  const [freq, setFreq] = useState('');
  const [autoReports, setAutoReports] = useState(true);
  const [incomeSelected, setIncomeSelected] = useState<string[]>([]);
  const [incomeLower, setIncomeLower] = useState(10000);
  const [incomeUpper, setIncomeUpper] = useState(15000);
  const [skillsSelected, setSkillsSelected] = useState<string[]>(['EXPENSE_COACHING', 'EMAIL_MISSION_REPORTS']);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    apiFetch('/api/profile')
      .then((d) => {
        const p = d.profile as Profile;
        setProfile(p);
        setNextReportAt(d.next_report_at ?? null);
        setCity(p.city);
        setLiving(p.living_situation);
        setFreq(p.report_frequency);
        setAutoReports(p.auto_reports_enabled ?? true);
        setIncomeSelected(Array.isArray(p.income_sources) ? p.income_sources : []);
        setIncomeLower(p.income_lower_inr ?? 10000);
        setIncomeUpper(p.income_upper_inr ?? 15000);
        setSkillsSelected(
          Array.isArray(p.agent_assistance_preferences) && p.agent_assistance_preferences.length > 0
            ? p.agent_assistance_preferences
            : ['EXPENSE_COACHING']
        );
      })
      .catch(() => {});

    apiFetch('/api/reports/deliveries/recent')
      .then((d) => setDeliveries(d.deliveries ?? []))
      .catch(() => {});
  }, []);

  const toggleIncome = (value: string) => {
    setIncomeSelected((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
    );
  };

  const toggleSkill = (value: string) => {
    if (value === 'EXPENSE_COACHING') return;
    setSkillsSelected((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
    );
  };

  const handleSave = async () => {
    if (incomeSelected.length === 0) {
      setMessage('Pick at least one income source');
      return;
    }

    if (incomeLower < 500 || incomeUpper < incomeLower) {
      setMessage('Invalid income range (min ₹500, upper ≥ lower)');
      return;
    }

    setSaving(true);
    setMessage('');
    try {
      const skills = skillsSelected.includes('EXPENSE_COACHING')
        ? skillsSelected
        : ['EXPENSE_COACHING', ...skillsSelected];

      const d = await apiFetch('/api/profile', {
        method: 'PATCH',
        body: JSON.stringify({
          city,
          living_situation: living,
          report_frequency: freq,
          auto_reports_enabled: autoReports,
          income_sources: incomeSelected,
          income_lower_inr: incomeLower,
          income_upper_inr: incomeUpper,
          agent_assistance_preferences: skills,
        }),
      });
      setProfile(d.profile);
      setNextReportAt(d.next_report_at ?? null);
      setIncomeSelected(d.profile.income_sources ?? incomeSelected);
      setSkillsSelected(d.profile.agent_assistance_preferences ?? skills);
      setMessage('Settings saved!');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  if (!profile) {
    return <p className="text-center text-white/50 py-12">Loading settings...</p>;
  }

  return (
    <div className="max-w-lg mx-auto">
      <div className="mb-8 text-center">
        <h1 className="font-display text-3xl font-bold">Settings</h1>
        <p className="text-white/50">Configure your profile and AI crew</p>
      </div>

      <CosmicCard className="mb-6">
        <Mascot animal="panda" size="sm" />
        <div className="mt-4 space-y-3 text-center">
          <p className="font-display text-2xl font-bold text-cosmos-mint">{profile.name}</p>
          <p className="text-white/50">Age {profile.age}</p>
        </div>
      </CosmicCard>

      <CosmicCard className="space-y-4 mb-6">
        <div>
          <label className="block text-sm text-white/60 mb-1">Report schedule</label>
          <p className="text-xs text-white/40 mb-2">
            Last report:{' '}
            {profile.last_report_at
              ? new Date(profile.last_report_at).toLocaleString('en-IN')
              : 'Never'}
          </p>
          <p className="text-xs text-white/40 mb-3">
            Next auto-report:{' '}
            {autoReports && nextReportAt
              ? new Date(nextReportAt).toLocaleString('en-IN')
              : autoReports
                ? 'Due now (cron runs daily)'
                : 'Paused'}
          </p>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={autoReports}
              onChange={(e) => setAutoReports(e.target.checked)}
              className="w-4 h-4 rounded accent-cosmos-mint"
            />
            <span className="text-sm">Automatic reports on my schedule</span>
          </label>
        </div>
      </CosmicCard>

      <CosmicCard className="space-y-5 mb-6">
        <div>
          <label className="block text-sm text-white/60 mb-2">City</label>
          <input
            value={city}
            onChange={(e) => setCity(e.target.value)}
            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 focus:border-cosmos-mint focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-sm text-white/60 mb-2">Living situation</label>
          <div className="grid grid-cols-2 gap-2">
            {LIVING_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setLiving(opt.value)}
                className={`chip-cosmic py-3 text-xs ${living === opt.value ? 'ring-2 ring-cosmos-mint' : ''}`}
              >
                {opt.emoji} {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm text-white/60 mb-2">Report frequency</label>
          <div className="space-y-2">
            {FREQ_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setFreq(opt.value)}
                className={`chip-cosmic w-full py-3 ${freq === opt.value ? 'ring-2 ring-cosmos-mint' : ''}`}
              >
                {opt.emoji} {opt.label}
              </button>
            ))}
          </div>
        </div>
      </CosmicCard>

      <CosmicCard className="space-y-5 mb-6">
        <div>
          <label className="block text-sm text-white/60 mb-1">Income sources</label>
          <div className="grid grid-cols-2 gap-2">
            {INCOME_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => toggleIncome(opt.value)}
                className={`chip-cosmic py-3 text-xs flex flex-col items-center gap-1 ${
                  incomeSelected.includes(opt.value) ? 'ring-2 ring-cosmos-mint bg-cosmos-mint/10' : ''
                }`}
              >
                <span className="text-xl">{opt.emoji}</span>
                <span>{opt.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm text-white/60 mb-1">Monthly income range</label>
          <div className="grid grid-cols-2 gap-2 mb-3">
            {INCOME_RANGE_PRESETS.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => {
                  setIncomeLower(p.lower);
                  setIncomeUpper(p.upper);
                }}
                className={`chip-cosmic py-2 text-xs flex flex-col items-center gap-1 ${
                  incomeLower === p.lower && incomeUpper === p.upper ? 'ring-2 ring-cosmos-mint' : ''
                }`}
              >
                <span>{p.emoji}</span>
                <span>{p.label}</span>
              </button>
            ))}
          </div>
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
        </div>

        <div>
          <label className="block text-sm text-white/60 mb-1">AI crew skills</label>
          <div className="grid grid-cols-2 gap-2 max-h-72 overflow-y-auto">
            {ASSISTANCE_OPTIONS.map((opt) => {
              const isCore = opt.value === 'EXPENSE_COACHING';
              const selected = isCore || skillsSelected.includes(opt.value);
              return (
                <button
                  key={opt.value}
                  type="button"
                  disabled={isCore}
                  onClick={() => toggleSkill(opt.value)}
                  className={`chip-cosmic py-3 px-2 text-xs flex flex-col items-center gap-1 ${
                    selected ? 'ring-2 ring-cosmos-mint bg-cosmos-mint/10' : ''
                  } ${isCore ? 'opacity-80 cursor-default' : ''}`}
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
        </div>
      </CosmicCard>

      {deliveries.length > 0 && (
        <CosmicCard className="mb-6">
          <h2 className="font-display font-bold text-lg mb-3">Recent email deliveries</h2>
          <ul className="space-y-2 text-sm">
            {deliveries.map((d) => (
              <li key={d.id} className="border-b border-white/5 pb-2 last:border-0">
                <div className="flex justify-between gap-2">
                  <span className="text-white/70 truncate">{d.subject}</span>
                  <span
                    className={
                      d.status === 'SENT'
                        ? 'text-cosmos-mint shrink-0'
                        : d.status === 'FAILED'
                          ? 'text-cosmos-pink shrink-0'
                          : 'text-white/50 shrink-0'
                    }
                  >
                    {d.status}
                  </span>
                </div>
                {d.sent_at && (
                  <p className="text-xs text-white/40 mt-0.5">
                    {new Date(d.sent_at).toLocaleString('en-IN')}
                  </p>
                )}
                {d.error_message && (
                  <p className="text-xs text-cosmos-pink mt-0.5">{d.error_message}</p>
                )}
              </li>
            ))}
          </ul>
        </CosmicCard>
      )}

      <CosmicCard>
        {message && (
          <p className={`text-sm mb-4 ${message.includes('saved') ? 'text-cosmos-mint' : 'text-cosmos-pink'}`}>
            {message}
          </p>
        )}

        <button
          onClick={handleSave}
          disabled={saving || incomeSelected.length === 0}
          className="btn-cosmic-primary w-full"
        >
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </CosmicCard>
    </div>
  );
}
