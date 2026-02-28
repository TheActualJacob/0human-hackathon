# Quick Test Setup Instructions

## Option 1: Using Supabase Dashboard (Recommended)

1. **Open your Supabase Dashboard**
   - Go to your Supabase project
   - Navigate to the SQL Editor

2. **Run the Test Data Script**
   - Open the file: `frontend/lib/supabase/setup_test_data.sql`
   - Copy the entire contents
   - Paste into the SQL Editor
   - Click "Run" 

3. **You'll now have these test tenants:**
   - **Alex Thompson** - Apartment 4A
   - **Sarah Johnson** - Apartment 2B  
   - **Mike Chen** - Studio 101

## Option 2: Manual Test Entry

If you prefer to test with manual data entry:

1. **Start the app:**
   ```bash
   cd frontend && npm run dev
   ```

2. **Create a mock submission in the UI:**
   - The dropdown will show any existing tenants
   - If no tenants exist, you'll need to create them in Supabase first

## Sample Test Descriptions

Copy and paste these into the Description field:

### 🚨 Emergency - Water Leak
```
There's water dripping from my ceiling in the bathroom! It started yesterday and is getting worse. I can see a wet patch that's growing larger.
```

### ⚡ High Priority - Electrical
```
The kitchen outlet is sparking when I plug anything in. I'm concerned about fire risk and have stopped using it.
```

### 🔧 Medium Priority - Appliance
```
My refrigerator stopped cooling properly. The freezer works but the main compartment is warm. Food is starting to spoil.
```

### 🎨 Low Priority - Cosmetic
```
There's a small scratch on the wall from moving furniture. It's about 2 inches long near the door frame.
```

### 🔨 DIY Fix - No Vendor Needed
```
The smoke detector in my bedroom is beeping. I think it just needs a new battery.
```

## Testing the Workflow

1. **Submit a request** using one of the descriptions above
2. **Watch the AI analyze** the request (you'll see the decision panel populate)
3. **As the owner**, approve or deny the request
4. **If approved and vendor needed**, simulate vendor response:
   - Select a contractor
   - Set an ETA
   - Submit
5. **Track progress** through the workflow timeline

## What to Look For

- ✅ Real-time state updates
- ✅ AI categorization and urgency detection
- ✅ Animated workflow timeline
- ✅ Communication feed updates
- ✅ Different paths (approved/denied, vendor/no-vendor)

## Troubleshooting

**No units showing in dropdown?**
- Make sure you ran the SQL script successfully
- Check that leases have status = 'active'
- Refresh the page

**Backend errors?**
- Ensure ANTHROPIC_API_KEY is set in backend/.env
- Check that the backend is running on port 8000
- Look for error messages in the terminal

**Can't connect to Supabase?**
- Verify your .env.local has correct Supabase URL and key
- Check that your Supabase project is active
- Try the SQL script directly in Supabase dashboard

## Demo Best Practices

1. Start with an emergency request to show urgency detection
2. Then try a cosmetic issue to show the no-vendor path
3. Demonstrate the deny flow
4. Show how the communication feed tracks everything
5. Point out the real-time updates and animations

Happy testing! 🎉