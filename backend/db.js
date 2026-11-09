const mongoose = require('mongoose');

const connectDB = async () => {
  const configuredUri = process.env.MONGODB_URI?.trim();
  if (!configuredUri && process.env.NODE_ENV === 'production') {
    console.error('Set MONGODB_URI to start the production backend.');
    return false;
  }

  try {
    const uri = configuredUri || 'mongodb://127.0.0.1:27017/guessgame';
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000
    });
    console.log('MongoDB connected.');
    return true;
  } catch (err) {
    console.error('MongoDB connection failed:', err.name);
    if (process.env.NODE_ENV !== 'production' && process.env.REQUIRE_DATABASE !== 'true') {
      console.log('Using in-memory mode. Game state is lost when the server restarts.');
    }
    return false;
  }
};

const disconnectDB = async () => {
  try {
    await mongoose.disconnect();
    console.log('✅ MongoDB disconnected');
  } catch (err) {
    console.error('❌ MongoDB disconnect failed:', err.message);
  }
};

module.exports = { connectDB, disconnectDB };
