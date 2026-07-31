import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { initDb } from './data/db.js';

// Load routes
import authRoutes from './routes/auth.js';
import logRoutes from './routes/logs.js';
import planRoutes from './routes/plans.js';
import reviewRoutes from './routes/reviews.js';
import auditRoutes from './routes/audits.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Initialize SQLite database
initDb().catch(err => {
  console.error('Failed to initialize database:', err);
  process.exit(1);
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/logs', logRoutes);
app.use('/api/plans', planRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/audits', auditRoutes);

// Serve static assets in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../client/dist')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/dist/index.html'));
  });
} else {
  app.get('/', (req, res) => {
    res.send('Wellness Review Agent Express Server is running in Development mode.');
  });
}

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled Server Error:', err);
  res.status(500).json({
    success: false,
    message: 'An internal server error occurred',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

app.listen(PORT, () => {
  console.log(`Server is listening on port ${PORT}`);
});
