'use client';

import { cn } from "@/lib/utils";
import { 
  Brain, LayoutDashboard, Building2, Users, FileText, 
  DollarSign, Wrench, UserCircle, Settings, Home, FolderOpen, User
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import useStore from "@/lib/store/useStore";

type NavItem = {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
};

type SidebarProps = {
  userRole: 'landlord' | 'tenant';
};

const landlordNavItems: NavItem[] = [
  {
    title: "Dashboard",
    href: "/landlord/dashboard",
    icon: LayoutDashboard,
  },
  {
    title: "Properties",
    href: "/landlord/properties",
    icon: Building2,
  },
  {
    title: "Tenants",
    href: "/landlord/tenants",
    icon: Users,
  },
  {
    title: "Leases",
    href: "/landlord/leases",
    icon: FileText,
  },
  {
    title: "Payments",
    href: "/landlord/payments",
    icon: DollarSign,
  },
  {
    title: "Maintenance",
    href: "/landlord/maintenance",
    icon: Wrench,
  },
  {
    title: "Contractors",
    href: "/landlord/contractors",
    icon: UserCircle,
  },
  {
    title: "Settings",
    href: "/landlord/settings",
    icon: Settings,
  },
];

const tenantNavItems: NavItem[] = [
  {
    title: "Dashboard",
    href: "/tenant/dashboard",
    icon: LayoutDashboard,
  },
  {
    title: "My Lease",
    href: "/tenant/my-lease",
    icon: FileText,
  },
  {
    title: "Payments",
    href: "/tenant/payments",
    icon: DollarSign,
  },
  {
    title: "Maintenance",
    href: "/tenant/maintenance",
    icon: Wrench,
  },
  {
    title: "Documents",
    href: "/tenant/documents",
    icon: FolderOpen,
  },
  {
    title: "Profile",
    href: "/tenant/profile",
    icon: User,
  },
];

export default function Sidebar({ userRole }: SidebarProps) {
  const pathname = usePathname();
  const { agentMode, autonomyLevel } = useStore();
  
  const navigation = userRole === 'landlord' ? landlordNavItems : tenantNavItems;

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
              key={item.title}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all",
                "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                isActive && "bg-sidebar-primary text-sidebar-primary-foreground ai-glow"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.title}
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