const path = require('path');
const fs = require('fs');

// Load .env from root or current directory
require('dotenv').config({ path: path.join(__dirname, '../.env') });
require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const participantRoutes = require('./routes/participant');
const adminRoutes = require('./routes/admin');

const app = express();

// Ensure upload directory exists
const uploadDir = path.join(__dirname, 'uploads/presentations');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static frontend files
app.use(express.static(path.join(__dirname, '../public')));

// API Routes
app.use('/api/participant', participantRoutes);
app.use('/api/teams', participantRoutes);
app.use('/api/admin', adminRoutes);

// Fallback for SPA routing
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

// MongoDB Connection
const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/quantumfest2k26';

mongoose.connect(mongoUri, {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => {
    console.log('----------------------------------------------------');
    console.log('✓ MongoDB Connected Successfully');
    console.log('----------------------------------------------------');
}).catch((err) => {
    console.error('----------------------------------------------------');
    console.error('⚠ MongoDB connection error:', err.message);
    console.error('Please ensure MongoDB is installed and running on port 27017');
    console.error('----------------------------------------------------');
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log('====================================================');
    console.log(`🚀 Quantum Fest 2K26 Portal is Running!`);
    console.log(`👉 Access URL: http://localhost:${PORT}`);
    console.log('====================================================');
});
