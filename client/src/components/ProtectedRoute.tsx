import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { apiFetch } from '../lib/supabase';
import { useEffect, useState } from 'react';

export function ProtectedRoute() {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen gradient-cosmos flex items-center justify-center">
        <p className="font-display text-xl text-cosmos-mint animate-pulse">🛸 Loading...</p>
      </div>
    );
  }

  if (!session) return <Navigate to="/login" replace />;
  return <Outlet />;
}

export function OnboardingGuard() {
  const [status, setStatus] = useState<'loading' | 'complete' | 'incomplete'>('loading');

  useEffect(() => {
    apiFetch('/api/onboarding/status')
      .then((d) => setStatus(d.completed ? 'complete' : 'incomplete'))
      .catch(() => setStatus('incomplete'));
  }, []);

  if (status === 'loading') {
    return (
      <div className="min-h-screen gradient-cosmos flex items-center justify-center">
        <p className="font-display text-xl text-cosmos-mint animate-pulse">🌌 Checking mission status...</p>
      </div>
    );
  }

  if (status === 'incomplete') return <Navigate to="/onboarding" replace />;
  return <Outlet />;
}

export function GuestRoute() {
  const { session, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen gradient-cosmos flex items-center justify-center">
        <p className="font-display text-xl text-cosmos-mint animate-pulse">🛸 Loading...</p>
      </div>
    );
  }
  if (session) {
    return <OnboardingRedirect />;
  }
  return <Outlet />;
}

/** Logged-in user: send to onboarding or dashboard */
function OnboardingRedirect() {
  const [target, setTarget] = useState<'loading' | '/onboarding' | '/'>('loading');

  useEffect(() => {
    apiFetch('/api/onboarding/status')
      .then((d) => setTarget(d.completed ? '/' : '/onboarding'))
      .catch(() => setTarget('/onboarding'));
  }, []);

  if (target === 'loading') {
    return (
      <div className="min-h-screen gradient-cosmos flex items-center justify-center">
        <p className="font-display text-xl text-cosmos-mint animate-pulse">🛸 Loading...</p>
      </div>
    );
  }

  return <Navigate to={target} replace />;
}
