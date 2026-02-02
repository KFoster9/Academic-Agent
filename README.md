# Academic Agent

AI-powered academic planning and advisory application for students.

## Features

- 📚 Course and assignment tracking
- 🎯 AI-powered recommendations
- 📊 Grade impact calculator
- 📅 Semester calendar view
- 💬 Chat with AI academic advisor
- 📄 Syllabus parsing and extraction

## Local Development

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn

### Installation

1. Install dependencies:
```bash
npm install
```

2. Run development server:
```bash
npm run dev
```

3. Open your browser to `http://localhost:5173`

## Building for Production

```bash
npm run build
```

The built files will be in the `dist` directory.

## Deployment to Netlify

### Option 1: Deploy via Netlify CLI
1. Install Netlify CLI:
```bash
npm install -g netlify-cli
```

2. Login to Netlify:
```bash
netlify login
```

3. Deploy:
```bash
netlify deploy --prod
```

### Option 2: Deploy via GitHub + Netlify
1. Push your code to GitHub
2. Log in to Netlify (https://app.netlify.com)
3. Click "Add new site" → "Import an existing project"
4. Connect to your GitHub repository
5. Netlify will automatically detect the build settings
6. Click "Deploy site"

### Build Settings
- Build command: `npm run build`
- Publish directory: `dist`
- Node version: 18

## Tech Stack

- React 18
- Vite
- Tailwind CSS
- Lucide React (icons)
- Claude API (Anthropic)

## Environment Variables

Currently, the app uses the Claude API directly. For production, you may want to implement a backend proxy to secure API keys.

## License

MIT
