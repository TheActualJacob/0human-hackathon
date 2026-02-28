"""
Maintenance Workflow Engine - Strict Finite State Machine
"""
from typing import Dict, Any, Optional, List, Tuple
from datetime import datetime
from enum import Enum
import asyncio
from app.database import get_db
from app.services.claude_service import ClaudeService
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
import json

class WorkflowState(str, Enum):
    """Workflow states - must match database enum values."""
    SUBMITTED = "SUBMITTED"
    OWNER_NOTIFIED = "OWNER_NOTIFIED"
    OWNER_RESPONDED = "OWNER_RESPONDED"
    DECISION_MADE = "DECISION_MADE"
    VENDOR_CONTACTED = "VENDOR_CONTACTED"
    AWAITING_VENDOR_RESPONSE = "AWAITING_VENDOR_RESPONSE"
    ETA_CONFIRMED = "ETA_CONFIRMED"
    TENANT_NOTIFIED = "TENANT_NOTIFIED"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"
    CLOSED_DENIED = "CLOSED_DENIED"

class WorkflowTransition:
    """Defines valid state transitions and their conditions."""
    
    # Map of current state to valid next states
    TRANSITIONS: Dict[WorkflowState, List[WorkflowState]] = {
        WorkflowState.SUBMITTED: [WorkflowState.OWNER_NOTIFIED],
        WorkflowState.OWNER_NOTIFIED: [WorkflowState.OWNER_RESPONDED],
        WorkflowState.OWNER_RESPONDED: [WorkflowState.DECISION_MADE, WorkflowState.CLOSED_DENIED],
        WorkflowState.DECISION_MADE: [WorkflowState.VENDOR_CONTACTED, WorkflowState.COMPLETED],
        WorkflowState.VENDOR_CONTACTED: [WorkflowState.AWAITING_VENDOR_RESPONSE],
        WorkflowState.AWAITING_VENDOR_RESPONSE: [WorkflowState.ETA_CONFIRMED],
        WorkflowState.ETA_CONFIRMED: [WorkflowState.TENANT_NOTIFIED],
        WorkflowState.TENANT_NOTIFIED: [WorkflowState.IN_PROGRESS],
        WorkflowState.IN_PROGRESS: [WorkflowState.COMPLETED],
        WorkflowState.COMPLETED: [],  # Terminal state
        WorkflowState.CLOSED_DENIED: []  # Terminal state
    }
    
    @classmethod
    def can_transition(cls, from_state: WorkflowState, to_state: WorkflowState) -> bool:
        """Check if transition is valid."""
        valid_next_states = cls.TRANSITIONS.get(from_state, [])
        return to_state in valid_next_states

class MaintenanceWorkflowEngine:
    """
    Strict finite-state workflow engine for maintenance requests.
    Enforces valid transitions and triggers appropriate actions.
    """
    
    def __init__(self, db_session: AsyncSession, claude_service: Optional[ClaudeService] = None):
        """
        Initialize workflow engine.
        
        Args:
            db_session: Database session
            claude_service: Optional Claude service instance
        """
        self.db = db_session
        self.claude = claude_service or ClaudeService()
    
    async def create_workflow(
        self, 
        maintenance_request_id: str,
        description: str,
        unit_address: Optional[str] = None,
        tenant_name: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Create a new workflow for a maintenance request.
        
        Args:
            maintenance_request_id: ID of the maintenance request
            description: Issue description
            unit_address: Optional unit address
            tenant_name: Optional tenant name
            
        Returns:
            Created workflow record
        """
        # Get AI analysis
        ai_analysis = await self.claude.analyze_maintenance_request(
            description, unit_address, tenant_name
        )
        
        # Create workflow record
        workflow = {
            'maintenance_request_id': maintenance_request_id,
            'current_state': WorkflowState.SUBMITTED,
            'ai_analysis': ai_analysis,
            'state_history': [{
                'state': WorkflowState.SUBMITTED,
                'timestamp': datetime.utcnow().isoformat(),
                'metadata': {'action': 'workflow_created'}
            }]
        }
        
        # Insert into database
        from sqlalchemy import text
        result = await self.db.execute(
            text("""
            INSERT INTO maintenance_workflows 
            (maintenance_request_id, current_state, ai_analysis, state_history)
            VALUES (:request_id, :state, :analysis, :history)
            RETURNING *
            """),
            {
                'request_id': workflow['maintenance_request_id'],
                'state': workflow['current_state'],
                'analysis': json.dumps(workflow['ai_analysis']),
                'history': json.dumps(workflow['state_history'])
            }
        )
        
        created_workflow = result.fetchone()
        
        # Automatically transition to OWNER_NOTIFIED
        await self.transition_state(
            created_workflow['id'],
            WorkflowState.OWNER_NOTIFIED,
            metadata={'action': 'automatic_notification'}
        )
        
        return created_workflow
    
    async def transition_state(
        self,
        workflow_id: str,
        new_state: WorkflowState,
        metadata: Optional[Dict[str, Any]] = None
    ) -> Tuple[bool, Optional[str]]:
        """
        Transition workflow to a new state.
        
        Args:
            workflow_id: Workflow ID
            new_state: Target state
            metadata: Optional metadata for the transition
            
        Returns:
            Tuple of (success, error_message)
        """
        # Get current workflow state
        result = await self.db.execute(
            "SELECT current_state, state_history FROM maintenance_workflows WHERE id = $1",
            workflow_id
        )
        workflow = result.fetchone()
        
        if not workflow:
            return False, "Workflow not found"
        
        current_state = WorkflowState(workflow['current_state'])
        
        # Check if transition is valid
        if not WorkflowTransition.can_transition(current_state, new_state):
            return False, f"Invalid transition from {current_state} to {new_state}"
        
        # Update state history
        state_history = json.loads(workflow['state_history'] or '[]')
        state_history.append({
            'from_state': current_state,
            'to_state': new_state,
            'timestamp': datetime.utcnow().isoformat(),
            'metadata': metadata or {}
        })
        
        # Update workflow
        await self.db.execute(
            """
            UPDATE maintenance_workflows 
            SET current_state = $1, state_history = $2, updated_at = NOW()
            WHERE id = $3
            """,
            new_state,
            json.dumps(state_history),
            workflow_id
        )
        
        # Trigger state-specific actions
        await self._trigger_state_actions(workflow_id, new_state, metadata)
        
        return True, None
    
    async def _trigger_state_actions(
        self,
        workflow_id: str,
        state: WorkflowState,
        metadata: Optional[Dict[str, Any]] = None
    ):
        """
        Trigger actions based on the new state.
        
        Args:
            workflow_id: Workflow ID
            state: New state
            metadata: Optional metadata
        """
        if state == WorkflowState.OWNER_NOTIFIED:
            await self._notify_owner(workflow_id)
            
        elif state == WorkflowState.DECISION_MADE:
            # Check if vendor is required
            workflow = await self._get_workflow(workflow_id)
            ai_analysis = json.loads(workflow['ai_analysis'])
            
            if ai_analysis.get('vendor_required', True):
                # Automatically transition to VENDOR_CONTACTED
                await self.transition_state(
                    workflow_id,
                    WorkflowState.VENDOR_CONTACTED,
                    metadata={'action': 'vendor_required'}
                )
            else:
                # Generate resolution instructions and complete
                await self._generate_resolution_instructions(workflow_id)
                await self.transition_state(
                    workflow_id,
                    WorkflowState.COMPLETED,
                    metadata={'action': 'self_resolution'}
                )
                
        elif state == WorkflowState.VENDOR_CONTACTED:
            await self._contact_vendor(workflow_id)
            # Automatically move to awaiting response
            await self.transition_state(
                workflow_id,
                WorkflowState.AWAITING_VENDOR_RESPONSE,
                metadata={'action': 'awaiting_vendor'}
            )
            
        elif state == WorkflowState.TENANT_NOTIFIED:
            await self._notify_tenant(workflow_id)
            # Automatically move to in progress
            await self.transition_state(
                workflow_id,
                WorkflowState.IN_PROGRESS,
                metadata={'action': 'work_started'}
            )
    
    async def handle_owner_response(
        self,
        workflow_id: str,
        response: str,  # 'approved', 'denied', 'question'
        message: Optional[str] = None
    ) -> Tuple[bool, Optional[str]]:
        """
        Handle owner's response to maintenance request.
        
        Args:
            workflow_id: Workflow ID
            response: Owner's response
            message: Optional message from owner
            
        Returns:
            Tuple of (success, error_message)
        """
        # Get current state
        workflow = await self._get_workflow(workflow_id)
        if not workflow:
            return False, "Workflow not found"
            
        if workflow['current_state'] != WorkflowState.OWNER_NOTIFIED:
            return False, f"Invalid state for owner response: {workflow['current_state']}"
        
        # Update workflow with owner response
        await self.db.execute(
            """
            UPDATE maintenance_workflows 
            SET owner_response = $1, owner_response_message = $2, updated_at = NOW()
            WHERE id = $3
            """,
            response,
            message,
            workflow_id
        )
        
        # Transition to OWNER_RESPONDED
        success, error = await self.transition_state(
            workflow_id,
            WorkflowState.OWNER_RESPONDED,
            metadata={'response': response, 'message': message}
        )
        
        if not success:
            return False, error
        
        # Handle based on response
        if response == 'approved':
            await self.transition_state(
                workflow_id,
                WorkflowState.DECISION_MADE,
                metadata={'action': 'approved'}
            )
        elif response == 'denied':
            await self.transition_state(
                workflow_id,
                WorkflowState.CLOSED_DENIED,
                metadata={'action': 'denied', 'reason': message}
            )
        # If 'question', stay in OWNER_RESPONDED state for follow-up
        
        return True, None
    
    async def handle_vendor_response(
        self,
        workflow_id: str,
        vendor_id: str,
        eta: datetime,
        notes: Optional[str] = None
    ) -> Tuple[bool, Optional[str]]:
        """
        Handle vendor's ETA response.
        
        Args:
            workflow_id: Workflow ID
            vendor_id: Vendor/Contractor ID
            eta: Estimated time of arrival
            notes: Optional vendor notes
            
        Returns:
            Tuple of (success, error_message)
        """
        # Get current state
        workflow = await self._get_workflow(workflow_id)
        if not workflow:
            return False, "Workflow not found"
            
        if workflow['current_state'] != WorkflowState.AWAITING_VENDOR_RESPONSE:
            return False, f"Invalid state for vendor response: {workflow['current_state']}"
        
        # Update workflow with vendor ETA
        await self.db.execute(
            """
            UPDATE maintenance_workflows 
            SET vendor_eta = $1, vendor_notes = $2, updated_at = NOW()
            WHERE id = $3
            """,
            eta,
            notes,
            workflow_id
        )
        
        # Update maintenance request with scheduled time
        await self.db.execute(
            """
            UPDATE maintenance_requests 
            SET contractor_id = $1, scheduled_at = $2
            WHERE id = (SELECT maintenance_request_id FROM maintenance_workflows WHERE id = $3)
            """,
            vendor_id,
            eta,
            workflow_id
        )
        
        # Transition to ETA_CONFIRMED
        success, error = await self.transition_state(
            workflow_id,
            WorkflowState.ETA_CONFIRMED,
            metadata={'vendor_id': vendor_id, 'eta': eta.isoformat()}
        )
        
        if success:
            # Immediately notify tenant
            await self.transition_state(
                workflow_id,
                WorkflowState.TENANT_NOTIFIED,
                metadata={'action': 'eta_notification'}
            )
        
        return success, error
    
    async def complete_repair(
        self,
        workflow_id: str,
        completion_notes: Optional[str] = None,
        actual_cost: Optional[float] = None
    ) -> Tuple[bool, Optional[str]]:
        """
        Mark repair as completed.
        
        Args:
            workflow_id: Workflow ID
            completion_notes: Optional completion notes
            actual_cost: Optional actual cost
            
        Returns:
            Tuple of (success, error_message)
        """
        # Get current state
        workflow = await self._get_workflow(workflow_id)
        if not workflow:
            return False, "Workflow not found"
            
        if workflow['current_state'] != WorkflowState.IN_PROGRESS:
            return False, f"Invalid state for completion: {workflow['current_state']}"
        
        # Update maintenance request
        await self.db.execute(
            """
            UPDATE maintenance_requests 
            SET status = 'completed', completed_at = NOW(), cost = $1
            WHERE id = (SELECT maintenance_request_id FROM maintenance_workflows WHERE id = $2)
            """,
            actual_cost,
            workflow_id
        )
        
        # Transition to COMPLETED
        return await self.transition_state(
            workflow_id,
            WorkflowState.COMPLETED,
            metadata={'notes': completion_notes, 'cost': actual_cost}
        )
    
    async def _get_workflow(self, workflow_id: str) -> Optional[Dict[str, Any]]:
        """Get workflow by ID."""
        result = await self.db.execute(
            "SELECT * FROM maintenance_workflows WHERE id = $1",
            workflow_id
        )
        return result.fetchone()
    
    async def _notify_owner(self, workflow_id: str):
        """Send notification to property owner."""
        # This would integrate with notification service
        # For now, just log the communication
        await self._add_communication(
            workflow_id,
            'system',
            'Maintenance request submitted. Owner has been notified for approval.'
        )
    
    async def _contact_vendor(self, workflow_id: str):
        """Contact vendor with AI-generated message."""
        workflow = await self._get_workflow(workflow_id)
        
        # Get maintenance request details
        result = await self.db.execute(
            """
            SELECT mr.*, l.*, u.*, t.full_name as tenant_name
            FROM maintenance_workflows mw
            JOIN maintenance_requests mr ON mw.maintenance_request_id = mr.id
            JOIN leases l ON mr.lease_id = l.id
            JOIN units u ON l.unit_id = u.id
            LEFT JOIN tenants t ON t.lease_id = l.id AND t.is_primary_tenant = true
            WHERE mw.id = $1
            """,
            workflow_id
        )
        details = result.fetchone()
        
        # Generate vendor message
        ai_analysis = json.loads(workflow['ai_analysis'])
        vendor_message = await self.claude.generate_vendor_message(
            vendor_name="Contractor",  # This would be from selected vendor
            issue_description=details['description'],
            urgency=ai_analysis['urgency'],
            unit_address=f"{details['unit_identifier']}, {details['address']}",
            tenant_name=details['tenant_name']
        )
        
        # Update workflow with vendor message
        await self.db.execute(
            """
            UPDATE maintenance_workflows 
            SET vendor_message = $1, updated_at = NOW()
            WHERE id = $2
            """,
            vendor_message,
            workflow_id
        )
        
        # Log communication
        await self._add_communication(
            workflow_id,
            'system',
            f'Vendor contacted with message: {vendor_message}'
        )
    
    async def _notify_tenant(self, workflow_id: str):
        """Notify tenant of vendor ETA."""
        workflow = await self._get_workflow(workflow_id)
        
        message = f"Good news! A contractor has been scheduled for your maintenance request. "
        if workflow['vendor_eta']:
            eta = datetime.fromisoformat(workflow['vendor_eta'])
            message += f"They will arrive on {eta.strftime('%B %d at %I:%M %p')}."
        
        await self._add_communication(
            workflow_id,
            'system',
            message
        )
    
    async def _generate_resolution_instructions(self, workflow_id: str):
        """Generate self-resolution instructions when no vendor needed."""
        await self._add_communication(
            workflow_id,
            'system',
            'Based on the issue description, this can be resolved without a contractor. '
            'Instructions have been sent to the tenant.'
        )
    
    async def _add_communication(
        self,
        workflow_id: str,
        sender_type: str,
        message: str,
        sender_id: Optional[str] = None,
        sender_name: Optional[str] = None
    ):
        """Add communication to workflow."""
        await self.db.execute(
            """
            INSERT INTO workflow_communications 
            (workflow_id, sender_type, sender_id, sender_name, message)
            VALUES ($1, $2, $3, $4, $5)
            """,
            workflow_id,
            sender_type,
            sender_id,
            sender_name or 'System',
            message
        )

    async def get_workflow_status(self, workflow_id: str) -> Dict[str, Any]:
        """
        Get complete workflow status including communications and state history.
        
        Args:
            workflow_id: Workflow ID
            
        Returns:
            Complete workflow status
        """
        # Get workflow
        workflow = await self._get_workflow(workflow_id)
        if not workflow:
            return {'error': 'Workflow not found'}
        
        # Get communications
        result = await self.db.execute(
            """
            SELECT * FROM workflow_communications 
            WHERE workflow_id = $1 
            ORDER BY created_at ASC
            """,
            workflow_id
        )
        communications = result.fetchall()
        
        # Get vendor bids if any
        result = await self.db.execute(
            """
            SELECT vb.*, c.name as contractor_name
            FROM vendor_bids vb
            JOIN contractors c ON vb.contractor_id = c.id
            WHERE vb.workflow_id = $1
            ORDER BY vb.created_at DESC
            """,
            workflow_id
        )
        vendor_bids = result.fetchall()
        
        return {
            'workflow': workflow,
            'communications': communications,
            'vendor_bids': vendor_bids,
            'state_history': json.loads(workflow['state_history'] or '[]'),
            'ai_analysis': json.loads(workflow['ai_analysis'] or '{}')
        }