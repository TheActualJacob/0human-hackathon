"""
Maintenance Workflow API Endpoints
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from typing import Dict, Any, Optional, List
from datetime import datetime
from pydantic import BaseModel, Field
from app.database import get_db
from app.services.workflow_engine import MaintenanceWorkflowEngine, WorkflowState
from app.services.claude_service import ClaudeService
import json
import uuid

router = APIRouter(prefix="/api/maintenance", tags=["maintenance-workflow"])

# Pydantic models for request/response

class MaintenanceSubmission(BaseModel):
    """Model for submitting a new maintenance request."""
    lease_id: str
    description: str
    unit_address: Optional[str] = None
    tenant_name: Optional[str] = None

class OwnerResponse(BaseModel):
    """Model for owner's response to maintenance request."""
    response: str = Field(..., pattern="^(approved|denied|question)$")
    message: Optional[str] = None

class VendorResponse(BaseModel):
    """Model for vendor's ETA response."""
    vendor_id: str
    eta: datetime
    notes: Optional[str] = None

class WorkflowComplete(BaseModel):
    """Model for completing a workflow."""
    completion_notes: Optional[str] = None
    actual_cost: Optional[float] = None

class WorkflowStatusResponse(BaseModel):
    """Response model for workflow status."""
    workflow: Dict[str, Any]
    communications: List[Dict[str, Any]]
    vendor_bids: List[Dict[str, Any]]
    state_history: List[Dict[str, Any]]
    ai_analysis: Dict[str, Any]

# Initialize services
claude_service = ClaudeService()

@router.post("/submit", response_model=Dict[str, Any])
async def submit_maintenance_request(
    submission: MaintenanceSubmission,
    db: AsyncSession = Depends(get_db)
):
    """
    Submit a new maintenance request and start workflow.
    
    This endpoint:
    1. Creates a maintenance request
    2. Initializes workflow with AI analysis
    3. Automatically notifies the owner
    """
    try:
        # Create maintenance request
        request_id = str(uuid.uuid4())
        
        await db.execute(
            text("""
            INSERT INTO maintenance_requests 
            (id, lease_id, description, category, urgency, status)
            VALUES (:id, :lease_id, :description, :category, :urgency, :status)
            """),
            {
                "id": request_id,
                "lease_id": submission.lease_id,
                "description": submission.description,
                "category": 'other',  # Will be updated by AI
                "urgency": 'routine',  # Will be updated by AI
                "status": 'open'
            }
        )
        
        # Initialize workflow engine
        engine = MaintenanceWorkflowEngine(db, claude_service)
        
        # Create workflow with AI analysis
        workflow = await engine.create_workflow(
            maintenance_request_id=request_id,
            description=submission.description,
            unit_address=submission.unit_address,
            tenant_name=submission.tenant_name
        )
        
        # Update maintenance request with AI analysis
        ai_analysis = json.loads(workflow['ai_analysis'])
        await db.execute(
            """
            UPDATE maintenance_requests 
            SET category = $1, urgency = $2, updated_at = NOW()
            WHERE id = $3
            """,
            ai_analysis['category'],
            ai_analysis['urgency'],
            request_id
        )
        
        # Add initial tenant communication
        await db.execute(
            """
            INSERT INTO workflow_communications 
            (workflow_id, sender_type, sender_name, message)
            VALUES ($1, $2, $3, $4)
            """,
            workflow['id'],
            'tenant',
            submission.tenant_name or 'Tenant',
            submission.description
        )
        
        await db.commit()
        
        return {
            'success': True,
            'maintenance_request_id': request_id,
            'workflow_id': workflow['id'],
            'current_state': workflow['current_state'],
            'ai_analysis': ai_analysis
        }
        
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error creating maintenance workflow: {str(e)}"
        )

@router.post("/{workflow_id}/owner-response")
async def handle_owner_response(
    workflow_id: str,
    response: OwnerResponse,
    db: AsyncSession = Depends(get_db)
):
    """
    Handle owner's response (approve/deny/question).
    """
    try:
        engine = MaintenanceWorkflowEngine(db, claude_service)
        
        # Add owner communication
        await db.execute(
            """
            INSERT INTO workflow_communications 
            (workflow_id, sender_type, sender_name, message)
            VALUES ($1, $2, $3, $4)
            """,
            workflow_id,
            'owner',
            'Property Owner',
            response.message or f"Request {response.response}"
        )
        
        # Handle the response
        success, error = await engine.handle_owner_response(
            workflow_id,
            response.response,
            response.message
        )
        
        if not success:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=error
            )
        
        await db.commit()
        
        # Get updated workflow status
        status = await engine.get_workflow_status(workflow_id)
        
        return {
            'success': True,
            'current_state': status['workflow']['current_state'],
            'message': f"Owner response '{response.response}' processed successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error processing owner response: {str(e)}"
        )

@router.post("/{workflow_id}/vendor-response")
async def handle_vendor_response(
    workflow_id: str,
    response: VendorResponse,
    db: AsyncSession = Depends(get_db)
):
    """
    Handle vendor's ETA response.
    """
    try:
        engine = MaintenanceWorkflowEngine(db, claude_service)
        
        # Add vendor bid
        await db.execute(
            """
            INSERT INTO vendor_bids 
            (workflow_id, contractor_id, bid_amount, estimated_completion_time, message)
            VALUES ($1, $2, $3, $4, $5)
            """,
            workflow_id,
            response.vendor_id,
            0,  # Bid amount would come from vendor
            int((response.eta - datetime.utcnow()).total_seconds() / 3600),  # Hours
            response.notes
        )
        
        # Add vendor communication
        await db.execute(
            """
            INSERT INTO workflow_communications 
            (workflow_id, sender_type, sender_id, sender_name, message)
            VALUES ($1, $2, $3, $4, $5)
            """,
            workflow_id,
            'vendor',
            response.vendor_id,
            'Contractor',
            f"ETA confirmed: {response.eta.strftime('%B %d at %I:%M %p')}"
        )
        
        # Handle the response
        success, error = await engine.handle_vendor_response(
            workflow_id,
            response.vendor_id,
            response.eta,
            response.notes
        )
        
        if not success:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=error
            )
        
        await db.commit()
        
        return {
            'success': True,
            'message': 'Vendor ETA confirmed and tenant notified'
        }
        
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error processing vendor response: {str(e)}"
        )

@router.post("/{workflow_id}/complete")
async def complete_workflow(
    workflow_id: str,
    completion: WorkflowComplete,
    db: AsyncSession = Depends(get_db)
):
    """
    Mark repair as completed.
    """
    try:
        engine = MaintenanceWorkflowEngine(db, claude_service)
        
        # Add completion communication
        await db.execute(
            """
            INSERT INTO workflow_communications 
            (workflow_id, sender_type, sender_name, message)
            VALUES ($1, $2, $3, $4)
            """,
            workflow_id,
            'system',
            'System',
            f"Repair completed. {completion.completion_notes or ''}"
        )
        
        # Complete the repair
        success, error = await engine.complete_repair(
            workflow_id,
            completion.completion_notes,
            completion.actual_cost
        )
        
        if not success:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=error
            )
        
        await db.commit()
        
        return {
            'success': True,
            'message': 'Maintenance request completed successfully'
        }
        
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error completing workflow: {str(e)}"
        )

@router.get("/{workflow_id}/status", response_model=Dict[str, Any])
async def get_workflow_status(
    workflow_id: str,
    db: AsyncSession = Depends(get_db)
):
    """
    Get complete workflow status including timeline and communications.
    """
    try:
        engine = MaintenanceWorkflowEngine(db, claude_service)
        status = await engine.get_workflow_status(workflow_id)
        
        if 'error' in status:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=status['error']
            )
        
        # Format response
        return {
            'workflow': dict(status['workflow']),
            'communications': [dict(c) for c in status['communications']],
            'vendor_bids': [dict(b) for b in status['vendor_bids']],
            'state_history': status['state_history'],
            'ai_analysis': status['ai_analysis']
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching workflow status: {str(e)}"
        )

@router.get("/workflows", response_model=List[Dict[str, Any]])
async def list_workflows(
    state: Optional[WorkflowState] = None,
    limit: int = 50,
    offset: int = 0,
    db: AsyncSession = Depends(get_db)
):
    """
    List all workflows with optional filtering.
    """
    try:
        query = """
            SELECT 
                mw.*,
                mr.description,
                mr.urgency,
                mr.category,
                l.unit_id,
                u.unit_identifier,
                t.full_name as tenant_name
            FROM maintenance_workflows mw
            JOIN maintenance_requests mr ON mw.maintenance_request_id = mr.id
            JOIN leases l ON mr.lease_id = l.id
            JOIN units u ON l.unit_id = u.id
            LEFT JOIN tenants t ON t.lease_id = l.id AND t.is_primary_tenant = true
        """
        
        params = []
        if state:
            query += " WHERE mw.current_state = $1"
            params.append(state)
        
        query += " ORDER BY mw.created_at DESC"
        query += f" LIMIT {limit} OFFSET {offset}"
        
        result = await db.execute(query, *params)
        workflows = result.fetchall()
        
        # Format response
        return [
            {
                'id': w['id'],
                'maintenance_request_id': w['maintenance_request_id'],
                'current_state': w['current_state'],
                'description': w['description'],
                'urgency': w['urgency'],
                'category': w['category'],
                'unit': w['unit_identifier'],
                'tenant': w['tenant_name'],
                'ai_analysis': json.loads(w['ai_analysis'] or '{}'),
                'owner_response': w['owner_response'],
                'vendor_eta': w['vendor_eta'],
                'created_at': w['created_at'],
                'updated_at': w['updated_at']
            }
            for w in workflows
        ]
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching workflows: {str(e)}"
        )