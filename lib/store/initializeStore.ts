import useStore from './useStore';
import { mockTenants } from '../mockData/tenants';
import { mockMaintenanceTickets } from '../mockData/maintenance';
import { mockVendors } from '../mockData/vendors';
import { mockRentPayments } from '../mockData/rentPayments';
import { mockLeases } from '../mockData/leases';
import { mockActivities } from '../mockData/activities';

export const initializeStore = () => {
  const store = useStore.getState();
  
  // Only initialize if store is empty
  if (store.tenants.length === 0) {
    useStore.setState({
      tenants: mockTenants,
      tickets: mockMaintenanceTickets,
      vendors: mockVendors,
      rentPayments: mockRentPayments,
      leases: mockLeases,
      activityFeed: mockActivities
    });
  }
};