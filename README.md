# LearnItDoIt Backend

A robust Node.js backend for the LearnItDoIt platform, featuring advanced project management, real-time collaboration, and AI-powered assistance.

## Features

- **User Authentication & Management**
  - JWT-based authentication
  - Role-based access control
  - OAuth integration
  - Two-factor authentication

- **Project Management**
  - Real-time collaboration
  - Auto-save functionality
  - Version control
  - Asset management

- **AI Integration**
  - Code generation and optimization
  - Accessibility suggestions
  - Performance insights
  - Best practices recommendations

- **File Management**
  - Automatic project directory creation
  - Local file synchronization
  - Asset optimization
  - Backup management

- **Deployment Integration**
  - GitHub repository management
  - Netlify deployment
  - CI/CD pipeline support
  - Environment management

## Getting Started

### Prerequisites

- Node.js >= 18
- MongoDB >= 6.0
- Redis >= 7.0
- Git

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/your-username/learnitdoit-backend.git
   cd learnitdoit-backend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. Start the development server:
   ```bash
   npm run dev
   ```

### Environment Variables

Required environment variables:

```env
NODE_ENV=development
PORT=3000
MONGODB_URI=mongodb://localhost:27017/learnitdoit
REDIS_URI=redis://localhost:6379
JWT_SECRET=your-jwt-secret
GITHUB_TOKEN=your-github-token
NETLIFY_TOKEN=your-netlify-token
```

## API Documentation

API documentation is available at `/api-docs` when running the server.

## Testing

Run the test suite:

```bash
npm test
```

Run tests with coverage:

```bash
npm run test:coverage
```

## Deployment

### Production Setup

1. Build the application:
   ```bash
   npm run build
   ```

2. Start the production server:
   ```bash
   npm start
   ```

### Docker Deployment

Build and run with Docker:

```bash
docker-compose -f docker-compose.prod.yml up -d
```

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
