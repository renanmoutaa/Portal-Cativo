import { Pool } from 'pg';
const url = 'postgresql://portal:portal@127.0.0.1:5433/portalcativo';
const pool = new Pool({ connectionString: url });
try {
  const res = await pool.query('SELECT 1 as one');
  console.log('OK', res.rows);
} catch (e) {
  console.error('ERROR', e.message);
  process.exit(1);
}
process.exit(0);