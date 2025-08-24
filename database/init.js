const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');

// Create database connection
const db = new Database(path.join(__dirname, 'app.db'));

// Enable foreign keys and WAL mode
db.pragma('foreign_keys = ON');
db.pragma('journal_mode = WAL');

// Create tables
const createTables = () => {
  try {
    // Accounts table
    const createAccountsTable = db.prepare(`
      CREATE TABLE IF NOT EXISTS accounts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        billing_email TEXT NOT NULL,
        token TEXT UNIQUE NOT NULL,
        is_active INTEGER NOT NULL DEFAULT 1,
        tokens INTEGER NOT NULL DEFAULT 100,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        deleted_at DATETIME
      )
    `);

    // Users table (updated with account_id)
    const createUsersTable = db.prepare(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        username TEXT NOT NULL,
        password TEXT NOT NULL,
        email TEXT,
        email_verified INTEGER NOT NULL DEFAULT 0,
        role TEXT NOT NULL CHECK (role IN ('admin','worker')) DEFAULT 'worker',
        scanner_mode TEXT NOT NULL CHECK (scanner_mode IN ('keyboard','physical')) DEFAULT 'keyboard',
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        deleted_at DATETIME,
        UNIQUE (account_id, username)
      )
    `);

    // Scans table
    const createScansTable = db.prepare(`
      CREATE TABLE IF NOT EXISTS scans (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        form_key TEXT NOT NULL,
        data TEXT NOT NULL,
        scanned_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        last_sent_to_email TEXT,
        last_email_status TEXT CHECK (last_email_status IN ('queued','sent','failed','canceled')),
        last_email_sent_at DATETIME,
        export_id INTEGER REFERENCES exports(id) ON DELETE SET NULL,
        deleted_at DATETIME
      )
    `);

    // Email events table
    const createEmailEventsTable = db.prepare(`
      CREATE TABLE IF NOT EXISTS email_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        scan_id INTEGER REFERENCES scans(id) ON DELETE CASCADE,
        to_email TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('queued','sent','failed','canceled')),
        provider TEXT DEFAULT 'resend',
        message_id TEXT,
        error TEXT,
        cost_microunits INTEGER DEFAULT 1000000,
        sent_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Exports table
    const createExportsTable = db.prepare(`
      CREATE TABLE IF NOT EXISTS exports (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        format TEXT NOT NULL DEFAULT 'csv',
        filename TEXT,
        params_json TEXT,
        from_ts DATETIME,
        to_ts DATETIME,
        scan_count INTEGER DEFAULT 0,
        status TEXT NOT NULL CHECK (status IN ('building','ready','failed', 'sent')) DEFAULT 'building',
        error TEXT,
        deleted_at DATETIME
      )
    `);

    // Export scans join table
    const createExportScansTable = db.prepare(`
      CREATE TABLE IF NOT EXISTS export_scans (
        export_id INTEGER NOT NULL REFERENCES exports(id) ON DELETE CASCADE,
        scan_id INTEGER NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
        PRIMARY KEY (export_id, scan_id)
      )
    `);

    // Execute table creation
    createAccountsTable.run();
    createUsersTable.run();
    createScansTable.run();
    createEmailEventsTable.run();
    createExportsTable.run();
    createExportScansTable.run();

    console.log('Database tables created successfully');
  } catch (error) {
    console.error('Error creating tables:', error);
    throw error;
  }
};

// Create indexes
const createIndexes = () => {
  try {
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_users_account ON users(account_id)',
      'CREATE INDEX IF NOT EXISTS idx_scans_account_time ON scans(account_id, scanned_at)',
      'CREATE INDEX IF NOT EXISTS idx_scans_account_export ON scans(account_id, export_id)',
      'CREATE INDEX IF NOT EXISTS idx_scans_formkey ON scans(form_key)',
      'CREATE INDEX IF NOT EXISTS idx_email_events_account_time ON email_events(account_id, sent_at)',
      'CREATE INDEX IF NOT EXISTS idx_exports_account_time ON exports(account_id, created_at)',
      'CREATE INDEX IF NOT EXISTS idx_export_scans_export ON export_scans(export_id)',
      'CREATE INDEX IF NOT EXISTS idx_export_scans_scan ON export_scans(scan_id)'
    ];

    indexes.forEach(indexSql => {
      db.prepare(indexSql).run();
    });

    console.log('Database indexes created successfully');
  } catch (error) {
    console.error('Error creating indexes:', error);
    throw error;
  }
};

// Create default admin account and user
const createDefaultAdmin = async () => {
  try {
    const checkAccount = db.prepare('SELECT * FROM accounts WHERE billing_email = ? LIMIT 1');
    const existingAccount = checkAccount.get('admin@example.com');

    if (!existingAccount) {
      // Create default account
      const insertAccount = db.prepare(`
        INSERT INTO accounts (name, billing_email, token, tokens)
        VALUES (?, ?, ?, ?)
      `);

      const accountResult = insertAccount.run(
        'Default Account',
        'admin@example.com',
        'default-account-token-' + Date.now(),
        100
      );

      // Create default admin user
      const hashedPassword = await bcrypt.hash('admin123', 12);
      const insertUser = db.prepare(`
        INSERT INTO users (account_id, username, email, password, role)
        VALUES (?, ?, ?, ?, ?)
      `);

      insertUser.run(
        accountResult.lastInsertRowid,
        'admin',
        'admin@example.com',
        hashedPassword,
        'admin'
      );

      console.log('Default admin account and user created: admin@example.com / admin123');
    }
  } catch (error) {
    console.error('Error creating default admin:', error);
    throw error;
  }
};

// Initialize database
const initDatabase = async () => {
  try {
    createTables();
    createIndexes();
    await createDefaultAdmin();
    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Database initialization error:', error);
    throw error;
  }
};

module.exports = { db, initDatabase };