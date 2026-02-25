import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { ChangeRecord, ProjectMetadata } from '../types';

export class WatcherDatabase {
  private db: Database.Database;

  constructor(projectPath: string = process.cwd()) {
    const dbDir = path.join(projectPath, '.watcher');
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }
    
    const dbPath = path.join(dbDir, 'watcher.db');
    this.db = new Database(dbPath);
    this.initialize();
  }

  private initialize(): void {
    // Create projects table
    this.db.exec(`
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

    // Create changes table
    this.db.exec(`
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

    // Create file_changes table
    this.db.exec(`
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

    // Create indexes
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_changes_project_timestamp 
      ON changes(project_id, timestamp)
    `);

    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_file_changes_change 
      ON file_changes(change_id)
    `);
  }

  saveProject(metadata: Omit<ProjectMetadata, 'createdAt' | 'updatedAt'>): number {
    const stmt = this.db.prepare(`
      INSERT INTO projects (name, path, tech_stack, architecture)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(path) DO UPDATE SET
        name = excluded.name,
        tech_stack = excluded.tech_stack,
        architecture = excluded.architecture,
        updated_at = CURRENT_TIMESTAMP
    `);

    const result = stmt.run(
      metadata.name,
      metadata.path,
      JSON.stringify(metadata.techStack),
      metadata.architecture
    );

    return result.lastInsertRowid as number;
  }

  getProject(projectPath: string): ProjectMetadata | null {
    const stmt = this.db.prepare(`
      SELECT * FROM projects WHERE path = ?
    `);

    const row = stmt.get(projectPath) as any;
    if (!row) return null;

    return {
      name: row.name,
      path: row.path,
      techStack: JSON.parse(row.tech_stack || '[]'),
      architecture: row.architecture,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  close(): void {
    this.db.close();
  }
}
