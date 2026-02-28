import { create } from 'zustand';
import { 
  MOCK_LANDLORD, 
  MOCK_UNITS, 
  MOCK_TENANTS, 
  MOCK_LEASES, 
  MOCK_MAINTENANCE_REQUESTS, 
  MOCK_PAYMENTS, 
  MOCK_CONTRACTORS 
} from '../mock-data';

// Simplified types for the demo
export type DemoState = {
  landlord: any;
  units: any[];
  tenants: any[];
  leases: any[];
  maintenanceRequests: any[];
  payments: any[];
  contractors: any[];
  loading: boolean;
  error: string | null;
  
  // Actions
  initialize: () => void;
  addUnit: (unit: any) => void;
  updateMaintenanceStatus: (id: string, status: string) => void;
  addMaintenanceRequest: (request: any) => void;
};

export const useDemoStore = create<DemoState>((set, get) => ({
  landlord: MOCK_LANDLORD,
  units: [],
  tenants: [],
  leases: [],
  maintenanceRequests: [],
  payments: [],
  contractors: [],
  loading: false,
  error: null,

  initialize: () => {
    set({
      landlord: MOCK_LANDLORD,
      units: MOCK_UNITS,
      tenants: MOCK_TENANTS,
      leases: MOCK_LEASES,
      maintenanceRequests: MOCK_MAINTENANCE_REQUESTS,
      payments: MOCK_PAYMENTS,
      contractors: MOCK_CONTRACTORS,
    });
  },

  addUnit: (unit: any) => {
    const newUnit = {
      ...unit,
      id: `unit-${Math.random().toString(36).substr(2, 9)}`,
      created_at: new Date().toISOString(),
      landlord_id: MOCK_LANDLORD.id,
      status: 'vacant',
    };
    set((state) => ({ units: [newUnit, ...state.units] }));
  },

  updateMaintenanceStatus: (id: string, status: string) => {
    set((state) => ({
      maintenanceRequests: state.maintenanceRequests.map((req) =>
        req.id === id ? { ...req, status } : req
      ),
    }));
  },

  addMaintenanceRequest: (request: any) => {
    const newRequest = {
      ...request,
      id: `req-${Math.random().toString(36).substr(2, 9)}`,
      created_at: new Date().toISOString(),
      status: 'SUBMITTED',
    };
    set((state) => ({
      maintenanceRequests: [newRequest, ...state.maintenanceRequests],
    }));
  },
}));
