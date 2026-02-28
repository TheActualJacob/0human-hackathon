'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Mail, Plus, Copy, CheckCircle, Clock, UserPlus } from 'lucide-react';
import { createPropertyInvite, getPropertyInvites } from '@/lib/property/invites';
import { getCurrentUser } from '@/lib/auth/client';
import { formatDistanceToNow } from 'date-fns';
import type { Database } from '@/lib/supabase/database.types';

type PropertyInvite = Database['public']['Tables']['property_invites']['Row'];

interface InviteManagementProps {
  unitId: string;
  unitName: string;
}

export default function InviteManagement({ unitId, unitName }: InviteManagementProps) {
  const [invites, setInvites] = useState<PropertyInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteMessage, setInviteMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [copiedLink, setCopiedLink] = useState<string | null>(null);

  useEffect(() => {
    loadInvites();
  }, [unitId]);

  const loadInvites = async () => {
    const data = await getPropertyInvites(unitId);
    setInvites(data);
    setLoading(false);
  };

  const handleSendInvite = async () => {
    if (!inviteEmail.includes('@')) return;
    
    setSending(true);
    try {
      const user = await getCurrentUser();
      if (!user) throw new Error('You must be logged in');

      const result = await createPropertyInvite({
        unitId,
        landlordId: user.entityId,
        email: inviteEmail,
        message: inviteMessage || `You've been invited to view ${unitName}.`
      });

      if (result.success) {
        await loadInvites();
        setShowInviteDialog(false);
        setInviteEmail('');
        setInviteMessage('');
        
        // Show success message and copy link
        if (result.inviteLink) {
          navigator.clipboard.writeText(result.inviteLink);
          alert(`Invitation sent! The link has been copied to your clipboard:\n${result.inviteLink}`);
        }
      } else {
        alert(result.error || 'Failed to send invitation');
      }
    } catch (error) {
      console.error('Error sending invite:', error);
      alert('Failed to send invitation');
    } finally {
      setSending(false);
    }
  };

  const copyInviteLink = (invite: PropertyInvite) => {
    const link = `${window.location.origin}/properties/${unitId}?invite=${invite.token}`;
    navigator.clipboard.writeText(link);
    setCopiedLink(invite.id);
    setTimeout(() => setCopiedLink(null), 2000);
  };

  if (loading) {
    return <div>Loading invitations...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">Private Invitations</CardTitle>
            <CardDescription>
              Manage who can view this private listing
            </CardDescription>
          </div>
          <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
            <DialogTrigger asChild>
              <Button size="sm">
                <UserPlus className="h-4 w-4 mr-2" />
                Send Invite
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Send Property Invitation</DialogTitle>
                <DialogDescription>
                  Invite someone to view this private listing
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="tenant@example.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="message">Personal Message (Optional)</Label>
                  <Input
                    id="message"
                    placeholder="Add a personal message..."
                    value={inviteMessage}
                    onChange={(e) => setInviteMessage(e.target.value)}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowInviteDialog(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleSendInvite} 
                  disabled={!inviteEmail.includes('@') || sending}
                >
                  {sending ? 'Sending...' : 'Send Invitation'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {invites.length === 0 ? (
          <div className="text-center py-4 text-muted-foreground">
            No invitations sent yet
          </div>
        ) : (
          <div className="space-y-2">
            {invites.map((invite) => (
              <div 
                key={invite.id} 
                className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">{invite.email}</p>
                    <p className="text-xs text-muted-foreground">
                      Sent {formatDistanceToNow(new Date(invite.created_at!), { addSuffix: true })}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {invite.used_at ? (
                    <Badge variant="success" className="text-xs">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Viewed
                    </Badge>
                  ) : new Date(invite.expires_at!) < new Date() ? (
                    <Badge variant="secondary" className="text-xs">
                      Expired
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-xs">
                      <Clock className="h-3 w-3 mr-1" />
                      Active
                    </Badge>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => copyInviteLink(invite)}
                  >
                    {copiedLink === invite.id ? (
                      <>
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="h-3 w-3 mr-1" />
                        Copy Link
                      </>
                    )}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}