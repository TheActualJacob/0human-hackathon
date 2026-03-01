'use client';

import { useState, useEffect } from 'react';
import {
  User, Bell, Shield, Key, Globe, Briefcase,
  MessageCircle, Phone, Save, Loader2, CheckCircle,
  AlertCircle, Home, Sparkles, Info
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import useTenantStore from '@/lib/store/tenant';
import { getCurrentUser } from '@/lib/auth/client';
import { createClient } from '@/lib/supabase/client';

// All fields stored in profile_data that auto-fill into rental applications
interface ProfileData {
  emergencyContactName: string;
  emergencyContactPhone: string;
  emergencyContactRelationship: string;
  // Application auto-fill fields
  employmentStatus: string;
  monthlyIncome: string;
  currentEmployer: string;
  employmentDuration: string;
  hasRentalHistory: string;
  currentAddress: string;
  reasonForMoving: string;
  previousLandlordContact: string;
  hasPets: string;
  petDetails: string;
  // Notification preferences
  notifWhatsapp: boolean;
  notifEmail: boolean;
  notifSms: boolean;
  notifPaymentReminders: boolean;
  notifMaintenanceUpdates: boolean;
  notifLeaseReminders: boolean;
  notifPropertyAnnouncements: boolean;
  reminderDaysBefore: string;
}

const DEFAULTS: ProfileData = {
  emergencyContactName: '',
  emergencyContactPhone: '',
  emergencyContactRelationship: '',
  employmentStatus: '',
  monthlyIncome: '',
  currentEmployer: '',
  employmentDuration: '',
  hasRentalHistory: '',
  currentAddress: '',
  reasonForMoving: '',
  previousLandlordContact: '',
  hasPets: '',
  petDetails: '',
  notifWhatsapp: true,
  notifEmail: true,
  notifSms: false,
  notifPaymentReminders: true,
  notifMaintenanceUpdates: true,
  notifLeaseReminders: true,
  notifPropertyAnnouncements: true,
  reminderDaysBefore: '3',
};

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export default function TenantSettingsPage() {
  const { tenantInfo, fetchTenantData, updateProfile, loading } = useTenantStore();

  // Core fields on the tenant record
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  // profile_data fields
  const [profileData, setProfileData] = useState<ProfileData>(DEFAULTS);

  // Password change
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');

  const [saveStatus, setSaveStatus] = useState<Record<string, SaveStatus>>({});
  const [initDone, setInitDone] = useState(false);

  // ── Load tenant data on mount ──────────────────────────────────────────────
  useEffect(() => {
    async function init() {
      // If tenant info is already in the store, use it
      if (tenantInfo) {
        populate(tenantInfo);
        setInitDone(true);
        return;
      }
      // Otherwise fetch via auth
      const user = await getCurrentUser();
      if (user?.entityId) {
        await fetchTenantData(user.entityId);
      }
      setInitDone(true);
    }
    init();
  }, []);

  // Re-populate form whenever tenantInfo loads or changes
  useEffect(() => {
    if (tenantInfo) populate(tenantInfo);
  }, [tenantInfo]);

  function populate(info: typeof tenantInfo) {
    if (!info) return;
    setFullName(info.full_name ?? '');
    setPhone(info.whatsapp_number ?? '');
    const pd = (info.profile_data ?? {}) as Record<string, any>;
    setProfileData({
      emergencyContactName: pd.emergencyContactName ?? '',
      emergencyContactPhone: pd.emergencyContactPhone ?? '',
      emergencyContactRelationship: pd.emergencyContactRelationship ?? '',
      employmentStatus: pd.employmentStatus ?? '',
      monthlyIncome: pd.monthlyIncome ?? '',
      currentEmployer: pd.currentEmployer ?? '',
      employmentDuration: pd.employmentDuration ?? '',
      hasRentalHistory: pd.hasRentalHistory ?? '',
      currentAddress: pd.currentAddress ?? '',
      reasonForMoving: pd.reasonForMoving ?? '',
      previousLandlordContact: pd.previousLandlordContact ?? '',
      hasPets: pd.hasPets ?? '',
      petDetails: pd.petDetails ?? '',
      notifWhatsapp: pd.notifWhatsapp ?? true,
      notifEmail: pd.notifEmail ?? true,
      notifSms: pd.notifSms ?? false,
      notifPaymentReminders: pd.notifPaymentReminders ?? true,
      notifMaintenanceUpdates: pd.notifMaintenanceUpdates ?? true,
      notifLeaseReminders: pd.notifLeaseReminders ?? true,
      notifPropertyAnnouncements: pd.notifPropertyAnnouncements ?? true,
      reminderDaysBefore: pd.reminderDaysBefore ?? '3',
    });
  }

  function setPD<K extends keyof ProfileData>(key: K, value: ProfileData[K]) {
    setProfileData(prev => ({ ...prev, [key]: value }));
  }

  async function save(section: string) {
    setSaveStatus(prev => ({ ...prev, [section]: 'saving' }));
    try {
      await updateProfile({
        full_name: fullName,
        whatsapp_number: phone,
        profile_data: profileData as any,
      });
      setSaveStatus(prev => ({ ...prev, [section]: 'saved' }));
      setTimeout(() => setSaveStatus(prev => ({ ...prev, [section]: 'idle' })), 2500);
    } catch {
      setSaveStatus(prev => ({ ...prev, [section]: 'error' }));
    }
  }

  async function handlePasswordChange() {
    setPasswordError('');
    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match');
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError('Password must be at least 8 characters');
      return;
    }
    setSaveStatus(prev => ({ ...prev, password: 'saving' }));
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setSaveStatus(prev => ({ ...prev, password: 'saved' }));
      setTimeout(() => setSaveStatus(prev => ({ ...prev, password: 'idle' })), 2500);
    } catch (err: any) {
      setPasswordError(err.message || 'Failed to update password');
      setSaveStatus(prev => ({ ...prev, password: 'error' }));
    }
  }

  function SaveButton({ section }: { section: string }) {
    const status = saveStatus[section] ?? 'idle';
    return (
      <Button onClick={() => save(section)} disabled={status === 'saving'} size="sm">
        {status === 'saving' && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
        {status === 'saved' && <CheckCircle className="h-4 w-4 mr-2 text-green-400" />}
        {status === 'error' && <AlertCircle className="h-4 w-4 mr-2 text-destructive" />}
        {status === 'idle' && <Save className="h-4 w-4 mr-2" />}
        {status === 'saving' ? 'Saving…' : status === 'saved' ? 'Saved' : 'Save Changes'}
      </Button>
    );
  }

  if (!initDone || loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Manage your account, profile, and preferences</p>
      </div>

      <Tabs defaultValue="profile">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="application">Application</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
        </TabsList>

        {/* ── Profile Tab ────────────────────────────────────────────────────── */}
        <TabsContent value="profile" className="space-y-4 mt-6">
          <Card className="p-6 space-y-4">
            <h3 className="text-base font-semibold flex items-center gap-2">
              <User className="h-4 w-4" />
              Personal Information
            </h3>
            <div className="space-y-2">
              <Label>Full Name</Label>
              <Input
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                placeholder="Your full name"
              />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={tenantInfo?.email ?? ''}
                disabled
                className="opacity-60"
              />
              <p className="text-xs text-muted-foreground">Email cannot be changed here. Contact support if needed.</p>
            </div>
            <div className="space-y-2">
              <Label>WhatsApp / Phone Number</Label>
              <Input
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="+44 7XXX XXXXXX"
              />
            </div>
          </Card>

          <Card className="p-6 space-y-4">
            <h3 className="text-base font-semibold flex items-center gap-2">
              <Phone className="h-4 w-4" />
              Emergency Contact
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Contact Name</Label>
                <Input
                  value={profileData.emergencyContactName}
                  onChange={e => setPD('emergencyContactName', e.target.value)}
                  placeholder="John Doe"
                />
              </div>
              <div className="space-y-2">
                <Label>Contact Phone</Label>
                <Input
                  value={profileData.emergencyContactPhone}
                  onChange={e => setPD('emergencyContactPhone', e.target.value)}
                  placeholder="+44 7XXX XXXXXX"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Relationship</Label>
              <Select
                value={profileData.emergencyContactRelationship}
                onValueChange={v => setPD('emergencyContactRelationship', v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select relationship" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="spouse">Spouse / Partner</SelectItem>
                  <SelectItem value="parent">Parent</SelectItem>
                  <SelectItem value="sibling">Sibling</SelectItem>
                  <SelectItem value="friend">Friend</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </Card>

          <div className="flex justify-end">
            <SaveButton section="profile" />
          </div>
        </TabsContent>

        {/* ── Application Profile Tab ────────────────────────────────────────── */}
        <TabsContent value="application" className="space-y-4 mt-6">
          <div className="flex items-start gap-3 px-4 py-3 rounded-lg bg-primary/10 border border-primary/20">
            <Sparkles className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-primary">Auto-fills into rental applications</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Save your details here once and they will be automatically pre-filled every time you apply for a property — no re-entering required.
              </p>
            </div>
          </div>

          <Card className="p-6 space-y-4">
            <h3 className="text-base font-semibold flex items-center gap-2">
              <Briefcase className="h-4 w-4" />
              Employment
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Employment Status</Label>
                <Select
                  value={profileData.employmentStatus}
                  onValueChange={v => setPD('employmentStatus', v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="full_time">Full-time Employed</SelectItem>
                    <SelectItem value="part_time">Part-time Employed</SelectItem>
                    <SelectItem value="self_employed">Self Employed</SelectItem>
                    <SelectItem value="student">Student</SelectItem>
                    <SelectItem value="retired">Retired</SelectItem>
                    <SelectItem value="unemployed">Unemployed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Monthly Income</Label>
                <Select
                  value={profileData.monthlyIncome}
                  onValueChange={v => setPD('monthlyIncome', v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select range" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0-1000">Under £1,000</SelectItem>
                    <SelectItem value="1000-2000">£1,000 – £2,000</SelectItem>
                    <SelectItem value="2000-3000">£2,000 – £3,000</SelectItem>
                    <SelectItem value="3000-4000">£3,000 – £4,000</SelectItem>
                    <SelectItem value="4000-5000">£4,000 – £5,000</SelectItem>
                    <SelectItem value="5000+">£5,000+</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {profileData.employmentStatus && profileData.employmentStatus !== 'unemployed' && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Current Employer</Label>
                  <Input
                    value={profileData.currentEmployer}
                    onChange={e => setPD('currentEmployer', e.target.value)}
                    placeholder="Company name"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Employment Duration</Label>
                  <Select
                    value={profileData.employmentDuration}
                    onValueChange={v => setPD('employmentDuration', v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="How long?" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="less_6_months">Less than 6 months</SelectItem>
                      <SelectItem value="6_12_months">6–12 months</SelectItem>
                      <SelectItem value="1_2_years">1–2 years</SelectItem>
                      <SelectItem value="2_5_years">2–5 years</SelectItem>
                      <SelectItem value="5_years_plus">5+ years</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </Card>

          <Card className="p-6 space-y-4">
            <h3 className="text-base font-semibold flex items-center gap-2">
              <Home className="h-4 w-4" />
              Rental History
            </h3>
            <div className="space-y-2">
              <Label>Do you have previous rental history?</Label>
              <RadioGroup
                value={profileData.hasRentalHistory}
                onValueChange={v => setPD('hasRentalHistory', v)}
                className="flex gap-6 mt-1"
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="yes" id="rh-yes" />
                  <Label htmlFor="rh-yes" className="font-normal cursor-pointer">Yes</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="no" id="rh-no" />
                  <Label htmlFor="rh-no" className="font-normal cursor-pointer">No (first-time renter)</Label>
                </div>
              </RadioGroup>
            </div>
            <div className="space-y-2">
              <Label>Current Address</Label>
              <Textarea
                value={profileData.currentAddress}
                onChange={e => setPD('currentAddress', e.target.value)}
                rows={2}
                placeholder="Your current address"
              />
            </div>
            <div className="space-y-2">
              <Label>Reason for Moving</Label>
              <Input
                value={profileData.reasonForMoving}
                onChange={e => setPD('reasonForMoving', e.target.value)}
                placeholder="e.g., Work relocation, need more space"
              />
            </div>
            {profileData.hasRentalHistory === 'yes' && (
              <div className="space-y-2">
                <Label>Previous Landlord Contact (optional)</Label>
                <Input
                  value={profileData.previousLandlordContact}
                  onChange={e => setPD('previousLandlordContact', e.target.value)}
                  placeholder="Name and phone / email"
                />
              </div>
            )}
          </Card>

          <Card className="p-6 space-y-4">
            <h3 className="text-base font-semibold">Pets</h3>
            <div className="space-y-2">
              <Label>Do you have any pets?</Label>
              <RadioGroup
                value={profileData.hasPets}
                onValueChange={v => setPD('hasPets', v)}
                className="flex gap-6 mt-1"
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="no" id="pets-no" />
                  <Label htmlFor="pets-no" className="font-normal cursor-pointer">No</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="yes" id="pets-yes" />
                  <Label htmlFor="pets-yes" className="font-normal cursor-pointer">Yes</Label>
                </div>
              </RadioGroup>
            </div>
            {profileData.hasPets === 'yes' && (
              <div className="space-y-2">
                <Label>Pet Details</Label>
                <Input
                  value={profileData.petDetails}
                  onChange={e => setPD('petDetails', e.target.value)}
                  placeholder="e.g., 1 small dog, 2 cats"
                />
              </div>
            )}
          </Card>

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Info className="h-3.5 w-3.5 flex-shrink-0" />
            Emergency contact details are saved under the Profile tab and also auto-fill into applications.
          </div>

          <div className="flex justify-end">
            <SaveButton section="application" />
          </div>
        </TabsContent>

        {/* ── Notifications Tab ──────────────────────────────────────────────── */}
        <TabsContent value="notifications" className="space-y-4 mt-6">
          <Card className="p-6 space-y-4">
            <h3 className="text-base font-semibold flex items-center gap-2">
              <MessageCircle className="h-4 w-4" />
              Communication Channels
            </h3>
            {[
              { key: 'notifWhatsapp' as const, label: 'WhatsApp', desc: 'Receive messages via WhatsApp' },
              { key: 'notifEmail' as const, label: 'Email', desc: 'Receive updates via email' },
              { key: 'notifSms' as const, label: 'SMS', desc: 'Receive SMS for urgent matters' },
            ].map(({ key, label, desc }) => (
              <div key={key} className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">{label}</p>
                  <p className="text-xs text-muted-foreground">{desc}</p>
                </div>
                <Switch
                  checked={profileData[key] as boolean}
                  onCheckedChange={v => setPD(key, v)}
                />
              </div>
            ))}
          </Card>

          <Card className="p-6 space-y-4">
            <h3 className="text-base font-semibold flex items-center gap-2">
              <Bell className="h-4 w-4" />
              Notification Types
            </h3>
            {[
              { key: 'notifPaymentReminders' as const, label: 'Payment Reminders', desc: 'Get reminded before rent is due' },
              { key: 'notifMaintenanceUpdates' as const, label: 'Maintenance Updates', desc: 'Status updates on maintenance requests' },
              { key: 'notifLeaseReminders' as const, label: 'Lease Reminders', desc: 'Notifications about lease renewal' },
              { key: 'notifPropertyAnnouncements' as const, label: 'Property Announcements', desc: 'Updates from your landlord' },
            ].map(({ key, label, desc }) => (
              <div key={key} className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">{label}</p>
                  <p className="text-xs text-muted-foreground">{desc}</p>
                </div>
                <Switch
                  checked={profileData[key] as boolean}
                  onCheckedChange={v => setPD(key, v)}
                />
              </div>
            ))}
            <div className="pt-2 border-t border-border">
              <Label className="text-sm">Payment Reminder — days in advance</Label>
              <Select
                value={profileData.reminderDaysBefore}
                onValueChange={v => setPD('reminderDaysBefore', v)}
              >
                <SelectTrigger className="mt-2 w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 day before</SelectItem>
                  <SelectItem value="3">3 days before</SelectItem>
                  <SelectItem value="7">1 week before</SelectItem>
                  <SelectItem value="14">2 weeks before</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </Card>

          <div className="flex justify-end">
            <SaveButton section="notifications" />
          </div>
        </TabsContent>

        {/* ── Security Tab ───────────────────────────────────────────────────── */}
        <TabsContent value="security" className="space-y-4 mt-6">
          <Card className="p-6 space-y-4">
            <h3 className="text-base font-semibold flex items-center gap-2">
              <Key className="h-4 w-4" />
              Change Password
            </h3>
            {passwordError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{passwordError}</AlertDescription>
              </Alert>
            )}
            {saveStatus.password === 'saved' && (
              <Alert>
                <CheckCircle className="h-4 w-4 text-green-500" />
                <AlertDescription>Password updated successfully.</AlertDescription>
              </Alert>
            )}
            <div className="space-y-2">
              <Label>New Password</Label>
              <Input
                type="password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="At least 8 characters"
              />
            </div>
            <div className="space-y-2">
              <Label>Confirm New Password</Label>
              <Input
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="Repeat new password"
              />
            </div>
            <Button
              onClick={handlePasswordChange}
              disabled={!newPassword || !confirmPassword || saveStatus.password === 'saving'}
            >
              {saveStatus.password === 'saving' ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Updating…</>
              ) : (
                <><Key className="h-4 w-4 mr-2" />Update Password</>
              )}
            </Button>
          </Card>

          <Card className="p-6 space-y-4">
            <h3 className="text-base font-semibold flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Privacy
            </h3>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-sm">Share contact with landlord</p>
                <p className="text-xs text-muted-foreground">Allow landlord to see your phone number</p>
              </div>
              <Switch defaultChecked />
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
