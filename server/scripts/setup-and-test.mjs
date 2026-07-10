/**
 * Creates tables (via pg if SUPABASE_DB_PASSWORD set) and runs sample data test.
 * Usage: node scripts/setup-and-test.mjs
 */
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..', '..');

function loadEnv() {
  const envPath = join(root, '.env');
  if (!existsSync(envPath)) throw new Error('.env not found');
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnv();

// Fix SSL issues in some dev environments (corporate proxy etc.)
if (process.env.NODE_TLS_REJECT_UNAUTHORIZED === undefined) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

const SUPABASE_URL = (process.env.SUPABASE_URL ?? '').replace(/\/rest\/v1\/?$/, '');
const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_KEY ?? '';
const ANON_KEY = process.env.SUPABASE_ANON_KEY ?? '';
const DB_PASSWORD = process.env.SUPABASE_DB_PASSWORD ?? '';
const PROJECT_REF = 'pyvavxrbygamknwzimjn';

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function tableExists(name) {
  const { error } = await admin.from(name).select('*').limit(1);
  if (!error) return true;
  if (error.code === 'PGRST205' || error.message?.includes('Could not find the table')) return false;
  return true;
}

async function runMigrationViaPg(sqlFile = '003_minimal_tables_auth.sql') {
  if (!DB_PASSWORD) {
    console.log('⚠️  SUPABASE_DB_PASSWORD not in .env — cannot run DDL from CLI.');
    console.log('   Add it from: Supabase Dashboard → Project Settings → Database → Database password');
    console.log('   Then re-run: npm run migrate');
    return false;
  }

  const pg = (await import('pg')).default;
  const sqlPath = join(root, 'supabase', 'migrations', sqlFile);
  const sql = readFileSync(sqlPath, 'utf8');

  const connStr = `postgresql://postgres.${PROJECT_REF}:${encodeURIComponent(DB_PASSWORD)}@aws-0-ap-south-1.pooler.supabase.com:6543/postgres`;

  const client = new pg.Client({ connectionString: connStr, ssl: { rejectUnauthorized: false } });
  try {
    await client.connect();
    console.log('✅ Connected to Postgres — running migration...');
    await client.query(sql);
    await client.end();
    console.log('✅ Migration applied.');
    return true;
  } catch (err) {
    await client.end().catch(() => {});
    // fallback direct connection
    const direct = `postgresql://postgres:${encodeURIComponent(DB_PASSWORD)}@db.${PROJECT_REF}.supabase.co:5432/postgres`;
    const client2 = new pg.Client({ connectionString: direct, ssl: { rejectUnauthorized: false } });
    try {
      await client2.connect();
      console.log('✅ Connected (direct) — running migration...');
      await client2.query(sql);
      await client2.end();
      console.log('✅ Migration applied.');
      return true;
    } catch (err2) {
      await client2.end().catch(() => {});
      console.log(`❌ Migration failed: ${err2.message}`);
      return false;
    }
  }
}

async function runSampleTest() {
  const testEmail = `cosmo-test-${Date.now()}@test.local`;
  const testPassword = 'testpass123';

  console.log('\n--- Sample data test ---');

  // 1. Create auth user
  const { data: authData, error: authErr } = await admin.auth.admin.createUser({
    email: testEmail,
    password: testPassword,
    email_confirm: true,
  });
  if (authErr) throw new Error(`Auth create failed: ${authErr.message}`);
  const userId = authData.user.id;
  console.log(`✅ Auth user created: ${testEmail} (${userId})`);

  // 2. Insert profile
  const { error: profileErr } = await admin.from('users').insert({
    id: userId,
    name: 'Cosmo Rahul',
    age: 23,
    city: 'Bengaluru',
    living_situation: 'PG_RENTAL',
    report_frequency: 'WEEKLY',
    income_sources: ['SALARY', 'FREELANCE'],
    income_lower_inr: 10000,
    income_upper_inr: 15000,
    agent_assistance_preferences: ['EXPENSE_COACHING', 'EMAIL_MISSION_REPORTS', 'BUDGET_PLANNING', 'CIBIL_CREDIT'],
  });
  if (profileErr) throw new Error(`Profile insert failed: ${profileErr.message}`);
  console.log('✅ Profile inserted');

  // 3. Insert sample transactions
  const { data: txs, error: txErr } = await admin.from('transactions').insert([
    {
      user_id: userId,
      amount: 450,
      description: 'Swiggy lunch',
      raw_message: 'spent 450 on Swiggy',
      category: null,
      is_split: false,
    },
    {
      user_id: userId,
      amount: 200,
      description: 'dinner with friends',
      raw_message: 'spent 800 on dinner with 3 friends',
      category: null,
      is_split: true,
      total_bill: 800,
      split_count: 4,
    },
  ]).select();
  if (txErr) throw new Error(`Transaction insert failed: ${txErr.message}`);
  console.log(`✅ ${txs.length} sample transactions inserted`);

  // 4. Test login via anon client
  const anon = createClient(SUPABASE_URL, ANON_KEY);
  const { data: signIn, error: signInErr } = await anon.auth.signInWithPassword({
    email: testEmail,
    password: testPassword,
  });
  if (signInErr) throw new Error(`Sign-in test failed: ${signInErr.message}`);
  console.log('✅ Email sign-in works');

  // 5. Test parser via API (if server running)
  try {
    const token = signIn.session.access_token;
    const res = await fetch('http://localhost:3001/api/expenses/parse', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ message: 'spent 120 on auto' }),
    });
    const body = await res.json();
    if (res.ok && body.success) {
      console.log(`✅ Expense parser API: ₹${body.amount} — ${body.description}`);
    } else {
      console.log(`⚠️  Parser API: ${body.error ?? res.status} (start server with npm run dev for full test)`);
    }
  } catch {
    console.log('⚠️  Server not running — start with npm run dev to test API');
  }

  console.log('\n🎉 Sample test complete!');
  console.log(`   Login: ${testEmail} / ${testPassword}`);
}

async function ensureProfileColumns() {
  const { error } = await admin.from('users').select('income_sources, agent_assistance_preferences').limit(1);
  if (!error) {
    console.log('✅ Profile skill columns exist');
    return true;
  }
  if (error.message?.includes('income_sources') || error.message?.includes('agent_assistance')) {
    console.log('⚠️  Missing profile columns — applying migration 004...');
    const ok = await runMigrationViaPg('004_user_agent_profile.sql');
    if (!ok) {
      console.log('\n📋 Paste this in Supabase SQL Editor:\n');
      console.log(readFileSync(join(root, 'supabase', 'migrations', '004_user_agent_profile.sql'), 'utf8'));
      return false;
    }
    return true;
  }
  console.log(`⚠️  Could not verify columns: ${error.message}`);
  return true;
}

async function main() {
  console.log('🌌 CosmoSpend setup & test\n');
  console.log(`   URL: ${SUPABASE_URL}`);

  if (!SUPABASE_URL || !SERVICE_KEY) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  }

  const usersExists = await tableExists('users');
  if (usersExists) {
    console.log('✅ Tables already exist');
    const colsOk = await ensureProfileColumns();
    if (!colsOk) process.exit(1);
  } else {
    console.log('❌ Tables not found — attempting migration via Postgres...');
    const migrated = await runMigrationViaPg();
    if (!migrated) {
      console.log('\n📋 Or paste SQL from supabase/migrations/003_minimal_tables_auth.sql in Supabase SQL Editor.');
      process.exit(1);
    }
  }

  await runSampleTest();
}

async function testAuthOnly() {
  console.log('\n--- Auth-only test ---');
  const testEmail = `cosmo-auth-${Date.now()}@test.local`;
  const testPassword = 'testpass123';
  const { error } = await admin.auth.admin.createUser({
    email: testEmail,
    password: testPassword,
    email_confirm: true,
  });
  if (error) throw new Error(`Auth create failed: ${error.message}`);
  console.log(`✅ Auth user created: ${testEmail}`);

  const anon = createClient(SUPABASE_URL, ANON_KEY);
  const { error: signInErr } = await anon.auth.signInWithPassword({ email: testEmail, password: testPassword });
  if (signInErr) throw new Error(`Sign-in failed: ${signInErr.message}`);
  console.log('✅ Email sign-in works');
  console.log(`   Login: ${testEmail} / ${testPassword}`);
}

if (process.argv.includes('--auth-only')) {
  loadEnv();
  if (process.env.NODE_TLS_REJECT_UNAUTHORIZED === undefined) {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  }
  console.log('🌌 CosmoSpend auth test\n');
  testAuthOnly().catch((err) => { console.error('\n❌', err.message); process.exit(1); });
} else {
  main().catch((err) => { console.error('\n❌', err.message); process.exit(1); });
}
