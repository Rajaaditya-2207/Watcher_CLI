import initSqlJs, { Database } from 'sql.js';
import path from 'path';
import fs from 'fs';
import { ProjectMetadata } from '../types';

export interface ChangeInput {
  projectId: number;
  category: string;
  summary: string;
  description?: string;
  impact: string;
  filesChanged: number;
  linesAdded?: number;
  linesRemoved?: number;
  fileDetails?: { filePath: string; changeType: string; linesAdded?: number; linesRemoved?: number }[];
}

export interface ChangeRow {
  id: number;
  projectId: number;
  timestamp: string;
  category: string;
  summary: string;
  description: string;
  impact: string;
  linesAdded: number;
  linesRemoved: number;
  filesChanged: number;
}

export interface FileChangeRow {
  id: number;
  changeId: number;
  filePath: string;
  changeType: string;
  linesAdded: number;
  linesRemoved: number;
}

export interface TechnicalDebtInput {
  projectId: number;
  type: string;
  severity: string;
  filePath?: string;
  description: string;
}

export interface TechnicalDebtRow {
  id: number;
  projectId: number;
  type: string;
  severity: string;
  filePath: string;
  description: string;
  detectedAt: string;
  status: string;
}

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
      CREATE TABLE IF NOT EXISTS technical_debt (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id INTEGER NOT NULL,
        type TEXT NOT NULL,
        severity TEXT NOT NULL,
        file_path TEXT,
        description TEXT NOT NULL,
        detected_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        resolved_at DATETIME,
        status TEXT DEFAULT 'open',
        FOREIGN KEY (project_id) REFERENCES projects(id)
      )
    `);

    this.db.run(`
      CREATE TABLE IF NOT EXISTS metrics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id INTEGER NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        total_files INTEGER,
        total_lines INTEGER,
        test_coverage REAL,
        code_duplication REAL,
        complexity_avg REAL,
        debt_count INTEGER,
        FOREIGN KEY (project_id) REFERENCES projects(id)
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

    this.db.run(`
      CREATE INDEX IF NOT EXISTS idx_debt_project_status
      ON technical_debt(project_id, status)
    `);

    this.db.run(`
      CREATE INDEX IF NOT EXISTS idx_metrics_project_timestamp
      ON metrics(project_id, timestamp)
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

    const existing = this.db.exec(
      'SELECT id FROM projects WHERE path = ?',
      [metadata.path]
    );

    if (existing.length > 0 && existing[0].values.length > 0) {
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

  getProjectId(projectPath: string): number | null {
    if (!this.db) throw new Error('Database not initialized');

    const result = this.db.exec(
      'SELECT id FROM projects WHERE path = ?',
      [projectPath]
    );

    if (result.length === 0 || result[0].values.length === 0) {
      return null;
    }

    return result[0].values[0][0] as number;
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

  saveChange(input: ChangeInput): number {
    if (!this.db) throw new Error('Database not initialized');

    this.db.run(
      `INSERT INTO changes (project_id, category, summary, description, impact, lines_added, lines_removed, files_changed)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.projectId,
        input.category,
        input.summary,
        input.description || '',
        input.impact,
        input.linesAdded || 0,
        input.linesRemoved || 0,
        input.filesChanged,
      ]
    );

    const result = this.db.exec('SELECT last_insert_rowid()');
    const changeId = result[0].values[0][0] as number;

    // Save file-level changes
    if (input.fileDetails) {
      for (const file of input.fileDetails) {
        this.db.run(
          `INSERT INTO file_changes (change_id, file_path, change_type, lines_added, lines_removed)
           VALUES (?, ?, ?, ?, ?)`,
          [changeId, file.filePath, file.changeType, file.linesAdded || 0, file.linesRemoved || 0]
        );
      }
    }

    this.save();
    return changeId;
  }

  getChanges(projectId: number, since?: string, limit?: number): ChangeRow[] {
    if (!this.db) throw new Error('Database not initialized');

    let query = 'SELECT * FROM changes WHERE project_id = ?';
    const params: any[] = [projectId];

    if (since) {
      query += ' AND timestamp >= ?';
      params.push(since);
    }

    query += ' ORDER BY timestamp DESC';

    if (limit) {
      query += ' LIMIT ?';
      params.push(limit);
    }

    const result = this.db.exec(query, params);

    if (result.length === 0) return [];

    const columns = result[0].columns;
    return result[0].values.map((row) => ({
      id: row[columns.indexOf('id')] as number,
      projectId: row[columns.indexOf('project_id')] as number,
      timestamp: row[columns.indexOf('timestamp')] as string,
      category: row[columns.indexOf('category')] as string,
      summary: row[columns.indexOf('summary')] as string,
      description: (row[columns.indexOf('description')] as string) || '',
      impact: row[columns.indexOf('impact')] as string,
      linesAdded: row[columns.indexOf('lines_added')] as number,
      linesRemoved: row[columns.indexOf('lines_removed')] as number,
      filesChanged: row[columns.indexOf('files_changed')] as number,
    }));
  }

  getFileChanges(changeId: number): FileChangeRow[] {
    if (!this.db) throw new Error('Database not initialized');

    const result = this.db.exec(
      'SELECT * FROM file_changes WHERE change_id = ?',
      [changeId]
    );

    if (result.length === 0) return [];

    const columns = result[0].columns;
    return result[0].values.map((row) => ({
      id: row[columns.indexOf('id')] as number,
      changeId: row[columns.indexOf('change_id')] as number,
      filePath: row[columns.indexOf('file_path')] as string,
      changeType: row[columns.indexOf('change_type')] as string,
      linesAdded: row[columns.indexOf('lines_added')] as number,
      linesRemoved: row[columns.indexOf('lines_removed')] as number,
    }));
  }

  getChangeSummary(projectId: number): {
    totalChanges: number;
    totalLinesAdded: number;
    totalLinesRemoved: number;
    categories: Record<string, number>;
  } {
    if (!this.db) throw new Error('Database not initialized');

    const countResult = this.db.exec(
      'SELECT COUNT(*), COALESCE(SUM(lines_added), 0), COALESCE(SUM(lines_removed), 0) FROM changes WHERE project_id = ?',
      [projectId]
    );

    const catResult = this.db.exec(
      'SELECT category, COUNT(*) as cnt FROM changes WHERE project_id = ? GROUP BY category',
      [projectId]
    );

    const categories: Record<string, number> = {};
    if (catResult.length > 0) {
      for (const row of catResult[0].values) {
        categories[row[0] as string] = row[1] as number;
      }
    }

    const row = countResult.length > 0 ? countResult[0].values[0] : [0, 0, 0];

    return {
      totalChanges: row[0] as number,
      totalLinesAdded: row[1] as number,
      totalLinesRemoved: row[2] as number,
      categories,
    };
  }

  saveTechnicalDebt(input: TechnicalDebtInput): number {
    if (!this.db) throw new Error('Database not initialized');

    this.db.run(
      `INSERT INTO technical_debt (project_id, type, severity, file_path, description)
       VALUES (?, ?, ?, ?, ?)`,
      [input.projectId, input.type, input.severity, input.filePath || '', input.description]
    );

    this.save();
    const result = this.db.exec('SELECT last_insert_rowid()');
    return result[0].values[0][0] as number;
  }

  getTechnicalDebt(projectId: number, status: string = 'open'): TechnicalDebtRow[] {
    if (!this.db) throw new Error('Database not initialized');

    const result = this.db.exec(
      'SELECT * FROM technical_debt WHERE project_id = ? AND status = ? ORDER BY detected_at DESC',
      [projectId, status]
    );

    if (result.length === 0) return [];

    const columns = result[0].columns;
    return result[0].values.map((row) => ({
      id: row[columns.indexOf('id')] as number,
      projectId: row[columns.indexOf('project_id')] as number,
      type: row[columns.indexOf('type')] as string,
      severity: row[columns.indexOf('severity')] as string,
      filePath: (row[columns.indexOf('file_path')] as string) || '',
      description: row[columns.indexOf('description')] as string,
      detectedAt: row[columns.indexOf('detected_at')] as string,
      status: row[columns.indexOf('status')] as string,
    }));
  }

  clearTechnicalDebt(projectId: number): void {
    if (!this.db) throw new Error('Database not initialized');
    this.db.run('DELETE FROM technical_debt WHERE project_id = ?', [projectId]);
    this.save();
  }

  getFileHotspots(projectId: number, limit: number = 10): { filePath: string; count: number }[] {
    if (!this.db) throw new Error('Database not initialized');

    const result = this.db.exec(
      `SELECT fc.file_path, COUNT(*) as cnt
       FROM file_changes fc
       JOIN changes c ON fc.change_id = c.id
       WHERE c.project_id = ?
       GROUP BY fc.file_path
       ORDER BY cnt DESC
       LIMIT ?`,
      [projectId, limit]
    );

    if (result.length === 0) return [];

    return result[0].values.map((row) => ({
      filePath: row[0] as string,
      count: row[1] as number,
    }));
  }

  close(): void {
    if (this.db) {
      this.save();
      this.db.close();
      this.db = null;
    }
  }
}
