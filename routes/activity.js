const express = require('express');
const { db } = require('../database/init');
const { isAuthenticated } = require('../middleware/auth');
const router = express.Router();

// GET activity page
router.get('/', isAuthenticated, (req, res) => {
  try {
    const isWorker = req.user.role === 'worker';
    
    // Base conditions for queries
    let baseConditions = 'WHERE s.account_id = ? AND s.deleted_at IS NULL';
    let baseParams = [req.user.account_id];
    
    // If worker, only show their data
    if (isWorker) {
      baseConditions += ' AND s.user_id = ?';
      baseParams.push(req.user.id);
    }

    // Get scans per form
    const scansPerFormQuery = db.prepare(`
      SELECT 
        s.form_key,
        COUNT(*) as scan_count
      FROM scans s
      ${baseConditions}
      GROUP BY s.form_key
      ORDER BY scan_count DESC
    `);
    const scansPerForm = scansPerFormQuery.all(...baseParams);

    // Get scans per user (only if admin)
    let scansPerUser = [];
    if (!isWorker) {
      const scansPerUserQuery = db.prepare(`
        SELECT 
          u.username,
          COUNT(s.id) as scan_count
        FROM users u
        LEFT JOIN scans s ON u.id = s.user_id AND s.deleted_at IS NULL
        WHERE u.account_id = ? AND u.deleted_at IS NULL
        GROUP BY u.id, u.username
        ORDER BY scan_count DESC
      `);
      scansPerUser = scansPerUserQuery.all(req.user.account_id);
    }

    // Get scans day over day (last 30 days)
    const scansPerDayQuery = db.prepare(`
      SELECT 
        DATE(s.scanned_at) as scan_date,
        COUNT(*) as scan_count
      FROM scans s
      ${baseConditions}
      AND s.scanned_at >= DATE('now', '-30 days')
      GROUP BY DATE(s.scanned_at)
      ORDER BY scan_date ASC
    `);
    const scansPerDay = scansPerDayQuery.all(...baseParams);

    // Get summary statistics
    const statsQuery = db.prepare(`
      SELECT 
        COUNT(*) as total_scans,
        COUNT(CASE WHEN DATE(s.scanned_at) = DATE('now') THEN 1 END) as today_scans,
        COUNT(CASE WHEN DATE(s.scanned_at) >= DATE('now', '-7 days') THEN 1 END) as week_scans,
        COUNT(CASE WHEN s.export_id IS NOT NULL THEN 1 END) as exported_scans
      FROM scans s
      ${baseConditions}
    `);
    const stats = statsQuery.get(...baseParams);

    // Get recent activity
    const recentActivityQuery = db.prepare(`
      SELECT 
        s.id,
        s.form_key,
        s.data,
        s.scanned_at,
        u.username
      FROM scans s
      LEFT JOIN users u ON s.user_id = u.id
      ${baseConditions}
      ORDER BY s.scanned_at DESC
      LIMIT 10
    `);
    const recentActivity = recentActivityQuery.all(...baseParams);

    res.render('activity/index', {
      title: 'Activity Dashboard',
      user: req.user,
      isWorker: isWorker,
      scansPerForm: scansPerForm,
      scansPerUser: scansPerUser,
      scansPerDay: scansPerDay,
      stats: stats,
      recentActivity: recentActivity.map(scan => ({
        ...scan,
        parsedData: JSON.parse(scan.data)
      })),
      messages: req.flash()
    });

  } catch (error) {
    console.error('Activity page error:', error);
    req.flash('error', 'Error loading activity dashboard');
    res.redirect('/dashboard');
  }
});

module.exports = router;