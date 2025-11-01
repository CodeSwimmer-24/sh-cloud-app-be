const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Folder = sequelize.define('Folder', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  folder_name: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  folder_path: {
    type: DataTypes.STRING(500),
    allowNull: false
  },
  ftp_path: {
    type: DataTypes.STRING(500),
    allowNull: false
  }
}, {
  tableName: 'folders',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

module.exports = Folder;
