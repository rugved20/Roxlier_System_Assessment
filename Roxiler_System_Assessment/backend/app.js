// app.js
const express = require('express');
const cors = require('cors');
const transactionRoutes = require('./routes/transactionRoutes').default.default;
const connectDB = require('./config/db');

const app = express();

// Connect to MongoDB
connectDB();

// CORS Configuration
app.use(cors({
  origin: 'http://localhost:5173',  // Frontend origin
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true
}));

// Middleware to parse JSON
app.use(express.json());

// API Routes
app.use('/api', transactionRoutes);

module.exports = app;
