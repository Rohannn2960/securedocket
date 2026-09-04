const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

const SYSTEM_BINARY = 'C:\\Program Files\\MongoDB\\Server\\8.2\\bin\\mongod.exe';
let mongoServer = null;

async function connectToTestDb() {
  if (!mongoServer) {
    mongoServer = await MongoMemoryServer.create({
      binary: {
        systemBinary: SYSTEM_BINARY,
      },
      replSet: {
        count: 1,
        dbName: 'secure-dms-jest',
        storageEngine: 'wiredTiger',
      },
    });
  }

  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(mongoServer.getUri('secure-dms-jest'), {
      retryWrites: false,
      serverSelectionTimeoutMS: 15000,
    });
  }

  return mongoose.connection;
}

async function closeTestDb() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }

  if (mongoServer) {
    await mongoServer.stop();
    mongoServer = null;
  }
}

module.exports = {
  connectToTestDb,
  closeTestDb,
  getMongoServer: () => mongoServer,
};
