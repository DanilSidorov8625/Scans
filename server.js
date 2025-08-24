const express = require('express');
const expressLayouts = require('express-ejs-layouts');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const passport = require('./config/passport');
const flash = require('connect-flash');
const { initDatabase } = require('./database/init');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Import routes
const indexRoutes = require('./routes/index');
const aboutRoutes = require('./routes/about');
const contactRoutes = require('./routes/contact');
const authRoutes = require('./routes/auth');
const dashboardRoutes = require('./routes/dashboard');
const formsRoutes = require('./routes/forms');
const scansRoutes = require('./routes/scans');
const exportsRoutes = require('./routes/exports');
const activityRoutes = require('./routes/activity');
const settingsRoutes = require('./routes/settings');
const adminRoutes = require('./routes/admin');

// Set up EJS as view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Set up EJS layouts
app.use(expressLayouts);
app.set('layout', 'layouts/main');

// Middleware
app.use(session({
  store: new SQLiteStore({
    db: 'sessions.db',
    dir: './database'
  }),
  secret: 'your-secret-key-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, // Set to true in production with HTTPS
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

app.use(passport.initialize());
app.use(passport.session());
app.use(flash());

// Make user available in all templates
app.use((req, res, next) => {
  res.locals.user = req.user;
  res.locals.isAuthenticated = req.isAuthenticated();
  next();
});

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Routes
app.use('/', indexRoutes);
app.use('/about', aboutRoutes);
app.use('/contact', contactRoutes);
app.use('/auth', authRoutes);
app.use('/dashboard', dashboardRoutes);
app.use('/forms', formsRoutes);
app.use('/scans', scansRoutes);
app.use('/exports', exportsRoutes);
app.use('/activity', activityRoutes);
app.use('/settings', settingsRoutes);
app.use('/admin', adminRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).render('404', {
    title: '404 - Page Not Found',
    layout: 'layouts/main'
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).render('error', {
    title: '500 - Server Error',
    layout: 'layouts/main',
    error: err.message
  });
});

app.listen(PORT, async () => {
  await initDatabase();
  console.log(`Server running on http://localhost:${PORT}`);
});