import { Shield, AlertTriangle, CheckCircle, XCircle, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, differenceInDays } from 'date-fns';
import type { UnitDocument } from '@/types';

interface CertificateStatusProps {
  documents: UnitDocument[];
  compact?: boolean;
  className?: string;
}

const CERTIFICATE_TYPES = [
  { key: 'gas_safety', label: 'Gas Safety', icon: '🔥', required: true },
  { key: 'epc', label: 'EPC', icon: '⚡', required: true },
  { key: 'electrical_cert', label: 'Electrical', icon: '🔌', required: true },
  { key: 'fire_risk', label: 'Fire Risk', icon: '🚨', required: false },
  { key: 'asbestos', label: 'Asbestos', icon: '☢️', required: false },
  { key: 'hmo_licence', label: 'HMO Licence', icon: '🏠', required: false },
];

export default function CertificateStatus({ 
  documents, 
  compact = false,
  className 
}: CertificateStatusProps) {
  // Group documents by type
  const documentsByType = documents.reduce((acc, doc) => {
    acc[doc.document_type] = doc;
    return acc;
  }, {} as Record<string, UnitDocument>);

  // Calculate overall compliance status
  const requiredCerts = CERTIFICATE_TYPES.filter(cert => cert.required);
  const hasAllRequired = requiredCerts.every(cert => 
    documentsByType[cert.key] && documentsByType[cert.key].status !== 'expired'
  );
  const hasExpired = documents.some(doc => doc.status === 'expired');
  const hasExpiringSoon = documents.some(doc => doc.status === 'expiring_soon');

  const getOverallStatus = () => {
    if (hasExpired || !hasAllRequired) return 'critical';
    if (hasExpiringSoon) return 'warning';
    return 'compliant';
  };

  const overallStatus = getOverallStatus();

  const getStatusIcon = (status?: string | null, hasDocument?: boolean) => {
    if (!hasDocument) return <XCircle className="h-4 w-4 text-gray-400" />;
    switch (status) {
      case 'valid':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'expiring_soon':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'expired':
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      default:
        return <XCircle className="h-4 w-4 text-gray-400" />;
    }
  };

  const getDaysUntilExpiry = (expiryDate?: string | null) => {
    if (!expiryDate) return null;
    return differenceInDays(new Date(expiryDate), new Date());
  };

  if (compact) {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <Shield className={cn(
          "h-5 w-5",
          overallStatus === 'compliant' && "text-green-500",
          overallStatus === 'warning' && "text-yellow-500",
          overallStatus === 'critical' && "text-red-500"
        )} />
        <div>
          <p className={cn(
            "text-sm font-medium",
            overallStatus === 'compliant' && "text-green-500",
            overallStatus === 'warning' && "text-yellow-500",
            overallStatus === 'critical' && "text-red-500"
          )}>
            {overallStatus === 'compliant' && 'Fully Compliant'}
            {overallStatus === 'warning' && 'Certificates Expiring'}
            {overallStatus === 'critical' && 'Non-Compliant'}
          </p>
          {hasExpired && (
            <p className="text-xs text-red-500">
              {documents.filter(d => d.status === 'expired').length} expired
            </p>
          )}
          {hasExpiringSoon && !hasExpired && (
            <p className="text-xs text-yellow-500">
              {documents.filter(d => d.status === 'expiring_soon').length} expiring soon
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={cn("bg-card border border-border rounded-lg p-6", className)}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Compliance Status</h3>
        <div className={cn(
          "px-3 py-1 rounded-full text-sm font-medium",
          overallStatus === 'compliant' && "bg-green-500/20 text-green-500",
          overallStatus === 'warning' && "bg-yellow-500/20 text-yellow-500",
          overallStatus === 'critical' && "bg-red-500/20 text-red-500"
        )}>
          {overallStatus === 'compliant' && 'Compliant'}
          {overallStatus === 'warning' && 'Action Needed'}
          {overallStatus === 'critical' && 'Critical'}
        </div>
      </div>

      <div className="space-y-3">
        {CERTIFICATE_TYPES.map(cert => {
          const doc = documentsByType[cert.key];
          const daysUntilExpiry = doc ? getDaysUntilExpiry(doc.expiry_date) : null;
          
          return (
            <div 
              key={cert.key}
              className={cn(
                "flex items-center justify-between p-3 rounded-lg",
                doc?.status === 'valid' && "bg-green-500/10",
                doc?.status === 'expiring_soon' && "bg-yellow-500/10",
                (!doc || doc.status === 'expired') && "bg-red-500/10"
              )}
            >
              <div className="flex items-center gap-3">
                <span className="text-xl">{cert.icon}</span>
                <div>
                  <p className="font-medium text-sm">
                    {cert.label}
                    {cert.required && (
                      <span className="text-xs text-muted-foreground ml-1">(Required)</span>
                    )}
                  </p>
                  {doc && doc.expiry_date && (
                    <p className="text-xs text-muted-foreground">
                      {doc.status === 'expired' ? 'Expired' : 'Expires'} {format(new Date(doc.expiry_date), 'MMM d, yyyy')}
                      {daysUntilExpiry !== null && daysUntilExpiry > 0 && (
                        <span className={cn(
                          "ml-1",
                          daysUntilExpiry <= 30 && "text-yellow-500"
                        )}>
                          ({daysUntilExpiry} days)
                        </span>
                      )}
                    </p>
                  )}
                  {!doc && (
                    <p className="text-xs text-red-500">Not uploaded</p>
                  )}
                </div>
              </div>
              
              {getStatusIcon(doc?.status, !!doc)}
            </div>
          );
        })}
      </div>

      {/* Summary */}
      {!hasAllRequired && (
        <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
          <p className="text-sm text-red-500 font-medium mb-1">
            Missing Required Certificates
          </p>
          <p className="text-xs text-red-400">
            Upload missing certificates to ensure legal compliance
          </p>
        </div>
      )}
    </div>
  );
}