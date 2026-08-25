const { EntitySchema } = require('typeorm');

const OrganizationSchema = new EntitySchema({
  name: 'Organization',
  tableName: 'organizations',
  columns: {
    id: {
      type: Number,
      primary: true,
      generated: 'increment'
    },
    name: {
      type: String
    },
    slug: {
      type: String,
      unique: true
    },
    createdByUserId: {
      type: Number,
      name: 'created_by_user_id',
      nullable: true
    },
    createdAt: {
      type: 'timestamptz',
      name: 'created_at',
      createDate: true
    },
    updatedAt: {
      type: 'timestamptz',
      name: 'updated_at',
      updateDate: true
    }
  }
});

module.exports = {
  OrganizationSchema
};