# 🚀 Maintenance System Fix Guide

## Current Issues Fixed:

1. ✅ **Supabase Query Errors** - Updated error handling to continue with partial data
2. ✅ **Backend API Connection** - Backend is now running on port 8001
3. ✅ **React Child Error** - Fixed contractors page to use correct property names
4. ✅ **Environment Variables** - Added all required backend environment variables

## 📋 Setup Instructions:

### 1. Database Setup (REQUIRED)

The maintenance workflow tables need to be created in your Supabase database:

1. **Go to your Supabase Dashboard**
2. **Navigate to the SQL Editor**
3. **Run the complete setup script:**
   - Copy the entire contents of `/frontend/lib/supabase/complete_setup.sql`
   - Paste and execute in the SQL editor
   - This will:
     - Create the workflow tables (`maintenance_workflows`, `workflow_communications`, `vendor_bids`)
     - Create test data (landlord, units, tenants, contractors)
     - Set up necessary indexes and triggers

### 2. Verify Services are Running

#### Frontend (Next.js):
- Running on: http://localhost:3000
- Check terminal: Should show `✓ Ready in...`

#### Backend (FastAPI):
- Running on: http://localhost:8001
- Check terminal: Should show `INFO: Uvicorn running on http://127.0.0.1:8001`

### 3. Test the Workflow

1. **Navigate to**: http://localhost:3000/maintenance

2. **Submit a Test Request**:
   - Unit: Select "Alex Thompson - Apartment 4A"
   - Description: Use one of these:
     ```
     Emergency: Water is leaking from the ceiling in the bathroom! It's getting worse.
     
     The AC unit is making a loud grinding noise and not cooling properly.
     
     Kitchen sink is completely clogged and water won't drain at all.
     ```

3. **What Should Happen**:
   - Request submits successfully
   - AI analyzes the request (Claude API)
   - Workflow timeline shows progress
   - Owner gets notified (shown in UI)
   - You can approve/deny as owner
   - If vendor required, vendor coordination panel appears

## 🔧 Troubleshooting:

### If maintenance requests disappear:

1. **Check Browser Console** (F12):
   - Look for any red errors
   - Check Network tab for failed API calls

2. **Check Backend Logs**:
   ```bash
   cat /Users/admin/.cursor/projects/Users-admin-0human-hackathon/terminals/549823.txt | tail -50
   ```

3. **Common Issues**:
   - **"Failed to fetch"** - Backend not running or wrong port
   - **"maintenance_workflows does not exist"** - Run the SQL setup script
   - **"Cannot read properties of undefined"** - Data not loading properly

### Quick Fixes:

1. **Restart Frontend**:
   ```bash
   # Kill existing process
   lsof -ti:3000 | xargs kill -9
   # Restart
   cd frontend && npm run dev
   ```

2. **Restart Backend**:
   ```bash
   # Kill existing process
   lsof -ti:8001 | xargs kill -9
   # Restart
   cd backend && /Users/admin/Library/Python/3.9/bin/uvicorn app.main:app --reload --port 8001
   ```

## ✅ Testing Checklist:

- [ ] Database tables created (run SQL script)
- [ ] Frontend running on port 3000
- [ ] Backend running on port 8001
- [ ] Can see test tenants in dropdown
- [ ] Can submit maintenance request
- [ ] Request appears in timeline
- [ ] Can interact as owner (approve/deny)

## 🎯 Expected Result:

When working properly:
1. Submit a maintenance request
2. See it appear in the timeline as "SUBMITTED"
3. Status changes to "OWNER_NOTIFIED"
4. AI analysis appears in right panel
5. Owner action buttons appear
6. Can progress through the entire workflow

## Need Help?

If issues persist:
1. Check all error messages in browser console
2. Verify backend is receiving requests (check logs)
3. Ensure database has all required tables
4. Confirm environment variables are set correctly