'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle, RefreshCw, Database, Server } from 'lucide-react';
import { checkTables } from '@/lib/api/maintenance';
import useStore from '@/lib/store/useStore';
import { cn } from '@/lib/utils';

export function DebugPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [tableStatus, setTableStatus] = useState<any>(null);
  const [checking, setChecking] = useState(false);
  const { maintenanceWorkflows, maintenanceRequests, error } = useStore();

  const checkBackendHealth = async () => {
    setChecking(true);
    try {
      const response = await checkTables();
      setTableStatus(response);
    } catch (err) {
      // Expected - backend can't connect to DB
      setTableStatus({ 
        success: false, 
        error: 'Backend running in offline mode',
        note: 'Frontend connected to Supabase directly' 
      });
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    if (isOpen && !tableStatus) {
      checkBackendHealth();
    }
  }, [isOpen]);

  if (!isOpen) {
    return (
      <Button
        onClick={() => setIsOpen(true)}
        variant="outline"
        size="sm"
        className="fixed bottom-4 right-4 z-50"
      >
        Debug
      </Button>
    );
  }

  return (
    <Card className="fixed bottom-4 right-4 z-50 w-96 max-h-[600px] overflow-y-auto p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Debug Panel</h3>
        <Button
          onClick={() => setIsOpen(false)}
          variant="ghost"
          size="sm"
        >
          ✕
        </Button>
      </div>

      {/* Backend Status */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium">Backend Status</h4>
          <Button
            onClick={checkBackendHealth}
            variant="ghost"
            size="sm"
            disabled={checking}
          >
            <RefreshCw className={cn("h-4 w-4", checking && "animate-spin")} />
          </Button>
        </div>
        
        {tableStatus && (
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              {tableStatus.success ? (
                <>
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span className="text-sm text-green-500">Backend Connected</span>
                </>
              ) : (
                <>
                  <AlertCircle className="h-4 w-4 text-red-500" />
                  <span className="text-sm text-yellow-500">
                    {tableStatus.error.includes('nodename') ? 'Backend offline (expected)' : tableStatus.error}
                  </span>
                </>
              )}
            </div>

            {tableStatus.tables && (
              <div className="mt-2 space-y-1">
                <p className="text-xs text-muted-foreground">Database Tables:</p>
                {Object.entries(tableStatus.tables).map(([table, info]: [string, any]) => (
                  <div key={table} className="flex items-center justify-between text-xs">
                    <span>{table}</span>
                    <Badge variant={info.exists ? "default" : "destructive"} className="text-xs">
                      {info.exists ? `${info.count} rows` : 'Missing'}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Store Data */}
      <div className="space-y-2">
        <h4 className="text-sm font-medium">Store Data</h4>
        <div className="space-y-1 text-xs">
          <div className="flex justify-between">
            <span>Maintenance Workflows:</span>
            <Badge variant="outline">{maintenanceWorkflows.length}</Badge>
          </div>
          <div className="flex justify-between">
            <span>Maintenance Requests:</span>
            <Badge variant="outline">{maintenanceRequests.length}</Badge>
          </div>
        </div>
      </div>

      {/* Errors */}
      {error && !error.includes('nodename nor servname provided') && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-red-500">Error</h4>
          <p className="text-xs text-red-500">{error}</p>
        </div>
      )}

      {/* Quick Actions */}
      <div className="space-y-2">
        <h4 className="text-sm font-medium">Quick Actions</h4>
        <div className="space-y-2">
          <Button
            onClick={() => window.location.reload()}
            variant="outline"
            size="sm"
            className="w-full justify-start"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Reload Page
          </Button>
          <Button
            onClick={() => useStore.getState().fetchData()}
            variant="outline"
            size="sm"
            className="w-full justify-start"
          >
            <Database className="h-4 w-4 mr-2" />
            Refresh Data
          </Button>
        </div>
      </div>

      {/* API Info */}
      <div className="space-y-1 text-xs text-muted-foreground">
        <p>Frontend: http://localhost:3000</p>
        <p>Backend: http://localhost:8001</p>
        <p>Database: Supabase</p>
      </div>
    </Card>
  );
}