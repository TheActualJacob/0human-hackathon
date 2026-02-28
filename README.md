# PropAI - AI-Powered Property Management Platform

A modern property management dashboard that demonstrates AI-powered automation for maintenance, rent collection, and tenant management.

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Open http://localhost:3000
```

## 🎯 Demo Flow

### 1. Dashboard Overview
- View KPI metrics and AI resolution rate
- Monitor live activity feed showing AI actions
- Check agent status panel (Active mode, 78% autonomy)

### 2. Maintenance Demo (Hero Feature)
1. Navigate to **Maintenance** page
2. Click **"New Ticket"** button
3. Select any tenant (e.g., "Sarah Johnson - Unit 2A")
4. Enter title: "Kitchen sink issue"
5. Click the example text for description
6. Click **"Run AI Agent"** button
7. Watch AI classify the issue and assign vendor automatically

### 3. Key Features to Highlight

#### AI Classification
- Automatically categorizes maintenance issues
- Sets urgency levels based on description
- Shows confidence scores

#### Smart Vendor Assignment
- Selects optimal vendor based on:
  - Specialty match
  - Response time
  - AI performance score
  - Availability

#### Autonomous Mode Toggle
- Visit **Settings** page
- Adjust autonomy level slider
- Switch between Active/Passive/Off modes

## 🏗️ Tech Stack

- **Next.js 14** (App Router)
- **TypeScript**
- **TailwindCSS** (Dark mode)
- **shadcn/ui** components
- **Zustand** for state management
- **Recharts** for data visualization

## 🎨 Design Features

- Bloomberg Terminal aesthetic
- Dark mode by default
- AI glow effects on automated elements
- Real-time activity animations
- High contrast, minimal design

## 📊 Mock Data

All data is pre-populated for demo purposes:
- 8 tenants with varying risk scores
- 5 maintenance tickets in different states
- 6 vendors with performance metrics
- Rent payment history
- Lease renewal predictions

## 🤖 AI Features

- **Maintenance Classification**: Categorizes issues based on keywords
- **Vendor Selection**: Matches best vendor using multiple criteria
- **Risk Scoring**: Calculates tenant risk based on payment history
- **Renewal Recommendations**: Suggests lease renewal probability
- **Activity Generation**: Creates realistic activity log entries

## 📱 Pages

1. **Dashboard** - Command center with KPIs and activity feed
2. **Maintenance** - Ticket management with AI decision panel
3. **Rent Collection** - Payment tracking and automated reminders
4. **Tenants** - Risk profiles and AI-generated insights
5. **Leases** - Renewal recommendations and expiry tracking
6. **Vendors** - Performance metrics and AI scoring
7. **Reports** - Analytics and AI efficiency metrics
8. **Settings** - Configure agent behavior and automation rules

## 🎪 Presentation Tips

1. Start on the Dashboard to show the "command center" feel
2. Emphasize the AI agent status (Active, 78% autonomy)
3. Demo the maintenance flow - it's the most impressive
4. Show how AI decisions appear in real-time
5. Point out the AI glow effects on automated elements
6. Toggle autonomous mode in Settings to show control
7. Highlight time saved and efficiency metrics in Reports

## 🔧 Customization

To adjust mock data, edit files in `/lib/mockData/`
To modify AI behavior, update `/lib/agentEngine/index.ts`