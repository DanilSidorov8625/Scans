const express = require('express');
const { Resend } = require('resend');
const router = express.Router();

// Initialize Resend
const resend = new Resend(process.env.RESEND_API_KEY || 'your-resend-api-key');

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
      from: 'noreply@yourdomain.com', // Replace with your verified domain
      to: 'admin@yourdomain.com', // Replace with your admin email
      subject: `Contact Form: ${name}`,
      html: `
        <h2>New Contact Form Submission</h2>
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Message:</strong></p>
        <p>${message.replace(/\n/g, '<br>')}</p>
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