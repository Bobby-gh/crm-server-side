const { EntitySchema } = require('typeorm');

const StorageRecordSchema = new EntitySchema({
  name: 'StorageRecord',
  tableName: 'kv_store',
  columns: {
    id: {
      type: Number,
      primary: true,
      generated: 'increment'
    },
    key: {
      type: String
    },
    value: {
      type: String
    },
    organizationId: {
      type: Number,
      name: 'organization_id',
      nullable: true
    },
    userId: {
      type: Number,
      name: 'user_id',
      nullable: true
    },
    updatedAt: {
      type: 'timestamptz',
      name: 'updated_at',
      createDate: true,
      updateDate: true
    }
  },
  indices: [
    {
      name: 'kv_store_org_key_idx',
      columns: ['organizationId', 'key'],
      unique: true
    },
    {
      name: 'kv_store_key_idx',
      columns: ['key']
    }
  ]
});

module.exports = {
  StorageRecordSchema
};
