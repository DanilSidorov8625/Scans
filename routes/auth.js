const express = require('express');
const bcrypt = require('bcryptjs');
const passport = require('../config/passport');
const { db } = require('../database/init');
const { isNotAuthenticated } = require('../middleware/auth');
const router = express.Router();

// GET login page
router.get('/login', isNotAuthenticated, (req, res) => {
  res.render('auth/login', {
    title: 'Login',
    messages: req.flash()
  });
});

// POST login
router.post('/login', isNotAuthenticated, (req, res, next) => {
  passport.authenticate('local', (err, user, info) => {
    if (err) {
      return next(err);
    }
    if (!user) {
      req.flash('error', info.message);
      return res.redirect('/auth/login');
    }
    req.logIn(user, (err) => {
      if (err) {
        return next(err);
      }
      req.flash('success', `Welcome back, ${user.username}!`);
      return res.redirect('/dashboard');
    });
  })(req, res, next);
});

// GET register page
router.get('/register', isNotAuthenticated, (req, res) => {
  res.render('auth/register', {
    title: 'Register',
    messages: req.flash()
  });
});

// POST register
router.post('/register', isNotAuthenticated, async (req, res) => {
  try {
    const { username, email, password, confirmPassword, accountName } = req.body;

    // Validation
    if (!username || !email || !password || !confirmPassword || !accountName) {
      req.flash('error', 'All fields are required');
      return res.redirect('/auth/register');
    }

    if (password !== confirmPassword) {
      req.flash('error', 'Passwords do not match');
      return res.redirect('/auth/register');
    }

    if (password.length < 6) {
      req.flash('error', 'Password must be at least 6 characters long');
      return res.redirect('/auth/register');
    }

    // Check if user already exists by email
    const checkUser = db.prepare('SELECT * FROM users WHERE email = ?');
    const existingUser = checkUser.get(email);

    if (existingUser) {
      req.flash('error', 'User with this email already exists');
      return res.redirect('/auth/register');
    }

    // Create account first
    const insertAccount = db.prepare(`
      INSERT INTO accounts (name, billing_email, token, tokens)
      VALUES (?, ?, ?, ?)
    `);

    const accountToken = 'acc-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    const accountResult = insertAccount.run(accountName, email, accountToken, 100);

    // Hash password and create user as admin of their account
    const hashedPassword = await bcrypt.hash(password, 12);
    const insertUser = db.prepare(`
      INSERT INTO users (account_id, username, email, password, role)
      VALUES (?, ?, ?, ?, ?)
    `);

    insertUser.run(accountResult.lastInsertRowid, username, email, hashedPassword, 'admin');

    req.flash('success', 'Registration successful! Please log in.');
    res.redirect('/auth/login');

  } catch (error) {
    console.error('Registration error:', error);
    req.flash('error', 'Registration failed. Please try again.');
    res.redirect('/auth/register');
  }
});

// POST logout
router.post('/logout', (req, res) => {
  req.logout((err) => {
    if (err) {
      return next(err);
    }
    req.flash('success', 'You have been logged out successfully');
    res.redirect('/');
  });
});

module.exports = router;