const express = require('express');
const { db } = require('../database/init');
const { isAuthenticated } = require('../middleware/auth');
const router = express.Router();

// GET settings page
router.get('/', isAuthenticated, (req, res) => {
  try {
    res.render('settings/index', {
      title: 'Settings',
      user: req.user,
      messages: req.flash()
    });
  } catch (error) {
    console.error('Settings page error:', error);
    req.flash('error', 'Error loading settings');
    res.redirect('/dashboard');
  }
});

// POST update scanner mode
router.post('/scanner-mode', isAuthenticated, (req, res) => {
  try {
    const { scanner_mode } = req.body;

    if (!['keyboard', 'physical'].includes(scanner_mode)) {
      req.flash('error', 'Invalid scanner mode');
      return res.redirect('/settings');
    }

    const updateUser = db.prepare(`
      UPDATE users 
      SET scanner_mode = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `);

    updateUser.run(scanner_mode, req.user.id);

    req.flash('success', 'Scanner mode updated successfully');
    res.redirect('/settings');

  } catch (error) {
    console.error('Scanner mode update error:', error);
    req.flash('error', 'Error updating scanner mode');
    res.redirect('/settings');
  }
});

// POST update account email
router.post('/account-email', isAuthenticated, (req, res) => {
  try {
    const { billing_email } = req.body;

    if (!billing_email || !billing_email.includes('@')) {
      req.flash('error', 'Valid email address is required');
      return res.redirect('/settings');
    }

    // Only admin can update account email
    if (req.user.role !== 'admin') {
      req.flash('error', 'Only account administrators can update the billing email');
      return res.redirect('/settings');
    }

    const updateAccount = db.prepare(`
      UPDATE accounts 
      SET billing_email = ? 
      WHERE id = ? AND id = ?
    `);

    updateAccount.run(billing_email, req.user.account_id, req.user.account_id);

    req.flash('success', 'Account email updated successfully');
    res.redirect('/settings');

  } catch (error) {
    console.error('Account email update error:', error);
    req.flash('error', 'Error updating account email');
    res.redirect('/settings');
  }
});

module.exports = router;