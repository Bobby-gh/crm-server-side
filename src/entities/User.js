const { EntitySchema } = require('typeorm');

const UserSchema = new EntitySchema({
  name: 'User',
  tableName: 'users',
  columns: {
    id: {
      type: Number,
      primary: true,
      generated: 'increment'
    },
    username: {
      type: String,
      unique: true
    },
    email: {
      type: String,
      nullable: true
    },
    organizationId: {
      type: Number,
      name: 'organization_id',
      nullable: true
    },
    isAdmin: {
      type: Boolean,
      name: 'is_admin',
      default: false
    },
    mustChangePassword: {
      type: Boolean,
      name: 'must_change_password',
      default: false
    },
    passwordHash: {
      type: String,
      name: 'password_hash'
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
    },
    passwordChangedAt: {
      type: 'timestamptz',
      name: 'password_changed_at',
      nullable: true
    }
  }
});

module.exports = {
  UserSchema
};
