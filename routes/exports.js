const express = require('express');
const { db } = require('../database/init');
const { isAuthenticated } = require('../middleware/auth');
const { stringify } = require('csv-stringify');
const { Resend } = require('resend');
const router = express.Router();

// Initialize Resend (you'll need to set RESEND_API_KEY environment variable)
const resend = new Resend(process.env.RESEND_API_KEY);

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
      WHERE es.export_id = ? AND s.account_id = ?
      ORDER BY s.scanned_at DESC
    `);

    const scans = scansQuery.all(id, req.user.account_id);

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
      WHERE es.export_id = ? AND s.account_id = ?
      ORDER BY s.scanned_at DESC
    `);

    const scans = scansQuery.all(id, req.user.account_id);

    // Generate CSV
    const csvData = await generateCSV(scans);
    const filename = exportRecord.filename || `export_${id}_${Date.now()}.csv`;

    // Send email with Resend
    try {
      const emailResult = await resend.emails.send({
        from: `${process.env.APP_NAME || 'Scans'} <${process.env.FROM_EMAIL}>`,
        to: email,
        subject: `Scan Export #${id}`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Your Scan Export is Ready</title>
            <style>
              body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
                line-height: 1.6;
                color: #333;
                max-width: 600px;
                margin: 0 auto;
                padding: 20px;
                background-color: #f8fafc;
              }
              .container {
                background: white;
                border-radius: 12px;
                padding: 32px;
                box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
              }
              .header {
                text-align: center;
                margin-bottom: 32px;
                padding-bottom: 24px;
                border-bottom: 2px solid #e2e8f0;
              }
              .logo {
                background: linear-gradient(135deg, #10b981 0%, #059669 100%);
                color: white;
                width: 80px;
                height: 80px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                margin: 0 auto 16px;
                font-size: 32px;
              }
              h1 {
                color: #1e293b;
                margin: 0;
                font-size: 28px;
                font-weight: 700;
              }
              .subtitle {
                color: #64748b;
                margin: 8px 0 0;
                font-size: 16px;
              }
              .export-card {
                background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
                border: 1px solid #0ea5e9;
                border-radius: 12px;
                padding: 24px;
                margin: 24px 0;
              }
              .export-id {
                font-size: 24px;
                font-weight: 700;
                color: #0369a1;
                margin-bottom: 16px;
              }
              .details-grid {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 16px;
                margin-bottom: 20px;
              }
              .detail-item {
                text-align: center;
                padding: 16px;
                background: white;
                border-radius: 8px;
                border: 1px solid #e2e8f0;
              }
              .detail-label {
                font-size: 12px;
                text-transform: uppercase;
                letter-spacing: 0.5px;
                color: #64748b;
                margin-bottom: 4px;
              }
              .detail-value {
                font-size: 18px;
                font-weight: 600;
                color: #1e293b;
              }
              .attachment-notice {
                background: #fef3c7;
                border: 1px solid #f59e0b;
                border-radius: 8px;
                padding: 16px;
                margin: 24px 0;
                display: flex;
                align-items: center;
                gap: 12px;
              }
              .attachment-icon {
                background: #f59e0b;
                color: white;
                width: 40px;
                height: 40px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 18px;
              }
              .footer {
                text-align: center;
                margin-top: 32px;
                padding-top: 24px;
                border-top: 1px solid #e2e8f0;
                color: #64748b;
                font-size: 14px;
              }
              .login-button {
                display: inline-block;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                padding: 12px 24px;
                text-decoration: none;
                border-radius: 8px;
                font-weight: 600;
                margin-top: 16px;
              }
              @media (max-width: 480px) {
                .details-grid {
                  grid-template-columns: 1fr;
                }
                .container {
                  padding: 20px;
                }
              }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <div class="logo">📊</div>
                <h1>Export Complete!</h1>
                <p class="subtitle">Your scan data export is ready for download</p>
              </div>
              
              <div class="export-card">
                <div class="export-id">Export #${id}</div>
                <div class="details-grid">
                  <div class="detail-item">
                    <div class="detail-label">Scan Count</div>
                    <div class="detail-value">${exportRecord.scan_count}</div>
                  </div>
                  <div class="detail-item">
                    <div class="detail-label">Created</div>
                    <div class="detail-value">${new Date(exportRecord.created_at).toLocaleDateString()}</div>
                  </div>
                </div>
              </div>
              
              <div class="attachment-notice">
                <div class="attachment-icon">📎</div>
                <div>
                  <strong>CSV File Attached</strong><br>
                  Your scan data has been exported to a CSV file and attached to this email.
                </div>
              </div>
              
              <div class="footer">
                <a href="${process.env.APP_URL || 'http://localhost:3000'}/exports/${id}" class="login-button">View Export Details</a>
                <p>This export was generated from ${process.env.APP_NAME || 'Scans'} on ${new Date().toLocaleDateString()}.</p>
                <p>Need help? Contact our support team.</p>
              </div>
            </div>
          </body>
          </html>
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

      console.log('✅ Resend email result:', emailResult);

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