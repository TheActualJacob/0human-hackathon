'use client';

import { Bell, User } from "lucide-react";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import Link from 'next/link';

type DemoTopBarProps = {
  userRole: 'landlord' | 'tenant';
};

export default function DemoTopBar({ userRole }: DemoTopBarProps) {
  return (
    <div className="flex h-16 items-center justify-between border-b border-border bg-background px-6">
      <div className="flex items-center gap-4">
        <h1 className="text-xl font-semibold">
          {userRole === 'landlord' ? 'Landlord Dashboard (Demo)' : 'Tenant Portal (Demo)'}
        </h1>
      </div>
      
      <div className="flex items-center gap-6">
        <div className="px-3 py-1 bg-primary/10 rounded-full border border-primary/20">
          <span className="text-xs font-medium text-primary uppercase">Demo Mode</span>
        </div>
        
        <button className="relative p-2 hover:bg-secondary rounded-lg transition-colors">
          <Bell className="h-5 w-5" />
          <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-destructive" />
        </button>
        
        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-2 p-2 hover:bg-secondary rounded-lg transition-colors">
            <User className="h-5 w-5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel>Demo Account</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/">Exit Demo</Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
