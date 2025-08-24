const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  res.render('index', {
    title: 'Home',
    heading: 'Welcome to Express with EJS',
    message: 'This is a demonstration of Express.js with EJS templating and layouts.',
    features: [
      'Express.js server',
      'EJS templating engine',
      'Express EJS layouts',
      'Modular route structure',
      'Static file serving',
      'Error handling'
    ]
  });
});

module.exports = router;