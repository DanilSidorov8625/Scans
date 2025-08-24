const express = require('express');
const { db } = require('../database/init');
const { isAuthenticated } = require('../middleware/auth');
const router = express.Router();

// Form definitions
const FORMS = {
  'barcode_only': {
    name: 'Barcode Only',
    description: 'Scan a single barcode',
    fields: ['barcode']
  },
  'barcode_location': {
    name: 'Barcode + Location',
    description: 'Scan barcode and location',
    fields: ['barcode', 'location']
  }
};

// GET forms list
router.get('/', isAuthenticated, (req, res) => {
  try {
    res.render('forms/list', {
      title: 'Forms',
      forms: FORMS,
      user: req.user,
      messages: req.flash()
    });
  } catch (error) {
    console.error('Forms list error:', error);
    req.flash('error', 'Error loading forms');
    res.redirect('/dashboard');
  }
});

// GET specific form
router.get('/:formKey', isAuthenticated, (req, res) => {
  try {
    const { formKey } = req.params;
    
    if (!FORMS[formKey]) {
      req.flash('error', 'Form not found');
      return res.redirect('/forms');
    }

    const form = FORMS[formKey];
    
    res.render(`forms/${formKey}`, {
      title: form.name,
      form: form,
      formKey: formKey,
      user: req.user,
      messages: req.flash()
    });
  } catch (error) {
    console.error('Form render error:', error);
    req.flash('error', 'Error loading form');
    res.redirect('/forms');
  }
});

// POST form submission
router.post('/:formKey', isAuthenticated, (req, res) => {
  try {
    const { formKey } = req.params;
    
    if (!FORMS[formKey]) {
      req.flash('error', 'Form not found');
      return res.redirect('/forms');
    }

    const form = FORMS[formKey];
    const formData = {};
    
    // Validate and collect form data
    for (const field of form.fields) {
      const value = req.body[field];
      if (!value || value.trim() === '') {
        req.flash('error', `${field} is required`);
        return res.redirect(`/forms/${formKey}`);
      }
      formData[field] = value.trim();
    }

    // Save scan to database
    const insertScan = db.prepare(`
      INSERT INTO scans (account_id, user_id, form_key, data)
      VALUES (?, ?, ?, ?)
    `);

    insertScan.run(
      req.user.account_id,
      req.user.id,
      formKey,
      JSON.stringify(formData)
    );

    req.flash('success', 'Scan saved successfully!');
    res.redirect(`/forms/${formKey}`);

  } catch (error) {
    console.error('Form submission error:', error);
    req.flash('error', 'Error saving scan');
    res.redirect(`/forms/${req.params.formKey}`);
  }
});

module.exports = router;