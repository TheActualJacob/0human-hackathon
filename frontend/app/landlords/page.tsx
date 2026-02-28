'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, Building2, Bell, MessageCircle, ChevronRight, Filter, Mail, Phone } from 'lucide-react';
import useStore from '@/lib/store/useStore';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import type { Landlord } from '@/types';

export default function LandlordsPage() {
  const { 
    landlords, 
    units,
    landlordNotifications,
    loading 
  } = useStore();

  const [selectedLandlord, setSelectedLandlord] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

  // Get units count for each landlord
  const getUnitsCount = (landlordId: string) => {
    return units.filter(unit => unit.landlord_id === landlordId).length;
  };

  // Get unread notifications count
  const getUnreadNotificationsCount = (landlordId: string) => {
    return landlordNotifications.filter(
      n => n.landlord_id === landlordId && !n.read_at
    ).length;
  };

  // Get selected landlord details
  const selectedLandlordData = selectedLandlord 
    ? landlords.find(l => l.id === selectedLandlord)
    : null;

  // Get notifications for selected landlord
  const selectedLandlordNotifications = selectedLandlord
    ? landlordNotifications.filter(n => n.landlord_id === selectedLandlord)
    : [];

  if (loading) {
    return (
      <div className="flex-1 p-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-muted-foreground">Loading landlords...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 p-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold mb-2">Landlords</h1>
            <p className="text-muted-foreground">
              Manage property owners and their notification preferences
            </p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors"
          >
            <Plus className="h-5 w-5" />
            Add Landlord
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Landlords List */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">All Landlords</h2>
            <div className="flex items-center gap-2">
              <button className="p-2 hover:bg-accent rounded-lg transition-colors">
                <Filter className="h-4 w-4" />
              </button>
            </div>
          </div>

          {landlords.length === 0 ? (
            <div className="bg-card border border-border rounded-lg p-8 text-center">
              <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground mb-4">No landlords added yet</p>
              <button
                onClick={() => setShowAddModal(true)}
                className="text-primary hover:underline"
              >
                Add your first landlord
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {landlords.map((landlord) => {
                const unitsCount = getUnitsCount(landlord.id);
                const unreadCount = getUnreadNotificationsCount(landlord.id);
                const isSelected = selectedLandlord === landlord.id;

                return (
                  <div
                    key={landlord.id}
                    onClick={() => setSelectedLandlord(landlord.id)}
                    className={cn(
                      "bg-card border rounded-lg p-6 cursor-pointer transition-all",
                      isSelected 
                        ? "border-primary ai-glow" 
                        : "border-border hover:border-primary/50"
                    )}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-semibold">
                            {landlord.full_name}
                          </h3>
                          {unreadCount > 0 && (
                            <span className="bg-primary text-primary-foreground text-xs font-semibold px-2 py-1 rounded-full">
                              {unreadCount} new
                            </span>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-4 text-sm text-muted-foreground mb-3">
                          <span className="flex items-center gap-1">
                            <Mail className="h-3 w-3" />
                            {landlord.email}
                          </span>
                          {landlord.phone && (
                            <span className="flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              {landlord.phone}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-6">
                          <div className="flex items-center gap-2">
                            <Building2 className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm">
                              {unitsCount} {unitsCount === 1 ? 'unit' : 'units'}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <MessageCircle className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm">
                              WhatsApp {landlord.whatsapp_number ? 'enabled' : 'disabled'}
                            </span>
                          </div>
                        </div>
                      </div>

                      <ChevronRight className={cn(
                        "h-5 w-5 text-muted-foreground transition-transform",
                        isSelected && "rotate-90"
                      )} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Landlord Details / Notifications */}
        <div className="space-y-4">
          {selectedLandlordData ? (
            <>
              {/* Landlord Info */}
              <div className="bg-card border border-border rounded-lg p-6">
                <h3 className="text-lg font-semibold mb-4">
                  Landlord Details
                </h3>
                <div className="space-y-3">
                  <div>
                    <p className="text-sm text-muted-foreground">Name</p>
                    <p className="font-medium">{selectedLandlordData.full_name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Email</p>
                    <p className="font-medium">{selectedLandlordData.email}</p>
                  </div>
                  {selectedLandlordData.whatsapp_number && (
                    <div>
                      <p className="text-sm text-muted-foreground">WhatsApp</p>
                      <p className="font-medium">{selectedLandlordData.whatsapp_number}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">
                      Notification Preferences
                    </p>
                    <div className="space-y-2">
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={selectedLandlordData.notification_preferences?.email || false}
                          className="rounded"
                          readOnly
                        />
                        <span className="text-sm">Email notifications</span>
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={selectedLandlordData.notification_preferences?.whatsapp || false}
                          className="rounded"
                          readOnly
                        />
                        <span className="text-sm">WhatsApp notifications</span>
                      </label>
                    </div>
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-border">
                  <Link
                    href={`/units?landlord=${selectedLandlordData.id}`}
                    className="text-primary hover:underline text-sm"
                  >
                    View all units →
                  </Link>
                </div>
              </div>

              {/* Recent Notifications */}
              <div className="bg-card border border-border rounded-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">
                    Recent Notifications
                  </h3>
                  <Bell className="h-4 w-4 text-muted-foreground" />
                </div>
                
                {selectedLandlordNotifications.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No notifications yet
                  </p>
                ) : (
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {selectedLandlordNotifications.slice(0, 10).map((notification) => (
                      <div
                        key={notification.id}
                        className={cn(
                          "p-3 rounded-lg border transition-colors",
                          notification.read_at
                            ? "bg-card border-border"
                            : "bg-accent/50 border-primary/30"
                        )}
                      >
                        <div className="flex items-start justify-between mb-1">
                          <span className={cn(
                            "text-xs font-medium px-2 py-1 rounded",
                            notification.notification_type === 'emergency_maintenance' && "bg-red-500/20 text-red-300",
                            notification.notification_type === 'legal_notice_issued' && "bg-yellow-500/20 text-yellow-300",
                            notification.notification_type === 'payment_received' && "bg-green-500/20 text-green-300",
                            !['emergency_maintenance', 'legal_notice_issued', 'payment_received'].includes(notification.notification_type) && "bg-primary/20 text-primary"
                          )}>
                            {notification.notification_type.replace(/_/g, ' ')}
                          </span>
                          {!notification.read_at && (
                            <span className="h-2 w-2 bg-primary rounded-full animate-pulse" />
                          )}
                        </div>
                        <p className="text-sm mb-1">{notification.message}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(notification.created_at || ''), { 
                            addSuffix: true 
                          })}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="bg-card border border-border rounded-lg p-6 text-center">
              <Bell className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
                Select a landlord to view details and notifications
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Add Landlord Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-lg p-6 max-w-md w-full">
            <h2 className="text-xl font-semibold mb-4">Add New Landlord</h2>
            <form 
              onSubmit={async (e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                await useStore.getState().addLandlord({
                  full_name: formData.get('name') as string,
                  email: formData.get('email') as string,
                  phone: formData.get('phone') as string || null,
                  whatsapp_number: formData.get('whatsapp') as string || null,
                  notification_preferences: {
                    email: true,
                    whatsapp: true,
                    digest_frequency: 'daily'
                  }
                });
                setShowAddModal(false);
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-sm font-medium mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  name="name"
                  required
                  className="w-full px-3 py-2 bg-background border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="John Smith"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Email *
                </label>
                <input
                  type="email"
                  name="email"
                  required
                  className="w-full px-3 py-2 bg-background border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="john@example.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Phone
                </label>
                <input
                  type="tel"
                  name="phone"
                  className="w-full px-3 py-2 bg-background border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="+44 7900 123456"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  WhatsApp Number
                </label>
                <input
                  type="tel"
                  name="whatsapp"
                  className="w-full px-3 py-2 bg-background border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="+44 7900 123456"
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 px-4 py-2 border border-border rounded-lg hover:bg-accent transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
                >
                  Add Landlord
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}