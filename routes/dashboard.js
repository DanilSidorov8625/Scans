const express = require('express');
const { db } = require('../database/init');
const { isAuthenticated, isAdmin } = require('../middleware/auth');
const router = express.Router();

// User dashboard
router.get('/', isAuthenticated, (req, res) => {
  res.render('dashboard/index', {
    title: 'Dashboard',
    user: req.user,
    messages: req.flash()
  });
});

// Admin panel - only accessible by admins
router.get('/admin', isAdmin, (req, res) => {
  try {
    // Get all users for admin panel
    // const account_id
    const stmt = db.prepare('SELECT id, username, email, role, created_at FROM users WHERE account_id = ? ORDER BY created_at DESC');
    const users = stmt.all(req.user.account_id);

    res.render('dashboard/admin', {
      title: 'Admin Panel',
      user: req.user,
      users: users,
      messages: req.flash()
    });
  } catch (error) {
    console.error('Admin panel error:', error);
    req.flash('error', 'Error loading admin panel');
    res.redirect('/dashboard');
  }
});

// Delete user (admin only)
router.post('/admin/delete-user/:id', isAdmin, (req, res) => {
  try {
    const userId = req.params.id;
    
    // Prevent admin from deleting themselves
    if (parseInt(userId) === req.user.id) {
      req.flash('error', 'You cannot delete your own account');
      return res.redirect('/dashboard/admin');
    }

    const stmt = db.prepare('DELETE FROM users WHERE id = ?');
    const result = stmt.run(userId);

    if (result.changes > 0) {
      req.flash('success', 'User deleted successfully');
    } else {
      req.flash('error', 'User not found');
    }
  } catch (error) {
    console.error('Delete user error:', error);
    req.flash('error', 'Error deleting user');
  }
  
  res.redirect('/dashboard/admin');
});

// Update user role (admin only)
router.post('/admin/update-role/:id', isAdmin, (req, res) => {
  try {
    const userId = req.params.id;
    const { role } = req.body;
    
    // Validate role
    if (!['user', 'admin'].includes(role)) {
      req.flash('error', 'Invalid role specified');
      return res.redirect('/dashboard/admin');
    }

    // Prevent admin from changing their own role
    if (parseInt(userId) === req.user.id) {
      req.flash('error', 'You cannot change your own role');
      return res.redirect('/dashboard/admin');
    }

    const stmt = db.prepare('UPDATE users SET role = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
    const result = stmt.run(role, userId);

    if (result.changes > 0) {
      req.flash('success', 'User role updated successfully');
    } else {
      req.flash('error', 'User not found');
    }
  } catch (error) {
    console.error('Update role error:', error);
    req.flash('error', 'Error updating user role');
  }
  
  res.redirect('/dashboard/admin');
});

module.exports = router;