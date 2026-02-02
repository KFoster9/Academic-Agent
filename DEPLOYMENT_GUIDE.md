# Academic Agent - Deployment Guide

## Complete Step-by-Step Deployment Process

### Part 1: Set Up GitHub Account & Repository (10 minutes)

#### Step 1: Create GitHub Account
1. Go to https://github.com
2. Click "Sign up"
3. Enter your email, create a password, and choose a username
4. Verify your email address
5. Complete the setup

#### Step 2: Create a New Repository
1. Once logged in, click the "+" icon in the top right
2. Select "New repository"
3. Repository details:
   - Repository name: `academic-agent`
   - Description: "AI-powered academic planning application"
   - Keep it **Public** (free hosting on Netlify works best with public repos)
   - **DO NOT** check "Add a README file" (we already have one)
   - Click "Create repository"

#### Step 3: Upload Your Code
You have two options:

**Option A: Using GitHub Desktop (Easier for beginners)**
1. Download GitHub Desktop from https://desktop.github.com
2. Install and sign in with your GitHub account
3. Click "Clone a repository from the Internet"
4. Find "academic-agent" and clone it to your computer
5. Copy all the files from the `academic-agent` folder into the cloned directory
6. In GitHub Desktop, you'll see all the changes
7. Write a commit message: "Initial commit - Academic Agent v1.0"
8. Click "Commit to main"
9. Click "Push origin"

**Option B: Using Git Command Line**
```bash
# Navigate to the academic-agent directory
cd academic-agent

# Initialize git
git init

# Add all files
git add .

# Commit
git commit -m "Initial commit - Academic Agent v1.0"

# Add your GitHub repo as remote (replace YOUR_USERNAME)
git remote add origin https://github.com/YOUR_USERNAME/academic-agent.git

# Push to GitHub
git branch -M main
git push -u origin main
```

---

### Part 2: Deploy to Netlify (5 minutes)

#### Step 1: Create Netlify Account
1. Go to https://www.netlify.com
2. Click "Sign up"
3. Choose "Sign up with GitHub" (this makes connecting easier)
4. Authorize Netlify to access your GitHub account

#### Step 2: Deploy Your Site
1. Once logged in, click "Add new site" → "Import an existing project"
2. Click "Deploy with GitHub"
3. Authorize Netlify (if asked)
4. Find and select your `academic-agent` repository
5. Configure build settings:
   - **Branch to deploy:** main
   - **Build command:** `npm run build` (should auto-detect)
   - **Publish directory:** `dist` (should auto-detect)
6. Click "Deploy academic-agent"

#### Step 3: Wait for Deployment
- Netlify will now:
  - Install dependencies
  - Build your application
  - Deploy it to their CDN
- This takes 2-3 minutes
- You can watch the build logs in real-time

#### Step 4: Get Your Live URL
- Once complete, Netlify will show you your live URL
- It will look like: `https://random-name-123456.netlify.app`
- Click the URL to view your live site!

#### Step 5: Customize Your Domain (Optional)
1. In your Netlify dashboard, click "Domain settings"
2. Click "Options" → "Edit site name"
3. Change it to something like: `khalil-academic-agent.netlify.app`
4. Click "Save"

---

### Part 3: Share with Beta Testers

Now that your site is live, you can share the URL with your friends for testing!

**What to share:**
- Your Netlify URL (e.g., `https://khalil-academic-agent.netlify.app`)
- Brief instructions on how to use it
- Ask them to report any bugs or feedback

**Important Notes for Beta Testing:**
1. Data is stored locally in each user's browser
2. The AI features require API access (currently working)
3. Each user will have their own separate data
4. Ask testers to try all features:
   - Adding courses
   - Adding assignments
   - Getting recommendations
   - Using the chat feature
   - Uploading syllabi

---

### Part 4: Making Updates

Whenever you want to update your site:

**Option A: Using GitHub Desktop**
1. Make changes to your local files
2. Open GitHub Desktop
3. Write a commit message describing your changes
4. Click "Commit to main"
5. Click "Push origin"
6. Netlify will automatically rebuild and deploy!

**Option B: Using Git Command Line**
```bash
git add .
git commit -m "Description of your changes"
git push
```

Netlify automatically redeploys whenever you push to GitHub!

---

### Part 5: Monitoring Your Site

In your Netlify dashboard you can:
- View deployment history
- See build logs
- Monitor site analytics
- Set up custom domains
- Configure environment variables

---

### Troubleshooting

**Build Failed?**
- Check the build logs in Netlify
- Most common issue: missing dependencies
- Solution: Make sure all files are committed to GitHub

**Site is blank?**
- Check browser console for errors
- Make sure all files were uploaded correctly

**Need Help?**
- Netlify has excellent documentation: https://docs.netlify.com
- GitHub has guides: https://docs.github.com

---

### Next Steps

1. ✅ Complete GitHub setup
2. ✅ Complete Netlify deployment
3. ✅ Share with 5-10 beta testers
4. 📝 Collect feedback
5. 🔄 Iterate and improve
6. 🚀 Scale to more users!

---

## Quick Reference Commands

```bash
# Install dependencies locally
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

Good luck with your launch! 🎓🚀
