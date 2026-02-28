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
  Brain,
  Building2,
  Key,
  MessageCircle,
  Scale
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import useStore from "@/lib/store/useStore";

const navigation = [
  { name: 'Dashboard', href: '/', icon: Home },
  { name: 'Landlords', href: '/landlords', icon: Building2 },
  { name: 'Units', href: '/units', icon: Key },
  { name: 'Tenants', href: '/tenants', icon: Users },
  { name: 'Leases', href: '/leases', icon: FileText },
  { name: 'Payments', href: '/payments', icon: DollarSign },
  { name: 'Maintenance', href: '/maintenance', icon: Wrench },
  { name: 'Conversations', href: '/conversations', icon: MessageCircle },
  { name: 'Legal', href: '/legal', icon: Scale },
  { name: 'Contractors', href: '/contractors', icon: Hammer },
  { name: 'Reports', href: '/reports', icon: BarChart3 },
  { name: 'Settings', href: '/settings', icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { agentMode, autonomyLevel } = useStore();

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
              <div className={cn(
                "h-2 w-2 rounded-full mr-1",
                agentMode === 'active' ? "bg-primary pulse-glow" : 
                agentMode === 'passive' ? "bg-yellow-500" : "bg-gray-500"
              )} />
              <span className={cn(
                "text-xs",
                agentMode === 'active' ? "text-primary" :
                agentMode === 'passive' ? "text-yellow-500" : "text-gray-500"
              )}>
                {agentMode.charAt(0).toUpperCase() + agentMode.slice(1)}
              </span>
            </div>
          </div>
          <div className="text-xs text-muted-foreground">
            Autonomy: {autonomyLevel}%
          </div>
        </div>
      </div>
    </div>
  );
}