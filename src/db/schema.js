async function columnExists(db, tableName, columnName) {
  const { rows } = await db.query(
    `SELECT 1
     FROM information_schema.columns
     WHERE table_name = $1 AND column_name = $2
     LIMIT 1`,
    [tableName, columnName]
  );

  return rows.length > 0;
}

async function ensureColumn(db, tableName, columnName, definition) {
  if (await columnExists(db, tableName, columnName)) {
    return;
  }

  await db.query(`ALTER TABLE ${tableName} ADD COLUMN ${definition}`);
}

async function ensureSchema(db) {
  await db.query(`
    CREATE TABLE IF NOT EXISTS app_migrations (
      name TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS users (
      id BIGSERIAL PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      email TEXT,
      is_admin BOOLEAN NOT NULL DEFAULT FALSE,
      must_change_password BOOLEAN NOT NULL DEFAULT FALSE,
      password_hash TEXT NOT NULL,
      created_by_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      password_changed_at TIMESTAMPTZ
    );

    CREATE TABLE IF NOT EXISTS kv_store (
      id BIGSERIAL PRIMARY KEY,
      key TEXT NOT NULL,
      value TEXT NOT NULL,
      user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (user_id, key)
    );
  `);

  await ensureColumn(db, 'users', 'email', 'email TEXT');
  await ensureColumn(db, 'users', 'is_admin', 'is_admin BOOLEAN NOT NULL DEFAULT FALSE');
  await ensureColumn(db, 'users', 'must_change_password', 'must_change_password BOOLEAN NOT NULL DEFAULT FALSE');
  await ensureColumn(db, 'users', 'created_by_user_id', 'created_by_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL');
  await ensureColumn(db, 'users', 'updated_at', 'updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()');
  await ensureColumn(db, 'users', 'password_changed_at', 'password_changed_at TIMESTAMPTZ');

  await ensureColumn(db, 'kv_store', 'updated_at', 'updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()');

  await db.query('CREATE UNIQUE INDEX IF NOT EXISTS kv_store_user_key_idx ON kv_store (user_id, key)');
  await db.query('CREATE INDEX IF NOT EXISTS kv_store_key_idx ON kv_store (key)');
  await db.query('CREATE INDEX IF NOT EXISTS users_username_idx ON users (username)');
}

module.exports = {
  ensureSchema
};
