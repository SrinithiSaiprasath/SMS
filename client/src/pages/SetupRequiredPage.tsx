export default function SetupRequiredPage() {
  return (
    <div className="min-h-screen gradient-cosmos starfield flex items-center justify-center p-6">
      <div className="glass-cosmic rounded-3xl p-8 max-w-lg w-full text-center">
        <span className="text-6xl animate-float inline-block">🦊🛸</span>
        <h1 className="font-display text-3xl font-bold text-cosmos-mint mt-6">
          Ship Needs Fuel!
        </h1>
        <p className="text-white/70 mt-3 leading-relaxed">
          CosmoSpend is running, but Supabase keys are missing from your{' '}
          <code className="text-cosmos-amber bg-white/10 px-1 rounded">.env</code> file.
          The app was blank because auth could not start.
        </p>

        <div className="mt-6 text-left glass-cosmic rounded-2xl p-4 text-sm font-mono text-white/80 space-y-1">
          <p className="text-cosmos-mint font-sans font-semibold mb-2">Add to project root .env:</p>
          <p>VITE_SUPABASE_URL=https://xxx.supabase.co</p>
          <p>VITE_SUPABASE_ANON_KEY=eyJ...</p>
          <p>SUPABASE_URL=https://xxx.supabase.co</p>
          <p>SUPABASE_ANON_KEY=eyJ...</p>
          <p>SUPABASE_SERVICE_ROLE_KEY=eyJ...</p>
          <p>OPENAI_API_KEY=sk-...</p>
        </div>

        <ol className="mt-6 text-left text-sm text-white/60 space-y-2 list-decimal pl-5">
          <li>Create a free project at supabase.com</li>
          <li>Run <code className="text-cosmos-amber">supabase/migrations/001_initial_schema.sql</code> in SQL Editor</li>
          <li>Copy URL + anon key + service role key into <code className="text-cosmos-amber">.env</code></li>
          <li>Restart: <code className="text-cosmos-amber">npm run dev</code></li>
        </ol>

        <button
          onClick={() => window.location.reload()}
          className="btn-cosmic-primary mt-8 w-full"
        >
          🔄 I added keys — Reload
        </button>
      </div>
    </div>
  );
}
