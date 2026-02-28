'use client';

import { cn } from "@/lib/utils";
import { 
  Brain, LayoutDashboard, Building2, Users, FileText, 
  DollarSign, Wrench, UserCircle, Settings, Home, FolderOpen, User
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";

type NavItem = {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
};

type DemoSidebarProps = {
  userRole: 'landlord' | 'tenant';
};

const landlordNavItems: NavItem[] = [
  {
    title: "Dashboard",
    href: "/demo/landlord",
    icon: LayoutDashboard,
  },
  {
    title: "Properties",
    href: "/demo/landlord/properties",
    icon: Building2,
  },
  {
    title: "Maintenance",
    href: "/demo/landlord/maintenance",
    icon: Wrench,
  },
];

const tenantNavItems: NavItem[] = [
  {
    title: "Dashboard",
    href: "/demo/tenant",
    icon: LayoutDashboard,
  },
  {
    title: "Maintenance",
    href: "/demo/tenant/maintenance",
    icon: Wrench,
  },
];

export default function DemoSidebar({ userRole }: DemoSidebarProps) {
  const pathname = usePathname();
  
  const navigation = userRole === 'landlord' ? landlordNavItems : tenantNavItems;

  return (
    <div className="flex h-full w-[220px] flex-col bg-sidebar border-r border-border">
      {/* Logo */}
      <div className="flex h-16 items-center px-6 border-b border-border">
        <Brain className="h-6 w-6 text-primary mr-2" />
        <span className="text-lg font-semibold">PropAI Demo</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-3 py-4">
        {navigation.map((item) => {
          const isActive = pathname === item.href;
          
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

      {/* Demo Warning */}
      <div className="p-4 border-t border-border">
        <div className="bg-primary/10 rounded-lg p-3">
          <p className="text-[10px] text-primary font-medium text-center uppercase tracking-wider">
            Demo Mode Active
          </p>
          <p className="text-[10px] text-muted-foreground text-center mt-1">
            Data is not persisted
          </p>
          <Button asChild variant="link" size="sm" className="w-full text-[10px] h-auto p-0 mt-2">
            <Link href="/">Exit Demo</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
