#!/usr/bin/env node

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DEAD_PCT_THRESHOLD = Number.parseFloat(process.env.DB_COMPACT_DEAD_PCT || '5');
const DEAD_ROWS_THRESHOLD = Number.parseInt(process.env.DB_COMPACT_DEAD_ROWS || '1000', 10);
const MAX_TABLES = Number.parseInt(process.env.DB_COMPACT_MAX_TABLES || '20', 10);

function qIdent(value) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

function toNumber(value) {
  const num = Number(value ?? 0);
  return Number.isFinite(num) ? num : 0;
}

function deadPct(dead, live) {
  const total = dead + live;
  if (total <= 0) return 0;
  return (dead / total) * 100;
}

async function main() {
  const tableRows = await prisma.$queryRawUnsafe(`
    SELECT
      schemaname,
      relname AS table_name,
      n_live_tup::bigint AS live_rows_estimate,
      n_dead_tup::bigint AS dead_rows_estimate
    FROM pg_stat_user_tables
    ORDER BY n_dead_tup DESC
  `);

  const candidates = (Array.isArray(tableRows) ? tableRows : [])
    .map((row) => {
      const live = toNumber(row.live_rows_estimate);
      const dead = toNumber(row.dead_rows_estimate);
      return {
        schema: row.schemaname,
        table: row.table_name,
        live,
        dead,
        deadPct: Number(deadPct(dead, live).toFixed(2)),
      };
    })
    .filter((row) => row.dead >= DEAD_ROWS_THRESHOLD && row.deadPct >= DEAD_PCT_THRESHOLD)
    .slice(0, Math.max(1, MAX_TABLES));

  // Always refresh planner statistics globally.
  await prisma.$executeRawUnsafe('ANALYZE;');

  const vacuumed = [];
  const skipped = [];

  for (const row of candidates) {
    const relation = `${qIdent(row.schema)}.${qIdent(row.table)}`;
    try {
      await prisma.$executeRawUnsafe(`VACUUM (ANALYZE) ${relation};`);
      vacuumed.push(row);
    } catch (error) {
      skipped.push({
        ...row,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify(
      {
        ok: true,
        thresholds: {
          deadPct: DEAD_PCT_THRESHOLD,
          deadRows: DEAD_ROWS_THRESHOLD,
          maxTables: MAX_TABLES,
        },
        analyzed: true,
        candidateCount: candidates.length,
        vacuumedCount: vacuumed.length,
        skippedCount: skipped.length,
        vacuumed,
        skipped,
      },
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
