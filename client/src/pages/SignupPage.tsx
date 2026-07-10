import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { Starfield, CosmicCard, Mascot } from '../components/CosmicUI';

export default function SignupPage() {
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      await signUp(email, password);
      // Account + session ready → onboarding only after signup succeeds
      navigate('/onboarding', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Signup failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Starfield className="flex items-center justify-center min-h-screen p-4">
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="w-full max-w-md">
        <div className="text-center mb-8">
          <Mascot animal="bunny" message="New recruit! Create your account first, then we'll suit you up!" />
          <h1 className="font-display text-3xl font-bold text-cosmos-mint mt-4">Join the Crew</h1>
          <p className="text-white/60 mt-2">Step 1: Create account → Step 2: Onboarding</p>
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
                autoComplete="email"
                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 focus:border-cosmos-mint focus:outline-none"
                placeholder="cadet@galaxy.com"
              />
            </div>
            <div>
              <label className="block text-sm text-white/60 mb-1">Password (min 6)</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                autoComplete="new-password"
                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 focus:border-cosmos-mint focus:outline-none"
                placeholder="••••••••"
              />
            </div>
            <div>
              <label className="block text-sm text-white/60 mb-1">Confirm Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
                autoComplete="new-password"
                className={`w-full px-4 py-3 rounded-xl bg-white/5 border focus:border-cosmos-mint focus:outline-none ${
                  confirmPassword && password !== confirmPassword
                    ? 'border-cosmos-pink'
                    : 'border-white/10'
                }`}
                placeholder="••••••••"
              />
              {confirmPassword && password !== confirmPassword && (
                <p className="text-cosmos-pink text-xs mt-1">Passwords don&apos;t match yet</p>
              )}
            </div>
            {error && <p className="text-cosmos-pink text-sm">{error}</p>}
            <button
              type="submit"
              disabled={loading || password !== confirmPassword}
              className="btn-cosmic-primary w-full"
            >
              {loading ? '🛸 Creating account...' : '🛸 Create Account & Continue'}
            </button>
          </form>
          <p className="text-center text-sm text-white/50 mt-6">
            Already a cadet?{' '}
            <Link to="/login" className="text-cosmos-mint hover:underline font-semibold">
              Log in
            </Link>
          </p>
        </CosmicCard>
      </motion.div>
    </Starfield>
  );
}
