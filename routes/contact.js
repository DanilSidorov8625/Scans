const express = require('express');
const { Resend } = require('resend');
const router = express.Router();

// Initialize Resend
const resend = new Resend(process.env.RESEND_API_KEY);

router.get('/', (req, res) => {
  res.render('contact', {
    title: 'Contact Us',
    messages: req.flash()
  });
});

router.post('/', async (req, res) => {
  const { name, email, message } = req.body;
  
  // Validation
  if (!name || !email || !message) {
    req.flash('error', 'All fields are required');
    return res.redirect('/contact');
  }

  if (!email.includes('@')) {
    req.flash('error', 'Please enter a valid email address');
    return res.redirect('/contact');
  }

  try {
    // Send email using Resend
    await resend.emails.send({
      from: `${process.env.APP_NAME || 'Scans'} Contact <${process.env.FROM_EMAIL}>`,
      to: process.env.ADMIN_EMAIL,
      subject: `Contact Form: ${name}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>New Contact Form Submission</title>
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
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
              width: 60px;
              height: 60px;
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
              margin: 0 auto 16px;
              font-size: 24px;
              font-weight: bold;
            }
            h1 {
              color: #1e293b;
              margin: 0;
              font-size: 24px;
            }
            .field {
              margin-bottom: 24px;
              padding: 20px;
              background: #f8fafc;
              border-radius: 8px;
              border-left: 4px solid #667eea;
            }
            .field-label {
              font-weight: 600;
              color: #475569;
              margin-bottom: 8px;
              text-transform: uppercase;
              font-size: 12px;
              letter-spacing: 0.5px;
            }
            .field-value {
              color: #1e293b;
              font-size: 16px;
              word-wrap: break-word;
            }
            .message-content {
              white-space: pre-wrap;
              background: white;
              padding: 16px;
              border-radius: 6px;
              border: 1px solid #e2e8f0;
            }
            .footer {
              text-align: center;
              margin-top: 32px;
              padding-top: 24px;
              border-top: 1px solid #e2e8f0;
              color: #64748b;
              font-size: 14px;
            }
            .reply-button {
              display: inline-block;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
              padding: 12px 24px;
              text-decoration: none;
              border-radius: 8px;
              font-weight: 600;
              margin-top: 16px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="logo">S</div>
              <h1>New Contact Form Submission</h1>
            </div>
            
            <div class="field">
              <div class="field-label">Name</div>
              <div class="field-value">${name}</div>
            </div>
            
            <div class="field">
              <div class="field-label">Email Address</div>
              <div class="field-value">${email}</div>
            </div>
            
            <div class="field">
              <div class="field-label">Message</div>
              <div class="field-value">
                <div class="message-content">${message}</div>
              </div>
            </div>
            
            <div class="footer">
              <a href="mailto:${email}" class="reply-button">Reply to ${name}</a>
              <p>This message was sent from the ${process.env.APP_NAME || 'Scans'} contact form.</p>
            </div>
          </div>
        </body>
        </html>
      `,
      replyTo: email
    });

    req.flash('success', 'Thank you for your message! We will get back to you soon.');
    console.log('Contact form submission sent via email:', { name, email });
    
  } catch (error) {
    console.error('Contact form email error:', error);
    req.flash('error', 'Sorry, there was an error sending your message. Please try again.');
  }
  
  res.redirect('/contact');
});

module.exports = router;