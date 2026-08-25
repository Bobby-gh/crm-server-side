const { EntitySchema } = require('typeorm');

const AppMigrationSchema = new EntitySchema({
  name: 'AppMigration',
  tableName: 'app_migrations',
  columns: {
    name: {
      type: String,
      primary: true
    },
    appliedAt: {
      type: 'timestamptz',
      name: 'applied_at',
      createDate: true
    }
  }
});

module.exports = {
  AppMigrationSchema
};
