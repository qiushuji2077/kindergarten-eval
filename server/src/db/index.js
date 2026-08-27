import { DatabaseSync } from 'node:sqlite';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { SCHEMA_SQL } from './schema.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(__dirname, '../../data');
const uploadsDir = path.resolve(dataDir, 'uploads');
const dbPath = path.resolve(dataDir, 'kindergarten.db');

fs.mkdirSync(uploadsDir, { recursive: true });

const db = new DatabaseSync(dbPath);
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');
db.exec(SCHEMA_SQL);

export { db, dataDir, uploadsDir, dbPath };
