import { getDbConnection } from './data/db.js';

async function queryDatabase() {
  let db;
  try {
    db = await getDbConnection();
    
    console.log('=== USERS TABLE ===');
    const users = await db.all('SELECT * FROM users');
    if (users.length === 0) {
      console.log('No users registered yet.');
    } else {
      console.table(users);
    }
    console.log('\n');

    console.log('=== GOALS TABLE ===');
    const goals = await db.all('SELECT * FROM goals');
    if (goals.length === 0) {
      console.log('No goals configured yet.');
    } else {
      console.table(goals);
    }
    console.log('\n');

  } catch (error) {
    console.error('Error querying database:', error.message);
  } finally {
    if (db) {
      await db.close();
    }
  }
}

queryDatabase();
