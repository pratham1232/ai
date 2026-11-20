# 🚀 Complete Deployment Guide: AI Internship Recommender

This guide explains how to deploy the project to the cloud so that the **database, backend API, AI recommendation engine, and frontend UI** all work together seamlessly in production.

---

## 🗄️ Database: How Your Data Works in Production

All 24 internships, 9 users, and application records from your local database have been extracted and bundled into this repository:
- **`backend/database_dump.sql`**: Complete SQL schema and data insert statements.
- **`backend/database_data.json`**: JSON export of all current records.
- **`backend/seed.js`**: Automatic database seeder.

### ✨ Zero-Config Auto-Seeding:
When you deploy the backend connected to ANY new, empty cloud MySQL database, `server.js` automatically detects that the database is fresh and **automatically seeds all 24 internships and users on initial startup**. You don't need to manually run SQL queries unless you prefer to.

---

## ☁️ Step-by-Step Deployment Options

### Option 1: Render (Recommended — Free & Easiest)

Render can run the Web Service, Python AI Service, and MySQL database.

#### Step 1: Create a Free Cloud MySQL Database
1. Go to **[TiDB Cloud](https://tidbcloud.com/)** or **[Aiven.io](https://aiven.io/)** (both offer a generous free-forever MySQL database with no credit card required).
2. Create a new MySQL cluster (takes ~1 minute).
3. Copy the **Connection String / URL** (e.g. `mysql://user:pass@gateway01.region.tidbcloud.com:4000/internshipDB?ssl=true`).

*(Alternatively: You can use Railway MySQL or Clever Cloud MySQL).*

#### Step 2: Deploy the Backend on Render
1. Go to **[Render.com](https://render.com/)** and click **New +** > **Web Service**.
2. Connect your GitHub repository: `https://github.com/pratham1232/ai.git`.
3. Configure the settings:
   - **Name**: `ai-internship-backend`
   - **Root Directory**: `backend`
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`
   - **Instance Type**: `Free`
4. Add **Environment Variables**:
   - `DATABASE_URL`: *(Paste your Cloud MySQL connection URL from Step 1)*
   - `NODE_ENV`: `production`
   - `PORT`: `5000`
5. Click **Create Web Service**.
6. The backend will start, connect to your cloud MySQL database, and **auto-seed all 24 internships and users**.

#### Step 3: Deploy Frontend (Vercel or Render Static Site)
##### On Vercel:
1. Go to **[Vercel.com](https://vercel.com/)** and import repository `https://github.com/pratham1232/ai.git`.
2. Set **Root Directory**: `frontend`.
3. Under **Environment Variables**, add:
   - `REACT_APP_API_URL`: `https://your-backend-name.onrender.com` *(your Render backend URL from Step 2)*.
4. Click **Deploy**.

---

### Option 2: Railway (1-Click Fullstack)

1. Go to **[Railway.app](https://railway.app/)** and click **New Project** > **Provision MySQL**.
2. Click **New** > **GitHub Repo** > Select `pratham1232/ai`.
3. In service settings, set **Root Directory** to `backend`.
4. Add variable:
   - `DATABASE_URL`: `${{MySQL.MYSQL_URL}}`
5. Click **Deploy**. The backend will connect to Railway's MySQL and auto-seed immediately!

---

### Option 3: Docker / Self-Hosted

If running via Docker on any VPS (AWS EC2, DigitalOcean, Linode):
```bash
docker compose up -d --build
```
This automatically boots MySQL 8.0, seeds `database_dump.sql`, boots the Python AI engine on port 8000, and boots the Node backend on port 5000.

---

## 🛠️ Testing the Deployment

1. **Health Check Endpoint**:
   Visit `https://your-backend-url/health`
   You should see:
   ```json
   {
     "status": "healthy",
     "database": "connected",
     "internships": 24,
     "timestamp": "..."
   }
   ```

2. **Login with existing user**:
   - Email: `prathammishra461@gmail.com`
   - Role: `student`
   - Test password from your local database

3. **Explore Internships**:
   Open the frontend URL, enter skills (e.g. `React, Python, Node.js`), and view semantic recommendations!
