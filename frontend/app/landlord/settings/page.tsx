'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { 
  User, Bell, Shield, Key, Globe, Palette, 
  Building, CreditCard, Save, Check,
  Brain, Wrench, Zap, Info, CheckCircle2
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
// import { useToast } from '@/components/ui/use-toast';
import useAuthStore from '@/lib/store/auth';
import { getCurrentUser } from '@/lib/auth/client';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import type { AutoApprovalPolicy } from '@/types';

const POLICY_KEY = 'maintenance_auto_approval_policy';

const DEFAULT_POLICY: AutoApprovalPolicy = {
  enabled: false,
  minConfidence: 0.9,
  maxCostRange: 'low',
  excludeEmergency: true,
};

export default function LandlordSettingsPage() {
  // const { toast } = useToast();
  const searchParams = useSearchParams();
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState(() => searchParams.get('tab') ?? 'profile');
  const [policySaved, setPolicySaved] = useState(false);
  const [policy, setPolicy] = useState<AutoApprovalPolicy>(() => {
    if (typeof window === 'undefined') return DEFAULT_POLICY;
    try {
      const stored = localStorage.getItem(POLICY_KEY);
      return stored ? { ...DEFAULT_POLICY, ...JSON.parse(stored) } : DEFAULT_POLICY;
    } catch {
      return DEFAULT_POLICY;
    }
  });
  const [isLoading, setIsLoading] = useState(true);
  const { user, setUser } = useAuthStore();
  const supabase = createClient();

  // Ensure user with entity data is loaded (handles direct navigation or stale store)
  useEffect(() => {
    if (!user?.entity) {
      getCurrentUser().then((currentUser) => {
        if (currentUser) setUser(currentUser);
        else setIsLoading(false);
      });
    }
  }, []);

  // Form state
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    whatsappNumber: '',
    companyName: '',
    portfolioSize: '5-10',
    paymentTerms: ''
  });

  // Sync policy from Supabase when user loads (cross-device consistency)
  useEffect(() => {
    if (user?.entity?.notification_preferences?.maintenance_policy) {
      const dbPolicy = {
        ...DEFAULT_POLICY,
        ...user.entity.notification_preferences.maintenance_policy,
      } as AutoApprovalPolicy;
      setPolicy(dbPolicy);
      try { localStorage.setItem(POLICY_KEY, JSON.stringify(dbPolicy)); } catch {}
    }
  }, [user?.entityId]);

  // Load user data on mount
  useEffect(() => {
    if (user?.entity) {
      const fullName = user.entity.full_name || '';
      const [firstName, ...lastNameParts] = fullName.split(' ');
      const lastName = lastNameParts.join(' ');
      
      // Get additional data from notification_preferences JSON if stored there
      const notificationPrefs = user.entity.notification_preferences || {};
      
      setFormData({
        firstName: firstName || '',
        lastName: lastName || '',
        email: user.email || '',
        phone: user.entity.phone || '',
        whatsappNumber: user.entity.whatsapp_number || '',
        companyName: notificationPrefs.company_name || '',
        portfolioSize: notificationPrefs.portfolio_size || '5-10',
        paymentTerms: notificationPrefs.payment_terms || ''
      });
      setIsLoading(false);
    } else if (user === null) {
      // User is not logged in or data failed to load
      setIsLoading(false);
    }
  }, [user]);

  const handleSave = async () => {
    if (!user?.entityId) return;
    
    setSaving(true);
    try {
      // Get current notification preferences
      const currentPrefs = user.entity?.notification_preferences || {
        email: true,
        whatsapp: true,
        digest_frequency: 'daily'
      };

      // Merge with additional profile data
      const updatedNotificationPreferences = {
        ...currentPrefs,
        company_name: formData.companyName,
        portfolio_size: formData.portfolioSize,
        payment_terms: formData.paymentTerms
      };

      // Update landlord data in the database
      const { error } = await supabase
        .from('landlords')
        .update({
          full_name: `${formData.firstName} ${formData.lastName}`.trim(),
          email: formData.email,
          phone: formData.phone || null,
          whatsapp_number: formData.whatsappNumber || null,
          notification_preferences: updatedNotificationPreferences
        })
        .eq('id', user.entityId);

      if (error) throw error;

      // Update the user's email if it changed
      if (formData.email !== user.email) {
        const { error: authError } = await supabase.auth.updateUser({
          email: formData.email
        });
        if (authError) throw authError;
      }

      // Refresh the user data in the auth store
      const { data: updatedLandlord } = await supabase
        .from('landlords')
        .select('*')
        .eq('id', user.entityId)
        .single();

      if (updatedLandlord) {
        useAuthStore.getState().setUser({
          ...user,
          email: formData.email,
          entity: updatedLandlord
        });
      }

      setPolicySaved(true);
      setTimeout(() => setPolicySaved(false), 2500);
    } catch (error) {
      console.error('Error saving settings:', error);
    } finally {
      setSaving(false);
    }
  };

  const savePolicy = async (next: AutoApprovalPolicy) => {
    // Always update localStorage immediately for instant UI feedback
    try { localStorage.setItem(POLICY_KEY, JSON.stringify(next)); } catch {}
    setPolicy(next);

    // Persist to Supabase so the server can enforce it on any device / tenant submission
    if (user?.entityId) {
      try {
        const currentPrefs = user.entity?.notification_preferences || {};
        await supabase
          .from('landlords')
          .update({
            notification_preferences: { ...currentPrefs, maintenance_policy: next },
          })
          .eq('id', user.entityId);
      } catch (err) {
        console.error('Failed to persist maintenance policy:', err);
      }
    }

    setPolicySaved(true);
    setTimeout(() => setPolicySaved(false), 2000);
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground">
          Manage your account and preferences
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="automation" className="flex items-center gap-1.5">
            <Brain className="h-3.5 w-3.5" />
            AI
          </TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="billing">Billing</TabsTrigger>
          <TabsTrigger value="preferences">Preferences</TabsTrigger>
        </TabsList>

        {/* Profile Tab */}
        <TabsContent value="profile" className="space-y-4 mt-6">
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <User className="h-5 w-5" />
              Personal Information
            </h3>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
            ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>First Name</Label>
                  <Input 
                    value={formData.firstName} 
                    onChange={(e) => setFormData(prev => ({ ...prev, firstName: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Last Name</Label>
                  <Input 
                    value={formData.lastName} 
                    onChange={(e) => setFormData(prev => ({ ...prev, lastName: e.target.value }))}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input 
                  type="email" 
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Phone Number</Label>
                <Input 
                  value={formData.phone}
                  onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>WhatsApp Number</Label>
                <Input 
                  value={formData.whatsappNumber}
                  onChange={(e) => setFormData(prev => ({ ...prev, whatsappNumber: e.target.value }))}
                  placeholder="Same as phone or different"
                />
              </div>
              <div className="space-y-2">
                <Label>Company Name (Optional)</Label>
                <Input 
                  placeholder="Acme Properties Ltd" 
                  value={formData.companyName}
                  onChange={(e) => setFormData(prev => ({ ...prev, companyName: e.target.value }))}
                />
              </div>
            </div>
            )}
          </Card>

          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Building className="h-5 w-5" />
              Property Management
            </h3>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
            ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Portfolio Size</p>
                  <p className="text-sm text-muted-foreground">Number of properties you manage</p>
                </div>
                <Select 
                  value={formData.portfolioSize}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, portfolioSize: value }))}
                >
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1-5">1-5</SelectItem>
                    <SelectItem value="5-10">5-10</SelectItem>
                    <SelectItem value="10-20">10-20</SelectItem>
                    <SelectItem value="20+">20+</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Default Payment Terms</Label>
                <Textarea 
                  placeholder="Payment is due on the 1st of each month..."
                  rows={3}
                  value={formData.paymentTerms}
                  onChange={(e) => setFormData(prev => ({ ...prev, paymentTerms: e.target.value }))}
                />
              </div>
            </div>
            )}
          </Card>
        </TabsContent>

        {/* Notifications Tab */}
        <TabsContent value="notifications" className="space-y-4 mt-6">
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Email Notifications
            </h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Payment Updates</p>
                  <p className="text-sm text-muted-foreground">Receive emails when payments are made</p>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Late Payment Alerts</p>
                  <p className="text-sm text-muted-foreground">Get notified about overdue payments</p>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Maintenance Requests</p>
                  <p className="text-sm text-muted-foreground">New maintenance requests from tenants</p>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Lease Expiry Reminders</p>
                  <p className="text-sm text-muted-foreground">Reminders before leases expire</p>
                </div>
                <Switch defaultChecked />
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">WhatsApp Notifications</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Urgent Maintenance</p>
                  <p className="text-sm text-muted-foreground">Emergency maintenance requests</p>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Tenant Messages</p>
                  <p className="text-sm text-muted-foreground">Direct messages from tenants</p>
                </div>
                <Switch defaultChecked />
              </div>
            </div>
          </Card>
        </TabsContent>

        {/* AI & Automation Tab */}
        <TabsContent value="automation" className="space-y-4 mt-6">
          {/* Master toggle */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-1 flex items-center gap-2">
              <Brain className="h-5 w-5 text-primary" />
              Maintenance Request Handling
            </h3>
            <p className="text-sm text-muted-foreground mb-6">
              Choose whether the AI agent automatically handles incoming maintenance requests or you review each one manually.
            </p>

            <div className="grid grid-cols-2 gap-4 mb-6">
              {/* Manual card */}
              <button
                onClick={() => savePolicy({ ...policy, enabled: false })}
                className={cn(
                  'relative flex flex-col items-start gap-2 rounded-xl border-2 p-5 text-left transition-all',
                  !policy.enabled
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/40'
                )}
              >
                {!policy.enabled && (
                  <CheckCircle2 className="absolute top-3 right-3 h-4 w-4 text-primary" />
                )}
                <div className="flex items-center gap-2">
                  <div className="h-9 w-9 rounded-lg bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center">
                    <Wrench className="h-5 w-5 text-yellow-400" />
                  </div>
                  <span className="font-semibold">Manual Approval</span>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  You review and approve every maintenance request before any action is taken. Full control, every time.
                </p>
              </button>

              {/* Agent card */}
              <button
                onClick={() => savePolicy({ ...policy, enabled: true })}
                className={cn(
                  'relative flex flex-col items-start gap-2 rounded-xl border-2 p-5 text-left transition-all',
                  policy.enabled
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/40'
                )}
              >
                {policy.enabled && (
                  <CheckCircle2 className="absolute top-3 right-3 h-4 w-4 text-primary" />
                )}
                <div className="flex items-center gap-2">
                  <div className="h-9 w-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
                    <Zap className="h-5 w-5 text-primary" />
                  </div>
                  <span className="font-semibold">AI Agent Handles It</span>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  The AI classifies, approves, and coordinates maintenance automatically based on the rules you set below.
                </p>
              </button>
            </div>

            {/* Rules — only visible when agent mode is on */}
            {policy.enabled && (
              <div className="space-y-5 pt-5 border-t border-border">
                <p className="text-sm font-medium flex items-center gap-2">
                  <Zap className="h-4 w-4 text-primary" />
                  Auto-Approval Rules
                </p>

                {/* Confidence slider */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">Minimum AI Confidence</Label>
                    <span className="text-sm font-bold text-primary">
                      {Math.round(policy.minConfidence * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="50"
                    max="99"
                    step="1"
                    value={Math.round(policy.minConfidence * 100)}
                    onChange={(e) =>
                      savePolicy({ ...policy, minConfidence: Number(e.target.value) / 100 })
                    }
                    className="w-full h-2 rounded-full appearance-none bg-border cursor-pointer accent-primary"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground/60">
                    <span>50% — permissive</span>
                    <span>99% — strict</span>
                  </div>
                </div>

                {/* Max cost */}
                <div className="space-y-2">
                  <Label className="text-sm">Maximum Cost the Agent Can Approve</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['low', 'medium', 'high'] as const).map((tier) => (
                      <button
                        key={tier}
                        onClick={() => savePolicy({ ...policy, maxCostRange: tier })}
                        className={cn(
                          'py-2 rounded-lg border text-sm font-medium transition-all',
                          policy.maxCostRange === tier
                            ? tier === 'low'
                              ? 'bg-green-500/20 border-green-500/50 text-green-300'
                              : tier === 'medium'
                                ? 'bg-yellow-500/20 border-yellow-500/50 text-yellow-300'
                                : 'bg-red-500/20 border-red-500/50 text-red-300'
                            : 'bg-card border-border text-muted-foreground hover:border-primary/40'
                        )}
                      >
                        {tier === 'low' ? '< €200' : tier === 'medium' ? '< €800' : 'Any amount'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Emergency toggle */}
                <div className="flex items-center justify-between py-3 px-4 rounded-lg border border-border bg-card">
                  <div>
                    <p className="text-sm font-medium">Always notify me for emergencies</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Emergency requests skip auto-approval and come straight to you
                    </p>
                  </div>
                  <Switch
                    checked={policy.excludeEmergency}
                    onCheckedChange={(checked) =>
                      savePolicy({ ...policy, excludeEmergency: checked })
                    }
                  />
                </div>

                {/* Summary callout */}
                <div className="flex items-start gap-2.5 p-3.5 bg-primary/5 border border-primary/15 rounded-lg">
                  <Info className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    The agent will auto-approve requests where AI confidence ≥{' '}
                    <span className="text-foreground font-medium">
                      {Math.round(policy.minConfidence * 100)}%
                    </span>{' '}
                    and estimated cost is{' '}
                    <span className="text-foreground font-medium">
                      {policy.maxCostRange === 'low'
                        ? 'under €200'
                        : policy.maxCostRange === 'medium'
                          ? 'under €800'
                          : 'any amount'}
                    </span>
                    {policy.excludeEmergency ? ', excluding emergencies' : ''}.
                    Everything else comes to you for manual review.
                  </p>
                </div>
              </div>
            )}
          </Card>

          {/* Saved indicator */}
          {policySaved && (
            <div className="flex items-center gap-2 text-sm text-green-400 justify-end">
              <CheckCircle2 className="h-4 w-4" />
              Saved
            </div>
          )}
        </TabsContent>

        {/* Security Tab */}
        <TabsContent value="security" className="space-y-4 mt-6">
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Key className="h-5 w-5" />
              Password & Authentication
            </h3>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Current Password</Label>
                <Input type="password" />
              </div>
              <div className="space-y-2">
                <Label>New Password</Label>
                <Input type="password" />
              </div>
              <div className="space-y-2">
                <Label>Confirm New Password</Label>
                <Input type="password" />
              </div>
              <Button>Update Password</Button>
            </div>
          </Card>

          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Two-Factor Authentication
            </h3>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Add an extra layer of security to your account
              </p>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Enable 2FA</p>
                  <p className="text-sm text-muted-foreground">Require code from authenticator app</p>
                </div>
                <Switch />
              </div>
            </div>
          </Card>
        </TabsContent>

        {/* Billing Tab */}
        <TabsContent value="billing" className="space-y-4 mt-6">
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Subscription Plan
            </h3>
            <div className="space-y-4">
              <div className="p-4 bg-primary/10 rounded-lg">
                <p className="font-medium text-lg">Professional Plan</p>
                <p className="text-2xl font-bold mt-1">£49/month</p>
                <p className="text-sm text-muted-foreground mt-2">
                  Up to 20 properties • AI Assistant • Priority Support
                </p>
              </div>
              <Button variant="outline">Change Plan</Button>
            </div>
          </Card>

          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Payment Method</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-3">
                  <CreditCard className="h-5 w-5" />
                  <div>
                    <p className="font-medium">•••• •••• •••• 4242</p>
                    <p className="text-sm text-muted-foreground">Expires 12/25</p>
                  </div>
                </div>
                <Button variant="ghost" size="sm">Update</Button>
              </div>
              <Button variant="outline" className="w-full">Add Payment Method</Button>
            </div>
          </Card>
        </TabsContent>

        {/* Preferences Tab */}
        <TabsContent value="preferences" className="space-y-4 mt-6">
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Palette className="h-5 w-5" />
              Display Preferences
            </h3>
            <div className="space-y-4">
              <div>
                <Label>Date Format</Label>
                <Select defaultValue="dd/mm/yyyy">
                  <SelectTrigger className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dd/mm/yyyy">DD/MM/YYYY</SelectItem>
                    <SelectItem value="mm/dd/yyyy">MM/DD/YYYY</SelectItem>
                    <SelectItem value="yyyy-mm-dd">YYYY-MM-DD</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Currency</Label>
                <Select defaultValue="gbp">
                  <SelectTrigger className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gbp">£ GBP</SelectItem>
                    <SelectItem value="usd">$ USD</SelectItem>
                    <SelectItem value="eur">€ EUR</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Globe className="h-5 w-5" />
              Language & Region
            </h3>
            <div className="space-y-4">
              <div>
                <Label>Language</Label>
                <Select defaultValue="en">
                  <SelectTrigger className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="es">Español</SelectItem>
                    <SelectItem value="fr">Français</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Time Zone</Label>
                <Select defaultValue="london">
                  <SelectTrigger className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="london">London (GMT)</SelectItem>
                    <SelectItem value="paris">Paris (CET)</SelectItem>
                    <SelectItem value="newyork">New York (EST)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Save Button */}
      <div className="flex items-center justify-end gap-3 pt-6">
        {policySaved && (
          <span className="flex items-center gap-1.5 text-sm text-green-400">
            <CheckCircle2 className="h-4 w-4" />
            Saved
          </span>
        )}
        <Button
          onClick={handleSave}
          disabled={saving}
          className="min-w-32"
        >
          {saving ? (
            <>
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent mr-2" />
              Saving...
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              Save Changes
            </>
          )}
        </Button>
      </div>
    </div>
  );
}