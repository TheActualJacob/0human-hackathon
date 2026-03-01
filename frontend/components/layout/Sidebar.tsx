'use client';

import { cn } from "@/lib/utils";
import {
  Brain, LayoutDashboard, Building2, Users, FileText,
  DollarSign, Wrench, UserCircle, Settings, Home, FolderOpen, User,
  ClipboardList, MessageSquare, TrendingUp, Activity, Receipt
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
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
    title: "Applications",
    href: "/landlord/applications",
    icon: ClipboardList,
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
    title: "Revenue AI",
    href: "/landlord/revenue",
    icon: TrendingUp,
  },
  {
    title: "Predictive Maintenance",
    href: "/landlord/predictive-maintenance",
    icon: Activity,
  },
  {
    title: "Lease Renewals",
    href: "/landlord/renewals",
    icon: TrendingUp,
  },
  {
    title: "Contractors",
    href: "/landlord/contractors",
    icon: UserCircle,
  },
  {
    title: "Taxes",
    href: "/landlord/taxes",
    icon: Receipt,
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
    title: "Browse Properties",
    href: "/properties",
    icon: Home,
  },
  {
    title: "My Applications",
    href: "/tenant/applications",
    icon: ClipboardList,
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
    title: "Property Manager",
    href: "/tenant/chat",
    icon: MessageSquare,
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

    </div>
  );
}