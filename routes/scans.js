const express = require('express');
const { db } = require('../database/init');
const { isAuthenticated } = require('../middleware/auth');
const router = express.Router();

// GET scans list
router.get('/', isAuthenticated, (req, res) => {
  try {
    const { form_key, page = 1 } = req.query;
    const limit = 20;
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE s.account_id = ? AND s.deleted_at IS NULL AND export_id IS NULL';
    let params = [req.user.account_id];

    // Filter by form key if provided
    if (form_key) {
      whereClause += ' AND s.form_key = ?';
      params.push(form_key);
    }

    // Filter by user if not admin
    if (req.user.role !== 'admin') {
      whereClause += ' AND s.user_id = ?';
      params.push(req.user.id);
    }

    // Get scans with pagination
    const scansQuery = db.prepare(`
      SELECT s.*, u.username, u.email as user_email
      FROM scans s
      LEFT JOIN users u ON s.user_id = u.id
      ${whereClause}
      ORDER BY s.scanned_at DESC
      LIMIT ? OFFSET ?
    `);

    const scans = scansQuery.all(...params, limit, offset);

    // Get total count for pagination
    const countQuery = db.prepare(`
      SELECT COUNT(*) as total
      FROM scans s
      ${whereClause}
    `);

    const { total } = countQuery.get(...params);

    // Get unique form keys for filter
    const formKeysQuery = db.prepare(`
      SELECT DISTINCT form_key
      FROM scans
      WHERE account_id = ? AND deleted_at IS NULL
      ORDER BY form_key
    `);

    const formKeys = formKeysQuery.all(req.user.account_id);

    // Parse JSON data for display
    const parsedScans = scans.map(scan => ({
      ...scan,
      parsedData: JSON.parse(scan.data)
    }));

    res.render('scans/list', {
      title: 'Scans',
      scans: parsedScans,
      formKeys: formKeys,
      currentFormKey: form_key || '',
      pagination: {
        current: parseInt(page),
        total: Math.ceil(total / limit),
        hasNext: offset + limit < total,
        hasPrev: page > 1
      },
      user: req.user,
      messages: req.flash()
    });

  } catch (error) {
    console.error('Scans list error:', error);
    req.flash('error', 'Error loading scans');
    res.redirect('/dashboard');
  }
});

// POST create export
router.post('/export', isAuthenticated, (req, res) => {
  try {
    const { form_key, from_date, to_date } = req.body;

    let whereClause = 'WHERE account_id = ? AND deleted_at IS NULL AND export_id IS NULL';
    let params = [req.user.account_id];

    if (form_key) {
      whereClause += ' AND form_key = ?';
      params.push(form_key);
    }

    if (req.user.role !== 'admin') {
      whereClause += ' AND user_id = ?';
      params.push(req.user.id);
    }

    if (from_date) {
      whereClause += ' AND scanned_at >= ?';
      params.push(from_date + ' 00:00:00');
    }

    if (to_date) {
      whereClause += ' AND scanned_at <= ?';
      params.push(to_date + ' 23:59:59');
    }

    // Get scans to export
    const scansQuery = db.prepare(`
      SELECT id FROM scans ${whereClause} ORDER BY scanned_at DESC
    `);

    const scanIds = scansQuery.all(...params).map(s => s.id);

    if (scanIds.length === 0) {
      req.flash('error', 'No scans found for export');
      return res.redirect('/scans');
    }

    // Create export record
    const insertExport = db.prepare(`
      INSERT INTO exports (account_id, created_by, params_json, from_ts, to_ts, scan_count, status)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const exportParams = {
      form_key: form_key || null,
      from_date: from_date || null,
      to_date: to_date || null
    };

    const exportResult = insertExport.run(
      req.user.account_id,
      req.user.id,
      JSON.stringify(exportParams),
      from_date ? from_date + ' 00:00:00' : null,
      to_date ? to_date + ' 23:59:59' : null,
      scanIds.length,
      'ready'
    );

    // Link scans to export
    const insertExportScan = db.prepare(`
      INSERT INTO export_scans (export_id, scan_id) VALUES (?, ?)
    `);

    scanIds.forEach(scanId => {
      insertExportScan.run(exportResult.lastInsertRowid, scanId);
    });

    // Update scans to mark them as exported
    const updateScansExportId = db.prepare(`
      UPDATE scans 
      SET export_id = ? 
      WHERE id IN (${scanIds.map(() => '?').join(',')})
    `);

    updateScansExportId.run(exportResult.lastInsertRowid, ...scanIds);

    req.flash('success', 'Export created successfully!');
    res.redirect(`/exports/${exportResult.lastInsertRowid}`);

  } catch (error) {
    console.error('Export creation error:', error);
    req.flash('error', 'Error creating export');
    res.redirect('/scans');
  }
});

module.exports = router;