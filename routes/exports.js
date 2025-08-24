const express = require('express');
const { db } = require('../database/init');
const { isAuthenticated } = require('../middleware/auth');
const { stringify } = require('csv-stringify');
const { Resend } = require('resend');
const router = express.Router();

// Initialize Resend (you'll need to set RESEND_API_KEY environment variable)
const resend = new Resend(process.env.RESEND_API_KEY || 'resend-api-key');

// GET exports list
router.get('/', isAuthenticated, (req, res) => {
  try {
    let whereClause = 'WHERE e.account_id = ? AND e.deleted_at IS NULL';
    let params = [req.user.account_id];

    // Filter by user if not admin
    if (req.user.role !== 'admin') {
      whereClause += ' AND e.created_by = ?';
      params.push(req.user.id);
    }

    const exportsQuery = db.prepare(`
      SELECT e.*, u.username as created_by_name
      FROM exports e
      LEFT JOIN users u ON e.created_by = u.id
      ${whereClause}
      ORDER BY e.created_at DESC
    `);

    const exports = exportsQuery.all(...params);

    res.render('exports/list', {
      title: 'Exports',
      exports: exports,
      user: req.user,
      messages: req.flash()
    });

  } catch (error) {
    console.error('Exports list error:', error);
    req.flash('error', 'Error loading exports');
    res.redirect('/dashboard');
  }
});

// GET specific export
router.get('/:id', isAuthenticated, (req, res) => {
  try {
    const { id } = req.params;

    let whereClause = 'WHERE e.id = ? AND e.account_id = ? AND e.deleted_at IS NULL';
    let params = [id, req.user.account_id];

    // Filter by user if not admin
    if (req.user.role !== 'admin') {
      whereClause += ' AND e.created_by = ?';
      params.push(req.user.id);
    }

    const exportQuery = db.prepare(`
      SELECT e.*, u.username as created_by_name
      FROM exports e
      LEFT JOIN users u ON e.created_by = u.id
      ${whereClause}
    `);

    const exportRecord = exportQuery.get(...params);

    if (!exportRecord) {
      req.flash('error', 'Export not found');
      return res.redirect('/exports');
    }

    res.render('exports/summary', {
      title: `Export #${exportRecord.id}`,
      exportRecord: exportRecord,
      user: req.user,
      messages: req.flash()
    });

  } catch (error) {
    console.error('Export summary error:', error);
    req.flash('error', 'Error loading export');
    res.redirect('/exports');
  }
});

// GET download CSV
router.get('/:id/download', isAuthenticated, async (req, res) => {
  try {
    const { id } = req.params;

    let whereClause = 'WHERE e.id = ? AND e.account_id = ? AND e.deleted_at IS NULL';
    let params = [id, req.user.account_id];

    if (req.user.role !== 'admin') {
      whereClause += ' AND e.created_by = ?';
      params.push(req.user.id);
    }

    const exportQuery = db.prepare(`
      SELECT e.* FROM exports e ${whereClause}
    `);

    const exportRecord = exportQuery.get(...params);

    if (!exportRecord) {
      req.flash('error', 'Export not found');
      return res.redirect('/exports');
    }

    // Get scans for this export
    const scansQuery = db.prepare(`
      SELECT s.*, u.username
      FROM scans s
      LEFT JOIN users u ON s.user_id = u.id
      JOIN export_scans es ON s.id = es.scan_id
      WHERE es.export_id = ?
      ORDER BY s.scanned_at DESC
    `);

    const scans = scansQuery.all(id);

    // Generate CSV
    const csvData = await generateCSV(scans);

    const filename = exportRecord.filename || `export_${id}_${Date.now()}.csv`;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csvData);

  } catch (error) {
    console.error('Export download error:', error);
    req.flash('error', 'Error downloading export');
    res.redirect('/exports');
  }
});

// POST send email
router.post('/:id/email', isAuthenticated, async (req, res) => {
  try {
    const { id } = req.params;
    const { email } = req.body;

    if (!email) {
      req.flash('error', 'Email address is required');
      return res.redirect(`/exports/${id}`);
    }

    // Check account tokens
    const accountQuery = db.prepare('SELECT tokens FROM accounts WHERE id = ?');
    const account = accountQuery.get(req.user.account_id);

    if (account.tokens < 1) {
      req.flash('error', 'Insufficient tokens. Please add more tokens to send emails.');
      return res.redirect(`/exports/${id}`);
    }

    let whereClause = 'WHERE e.id = ? AND e.account_id = ? AND e.deleted_at IS NULL';
    let params = [id, req.user.account_id];

    if (req.user.role !== 'admin') {
      whereClause += ' AND e.created_by = ?';
      params.push(req.user.id);
    }

    const exportQuery = db.prepare(`
      SELECT e.* FROM exports e ${whereClause}
    `);

    const exportRecord = exportQuery.get(...params);

    if (!exportRecord) {
      req.flash('error', 'Export not found');
      return res.redirect('/exports');
    }

    // Get scans for this export
    const scansQuery = db.prepare(`
      SELECT s.*, u.username
      FROM scans s
      LEFT JOIN users u ON s.user_id = u.id
      JOIN export_scans es ON s.id = es.scan_id
      WHERE es.export_id = ?
      ORDER BY s.scanned_at DESC
    `);

    const scans = scansQuery.all(id);

    // Generate CSV
    const csvData = await generateCSV(scans);
    const filename = exportRecord.filename || `export_${id}_${Date.now()}.csv`;

    // Send email with Resend
    try {
      const emailResult = await resend.emails.send({
        from: 'Scans <noreply@scans.omnaris.xyz>', // Replace with your verified domain
        to: email,
        subject: `Scan Export #${id}`,
        html: `
          <h2>Your scan export is ready</h2>
          <p>Please find your CSV export attached.</p>
          <p><strong>Export Details:</strong></p>
          <ul>
            <li>Export ID: ${id}</li>
            <li>Scan Count: ${exportRecord.scan_count}</li>
            <li>Created: ${new Date(exportRecord.created_at).toLocaleString()}</li>
          </ul>
        `,
        attachments: [
          {
            filename: filename,
            content: Buffer.from(csvData).toString('base64'),
            type: 'text/csv',
            disposition: 'attachment'
          }
        ]
      });

      // Update scans table with email tracking info
      const updateScansEmail = db.prepare(`
        UPDATE scans 
        SET last_sent_to_email = ?, 
            last_email_status = 'sent', 
            last_email_sent_at = CURRENT_TIMESTAMP
        WHERE id IN (
          SELECT scan_id FROM export_scans WHERE export_id = ?
        )
      `);
      updateScansEmail.run(email, id);

      // Record email event
      const insertEmailEvent = db.prepare(`
        INSERT INTO email_events (account_id, to_email, status, provider, message_id)
        VALUES (?, ?, ?, ?, ?)
      `);

      insertEmailEvent.run(
        req.user.account_id,
        email,
        'sent',
        'resend',
        emailResult.id
      );

      // Deduct token
      const updateTokens = db.prepare('UPDATE accounts SET tokens = tokens - 1 WHERE id = ?');
      updateTokens.run(req.user.account_id);

      req.flash('success', 'Email sent successfully!');

    } catch (emailError) {
      console.error('Email sending error:', emailError);

      // Update scans table with failed email status
      const updateScansEmailFailed = db.prepare(`
        UPDATE scans 
        SET last_sent_to_email = ?, 
            last_email_status = 'failed', 
            last_email_sent_at = CURRENT_TIMESTAMP
        WHERE id IN (
          SELECT scan_id FROM export_scans WHERE export_id = ?
        )
      `);
      updateScansEmailFailed.run(email, id);

      // Record failed email event
      const insertEmailEvent = db.prepare(`
        INSERT INTO email_events (account_id, to_email, status, provider, error)
        VALUES (?, ?, ?, ?, ?)
      `);

      insertEmailEvent.run(
        req.user.account_id,
        email,
        'failed',
        'resend',
        emailError.message
      );

      req.flash('error', 'Failed to send email. Please try again.');
    }

    res.redirect(`/exports/${id}`);

  } catch (error) {
    console.error('Email export error:', error);
    req.flash('error', 'Error sending email');
    res.redirect(`/exports/${id}`);
  }
});

// Helper function to generate CSV
async function generateCSV(scans) {
  return new Promise((resolve, reject) => {
    const records = [];

    // Add header
    records.push(['ID', 'Date', 'Form', 'User', 'Data']);

    // Add scan data
    scans.forEach(scan => {
      const parsedData = JSON.parse(scan.data);
      const dataString = Object.entries(parsedData)
        .map(([key, value]) => `${key}: ${value}`)
        .join('; ');

      records.push([
        scan.id,
        new Date(scan.scanned_at).toISOString(),
        scan.form_key,
        scan.username || 'Unknown',
        dataString
      ]);
    });

    stringify(records, (err, output) => {
      if (err) {
        reject(err);
      } else {
        resolve(output);
      }
    });
  });
}

module.exports = router;