'use client';

import { useState, useEffect } from 'react';
import { 
  Wrench, Plus, Phone, Mail, AlertCircle,
  CheckCircle, Building
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import useLandlordStore from '@/lib/store/landlord';
import useAuthStore from '@/lib/store/auth';
import { getCurrentUser } from '@/lib/auth/client';
import { cn } from '@/lib/utils';

export default function LandlordContractorsPage() {
  const { 
    contractors,
    loading,
    fetchLandlordData,
    createContractor
  } = useLandlordStore();

  const { user } = useAuthStore();

  const [searchTerm, setSearchTerm] = useState('');
  const [filterTrade, setFilterTrade] = useState<string>('all');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [selectedContractorId, setSelectedContractorId] = useState<string | null>(null);
  const [newContractor, setNewContractor] = useState({
    name: '',
    phone: '',
    email: '',
    trades: [] as string[],
    emergency_available: false,
    notes: ''
  });

  useEffect(() => {
    async function load() {
      let currentUser = user;
      if (!currentUser) {
        currentUser = await getCurrentUser();
        if (currentUser) useAuthStore.getState().setUser(currentUser);
      }
      if (currentUser?.entityId) {
        fetchLandlordData(currentUser.entityId);
      }
    }
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const allTrades = Array.from(
    new Set(contractors.flatMap(c => c.trades ?? []))
  ).sort();

  const filtered = contractors.filter(c => {
    const matchesSearch = c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         c.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         c.phone?.includes(searchTerm);
    const matchesTrade = filterTrade === 'all' || (c.trades ?? []).includes(filterTrade);
    return matchesSearch && matchesTrade;
  });

  const selectedContractor = contractors.find(c => c.id === selectedContractorId) ?? null;

  const handleAdd = async () => {
    if (!newContractor.name || !newContractor.phone) return;
    try {
      const currentUser = await getCurrentUser();
      if (!currentUser?.entityId) return;
      await createContractor({
        landlord_id: currentUser.entityId,
        name: newContractor.name,
        phone: newContractor.phone || null,
        email: newContractor.email || null,
        trades: newContractor.trades.length ? newContractor.trades : null,
        emergency_available: newContractor.emergency_available,
        notes: newContractor.notes || null
      });
      setShowAddDialog(false);
      setNewContractor({ name: '', phone: '', email: '', trades: [], emergency_available: false, notes: '' });
    } catch (err: any) {
      alert(err.message);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center space-y-4">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent" />
          <p className="text-muted-foreground">Loading contractors...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Contractors</h1>
          <p className="text-muted-foreground">Trusted vendors for property maintenance</p>
        </div>
        <Button onClick={() => setShowAddDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Contractor
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <Building className="h-8 w-8 text-primary" />
            <div>
              <p className="text-2xl font-bold">{contractors.length}</p>
              <p className="text-sm text-muted-foreground">Total Contractors</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-8 w-8 text-orange-500" />
            <div>
              <p className="text-2xl font-bold">
                {contractors.filter(c => c.emergency_available).length}
              </p>
              <p className="text-sm text-muted-foreground">Emergency Available</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <Wrench className="h-8 w-8 text-blue-500" />
            <div>
              <p className="text-2xl font-bold">{allTrades.length}</p>
              <p className="text-sm text-muted-foreground">Trade Types</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <div className="flex-1 max-w-md">
          <Input
            placeholder="Search contractors..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <Select value={filterTrade} onValueChange={setFilterTrade}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="All Trades" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Trades</SelectItem>
            {allTrades.map(trade => (
              <SelectItem key={trade} value={trade}>
                {trade.charAt(0).toUpperCase() + trade.slice(1)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.length === 0 ? (
          <div className="col-span-full text-center py-12">
            <Wrench className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground mb-2">No contractors found</p>
            <Button onClick={() => setShowAddDialog(true)} variant="outline">
              Add your first contractor
            </Button>
          </div>
        ) : (
          filtered.map(contractor => (
            <Card
              key={contractor.id}
              className={cn(
                "p-6 cursor-pointer transition-all",
                selectedContractorId === contractor.id
                  ? "border-primary"
                  : "hover:border-primary/50"
              )}
              onClick={() => setSelectedContractorId(contractor.id)}
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <h3 className="font-semibold text-lg">{contractor.name}</h3>
                  {contractor.emergency_available && (
                    <Badge className="bg-orange-500/10 text-orange-500 text-xs">Emergency</Badge>
                  )}
                </div>

                {(contractor.trades ?? []).length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {contractor.trades!.map(trade => (
                      <Badge key={trade} variant="outline" className="text-xs capitalize">
                        {trade}
                      </Badge>
                    ))}
                  </div>
                )}

                <div className="space-y-1 text-sm text-muted-foreground">
                  {contractor.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-3 w-3" />
                      <span>{contractor.phone}</span>
                    </div>
                  )}
                  {contractor.email && (
                    <div className="flex items-center gap-2">
                      <Mail className="h-3 w-3" />
                      <span className="truncate">{contractor.email}</span>
                    </div>
                  )}
                </div>

                {contractor.notes && (
                  <p className="text-xs text-muted-foreground line-clamp-2">{contractor.notes}</p>
                )}
              </div>
            </Card>
          ))
        )}
      </div>

      {/* Detail Dialog */}
      {selectedContractor && (
        <Dialog open={!!selectedContractorId} onOpenChange={() => setSelectedContractorId(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{selectedContractor.name}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Phone</p>
                  <p className="font-medium">{selectedContractor.phone || '—'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Email</p>
                  <p className="font-medium">{selectedContractor.email || '—'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Emergency</p>
                  <p className="font-medium flex items-center gap-1">
                    {selectedContractor.emergency_available
                      ? <><CheckCircle className="h-4 w-4 text-green-500" /> Available</>
                      : '—'}
                  </p>
                </div>
              </div>

              {(selectedContractor.trades ?? []).length > 0 && (
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Trades</p>
                  <div className="flex flex-wrap gap-2">
                    {selectedContractor.trades!.map(t => (
                      <Badge key={t} variant="secondary" className="capitalize">{t}</Badge>
                    ))}
                  </div>
                </div>
              )}

              {selectedContractor.notes && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Notes</p>
                  <p className="text-sm">{selectedContractor.notes}</p>
                </div>
              )}

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setSelectedContractorId(null)}>Close</Button>
                {selectedContractor.phone && (
                  <Button asChild>
                    <a href={`tel:${selectedContractor.phone}`}>
                      <Phone className="h-4 w-4 mr-2" />
                      Call
                    </a>
                  </Button>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Add Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Contractor</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input
                placeholder="ABC Plumbing Ltd"
                value={newContractor.name}
                onChange={e => setNewContractor(p => ({ ...p, name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Phone *</Label>
              <Input
                placeholder="+44 7XXX XXXXXX"
                value={newContractor.phone}
                onChange={e => setNewContractor(p => ({ ...p, phone: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                placeholder="contact@company.com"
                value={newContractor.email}
                onChange={e => setNewContractor(p => ({ ...p, email: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Trades (comma-separated)</Label>
              <Input
                placeholder="plumbing, electrical, hvac"
                onChange={e => setNewContractor(p => ({
                  ...p,
                  trades: e.target.value.split(',').map(t => t.trim()).filter(Boolean)
                }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                placeholder="Any additional notes..."
                value={newContractor.notes}
                onChange={e => setNewContractor(p => ({ ...p, notes: e.target.value }))}
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="emergency"
                checked={newContractor.emergency_available}
                onChange={e => setNewContractor(p => ({ ...p, emergency_available: e.target.checked }))}
              />
              <Label htmlFor="emergency">Available for emergencies</Label>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowAddDialog(false)}>Cancel</Button>
              <Button onClick={handleAdd} disabled={!newContractor.name || !newContractor.phone}>
                Add Contractor
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
