import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config({ path: '../.env' });
dotenv.config();

// Dev/proxy SSL fix (corporate networks)
if (process.env.NODE_ENV !== 'production' && !process.env.NODE_TLS_REJECT_UNAUTHORIZED) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

import onboardingRoutes from './routes/onboarding.js';
import expenseRoutes from './routes/expenses.js';
import reportRoutes from './routes/reports.js';
import profileRoutes from './routes/profile.js';
import internalRoutes from './routes/internal.js';
import { getLlmConfigSummary } from './lib/llm.js';
import { BRAND } from './lib/brand.js';
import { supabaseAdmin } from './lib/supabase.js';

const app = express();
const PORT = process.env.PORT ?? 3001;

app.use(cors({ origin: process.env.CLIENT_URL ?? 'http://localhost:5173', credentials: true }));
app.use(express.json());

app.get('/api/health', (_req, res) => {
  let llm: ReturnType<typeof getLlmConfigSummary> | { configured: false } = { configured: false };
  try {
    llm = getLlmConfigSummary();
  } catch {
    /* key not set */
  }
  res.json({ status: 'ok', theme: BRAND.theme, brand: BRAND.name, llm });
});

app.use('/api/onboarding', onboardingRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/internal', internalRoutes);

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, async () => {
  console.log(`🚀 ${BRAND.name} server on http://localhost:${PORT}`);
  try {
    const llm = getLlmConfigSummary();
    console.log(`   LLM: ${llm.provider} / ${llm.default_model}`);
  } catch {
    console.warn('   ⚠️  No GROQ_API_KEY or OPENAI_API_KEY — reports will fail until configured');
  }
  const { error } = await supabaseAdmin.from('users').select('income_sources').limit(1);
  if (error?.message?.includes('income_sources') || error?.message?.includes('agent_assistance') || error?.message?.includes('income_lower')) {
    console.warn('   ⚠️  DB missing columns — run: npm run migrate');
  }
});
