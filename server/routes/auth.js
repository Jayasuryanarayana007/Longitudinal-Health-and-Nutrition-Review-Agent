import { Router } from 'express';
import { getDbConnection } from '../data/db.js';
import { hashPassword } from '../utils/hash.js';
import { seedUserLogs } from '../utils/seedData.js';

const router = Router();

// POST /signup - Register a new user
router.post('/signup', async (req, res, next) => {
  const { username, email, password, dob, sex, name } = req.req_body || req.body;
  
  if (!username || !email || !password || !dob || !sex || !name) {
    return res.status(400).json({ success: false, message: 'All fields are required.' });
  }

  try {
    const db = await getDbConnection();
    
    // Check if username or email already exists
    const existingUser = await db.get(
      'SELECT username, email FROM users WHERE username = ? OR email = ?',
      [username.trim().toLowerCase(), email.trim().toLowerCase()]
    );

    if (existingUser) {
      if (existingUser.username === username.trim().toLowerCase()) {
        await db.close();
        return res.status(400).json({ success: false, message: 'Username is already taken.' });
      }
      if (existingUser.email === email.trim().toLowerCase()) {
        await db.close();
        return res.status(400).json({ success: false, message: 'Email is already registered.' });
      }
    }

    const passwordHash = hashPassword(password);
    const createdAt = new Date().toISOString();

    // Insert user
    await db.run(
      `INSERT INTO users (username, email, passwordHash, dob, sex, createdAt) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [username.trim().toLowerCase(), email.trim().toLowerCase(), passwordHash, dob, sex, createdAt]
    );

    // Initialize version 1 goals
    const goalId = 'goal_' + Math.random().toString(36).substr(2, 9);
    await db.run(
      `INSERT INTO goals (goalId, username, version, targetSleepHours, targetDailyCalories, targetActivityMinutes, status, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        goalId,
        username.trim().toLowerCase(),
        1,
        8.0, // Default sleep target (hours)
        2000.0, // Default daily calorie target (kcal)
        30, // Default activity target (minutes)
        'Active',
        createdAt
      ]
    );

    await db.close();

    // Dynamically seed 14 days of historical logs for the new account
    await seedUserLogs(username);

    return res.status(201).json({
      success: true,
      message: 'Account created successfully. Please log in.'
    });

  } catch (error) {
    next(error);
  }
});

// POST /login - Authenticate credentials and establish session
router.post('/login', async (req, res, next) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ success: false, message: 'Username and password are required.' });
  }

  try {
    const db = await getDbConnection();
    const user = await db.get(
      'SELECT username, email, dob, sex, createdAt FROM users WHERE username = ? AND passwordHash = ?',
      [username.trim().toLowerCase(), hashPassword(password)]
    );

    if (!user) {
      await db.close();
      return res.status(401).json({ success: false, message: 'Invalid username or password.' });
    }

    // Get active goal for user
    const activeGoal = await db.get(
      'SELECT version, targetSleepHours, targetDailyCalories, targetActivityMinutes FROM goals WHERE username = ? AND status = "Active"',
      [username.trim().toLowerCase()]
    );

    await db.close();
    return res.json({
      success: true,
      message: 'Authentication successful.',
      user: {
        username: user.username,
        email: user.email,
        dob: user.dob,
        sex: user.sex,
        activeGoal: activeGoal || {
          version: 1,
          targetSleepHours: 8.0,
          targetDailyCalories: 2000.0,
          targetActivityMinutes: 30
        }
      }
    });

  } catch (error) {
    next(error);
  }
});

export default router;
