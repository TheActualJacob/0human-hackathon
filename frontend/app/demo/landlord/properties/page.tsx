'use client';

import { useDemoStore } from '@/lib/store/demo';
import { Building2, Plus, Search, Filter, MapPin, Users, DollarSign } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export default function DemoLandlordProperties() {
  const { units } = useDemoStore();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Properties (Demo)</h1>
          <p className="text-muted-foreground">Manage your property portfolio</p>
        </div>
        <Button className="ai-glow">
          <Plus className="h-4 w-4 mr-2" />
          Add Property
        </Button>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search properties..." className="pl-9" />
        </div>
        <Button variant="outline">
          <Filter className="h-4 w-4 mr-2" />
          Filter
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {units.map((unit) => (
          <Card key={unit.id} className="overflow-hidden hover:border-primary/50 transition-all cursor-pointer">
            <div className="aspect-video bg-muted flex items-center justify-center relative">
              <Building2 className="h-12 w-12 text-muted-foreground opacity-20" />
              <Badge className={cn(
                "absolute top-3 right-3",
                unit.status === 'occupied' ? "bg-green-500/20 text-green-300" : "bg-yellow-500/20 text-yellow-300"
              )}>
                {unit.status.toUpperCase()}
              </Badge>
            </div>
            <CardContent className="p-4 space-y-4">
              <div>
                <h3 className="font-semibold text-lg">{unit.name}</h3>
                <div className="flex items-center text-sm text-muted-foreground mt-1">
                  <MapPin className="h-3 w-3 mr-1" />
                  {unit.address}
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4 pt-2 border-t text-sm">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" />
                  <span>{unit.status === 'occupied' ? '1 Tenant' : 'Vacant'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-primary" />
                  <span>${unit.rent_amount.toLocaleString()}/mo</span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
