import { FileText, Download, ExternalLink, Calendar, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import type { UnitDocument } from '@/types';

interface DocumentViewerProps {
  documents: UnitDocument[];
  onViewDocument?: (doc: UnitDocument) => void;
  className?: string;
}

export default function DocumentViewer({ 
  documents, 
  onViewDocument,
  className 
}: DocumentViewerProps) {
  const getDocumentIcon = (type: string) => {
    switch (type) {
      case 'gas_safety': return '🔥';
      case 'epc': return '⚡';
      case 'electrical_cert': return '🔌';
      case 'fire_risk': return '🚨';
      case 'asbestos': return '☢️';
      case 'planning_permission': return '📋';
      case 'hmo_licence': return '🏠';
      case 'inventory': return '📝';
      default: return '📄';
    }
  };

  const getStatusColor = (status?: string | null) => {
    switch (status) {
      case 'valid': return 'border-green-500/30 bg-green-500/10';
      case 'expiring_soon': return 'border-yellow-500/30 bg-yellow-500/10';
      case 'expired': return 'border-red-500/30 bg-red-500/10';
      default: return 'border-gray-500/30 bg-gray-500/10';
    }
  };

  const sortedDocuments = [...documents].sort((a, b) => {
    // Sort by status priority: expired > expiring_soon > valid
    const statusOrder = { expired: 0, expiring_soon: 1, valid: 2 };
    const aOrder = statusOrder[a.status as keyof typeof statusOrder] ?? 3;
    const bOrder = statusOrder[b.status as keyof typeof statusOrder] ?? 3;
    if (aOrder !== bOrder) return aOrder - bOrder;
    
    // Then by expiry date
    if (a.expiry_date && b.expiry_date) {
      return new Date(a.expiry_date).getTime() - new Date(b.expiry_date).getTime();
    }
    return 0;
  });

  return (
    <div className={cn("space-y-4", className)}>
      {documents.length === 0 ? (
        <div className="text-center py-8">
          <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">No documents uploaded</p>
        </div>
      ) : (
        sortedDocuments.map((doc) => (
          <div
            key={doc.id}
            className={cn(
              "rounded-lg border p-4 transition-all cursor-pointer hover:shadow-md",
              getStatusColor(doc.status),
              onViewDocument && "hover:border-primary/50"
            )}
            onClick={() => onViewDocument?.(doc)}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                <div className="text-2xl">{getDocumentIcon(doc.document_type)}</div>
                <div>
                  <h4 className="font-medium mb-1">
                    {doc.document_type.replace(/_/g, ' ').toUpperCase()}
                  </h4>
                  
                  <div className="space-y-1 text-sm text-muted-foreground">
                    {doc.issue_date && (
                      <p className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        Issued: {format(new Date(doc.issue_date), 'MMM d, yyyy')}
                      </p>
                    )}
                    {doc.expiry_date && (
                      <p className={cn(
                        "flex items-center gap-1",
                        doc.status === 'expired' && "text-red-500",
                        doc.status === 'expiring_soon' && "text-yellow-500"
                      )}>
                        {(doc.status === 'expired' || doc.status === 'expiring_soon') && (
                          <AlertCircle className="h-3 w-3" />
                        )}
                        Expires: {format(new Date(doc.expiry_date), 'MMM d, yyyy')}
                      </p>
                    )}
                  </div>

                  {doc.notes && (
                    <p className="mt-2 text-sm text-muted-foreground">{doc.notes}</p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                {doc.status === 'expired' && (
                  <span className="text-xs bg-red-500 text-white px-2 py-1 rounded font-medium">
                    EXPIRED
                  </span>
                )}
                {doc.status === 'expiring_soon' && (
                  <span className="text-xs bg-yellow-500 text-white px-2 py-1 rounded font-medium">
                    EXPIRING
                  </span>
                )}
                {doc.document_url ? (
                  <button
                    className="p-2 hover:bg-accent rounded-lg transition-colors"
                    onClick={(e) => {
                      e.stopPropagation();
                      window.open(doc.document_url!, '_blank');
                    }}
                  >
                    <ExternalLink className="h-4 w-4" />
                  </button>
                ) : (
                  <span className="text-xs text-muted-foreground">No file</span>
                )}
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
}