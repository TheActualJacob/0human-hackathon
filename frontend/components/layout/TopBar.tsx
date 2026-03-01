'use client';

import { LogOut, User } from "lucide-react";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { cn } from "@/lib/utils";
import useStore from "@/lib/store/useStore";
import { useRouter } from 'next/navigation';
import { signOut } from '@/lib/auth/client';
import { useState } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type TopBarProps = {
  userRole: 'landlord' | 'tenant';
};

export default function TopBar({ userRole }: TopBarProps) {
  const { agentMode } = useStore();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  
  return (
    <div className="flex h-16 items-center justify-between border-b border-border bg-background px-6">
      {/* Page Title - will be filled by individual pages */}
      <div className="flex items-center gap-4">
        <h1 className="text-xl font-semibold">
          {userRole === 'landlord' ? 'Landlord Dashboard' : 'Tenant Portal'}
        </h1>
      </div>
      
      {/* Right Section */}
      <div className="flex items-center gap-6">
        {/* Agent Status Panel */}
        <div className="flex items-center gap-4 rounded-lg bg-card px-4 py-2 ai-glow">
          <div className="flex items-center gap-2">
            <div className={cn(
              "h-2 w-2 rounded-full",
              agentMode === 'active' ? "bg-primary pulse-glow" : "bg-muted"
            )} />
            <span className="text-sm font-medium">
              Agent: {agentMode.charAt(0).toUpperCase() + agentMode.slice(1)}
            </span>
          </div>
          
          {/* Escalations can be added later when you have escalation logic */}
        </div>

        {/* Theme Toggle */}
        <ThemeToggle />

        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-2 p-2 hover:bg-secondary rounded-lg transition-colors">
            <User className="h-5 w-5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel>My Account</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              onClick={() => router.push(userRole === 'landlord' ? '/landlord/settings' : '/tenant/profile')}
            >
              {userRole === 'landlord' ? 'Settings' : 'Profile'}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              onClick={async () => {
                setLoading(true);
                try {
                  await signOut();
                  // Force a hard reload to clear all states and stores
                  window.location.href = '/';
                } catch (error) {
                  console.error('Sign out error:', error);
                  // Fallback if signOut fails
                  window.location.href = '/';
                }
              }}
              className="text-destructive"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}