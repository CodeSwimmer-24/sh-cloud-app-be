const { sequelize } = require('../config/database');
const User = require('./User');
const File = require('./File');
const Folder = require('./Folder');

// Define associations
User.hasMany(File, { foreignKey: 'user_id', as: 'files' });
File.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

User.hasMany(Folder, { foreignKey: 'user_id', as: 'folders' });
Folder.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

Folder.hasMany(File, { foreignKey: 'folder_id', as: 'files' });
File.belongsTo(Folder, { foreignKey: 'folder_id', as: 'folder' });

// Sync database
const syncDatabase = async () => {
  try {
    await sequelize.sync({ alter: true });
    console.log('Database synchronized successfully');

    // Create default admin user if it doesn't exist
    const adminUser = await User.findOne({ where: { username: 'admin' } });
    if (!adminUser) {
      await User.create({
        username: 'admin',
        email: 'admin@example.com',
        password: 'admin123', // Will be hashed by the model hook
        role: 'admin'
      });
      console.log('Default admin user created (username: admin, password: admin123)');
    }
  } catch (error) {
    console.error('Database sync failed:', error);
    throw error;
  }
};

module.exports = {
  sequelize,
  User,
  File,
  Folder,
  syncDatabase
};
