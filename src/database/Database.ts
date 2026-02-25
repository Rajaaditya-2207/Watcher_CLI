import initSqlJs, { Database } from 'sql.js';
import path from 'path';
import fs from 'fs';
import { ProjectMetadata } from '../types';

export class WatcherDatabase {
  private db: Database | null = null;
  private dbPath: string;
  private initialized: boolean = false;

  constructor(projectPath: string = process.cwd()) {
    const dbDir = path.join(projectPath, '.watcher');
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }
    
    this.dbPath = path.join(dbDir, 'watcher.db');
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    const SQL = await initSqlJs();
    
    // Load existing database or create new one
    if (fs.existsSync(this.dbPath)) {
      const buffer = fs.readFileSync(this.dbPath);
      this.db = new SQL.Database(buffer);
    } else {
      this.db = new SQL.Database();
    }

    // Create tables
    this.db.run(`
      CREATE TABLE IF NOT EXISTS projects (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        path TEXT NOT NULL UNIQUE,
        tech_stack TEXT,
        architecture TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    this.db.run(`
      CREATE TABLE IF NOT EXISTS changes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id INTEGER NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        category TEXT NOT NULL,
        summary TEXT NOT NULL,
        description TEXT,
        impact TEXT,
        lines_added INTEGER DEFAULT 0,
        lines_removed INTEGER DEFAULT 0,
        files_changed INTEGER DEFAULT 0,
        FOREIGN KEY (project_id) REFERENCES projects(id)
      )
    `);

    this.db.run(`
      CREATE TABLE IF NOT EXISTS file_changes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        change_id INTEGER NOT NULL,
        file_path TEXT NOT NULL,
        change_type TEXT NOT NULL,
        lines_added INTEGER DEFAULT 0,
        lines_removed INTEGER DEFAULT 0,
        FOREIGN KEY (change_id) REFERENCES changes(id)
      )
    `);

    this.db.run(`
      CREATE INDEX IF NOT EXISTS idx_changes_project_timestamp 
      ON changes(project_id, timestamp)
    `);

    this.db.run(`
      CREATE INDEX IF NOT EXISTS idx_file_changes_change 
      ON file_changes(change_id)
    `);

    this.initialized = true;
    this.save();
  }

  private save(): void {
    if (!this.db) return;
    const data = this.db.export();
    fs.writeFileSync(this.dbPath, data);
  }

  saveProject(metadata: Omit<ProjectMetadata, 'createdAt' | 'updatedAt'>): number {
    if (!this.db) throw new Error('Database not initialized');

    // Check if project exists
    const existing = this.db.exec(
      'SELECT id FROM projects WHERE path = ?',
      [metadata.path]
    );

    if (existing.length > 0 && existing[0].values.length > 0) {
      // Update existing
      this.db.run(
        `UPDATE projects SET 
          name = ?, 
          tech_stack = ?, 
          architecture = ?,
          updated_at = CURRENT_TIMESTAMP
         WHERE path = ?`,
        [
          metadata.name,
          JSON.stringify(metadata.techStack),
          metadata.architecture,
          metadata.path,
        ]
      );
      this.save();
      return existing[0].values[0][0] as number;
    } else {
      // Insert new
      this.db.run(
        'INSERT INTO projects (name, path, tech_stack, architecture) VALUES (?, ?, ?, ?)',
        [
          metadata.name,
          metadata.path,
          JSON.stringify(metadata.techStack),
          metadata.architecture,
        ]
      );
      this.save();
      
      const result = this.db.exec('SELECT last_insert_rowid()');
      return result[0].values[0][0] as number;
    }
  }

  getProject(projectPath: string): ProjectMetadata | null {
    if (!this.db) throw new Error('Database not initialized');

    const result = this.db.exec(
      'SELECT * FROM projects WHERE path = ?',
      [projectPath]
    );

    if (result.length === 0 || result[0].values.length === 0) {
      return null;
    }

    const row = result[0].values[0];
    const columns = result[0].columns;

    return {
      name: row[columns.indexOf('name')] as string,
      path: row[columns.indexOf('path')] as string,
      techStack: JSON.parse((row[columns.indexOf('tech_stack')] as string) || '[]'),
      architecture: row[columns.indexOf('architecture')] as string,
      createdAt: new Date(row[columns.indexOf('created_at')] as string),
      updatedAt: new Date(row[columns.indexOf('updated_at')] as string),
    };
  }

  close(): void {
    if (this.db) {
      this.save();
      this.db.close();
      this.db = null;
    }
  }
}
