async function columnExists(db: any, tableName: string, columnName: string): Promise<boolean> {
  const { rows } = await db.query(
    `SELECT 1
     FROM information_schema.columns
     WHERE table_name = $1 AND column_name = $2
     LIMIT 1`,
    [tableName, columnName]
  );

  return rows.length > 0;
}

async function ensureColumn(db: any, tableName: string, columnName: string, definition: string): Promise<void> {
  if (await columnExists(db, tableName, columnName)) {
    return;
  }

  await db.query(`ALTER TABLE ${tableName} ADD COLUMN ${definition}`);
}

export async function ensureSchema(db: any): Promise<void> {
  await db.query(`
    CREATE TABLE IF NOT EXISTS organizations (
      id BIGSERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      created_by_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS users (
      id BIGSERIAL PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      email TEXT,
      organization_id BIGINT REFERENCES organizations(id) ON DELETE SET NULL,
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
      organization_id BIGINT REFERENCES organizations(id) ON DELETE SET NULL,
      user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (organization_id, key)
    );
  `);

  await ensureColumn(db, 'users', 'email', 'email TEXT');
  await ensureColumn(db, 'users', 'organization_id', 'organization_id BIGINT REFERENCES organizations(id) ON DELETE SET NULL');
  await ensureColumn(db, 'users', 'is_admin', 'is_admin BOOLEAN NOT NULL DEFAULT FALSE');
  await ensureColumn(db, 'users', 'must_change_password', 'must_change_password BOOLEAN NOT NULL DEFAULT FALSE');
  await ensureColumn(db, 'users', 'created_by_user_id', 'created_by_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL');
  await ensureColumn(db, 'users', 'updated_at', 'updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()');
  await ensureColumn(db, 'users', 'password_changed_at', 'password_changed_at TIMESTAMPTZ');

  await ensureColumn(db, 'kv_store', 'updated_at', 'updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()');

  await db.query('CREATE UNIQUE INDEX IF NOT EXISTS kv_store_org_key_idx ON kv_store (organization_id, key)');
  await db.query('CREATE INDEX IF NOT EXISTS kv_store_key_idx ON kv_store (key)');
  await db.query('CREATE INDEX IF NOT EXISTS users_username_idx ON users (username)');
}
