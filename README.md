# Quick App Agent (QAA)

A web application that helps developers quickly build and deploy web and mobile applications using AI assistance.

## Project Structure

```
QAA/
├── backend/
│   ├── app.py
│   └── requirements.txt
└── frontend/
    ├── src/
    │   ├── App.js
    │   └── App.css
    └── package.json
```

## Setup Instructions

### Backend Setup

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Create a virtual environment (optional but recommended):
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

4. Set environment variables:
   - OPENAI_API_KEY: Your OpenAI API key
   - JWT_SECRET_KEY: Your JWT secret key

5. Run the Flask server:
   ```bash
   python app.py
   ```

### Frontend Setup

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm start
   ```

## Deployment

### Backend
- Deploy to your preferred hosting service (e.g., Heroku, DigitalOcean)
- Make sure to set environment variables in your hosting platform

### Frontend
1. Build the production version:
   ```bash
   npm run build
   ```
2. Deploy to Netlify:
   - Drag and drop the `build` folder to Netlify
   - Or connect your GitHub repository for continuous deployment

## Default Credentials
- Username: admin
- Password: password123
(Change these in production)
