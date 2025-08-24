const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  res.render('contact', {
    title: 'Contact Us',
    heading: 'Get In Touch',
    message: null
  });
});

router.post('/', (req, res) => {
  const { name, email, message } = req.body;
  
  // Here you would typically save to database or send email
  console.log('Contact form submission:', { name, email, message });
  
  res.render('contact', {
    title: 'Contact Us',
    heading: 'Get In Touch',
    message: 'Thank you for your message! We will get back to you soon.'
  });
});

module.exports = router;