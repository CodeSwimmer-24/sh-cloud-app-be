const express = require('express');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const { Op } = require('sequelize');
const { User, File, Folder, sequelize } = require('../models');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Register new user (Public - No authentication required)
router.post('/register',
  [
    body('username')
      .isLength({ min: 3 }).withMessage('Username must be at least 3 characters')
      .matches(/^[a-zA-Z0-9_]+$/).withMessage('Username can only contain letters, numbers, and underscores')
      .custom((value) => {
        if (/^\d+$/.test(value)) {
          throw new Error('Username cannot contain only numbers');
        }
        return true;
      }),
    body('email').isEmail().withMessage('Valid email required'),
    body('password')
      .isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
      .custom((value) => {
        if (/^\d+$/.test(value)) {
          throw new Error('Password cannot contain only numbers');
        }
        if (/^[a-zA-Z]+$/.test(value)) {
          throw new Error('Password should include at least one number or special character');
        }
        return true;
      })
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { username, email, password, role } = req.body;

      // Public registration - always set role to 'user' (prevent self-admin registration)
      const userRole = 'user';

      // Check if user already exists
      const existingUser = await User.findOne({
        where: {
          [Op.or]: [{ username }, { email }]
        }
      });

      if (existingUser) {
        return res.status(400).json({ message: 'User already exists' });
      }

      // Create user (password will be hashed by the model hook)
      const user = await User.create({
        username,
        email,
        password,
        role: userRole
      });

      res.status(201).json({
        message: 'User created successfully',
        userId: user.id
      });
    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  }
);

// Login
router.post('/login',
  [
    body('username').notEmpty().withMessage('Username required'),
    body('password').notEmpty().withMessage('Password required')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { username, password } = req.body;

      // Find user
      const user = await User.findOne({
        where: { username }
      });

      if (!user) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      // Check password
      const isValidPassword = await user.validatePassword(password);
      if (!isValidPassword) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      // Generate JWT token
      const token = jwt.sign(
        { userId: user.id, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
      );

      res.json({
        message: 'Login successful',
        token,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role
        }
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  }
);

// Get current user profile
router.get('/profile', authenticateToken, (req, res) => {
  res.json({
    user: {
      id: req.user.id,
      username: req.user.username,
      email: req.user.email,
      role: req.user.role
    }
  });
});

// Delete user (Admin only) - Place before GET /users to avoid route conflicts
router.delete('/users/:userId', authenticateToken, async (req, res) => {
  console.log('=== DELETE USER ROUTE HIT ===');
  console.log('Method:', req.method);
  console.log('Path:', req.path);
  console.log('Original URL:', req.originalUrl);
  console.log('Params:', req.params);
  console.log('User ID to delete:', req.params.userId);

  try {
    console.log('Delete user route hit - userId:', req.params.userId);
    console.log('User making request:', req.user);

    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const userId = parseInt(req.params.userId);
    console.log('Parsed userId:', userId);

    // Validate userId
    if (isNaN(userId)) {
      return res.status(400).json({ message: 'Invalid user ID' });
    }

    // Prevent admin from deleting themselves
    if (userId === req.user.id) {
      return res.status(400).json({ message: 'You cannot delete your own account' });
    }

    // Find the user to delete (without transaction first)
    const userToDelete = await User.findByPk(userId);

    if (!userToDelete) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Prevent deleting the last admin
    if (userToDelete.role === 'admin') {
      const adminCount = await User.count({ where: { role: 'admin' } });
      if (adminCount === 1) {
        return res.status(400).json({ message: 'Cannot delete the last admin user' });
      }
    }

    // Start transaction for actual deletion
    const transaction = await sequelize.transaction();

    try {
      // Delete user's files first (cascade delete)
      const deletedFiles = await File.destroy({
        where: { user_id: userId },
        transaction
      });

      // Delete user's folders
      const deletedFolders = await Folder.destroy({
        where: { user_id: userId },
        transaction
      });

      // Delete the user
      await userToDelete.destroy({ transaction });

      // Commit transaction
      await transaction.commit();

      console.log(`User ${userId} deleted. Files deleted: ${deletedFiles}, Folders deleted: ${deletedFolders}`);

      res.json({
        message: 'User deleted successfully',
        deletedFiles,
        deletedFolders
      });
    } catch (transactionError) {
      // Rollback transaction on error
      try {
        await transaction.rollback();
      } catch (rollbackError) {
        console.error('Transaction rollback error:', rollbackError);
      }
      throw transactionError; // Re-throw to outer catch
    }
  } catch (error) {
    console.error('Delete user error:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    res.status(500).json({
      message: error.message || 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Get all users (Admin only)
router.get('/users', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const users = await User.findAll({
      attributes: ['id', 'username', 'email', 'role', 'created_at'],
      order: [['created_at', 'DESC']]
    });

    res.json({ users });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
