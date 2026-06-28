import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { join, dirname } from 'path';
import pool from './client.ts';

const sql = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), 'schema.sql'), 'utf8'
);
await pool.query(sql);
console.log('Schema applied.');
await pool.end();
