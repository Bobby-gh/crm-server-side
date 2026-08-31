import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialSchema1725148800000 implements MigrationInterface {
  name = "InitialSchema1725148800000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "organizations" (
        "id" SERIAL NOT NULL,
        "name" text,
        "slug" text NOT NULL,
        "created_by_user_id" integer,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_organizations_slug" UNIQUE ("slug"),
        CONSTRAINT "PK_organizations" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "users" (
        "id" SERIAL NOT NULL,
        "username" text NOT NULL,
        "email" text,
        "organization_id" integer,
        "is_admin" boolean NOT NULL DEFAULT false,
        "must_change_password" boolean NOT NULL DEFAULT false,
        "password_hash" text NOT NULL,
        "created_by_user_id" integer,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "password_changed_at" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "UQ_users_username" UNIQUE ("username"),
        CONSTRAINT "PK_users" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "kv_store" (
        "id" SERIAL NOT NULL,
        "key" text NOT NULL,
        "value" text NOT NULL,
        "organization_id" integer,
        "user_id" integer,
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_kv_store" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "kv_store_org_key_idx"
        ON "kv_store" ("organization_id", "key")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "kv_store_key_idx"
        ON "kv_store" ("key")
    `);

    // Add foreign keys only if they don't already exist
    const fkCheck = async (table: string, constraint: string) => {
      const result = await queryRunner.query(`
        SELECT 1 FROM information_schema.table_constraints
        WHERE table_name = $1 AND constraint_name = $2 AND constraint_type = 'FOREIGN KEY'
      `, [table, constraint]);
      return result.length > 0;
    };

    if (!(await fkCheck("users", "FK_users_organization"))) {
      await queryRunner.query(`
        ALTER TABLE "users" ADD CONSTRAINT "FK_users_organization"
          FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
          ON DELETE SET NULL ON UPDATE NO ACTION
      `).catch(() => {});
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "kv_store"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "users"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "organizations"`);
  }
}
