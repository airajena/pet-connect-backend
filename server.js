require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fileUpload = require('express-fileupload');
const connectDB = require('./config/db');
const errorHandler = require('./middlewares/error');
const authRoutes = require('./routes/auth');
const animalRoutes = require('./routes/animals');
const adoptionRoutes = require('./routes/adoptions');

const app = express();

// Connect to MongoDB
connectDB();

// Middleware
app.use(cors({ origin: 'http://localhost:8080' }));
app.use(express.json());
app.use(fileUpload({
  useTempFiles: true,
  tempFileDir: './tmp/',
}));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/animals', animalRoutes);
app.use('/api/adoptions', adoptionRoutes);

// Error Handler
app.use(errorHandler);

// Port
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));