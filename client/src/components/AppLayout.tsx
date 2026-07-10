import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Rocket, Moon, Star, Settings, LogOut } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Starfield } from './CosmicUI';
import { PLANETS, ANIMALS } from '../lib/cosmicTheme';
import { BRAND } from '../lib/brand';
import { useEffect, useState } from 'react';
import { apiFetch } from '../lib/supabase';

const navItems = [
  { to: '/', icon: Rocket, label: 'Home Planet', planet: 'dashboard' as const },
  { to: '/history', icon: Moon, label: 'Moon Archive', planet: 'history' as const },
  { to: '/reports', icon: Star, label: 'Star Reports', planet: 'reports' as const },
  { to: '/settings', icon: Settings, label: 'Ship Deck', planet: 'settings' as const },
];

export default function AppLayout() {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const [newReports, setNewReports] = useState(0);

  useEffect(() => {
    apiFetch('/api/reports')
      .then((data) => {
        const recent = (data.reports ?? []).filter(
          (r: { status: string; generated_at: string }) =>
            r.status === 'COMPLETED' &&
            r.generated_at &&
            Date.now() - new Date(r.generated_at).getTime() < 7 * 24 * 60 * 60 * 1000
        );
        setNewReports(recent.length > 0 ? 1 : 0);
      })
      .catch(() => {});
  }, []);

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <Starfield className="flex min-h-full">
      <aside className="hidden md:flex flex-col w-64 glass-cosmic m-4 rounded-3xl p-4 border-r-0">
        <div className="flex items-center gap-3 px-2 py-4 mb-4">
          <span className="text-3xl animate-float">{ANIMALS.fox.emoji}</span>
          <div>
            <h1 className="font-display font-bold text-lg text-cosmos-mint">{BRAND.name}</h1>
            <p className="text-xs text-white/50">{BRAND.tagline}</p>
          </div>
        </div>

        <nav className="flex-1 space-y-1">
          {navItems.map(({ to, icon: Icon, label, planet }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-2xl transition-all font-semibold text-sm ${
                  isActive
                    ? 'bg-cosmos-mint/20 text-cosmos-mint border border-cosmos-mint/30'
                    : 'text-white/70 hover:bg-white/5 hover:text-white'
                }`
              }
            >
              <span>{PLANETS[planet].emoji}</span>
              <Icon size={18} />
              <span className="flex-1">{label}</span>
              {planet === 'reports' && newReports > 0 && (
                <span className="w-2 h-2 rounded-full bg-cosmos-pink animate-pulse" />
              )}
            </NavLink>
          ))}
        </nav>

        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-4 py-3 rounded-2xl text-white/50 hover:text-cosmos-pink hover:bg-white/5 transition-all text-sm mt-4"
        >
          <LogOut size={18} />
          Exit Ship
        </button>
      </aside>

      <div className="flex-1 flex flex-col min-h-full">
        <header className="md:hidden glass-cosmic m-3 rounded-2xl px-4 py-3 flex items-center justify-between">
          <span className="font-display font-bold text-cosmos-mint">🌌 {BRAND.name}</span>
          <div className="flex gap-1">
            {navItems.map(({ to, planet }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                className={({ isActive }) =>
                  `p-2 rounded-xl text-lg ${isActive ? 'bg-cosmos-mint/20' : ''}`
                }
              >
                {PLANETS[planet].emoji}
              </NavLink>
            ))}
          </div>
        </header>

        <main className="flex-1 p-4 md:p-8 overflow-auto">
          <Outlet />
        </main>
      </div>
    </Starfield>
  );
}
