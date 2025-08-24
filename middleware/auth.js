// Middleware to check if user is authenticated
const isAuthenticated = (req, res, next) => {
  if (req.isAuthenticated()) {
    return next();
  }
  req.flash('error', 'Please log in to access this page');
  res.redirect('/auth/login');
};

// Middleware to check if user is not authenticated (for login/register pages)
const isNotAuthenticated = (req, res, next) => {
  if (!req.isAuthenticated()) {
    return next();
  }
  res.redirect('/dashboard');
};

// Middleware to check if user has admin role
const isAdmin = (req, res, next) => {
  if (req.isAuthenticated() && req.user.role === 'admin') {
    return next();
  }
  req.flash('error', 'Access denied. Admin privileges required.');
  res.redirect('/dashboard');
};

// Middleware to check if user has user role or higher
const isUser = (req, res, next) => {
  if (req.isAuthenticated() && (req.user.role === 'user' || req.user.role === 'admin')) {
    return next();
  }
  req.flash('error', 'Access denied. User privileges required.');
  res.redirect('/auth/login');
};

module.exports = {
  isAuthenticated,
  isNotAuthenticated,
  isAdmin,
  isUser
};