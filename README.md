# Scans App

A professional barcode scanning and data management platform built with Node.js, Express, and EJS.

## Features

- 🔍 **Barcode Scanning**: Support for keyboard input and physical barcode scanners
- 📊 **Data Management**: Organize and track scan data with multiple form types
- 📈 **Analytics**: Comprehensive activity dashboard with charts and statistics
- 📧 **Email Integration**: Export data via email using Resend API
- 👥 **Multi-Tenant**: Secure account isolation with role-based access control
- 📱 **Mobile Responsive**: Optimized for all devices
- 🔐 **Secure**: Enterprise-grade authentication and data protection

## Quick Start

### Using Docker (Recommended)

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd scans-app
   ```

2. **Set up environment variables**
   ```bash
   cp .env.docker .env
   # Edit .env with your actual values
   ```

3. **Run with Docker Compose**
   ```bash
   docker-compose up -d
   ```

4. **Access the application**
   - Open http://localhost:3000
   - Register a new account to get started

### Manual Installation

1. **Prerequisites**
   - Node.js 18+ 
   - npm or yarn

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Start the application**
   ```bash
   npm start
   ```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `RESEND_API_KEY` | Your Resend API key for email functionality | Yes |
| `FROM_EMAIL` | Verified sender email address | Yes |
| `ADMIN_EMAIL` | Admin email for contact form submissions | Yes |
| `SESSION_SECRET` | Secret key for session encryption | Yes |
| `APP_NAME` | Application name for branding | No |
| `APP_URL` | Base URL for email links | No |

## Docker Commands

```bash
# Build and start
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down

# Rebuild after changes
docker-compose up -d --build

# Access container shell
docker-compose exec scans-app sh
```

## Database

The application uses SQLite with automatic initialization. Database files are stored in the `./database` directory and are persisted via Docker volumes.

## Security Features

- ✅ Multi-tenant data isolation
- ✅ Secure password hashing (bcrypt)
- ✅ Session-based authentication
- ✅ Role-based access control
- ✅ CSRF protection via flash messages
- ✅ Input validation and sanitization

## API Endpoints

- `GET /` - Landing page
- `GET /auth/login` - Login page
- `GET /auth/register` - Registration page
- `GET /dashboard` - User dashboard
- `GET /forms` - Available scan forms
- `GET /scans` - Scan data management
- `GET /exports` - Export management
- `GET /activity` - Analytics dashboard
- `GET /settings` - User settings
- `GET /admin` - Admin panel (admin only)

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is proprietary software owned by Omnaris LLC.

## Support

For support, email your admin or create an issue in the repository.