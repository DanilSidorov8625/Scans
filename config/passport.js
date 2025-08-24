const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const bcrypt = require('bcryptjs');
const { db } = require('../database/init');

// Configure local strategy
passport.use(new LocalStrategy({
  usernameField: 'email',
  passwordField: 'password'
}, async (email, password, done) => {
  try {
    const stmt = db.prepare('SELECT * FROM users WHERE email = ?');
    const user = stmt.get(email);

    if (!user) {
      return done(null, false, { message: 'Invalid email or password' });
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return done(null, false, { message: 'Invalid email or password' });
    }

    return done(null, user);
  } catch (error) {
    return done(error);
  }
}));

// Serialize user for session
passport.serializeUser((user, done) => {
  done(null, user.id);
});

// Deserialize user from session
passport.deserializeUser((id, done) => {
  try {
    const stmt = db.prepare(`
      SELECT u.id, u.account_id, u.username, u.email, u.role, u.scanner_mode, u.created_at,
             a.name as account_name, a.billing_email, a.tokens
      FROM users u 
      JOIN accounts a ON u.account_id = a.id 
      WHERE u.id = ? AND u.is_active = 1 AND a.is_active = 1
    `);
    const user = stmt.get(id);
    done(null, user);
  } catch (error) {
    done(error);
  }
});

module.exports = passport;