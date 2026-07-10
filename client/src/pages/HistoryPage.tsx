import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { apiFetch } from '../lib/supabase';
import { CosmicCard } from '../components/CosmicUI';
import { formatINR, categoryBadge } from '../lib/cosmicTheme';

interface Transaction {
  id: string;
  amount: number;
  description: string;
  raw_message: string;
  category: string | null;
  is_split: boolean;
  total_bill: number | null;
  logged_at: string;
}

export default function HistoryPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (category) params.set('category', category);

    setLoading(true);
    apiFetch(`/api/expenses?${params}`)
      .then((d) => setTransactions(d.transactions ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [search, category]);

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="font-display text-3xl font-bold">🌙 Moon Archive</h1>
        <p className="text-white/50">Your expense flight log across the galaxy</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" size={18} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search missions..."
            className="w-full pl-10 pr-4 py-3 rounded-2xl bg-white/5 border border-white/10 focus:border-cosmos-mint focus:outline-none"
          />
        </div>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="px-4 py-3 rounded-2xl bg-white/5 border border-white/10 focus:border-cosmos-mint focus:outline-none"
        >
          <option value="">All planets</option>
          <option value="LEAK">🪐 Leak Planet</option>
          <option value="WORTHY_ESSENTIAL">⭐ Essential Star</option>
          <option value="INVESTMENT">🚀 Investment Rocket</option>
        </select>
      </div>

      {loading ? (
        <p className="text-center text-white/50 py-12">Scanning the archives...</p>
      ) : transactions.length === 0 ? (
        <CosmicCard className="text-center py-12">
          <span className="text-5xl">🌌</span>
          <p className="font-display text-xl mt-4">No missions logged yet!</p>
          <p className="text-white/50">Head to Home Planet to log your first expense.</p>
        </CosmicCard>
      ) : (
        <div className="space-y-3">
          {transactions.map((tx) => {
            const badge = categoryBadge(tx.category);
            return (
              <CosmicCard key={tx.id} className="!p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-display font-bold text-lg text-cosmos-mint">
                        {formatINR(Number(tx.amount))}
                      </span>
                      {tx.is_split && (
                        <span className="text-xs bg-cosmos-amber/20 text-cosmos-amber px-2 py-0.5 rounded-full">
                          split from {formatINR(Number(tx.total_bill))}
                        </span>
                      )}
                    </div>
                    <p className="font-semibold truncate">{tx.description}</p>
                    <p className="text-xs text-white/40 truncate mt-1">&ldquo;{tx.raw_message}&rdquo;</p>
                    <p className="text-xs text-white/30 mt-1">
                      {new Date(tx.logged_at).toLocaleDateString('en-IN', {
                        day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
                      })}
                    </p>
                  </div>
                  <span className={`text-xs px-3 py-1 rounded-full whitespace-nowrap ${badge.class}`}>
                    {badge.emoji} {badge.label}
                  </span>
                </div>
              </CosmicCard>
            );
          })}
        </div>
      )}
    </div>
  );
}
