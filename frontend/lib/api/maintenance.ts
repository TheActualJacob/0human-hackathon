/**
 * Maintenance API client with robust error handling
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001';

export interface MaintenanceSubmission {
  lease_id: string;
  description: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export async function submitMaintenanceRequest(submission: MaintenanceSubmission): Promise<ApiResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/maintenance/submit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(submission),
    });

    const data = await response.json();
    
    if (!response.ok) {
      // API returns 500 but that's expected since backend can't connect to DB
      // Don't log as error since fallback works
      return {
        success: false,
        error: data.detail || data.message || `API error: ${response.status}`,
      };
    }

    return {
      success: true,
      data,
    };
  } catch (error: any) {
    
    // Check if backend is running
    if (error.message?.includes('Failed to fetch')) {
      return {
        success: false,
        error: 'Backend server is not running. Please start the API server on port 8001.',
      };
    }
    
    return {
      success: false,
      error: error.message || 'Unknown error occurred',
    };
  }
}

// Test endpoint for simple workflow creation
export async function createTestWorkflow(leaseId: string, description: string): Promise<ApiResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/test/simple-maintenance`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        lease_id: leaseId,
        description,
      }),
    });

    const data = await response.json();
    return data;
  } catch (error: any) {
    console.error('Test endpoint failed:', error);
    return {
      success: false,
      error: error.message,
    };
  }
}

// Check if required tables exist
export async function checkTables(): Promise<ApiResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/test/check-tables`);
    const data = await response.json();
    return data;
  } catch (error: any) {
    console.error('Table check failed:', error);
    return {
      success: false,
      error: error.message,
    };
  }
}