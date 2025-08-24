const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  res.render('about', {
    title: 'About Us',
    heading: 'About Our Application',
    description: 'This Express application demonstrates the power of EJS templating with layouts.',
    team: [
      { name: 'John Doe', role: 'Full Stack Developer' },
      { name: 'Jane Smith', role: 'Frontend Developer' },
      { name: 'Mike Johnson', role: 'Backend Developer' }
    ]
  });
});

module.exports = router;