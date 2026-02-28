# Testing the AI Maintenance Workflow

## Quick Setup

1. **Run the test data setup script:**
   ```bash
   cd frontend
   node scripts/setup-test-data.js
   ```

   This will create:
   - Test Tenant: **Alex Thompson** (alex@testmail.com)
   - Unit: **Apartment 4A** at 456 Test Street, San Francisco
   - Active lease with $1,800/month rent
   - Three test contractors (plumbing, electrical, general)

2. **Start the application:**
   ```bash
   # Terminal 1 - Backend
   cd backend
   uvicorn app.main:app --reload

   # Terminal 2 - Frontend
   cd frontend
   npm run dev
   ```

3. **Navigate to the Maintenance page:**
   Open http://localhost:3000/maintenance

## Testing the Complete Workflow

### Step 1: Submit a Maintenance Request

1. Click **"Submit New Maintenance Request"** button
2. Select **"Apartment 4A - Alex Thompson"** from the dropdown
3. Enter a test description, for example:
   - "Water is leaking from the bathroom ceiling. It's getting worse and there's a growing wet patch."
   - "The kitchen light switch is sparking when I turn it on. I'm worried about fire risk."
   - "My refrigerator stopped working overnight. All my food is going bad."

4. Click **"Submit to AI"**

### Step 2: Observe AI Analysis

Watch as the system:
- Analyzes the request with Claude AI
- Determines category, urgency, and vendor requirement
- Notifies the owner (you'll see this in the communication feed)

### Step 3: Owner Response

As the owner, you'll see three action buttons:
- **Approve Request** - Continues the workflow
- **Deny Request** - Closes the request
- **Ask Question** - Requests clarification

Try different responses to see how the workflow adapts.

### Step 4: Vendor Coordination (if approved)

If the AI determines a vendor is needed:
1. The system will show the vendor coordination panel
2. You can simulate vendor responses by selecting a contractor
3. Set an ETA (date and time)
4. Add any notes

### Step 5: Track Progress

Watch the workflow timeline update in real-time:
- ✅ Completed steps show with checkmarks
- 🔵 Current step is highlighted and animated
- ⚪ Future steps are grayed out

### Step 6: Resolution

The workflow completes when:
- The vendor marks the job as done
- Or the tenant resolves it themselves (for non-vendor issues)

## Test Scenarios

### Scenario 1: Emergency Plumbing
```
"Water is flooding my bathroom! The pipe under the sink burst and water is everywhere!"
```
- Expected: HIGH/EMERGENCY urgency, vendor required

### Scenario 2: Simple DIY Fix
```
"The battery in my smoke detector is beeping. It needs to be replaced."
```
- Expected: LOW urgency, no vendor required

### Scenario 3: Electrical Hazard
```
"I smell burning plastic from the electrical outlet in my bedroom. It's hot to touch."
```
- Expected: EMERGENCY urgency, vendor required immediately

### Scenario 4: Cosmetic Issue
```
"There's a small paint chip on the living room wall from moving furniture."
```
- Expected: LOW urgency, no vendor required

## Monitoring Features

1. **Communication Feed**: Shows all messages between tenant, owner, system, and vendor
2. **AI Decision Panel**: Displays Claude's analysis with reasoning
3. **State History**: Each transition is logged with timestamp
4. **Real-time Updates**: All changes sync immediately

## Troubleshooting

If you don't see any units in the dropdown:
1. Check that the test data script ran successfully
2. Refresh the page (data might need to sync)
3. Check the browser console for errors

If the AI analysis fails:
1. Ensure the backend is running
2. Check that ANTHROPIC_API_KEY is set in backend/.env
3. Look at the backend terminal for error messages

## Demo Tips

For the best demo experience:
1. Use realistic descriptions for maintenance issues
2. Try both emergency and routine scenarios
3. Show the denied workflow path
4. Demonstrate the no-vendor-required path
5. Highlight the real-time updates and animations

## Reset Test Data

To start fresh, you can delete and recreate the test data:
```sql
-- Run in Supabase SQL editor
DELETE FROM maintenance_workflows WHERE maintenance_request_id IN (
  SELECT id FROM maintenance_requests WHERE lease_id = 'test-lease-001'
);
DELETE FROM maintenance_requests WHERE lease_id = 'test-lease-001';
```

Then run the setup script again.