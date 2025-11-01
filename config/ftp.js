const ftp = require('ftp');
const fs = require('fs');
require('dotenv').config();

class FTPManager {
  constructor() {
    this.config = {
      host: process.env.FTP_HOST,
      user: process.env.FTP_USER,
      password: process.env.FTP_PASSWORD,
      port: process.env.FTP_PORT || 21
    };
  }

  async connect() {
    return new Promise((resolve, reject) => {
      const client = new ftp();

      client.on('ready', () => {
        console.log('FTP connected successfully');
        resolve(client);
      });

      client.on('error', (err) => {
        console.error('FTP connection error:', err);
        reject(err);
      });

      client.connect(this.config);
    });
  }

  async uploadFile(localPath, remotePath) {
    const client = await this.connect();

    return new Promise((resolve, reject) => {
      client.put(localPath, remotePath, (err) => {
        client.end();
        if (err) {
          reject(err);
        } else {
          resolve(remotePath);
        }
      });
    });
  }

  async listFiles(remotePath = '/') {
    const client = await this.connect();

    return new Promise((resolve, reject) => {
      client.list(remotePath, (err, list) => {
        client.end();
        if (err) {
          reject(err);
        } else {
          resolve(list);
        }
      });
    });
  }

  async createDirectory(remotePath) {
    const client = await this.connect();

    return new Promise((resolve, reject) => {
      client.mkdir(remotePath, true, (err) => {
        client.end();
        if (err) {
          reject(err);
        } else {
          resolve(remotePath);
        }
      });
    });
  }

  async deleteFile(remotePath) {
    const client = await this.connect();

    return new Promise((resolve, reject) => {
      client.delete(remotePath, (err) => {
        client.end();
        if (err) {
          reject(err);
        } else {
          resolve(true);
        }
      });
    });
  }

  async downloadFile(remotePath, localPath) {
    const client = await this.connect();

    return new Promise((resolve, reject) => {
      client.get(remotePath, (err, stream) => {
        if (err) {
          client.end();
          reject(err);
          return;
        }

        const writeStream = fs.createWriteStream(localPath);
        stream.pipe(writeStream);

        writeStream.on('close', () => {
          client.end();
          resolve(localPath);
        });

        writeStream.on('error', (err) => {
          client.end();
          fs.unlink(localPath, () => { }); // Clean up on error
          reject(err);
        });
      });
    });
  }

  async getFileStream(remotePath) {
    const client = await this.connect();

    return new Promise((resolve, reject) => {
      client.get(remotePath, (err, stream) => {
        if (err) {
          client.end();
          reject(err);
          return;
        }

        // Resolve with stream and client (to close later)
        resolve({ stream, client });
      });
    });
  }
}

module.exports = new FTPManager();
