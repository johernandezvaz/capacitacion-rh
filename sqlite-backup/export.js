const { createClient } = require('@supabase/supabase-js');
const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const SUPABASE_URL = 'https://hxhmvkxzfehbcvaumyjl.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh4aG12a3h6ZmVoYmN2YXVteWpsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg1ODQxOTksImV4cCI6MjA4NDE2MDE5OX0.1fqM67fF0gGFf4GKs1-ANCDFiTr95TlHosYzjIIP_RY';

const TABLES = [
    'plants',
    'departamentos',
    'training_years',
    'employees',
    'courses',
    'course_participants',
    'questionnaires',
    'questionnaire_responses',
    'questionnaire_signatures',
    'questionnaire_templates',
    'questionnaire_tokens',
    'hot_questionnaires',
    'hot_section_scores',
    'hot_section_yesno',
    'cold_questionnaires',
    'cold_questionnaire_sections',
    'ojt_records',
    'ojt_sections',
    'ojt_entries',
    'ojt_instances',
    'ojt_instance_entries',
    'ojt_instance_signatures',
    'dnc_entries',
    'detecciones',
    'deteccion_departamentos',
    'deteccion_empleados',
    'user_plants',
];

function log(msg) { console.log(`[${new Date().toISOString().slice(11, 19)}] ${msg}`); }
function err(msg) { console.error(`[ERROR] ${msg}`); }

function getSqlType(value) {
    if (value === null || value === undefined) return 'TEXT';
    if (typeof value === 'number') return 'REAL';
    if (typeof value === 'boolean') return 'INTEGER';
    return 'TEXT';
}

function toSqlValue(value) {
    if (value === null || value === undefined) return null;
    if (typeof value === 'boolean') return value ? 1 : 0;
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
}

async function fetchAllRows(supabase, table) {
    const PAGE = 1000;
    let all = [];
    let from = 0;
    while (true) {
        const { data, error } = await supabase
            .from(table)
            .select('*')
            .range(from, from + PAGE - 1);
        if (error) throw new Error(`${table}: ${error.message}`);
        if (!data || data.length === 0) break;
        all = all.concat(data);
        if (data.length < PAGE) break;
        from += PAGE;
    }
    return all;
}

function createTable(db, table, rows) {
    if (!rows || rows.length === 0) {
        db.run(`CREATE TABLE IF NOT EXISTS "${table}" (id TEXT)`);
        log(`  ${table}: tabla vacía creada`);
        return;
    }

    const sample = rows[0];
    const cols = Object.keys(sample);

    const colDefs = cols.map(col => {
        const type = getSqlType(sample[col]);
        return `"${col}" ${type}`;
    }).join(', ');

    db.run(`CREATE TABLE IF NOT EXISTS "${table}" (${colDefs})`);
}

function insertRows(db, table, rows) {
    if (!rows || rows.length === 0) return;

    const cols = Object.keys(rows[0]);
    const placeholders = cols.map(() => '?').join(', ');
    const colNames = cols.map(c => `"${c}"`).join(', ');
    const stmt = db.prepare(
        `INSERT OR REPLACE INTO "${table}" (${colNames}) VALUES (${placeholders})`
    );

    for (const row of rows) {
        const values = cols.map(col => toSqlValue(row[col]));
        stmt.run(values);
    }
    stmt.free();
}

async function main() {
    const date = new Date().toISOString().slice(0, 10);
    const outputFile = path.join(__dirname, `backup_${date}.sqlite`);

    log('Iniciando exportación Supabase → SQLite');
    log(`Destino: ${outputFile}`);
    console.log('');

    const SQL = await initSqlJs();
    const db = new SQL.Database();

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    let totalRows = 0;
    const summary = [];

    for (const table of TABLES) {
        try {
            process.stdout.write(`Exportando ${table}... `);
            const rows = await fetchAllRows(supabase, table);
            createTable(db, table, rows);
            insertRows(db, table, rows);
            console.log(`${rows.length} filas`);
            totalRows += rows.length;
            summary.push({ table, rows: rows.length, status: 'OK' });
        } catch (e) {
            console.log(`ERROR: ${e.message}`);
            summary.push({ table, rows: 0, status: `ERROR: ${e.message}` });
        }
    }

    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(outputFile, buffer);
    db.close();

    console.log('');
    log('═══════════════════════════════════════');
    log(`Exportación completada`);
    log(`Tablas: ${TABLES.length}`);
    log(`Total filas: ${totalRows.toLocaleString()}`);
    log(`Archivo: ${path.basename(outputFile)}`);
    log(`Tamaño: ${(fs.statSync(outputFile).size / 1024).toFixed(1)} KB`);
    log('═══════════════════════════════════════');

    const errors = summary.filter(s => s.status !== 'OK');
    if (errors.length > 0) {
        console.log('');
        log('Tablas con errores:');
        errors.forEach(e => log(`  ✗ ${e.table}: ${e.status}`));
    }
}

main().catch(e => {
    err(e.message);
    process.exit(1);
});