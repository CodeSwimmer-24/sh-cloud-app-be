const express = require('express');
const path = require('path');
const fs = require('fs');
const { File, User, Folder } = require('../models');
const ftpManager = require('../config/ftp');
const upload = require('../middleware/upload');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Upload file
router.post('/upload', authenticateToken, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const { folderId } = req.body;
    const userId = req.user.id;
    const file = req.file;

    let folderFtpPath = '';
    let folderRecord = null;

    // If folderId is provided, validate it exists and belongs to user
    if (folderId) {
      folderRecord = await Folder.findOne({
        where: {
          id: folderId,
          user_id: userId
        }
      });

      if (!folderRecord) {
        return res.status(404).json({ message: 'Folder not found or does not belong to you' });
      }

      folderFtpPath = folderRecord.ftp_path;
    }

    // Create user folder on FTP if it doesn't exist
    const userFtpPath = `/users/${userId}`;
    await ftpManager.createDirectory(userFtpPath);

    // Upload file to FTP - in folder if provided, otherwise in user root
    const ftpFilePath = folderFtpPath
      ? `${folderFtpPath}/${file.filename}`
      : `${userFtpPath}/${file.filename}`;

    // Ensure folder exists on FTP
    if (folderFtpPath) {
      await ftpManager.createDirectory(folderFtpPath);
    }

    await ftpManager.uploadFile(file.path, ftpFilePath);

    // Save file info to database
    const fileRecord = await File.create({
      user_id: userId,
      folder_id: folderId || null,
      filename: file.filename,
      original_name: file.originalname,
      file_path: file.path,
      file_size: file.size,
      file_type: file.mimetype,
      ftp_path: ftpFilePath
    });

    // Clean up local file
    fs.unlinkSync(file.path);

    res.status(201).json({
      message: 'File uploaded successfully',
      file: {
        id: fileRecord.id,
        filename: file.filename,
        originalName: file.originalname,
        size: file.size,
        type: file.mimetype,
        ftpPath: ftpFilePath
      }
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get user's files
router.get('/my-files', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { folderId } = req.query;

    const whereClause = { user_id: userId };
    if (folderId) {
      whereClause.folder_id = folderId;
    }

    const files = await File.findAll({
      where: whereClause,
      include: [{
        model: Folder,
        as: 'folder',
        attributes: ['id', 'folder_name'],
        required: false
      }],
      order: [['created_at', 'DESC']]
    });

    res.json({ files });
  } catch (error) {
    console.error('Get files error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all files (Admin only)
router.get('/all-files', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { folderId } = req.query;

    const includeClause = [{
      model: User,
      as: 'user',
      attributes: ['username', 'email']
    }, {
      model: Folder,
      as: 'folder',
      attributes: ['id', 'folder_name'],
      required: false
    }];

    const whereClause = {};
    if (folderId) {
      whereClause.folder_id = folderId;
    }

    const files = await File.findAll({
      where: whereClause,
      include: includeClause,
      order: [['created_at', 'DESC']]
    });

    res.json({ files });
  } catch (error) {
    console.error('Get all files error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get files by user (Admin only)
router.get('/user-files/:userId', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const files = await File.findAll({
      where: { user_id: userId },
      order: [['created_at', 'DESC']]
    });

    const user = await User.findByPk(userId, {
      attributes: ['username', 'email']
    });

    res.json({
      files,
      user
    });
  } catch (error) {
    console.error('Get user files error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create folder
router.post('/create-folder', authenticateToken, async (req, res) => {
  try {
    const { folderName } = req.body;
    const userId = req.user.id;

    if (!folderName) {
      return res.status(400).json({ message: 'Folder name required' });
    }

    // Create user folder on FTP if it doesn't exist
    const userFtpPath = `/users/${userId}`;
    await ftpManager.createDirectory(userFtpPath);

    const folderFtpPath = `${userFtpPath}/${folderName}`;
    await ftpManager.createDirectory(folderFtpPath);

    // Save folder info to database
    const folder = await Folder.create({
      user_id: userId,
      folder_name: folderName,
      folder_path: `./uploads/${userId}/${folderName}`,
      ftp_path: folderFtpPath
    });

    res.status(201).json({
      message: 'Folder created successfully',
      folder: {
        id: folder.id,
        name: folderName,
        ftpPath: folderFtpPath
      }
    });
  } catch (error) {
    console.error('Create folder error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get user's folders
router.get('/my-folders', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const folders = await Folder.findAll({
      where: { user_id: userId },
      order: [['created_at', 'DESC']]
    });

    res.json({ folders });
  } catch (error) {
    console.error('Get folders error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all folders (Admin only)
router.get('/all-folders', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const folders = await Folder.findAll({
      include: [{
        model: User,
        as: 'user',
        attributes: ['username', 'email']
      }],
      order: [['created_at', 'DESC']]
    });

    res.json({ folders });
  } catch (error) {
    console.error('Get all folders error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// List FTP files (Admin only)
router.get('/ftp-files', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { path = '/' } = req.query;
    const files = await ftpManager.listFiles(path);
    res.json({ files, path });
  } catch (error) {
    console.error('List FTP files error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Download file
router.get('/download/:fileId', authenticateToken, async (req, res) => {
  console.log('=== DOWNLOAD ROUTE HIT ===');
  console.log('Method:', req.method);
  console.log('Path:', req.path);
  console.log('Original URL:', req.originalUrl);
  console.log('Params:', req.params);
  console.log('File ID:', req.params.fileId);

  let tempFilePath = null;

  try {
    const { fileId } = req.params;
    const userId = req.user.id;
    const isAdmin = req.user.role === 'admin';

    // Get file info
    const file = await File.findByPk(fileId, {
      include: [{
        model: User,
        as: 'user',
        attributes: ['id', 'username']
      }]
    });

    if (!file) {
      return res.status(404).json({ message: 'File not found' });
    }

    // Check permissions: user can download their own files, admin can download any file
    if (!isAdmin && file.user_id !== userId) {
      return res.status(403).json({ message: 'You do not have permission to download this file' });
    }

    // Create temporary file path
    tempFilePath = path.join(__dirname, '../../temp', `download_${fileId}_${Date.now()}_${file.filename}`);

    // Ensure temp directory exists
    const tempDir = path.dirname(tempFilePath);
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    // Download file from FTP to temp location
    await ftpManager.downloadFile(file.ftp_path, tempFilePath);

    // Check if file exists
    if (!fs.existsSync(tempFilePath)) {
      return res.status(500).json({ message: 'Failed to download file from storage' });
    }

    // Get file stats
    const stats = fs.statSync(tempFilePath);

    // Set headers for file download
    res.setHeader('Content-Type', file.file_type || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(file.original_name)}"`);
    res.setHeader('Content-Length', stats.size);

    // Stream file to response
    const fileStream = fs.createReadStream(tempFilePath);

    fileStream.pipe(res);

    // Clean up temp file after sending
    fileStream.on('end', () => {
      fs.unlink(tempFilePath, (err) => {
        if (err) console.error('Error deleting temp file:', err);
      });
    });

    fileStream.on('error', (err) => {
      console.error('File stream error:', err);
      if (tempFilePath && fs.existsSync(tempFilePath)) {
        fs.unlink(tempFilePath, () => { });
      }
      if (!res.headersSent) {
        res.status(500).json({ message: 'Error streaming file' });
      }
    });

  } catch (error) {
    console.error('Download file error:', error);

    // Clean up temp file on error
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      fs.unlink(tempFilePath, (err) => {
        if (err) console.error('Error deleting temp file:', err);
      });
    }

    if (!res.headersSent) {
      res.status(500).json({ message: 'Failed to download file' });
    }
  }
});

// Delete file (Admin only)
router.delete('/delete/:fileId', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { fileId } = req.params;

    // Get file info
    const file = await File.findByPk(fileId);

    if (!file) {
      return res.status(404).json({ message: 'File not found' });
    }

    // Delete from FTP
    await ftpManager.deleteFile(file.ftp_path);

    // Delete from database
    await file.destroy();

    res.json({ message: 'File deleted successfully' });
  } catch (error) {
    console.error('Delete file error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
