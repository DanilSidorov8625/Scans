const express = require('express');
const bcrypt = require('bcryptjs');
const { db } = require('../database/init');
const { isAuthenticated } = require('../middleware/auth');
const router = express.Router();

// Middleware to check admin role
const isAdmin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    return next();
  }
  req.flash('error', 'Access denied. Admin privileges required.');
  res.redirect('/dashboard');
};

// GET admin overview
router.get('/', isAuthenticated, isAdmin, (req, res) => {
  try {
    // Get account statistics
    const statsQuery = db.prepare(`
      SELECT 
        (SELECT COUNT(*) FROM users WHERE account_id = ? AND deleted_at IS NULL) as total_users,
        (SELECT COUNT(*) FROM scans WHERE account_id = ? AND deleted_at IS NULL) as total_scans,
        (SELECT COUNT(*) FROM scans WHERE account_id = ? AND deleted_at IS NULL AND DATE(scanned_at) = DATE('now')) as today_scans,
        (SELECT COUNT(*) FROM exports WHERE account_id = ? AND deleted_at IS NULL) as total_exports
    `);

    const stats = statsQuery.get(
      req.user.account_id,
      req.user.account_id,
      req.user.account_id,
      req.user.account_id
    );

    // Get recent scans
    const recentScansQuery = db.prepare(`
      SELECT s.*, u.username
      FROM scans s
      LEFT JOIN users u ON s.user_id = u.id
      WHERE s.account_id = ? AND s.deleted_at IS NULL
      ORDER BY s.scanned_at DESC
      LIMIT 10
    `);

    const recentScans = recentScansQuery.all(req.user.account_id);

    // Get scans per user
    const userStatsQuery = db.prepare(`
      SELECT u.username, COUNT(s.id) as scan_count
      FROM users u
      LEFT JOIN scans s ON u.id = s.user_id AND s.deleted_at IS NULL
      WHERE u.account_id = ? AND u.deleted_at IS NULL
      GROUP BY u.id, u.username
      ORDER BY scan_count DESC
    `);

    const userStats = userStatsQuery.all(req.user.account_id);

    // Get scans per form
    const formStatsQuery = db.prepare(`
      SELECT form_key, COUNT(*) as scan_count
      FROM scans
      WHERE account_id = ? AND deleted_at IS NULL
      GROUP BY form_key
      ORDER BY scan_count DESC
    `);

    const formStats = formStatsQuery.all(req.user.account_id);

    res.render('admin/overview', {
      title: 'Admin Overview',
      stats: stats,
      recentScans: recentScans.map(scan => ({
        ...scan,
        parsedData: JSON.parse(scan.data)
      })),
      userStats: userStats,
      formStats: formStats,
      user: req.user,
      messages: req.flash()
    });

  } catch (error) {
    console.error('Admin overview error:', error);
    req.flash('error', 'Error loading admin overview');
    res.redirect('/dashboard');
  }
});

// GET user management
router.get('/users', isAuthenticated, isAdmin, (req, res) => {
  try {
    const usersQuery = db.prepare(`
      SELECT id, username, email, role, is_active, created_at
      FROM users
      WHERE account_id = ? AND deleted_at IS NULL
      ORDER BY created_at DESC
    `);

    const users = usersQuery.all(req.user.account_id);

    res.render('admin/users', {
      title: 'User Management',
      users: users,
      user: req.user,
      messages: req.flash()
    });

  } catch (error) {
    console.error('User management error:', error);
    req.flash('error', 'Error loading users');
    res.redirect('/admin');
  }
});

// POST add user
router.post('/users', isAuthenticated, isAdmin, async (req, res) => {
  try {
    const { username, email, password, role } = req.body;

    // Validation
    if (!username || !email || !password || !role) {
      req.flash('error', 'All fields are required');
      return res.redirect('/admin/users');
    }

    if (!['admin', 'worker'].includes(role)) {
      req.flash('error', 'Invalid role specified');
      return res.redirect('/admin/users');
    }

    if (password.length < 6) {
      req.flash('error', 'Password must be at least 6 characters long');
      return res.redirect('/admin/users');
    }

    // Check if user already exists
    const checkUser = db.prepare('SELECT * FROM users WHERE (email = ? OR username = ?) AND account_id = ?');
    const existingUser = checkUser.get(email, username, req.user.account_id);

    if (existingUser) {
      req.flash('error', 'User with this email or username already exists');
      return res.redirect('/admin/users');
    }

    // Create user
    const hashedPassword = await bcrypt.hash(password, 12);
    const insertUser = db.prepare(`
      INSERT INTO users (account_id, username, email, password, role)
      VALUES (?, ?, ?, ?, ?)
    `);

    insertUser.run(req.user.account_id, username, email, hashedPassword, role);

    req.flash('success', 'User created successfully');
    res.redirect('/admin/users');

  } catch (error) {
    console.error('Add user error:', error);
    req.flash('error', 'Error creating user');
    res.redirect('/admin/users');
  }
});

// POST update user role
router.post('/users/:id/role', isAuthenticated, isAdmin, (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    if (!['admin', 'worker'].includes(role)) {
      req.flash('error', 'Invalid role specified');
      return res.redirect('/admin/users');
    }

    // Prevent admin from changing their own role
    if (parseInt(id) === req.user.id) {
      req.flash('error', 'You cannot change your own role');
      return res.redirect('/admin/users');
    }

    const updateUser = db.prepare(`
      UPDATE users 
      SET role = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ? AND account_id = ?
    `);

    const result = updateUser.run(role, id, req.user.account_id);

    if (result.changes > 0) {
      req.flash('success', 'User role updated successfully');
    } else {
      req.flash('error', 'User not found');
    }

    res.redirect('/admin/users');

  } catch (error) {
    console.error('Update user role error:', error);
    req.flash('error', 'Error updating user role');
    res.redirect('/admin/users');
  }
});

// POST toggle user active status
router.post('/users/:id/toggle', isAuthenticated, isAdmin, (req, res) => {
  try {
    const { id } = req.params;

    // Prevent admin from deactivating themselves
    if (parseInt(id) === req.user.id) {
      req.flash('error', 'You cannot deactivate your own account');
      return res.redirect('/admin/users');
    }

    const toggleUser = db.prepare(`
      UPDATE users 
      SET is_active = CASE WHEN is_active = 1 THEN 0 ELSE 1 END,
          updated_at = CURRENT_TIMESTAMP 
      WHERE id = ? AND account_id = ?
    `);

    const result = toggleUser.run(id, req.user.account_id);

    if (result.changes > 0) {
      req.flash('success', 'User status updated successfully');
    } else {
      req.flash('error', 'User not found');
    }

    res.redirect('/admin/users');

  } catch (error) {
    console.error('Toggle user error:', error);
    req.flash('error', 'Error updating user status');
    res.redirect('/admin/users');
  }
});

// POST delete user
router.post('/users/:id/delete', isAuthenticated, isAdmin, (req, res) => {
  try {
    const { id } = req.params;

    // Prevent admin from deleting themselves
    if (parseInt(id) === req.user.id) {
      req.flash('error', 'You cannot delete your own account');
      return res.redirect('/admin/users');
    }

    const deleteUser = db.prepare(`
      UPDATE users 
      SET deleted_at = CURRENT_TIMESTAMP 
      WHERE id = ? AND account_id = ?
    `);

    const result = deleteUser.run(id, req.user.account_id);

    if (result.changes > 0) {
      req.flash('success', 'User deleted successfully');
    } else {
      req.flash('error', 'User not found');
    }

    res.redirect('/admin/users');

  } catch (error) {
    console.error('Delete user error:', error);
    req.flash('error', 'Error deleting user');
    res.redirect('/admin/users');
  }
});

module.exports = router;