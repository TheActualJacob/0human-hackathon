'use client';

import { cn } from "@/lib/utils";
import { 
  Home, 
  DollarSign, 
  Wrench, 
  Users, 
  FileText, 
  Hammer, 
  BarChart3, 
  Settings,
  Brain
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const navigation = [
  { name: 'Dashboard', href: '/', icon: Home },
  { name: 'Rent Collection', href: '/rent', icon: DollarSign },
  { name: 'Maintenance', href: '/maintenance', icon: Wrench },
  { name: 'Tenants', href: '/tenants', icon: Users },
  { name: 'Leases', href: '/leases', icon: FileText },
  { name: 'Vendors', href: '/vendors', icon: Hammer },
  { name: 'Reports', href: '/reports', icon: BarChart3 },
  { name: 'Settings', href: '/settings', icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <div className="flex h-full w-[220px] flex-col bg-sidebar border-r border-border">
      {/* Logo */}
      <div className="flex h-16 items-center px-6 border-b border-border">
        <Brain className="h-6 w-6 text-primary mr-2" />
        <span className="text-lg font-semibold">PropAI</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-3 py-4">
        {navigation.map((item) => {
          const isActive = pathname === item.href || 
                          (item.href !== '/' && pathname.startsWith(item.href));
          
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all",
                "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                isActive && "bg-sidebar-primary text-sidebar-primary-foreground ai-glow"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.name}
            </Link>
          );
        })}
      </nav>

      {/* AI Status */}
      <div className="border-t border-border p-4">
        <div className="rounded-lg bg-sidebar-accent p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-muted-foreground">AI Agent</span>
            <div className="flex items-center">
              <div className="h-2 w-2 rounded-full bg-primary pulse-glow mr-1" />
              <span className="text-xs text-primary">Active</span>
            </div>
          </div>
          <div className="text-xs text-muted-foreground">
            Autonomy: 78%
          </div>
        </div>
      </div>
    </div>
  );
}