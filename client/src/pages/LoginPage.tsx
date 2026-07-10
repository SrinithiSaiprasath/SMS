import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { apiFetch } from '../lib/supabase';
import { Starfield, CosmicCard, Mascot } from '../components/CosmicUI';

export default function LoginPage() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await signIn(email, password);
      const status = await apiFetch('/api/onboarding/status');
      navigate(status.completed ? '/' : '/onboarding', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Starfield className="flex items-center justify-center min-h-screen p-4">
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="w-full max-w-md">
        <div className="text-center mb-8">
          <Mascot animal="fox" message="Welcome back, space cadet! Ready to track your cosmic credits?" />
          <h1 className="font-display text-3xl font-bold text-cosmos-mint mt-4">Board the Ship</h1>
          <p className="text-white/60 mt-2">Log in to continue your adventure</p>
        </div>

        <CosmicCard>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm text-white/60 mb-1">Space Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 focus:border-cosmos-mint focus:outline-none transition-colors"
                placeholder="cadet@galaxy.com"
              />
            </div>
            <div>
              <label className="block text-sm text-white/60 mb-1">Secret Code</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 focus:border-cosmos-mint focus:outline-none transition-colors"
                placeholder="••••••••"
              />
            </div>
            {error && <p className="text-cosmos-pink text-sm">{error}</p>}
            <button type="submit" disabled={loading} className="btn-cosmic-primary w-full">
              {loading ? '🚀 Launching...' : '🚀 Launch'}
            </button>
          </form>
          <p className="text-center text-sm text-white/50 mt-6">
            New explorer?{' '}
            <Link to="/signup" className="text-cosmos-mint hover:underline font-semibold">
              Join the crew
            </Link>
          </p>
        </CosmicCard>
      </motion.div>
    </Starfield>
  );
}
