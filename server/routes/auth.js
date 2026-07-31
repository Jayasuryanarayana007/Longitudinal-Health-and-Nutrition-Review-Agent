import { Router } from 'express';
import { getDbConnection } from '../data/db.js';
import { hashPassword } from '../utils/hash.js';

const router = Router();

// POST /signup - Register a new user
router.post('/signup', async (req, res, next) => {
  const { username, email, password, dob, sex, name } = req.body;
  
  if (!username || !email || !password || !dob || !sex || !name) {
    return res.status(400).json({ success: false, message: 'All fields are required.' });
  }

  // Type-casting safety to prevent crashes from malicious non-string payloads
  const userStr = String(username).trim().toLowerCase();
  const nameStr = String(name).trim();
  const emailStr = String(email).trim().toLowerCase();
  const passStr = String(password);
  const dobStr = String(dob);
  const sexStr = String(sex);

  // Validate Full Name
  if (nameStr.length < 1 || nameStr.length > 50) {
    return res.status(400).json({ success: false, message: 'Full Name must be between 1 and 50 characters.' });
  }

  // Validate Email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(emailStr) || emailStr.length > 254) {
    return res.status(400).json({ success: false, message: 'Please provide a valid email address.' });
  }

  // Validate Username format: Alphanumeric and underscores, 3 to 20 characters
  const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
  if (!usernameRegex.test(userStr)) {
    return res.status(400).json({ 
      success: false, 
      message: 'Username must be 3-20 characters long and contain only letters, numbers, or underscores.' 
    });
  }

  // Validate Password complexity: Minimum 8 characters
  if (passStr.length < 8) {
    return res.status(400).json({ success: false, message: 'Password must be at least 8 characters long.' });
  }

  // DOB validation: must be a valid date in the past
  const birthDate = new Date(dobStr);
  if (isNaN(birthDate.getTime()) || birthDate >= new Date()) {
    return res.status(400).json({ success: false, message: 'Date of Birth must be a valid date in the past.' });
  }

  // DOB year lower boundary (no older than year 1900)
  if (birthDate.getFullYear() < 1900) {
    return res.status(400).json({ success: false, message: 'Date of Birth must be after the year 1900.' });
  }

  // Sex validation: must be Male, Female, or Other
  const validSexes = ['Male', 'Female', 'Other'];
  if (!validSexes.includes(sexStr)) {
    return res.status(400).json({ success: false, message: 'Biological Sex must be Male, Female, or Other.' });
  }

  let db;
  try {
    db = await getDbConnection();
    
    // Check if username or email already exists
    const existingUser = await db.get(
      'SELECT username, email FROM users WHERE username = ? OR email = ?',
      [userStr, emailStr]
    );

    if (existingUser) {
      if (existingUser.username === userStr) {
        return res.status(400).json({ success: false, message: 'Username is already taken.' });
      }
      if (existingUser.email === emailStr) {
        return res.status(400).json({ success: false, message: 'Email is already registered.' });
      }
    }

    const passwordHash = hashPassword(passStr);
    const createdAt = new Date().toISOString();

    // Insert user
    await db.run(
      `INSERT INTO users (username, name, email, passwordHash, dob, sex, createdAt) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [userStr, nameStr, emailStr, passwordHash, dobStr, sexStr, createdAt]
    );

    return res.status(201).json({
      success: true,
      message: 'Account created successfully. Please log in.'
    });

  } catch (error) {
    next(error);
  } finally {
    if (db) {
      await db.close();
    }
  }
});

// POST /login - Authenticate credentials and establish session
router.post('/login', async (req, res, next) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ success: false, message: 'Username and password are required.' });
  }

  const userStr = String(username).trim().toLowerCase();
  const passStr = String(password);

  let db;
  try {
    db = await getDbConnection();
    const user = await db.get(
      'SELECT username, name, email, dob, sex, createdAt FROM users WHERE username = ? AND passwordHash = ?',
      [userStr, hashPassword(passStr)]
    );

    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid username or password.' });
    }

    // Get active goal for user (optional: returns null if not configured)
    const activeGoal = await db.get(
      'SELECT version, targetSleepHours, targetDailyCalories, targetActivityMinutes, targetWeight FROM goals WHERE username = ? AND status = "Active"',
      [userStr]
    );

    return res.json({
      success: true,
      message: 'Authentication successful.',
      user: {
        username: user.username,
        name: user.name,
        email: user.email,
        dob: user.dob,
        sex: user.sex,
        activeGoal: activeGoal || null
      }
    });

  } catch (error) {
    next(error);
  } finally {
    if (db) {
      await db.close();
    }
  }
});

export default router;
