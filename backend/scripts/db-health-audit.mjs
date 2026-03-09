#!/usr/bin/env node

import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function bytesToHuman(bytes) {
  const value = Number(bytes || 0);
  if (!Number.isFinite(value) || value <= 0) return '0 B';
  const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB'];
  let size = value;
  let idx = 0;
  while (size >= 1024 && idx < units.length - 1) {
    size /= 1024;
    idx += 1;
  }
  return `${size.toFixed(idx === 0 ? 0 : 2)} ${units[idx]}`;
}

function nowStamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function toNumber(value) {
  const num = Number(value ?? 0);
  return Number.isFinite(num) ? num : 0;
}

function toRatioPercent(numerator, denominator) {
  if (!denominator || denominator <= 0) return 0;
  return Number(((numerator / denominator) * 100).toFixed(2));
}

async function queryOne(sql) {
  const rows = await prisma.$queryRawUnsafe(sql);
  return rows[0] || null;
}

async function queryMany(sql) {
  const rows = await prisma.$queryRawUnsafe(sql);
  return Array.isArray(rows) ? rows : [];
}

async function main() {
  const startedAt = new Date().toISOString();
  const dbInfo = await queryOne(`
    SELECT
      current_database() AS database_name,
      pg_database_size(current_database())::bigint AS database_bytes,
      current_setting('server_version') AS server_version
  `);

  const tableStats = await queryMany(`
    SELECT
      st.schemaname,
      st.relname AS table_name,
      st.n_live_tup::bigint AS live_rows_estimate,
      st.n_dead_tup::bigint AS dead_rows_estimate,
      st.last_vacuum,
      st.last_autovacuum,
      st.last_analyze,
      st.last_autoanalyze,
      pg_total_relation_size(st.relid)::bigint AS total_bytes,
      pg_relation_size(st.relid)::bigint AS table_bytes,
      pg_indexes_size(st.relid)::bigint AS index_bytes
    FROM pg_stat_user_tables st
    ORDER BY pg_total_relation_size(st.relid) DESC
  `);

  const indexStats = await queryMany(`
    SELECT
      ui.schemaname,
      ui.relname AS table_name,
      ui.indexrelname AS index_name,
      ui.idx_scan::bigint AS idx_scan,
      ix.indisunique,
      ix.indisprimary,
      pg_relation_size(ui.indexrelid)::bigint AS index_bytes
    FROM pg_stat_user_indexes ui
    JOIN pg_index ix ON ix.indexrelid = ui.indexrelid
    ORDER BY pg_relation_size(ui.indexrelid) DESC
  `);

  const duplicateIndexes = await queryMany(`
    WITH idx AS (
      SELECT
        n.nspname AS schemaname,
        t.relname AS table_name,
        i.relname AS index_name,
        x.indrelid,
        x.indkey::text AS indkey,
        coalesce(pg_get_expr(x.indpred, x.indrelid), '') AS predicate,
        x.indisunique,
        x.indisprimary
      FROM pg_index x
      JOIN pg_class i ON i.oid = x.indexrelid
      JOIN pg_class t ON t.oid = x.indrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
      WHERE n.nspname NOT IN ('pg_catalog', 'information_schema')
        AND t.relkind = 'r'
    ),
    dup_keys AS (
      SELECT
        schemaname,
        table_name,
        indkey,
        predicate,
        indisunique,
        indisprimary,
        COUNT(*)::int AS copies
      FROM idx
      GROUP BY schemaname, table_name, indkey, predicate, indisunique, indisprimary
      HAVING COUNT(*) > 1
    )
    SELECT
      d.schemaname,
      d.table_name,
      d.indkey,
      d.predicate,
      d.indisunique,
      d.indisprimary,
      d.copies,
      array_agg(i.index_name ORDER BY i.index_name) AS index_names
    FROM dup_keys d
    JOIN idx i
      ON i.schemaname = d.schemaname
     AND i.table_name = d.table_name
     AND i.indkey = d.indkey
     AND i.predicate = d.predicate
     AND i.indisunique = d.indisunique
     AND i.indisprimary = d.indisprimary
    GROUP BY d.schemaname, d.table_name, d.indkey, d.predicate, d.indisunique, d.indisprimary, d.copies
    ORDER BY d.copies DESC, d.table_name
  `);

  const normalizedTables = tableStats.map((row) => {
    const live = toNumber(row.live_rows_estimate);
    const dead = toNumber(row.dead_rows_estimate);
    const totalRows = live + dead;
    return {
      schema: row.schemaname,
      table: row.table_name,
      liveRowsEstimate: live,
      deadRowsEstimate: dead,
      deadPct: toRatioPercent(dead, totalRows),
      totalBytes: toNumber(row.total_bytes),
      tableBytes: toNumber(row.table_bytes),
      indexBytes: toNumber(row.index_bytes),
      lastVacuum: row.last_vacuum || null,
      lastAutovacuum: row.last_autovacuum || null,
      lastAnalyze: row.last_analyze || null,
      lastAutoanalyze: row.last_autoanalyze || null,
    };
  });

  const largestTables = [...normalizedTables]
    .sort((a, b) => b.totalBytes - a.totalBytes)
    .slice(0, 20);
  const deadTupleCandidates = [...normalizedTables]
    .filter((row) => row.deadRowsEstimate >= 1000 && row.deadPct >= 5)
    .sort((a, b) => b.deadPct - a.deadPct)
    .slice(0, 20);
  const staleVacuumCandidates = [...normalizedTables]
    .filter((row) => !row.lastAutovacuum && !row.lastVacuum)
    .slice(0, 20);

  const normalizedIndexes = indexStats.map((row) => ({
    schema: row.schemaname,
    table: row.table_name,
    index: row.index_name,
    scans: toNumber(row.idx_scan),
    isUnique: Boolean(row.indisunique),
    isPrimary: Boolean(row.indisprimary),
    bytes: toNumber(row.index_bytes),
  }));

  const possiblyUnusedIndexes = normalizedIndexes
    .filter((idx) => idx.scans === 0 && !idx.isPrimary)
    .sort((a, b) => b.bytes - a.bytes)
    .slice(0, 30);

  const dbBytes = toNumber(dbInfo?.database_bytes);
  const totalTableBytes = normalizedTables.reduce((sum, row) => sum + row.tableBytes, 0);
  const totalIndexBytes = normalizedTables.reduce((sum, row) => sum + row.indexBytes, 0);
  const totalDeadRowsEstimate = normalizedTables.reduce(
    (sum, row) => sum + row.deadRowsEstimate,
    0
  );
  const totalLiveRowsEstimate = normalizedTables.reduce(
    (sum, row) => sum + row.liveRowsEstimate,
    0
  );

  const summary = {
    startedAt,
    database: {
      name: dbInfo?.database_name || 'unknown',
      serverVersion: dbInfo?.server_version || 'unknown',
      bytes: dbBytes,
      size: bytesToHuman(dbBytes),
    },
    footprint: {
      tableBytes: totalTableBytes,
      tableSize: bytesToHuman(totalTableBytes),
      indexBytes: totalIndexBytes,
      indexSize: bytesToHuman(totalIndexBytes),
      indexToTableRatioPct: toRatioPercent(totalIndexBytes, totalTableBytes || 1),
    },
    rowEstimates: {
      live: totalLiveRowsEstimate,
      dead: totalDeadRowsEstimate,
      deadPct: toRatioPercent(totalDeadRowsEstimate, totalLiveRowsEstimate + totalDeadRowsEstimate),
    },
    counts: {
      userTables: normalizedTables.length,
      userIndexes: normalizedIndexes.length,
      duplicateIndexSets: duplicateIndexes.length,
      deadTupleCandidates: deadTupleCandidates.length,
      staleVacuumCandidates: staleVacuumCandidates.length,
      possiblyUnusedIndexes: possiblyUnusedIndexes.length,
    },
  };

  const report = {
    summary,
    largestTables,
    deadTupleCandidates,
    staleVacuumCandidates,
    possiblyUnusedIndexes,
    duplicateIndexes,
    generatedAt: new Date().toISOString(),
  };

  const outDir = path.resolve(process.cwd(), '..', 'reports', `db-health-${nowStamp()}`);
  await fs.mkdir(outDir, { recursive: true });
  const jsonPath = path.join(outDir, 'DB_HEALTH_REPORT.json');
  const mdPath = path.join(outDir, 'DB_HEALTH_REPORT.md');

  const lines = [];
  lines.push('# DB Health Report');
  lines.push('');
  lines.push(`- Generated: ${report.generatedAt}`);
  lines.push(`- Database: ${summary.database.name}`);
  lines.push(`- DB Size: ${summary.database.size}`);
  lines.push(`- Tables: ${summary.footprint.tableSize}`);
  lines.push(`- Indexes: ${summary.footprint.indexSize}`);
  lines.push(`- Index/Table Ratio: ${summary.footprint.indexToTableRatioPct}%`);
  lines.push(
    `- Estimated Dead Rows: ${summary.rowEstimates.dead} (${summary.rowEstimates.deadPct}%)`
  );
  lines.push('');
  lines.push('## Immediate Safe Actions');
  lines.push(
    '1. Run `npm run -w sonus-backend db:compact:safe` to execute ANALYZE + targeted VACUUM (no data deletion).'
  );
  lines.push('2. Review dead-tuple candidates and re-check after normal traffic cycles.');
  lines.push('3. Review duplicate/unused indexes before changing indexes in production.');
  lines.push('');

  lines.push('## Largest Tables');
  for (const row of largestTables.slice(0, 12)) {
    lines.push(
      `- ${row.schema}.${row.table}: total=${bytesToHuman(row.totalBytes)}, table=${bytesToHuman(row.tableBytes)}, indexes=${bytesToHuman(row.indexBytes)}, dead=${row.deadPct}%`
    );
  }
  lines.push('');

  lines.push('## Dead Tuple Candidates');
  if (!deadTupleCandidates.length) {
    lines.push('- None above threshold (dead >= 1000 and dead% >= 5).');
  } else {
    for (const row of deadTupleCandidates.slice(0, 12)) {
      lines.push(
        `- ${row.schema}.${row.table}: dead=${row.deadRowsEstimate}, live=${row.liveRowsEstimate}, dead%=${row.deadPct}`
      );
    }
  }
  lines.push('');

  lines.push('## Possibly Unused Indexes');
  if (!possiblyUnusedIndexes.length) {
    lines.push('- None with zero scans (excluding primary indexes).');
  } else {
    for (const idx of possiblyUnusedIndexes.slice(0, 12)) {
      lines.push(
        `- ${idx.schema}.${idx.index} on ${idx.table}: scans=${idx.scans}, size=${bytesToHuman(idx.bytes)}, unique=${idx.isUnique}`
      );
    }
  }
  lines.push('');

  lines.push('## Duplicate Index Sets');
  if (!duplicateIndexes.length) {
    lines.push('- None detected.');
  } else {
    for (const dup of duplicateIndexes.slice(0, 10)) {
      lines.push(
        `- ${dup.schemaname}.${dup.table_name}: ${dup.copies} copies -> ${(dup.index_names || []).join(', ')}`
      );
    }
  }
  lines.push('');

  await fs.writeFile(jsonPath, JSON.stringify(report, null, 2), 'utf8');
  await fs.writeFile(mdPath, `${lines.join('\n')}\n`, 'utf8');

  // eslint-disable-next-line no-console
  console.log(`DB health report written:\n- ${mdPath}\n- ${jsonPath}`);
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
