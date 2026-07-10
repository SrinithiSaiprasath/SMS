/**
 * Apply pending Supabase SQL migrations via direct Postgres connection.
 * Requires SUPABASE_DB_PASSWORD in .env (Dashboard → Database → password).
 *
 * Usage: node scripts/migrate.mjs
 *        node scripts/migrate.mjs --file 004_user_agent_profile.sql
 */
import { readFileSync, existsSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

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

const DB_PASSWORD = process.env.SUPABASE_DB_PASSWORD ?? '';
const PROJECT_REF = process.env.SUPABASE_PROJECT_REF ?? 'pyvavxrbygamknwzimjn';

const MIGRATION_ORDER = [
  '002_complete_setup.sql',
  '004_user_agent_profile.sql',
];

async function connectPg() {
  const pg = (await import('pg')).default;
  const hosts = [
    `postgresql://postgres.${PROJECT_REF}:${encodeURIComponent(DB_PASSWORD)}@aws-0-ap-south-1.pooler.supabase.com:6543/postgres`,
    `postgresql://postgres:${encodeURIComponent(DB_PASSWORD)}@db.${PROJECT_REF}.supabase.co:5432/postgres`,
  ];

  for (const connStr of hosts) {
    const client = new pg.Client({ connectionString: connStr, ssl: { rejectUnauthorized: false } });
    try {
      await client.connect();
      console.log('✅ Connected to Postgres');
      return client;
    } catch (err) {
      await client.end().catch(() => {});
      console.log(`   Connection attempt failed: ${err.message?.slice(0, 100)}`);
    }
  }
  throw new Error('Could not connect to Postgres');
}

async function runSql(client, sql, label) {
  console.log(`\n📄 Running ${label}...`);
  await client.query(sql);
  console.log(`✅ ${label} applied`);
}

async function main() {
  const fileArg = process.argv.find((a) => a.startsWith('--file='))?.split('=')[1]
    ?? (process.argv.includes('--file') ? process.argv[process.argv.indexOf('--file') + 1] : null);

  if (!DB_PASSWORD) {
    console.error('❌ SUPABASE_DB_PASSWORD not set in .env');
    console.error('\nAdd your database password, then re-run:');
    console.error('  npm run migrate');
    console.error('\nOr paste this in Supabase SQL Editor:\n');
    const sql = readFileSync(join(root, 'supabase', 'migrations', '004_user_agent_profile.sql'), 'utf8');
    console.error(sql);
    process.exit(1);
  }

  const client = await connectPg();

  try {
    if (fileArg) {
      const path = join(root, 'supabase', 'migrations', fileArg);
      await runSql(client, readFileSync(path, 'utf8'), fileArg);
    } else {
      // Default: run incremental migrations only (skip full 002 on existing DBs)
      for (const file of [
        '004_user_agent_profile.sql',
        '005_income_range_and_email.sql',
        '006_user_documents_storage.sql',
        '007_report_jobs.sql',
        '008_launch_readiness.sql',
        '009_cron_runs.sql',
      ]) {
        const path = join(root, 'supabase', 'migrations', file);
        if (existsSync(path)) {
          await runSql(client, readFileSync(path, 'utf8'), file);
        }
      }
    }
    console.log('\n🎉 Migrations complete');
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('\n❌', err.message);
  process.exit(1);
});
