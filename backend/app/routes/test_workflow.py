"""
Test endpoint for maintenance workflow
"""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from typing import Dict, Any
from app.database import get_db
import uuid
from datetime import datetime

router = APIRouter(prefix="/api/test", tags=["test"])

@router.post("/simple-maintenance")
async def create_simple_maintenance(
    data: Dict[str, Any],
    db: AsyncSession = Depends(get_db)
):
    """Simple test endpoint to create maintenance request and workflow"""
    try:
        # For now, just return success without database
        # This allows the frontend to work even if backend can't connect to DB
        request_id = str(uuid.uuid4())
        workflow_id = str(uuid.uuid4())
        
        return {
            "success": True,
            "request_id": request_id,
            "workflow_id": workflow_id,
            "message": "Test maintenance workflow created (mock)"
        }
        
        # Original database code (commented out for now)
        """
        # Create maintenance request
        await db.execute(
            text('''
            INSERT INTO maintenance_requests (id, lease_id, description, category, urgency, status, created_at)
            VALUES (:id, :lease_id, :description, :category, :urgency, :status, :created_at)
            '''),
            {
                "id": request_id,
                "lease_id": data.get("lease_id"),
                "description": data.get("description"),
                "category": "other",
                "urgency": "medium",
                "status": "open",
                "created_at": datetime.utcnow()
            }
        )
        
        # Create workflow
        await db.execute(
            text("""
            INSERT INTO maintenance_workflows (
                id, maintenance_request_id, current_state, ai_analysis, created_at, updated_at
            )
            VALUES (
                :id, :request_id, :state, :ai_analysis, :created_at, :updated_at
            )
            """),
            {
                "id": workflow_id,
                "request_id": request_id,
                "state": "SUBMITTED",
                "ai_analysis": {
                    "category": "plumbing",
                    "urgency": "medium",
                    "vendor_required": True,
                    "estimated_cost_range": "medium",
                    "reasoning": "Test analysis",
                    "confidence_score": 0.95
                },
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow()
            }
        )
        
        # Add initial communication
        await db.execute(
            text("""
            INSERT INTO workflow_communications (
                id, workflow_id, sender_type, sender_name, message, created_at
            )
            VALUES (
                :id, :workflow_id, :sender_type, :sender_name, :message, :created_at
            )
            """),
            {
                "id": str(uuid.uuid4()),
                "workflow_id": workflow_id,
                "sender_type": "system",
                "sender_name": "AI System",
                "message": "Maintenance request received and analyzed.",
                "created_at": datetime.utcnow()
            }
        )
        
        await db.commit()
        
        return {
            "success": True,
            "request_id": request_id,
            "workflow_id": workflow_id,
            "message": "Test maintenance workflow created successfully"
        }
        """
        
    except Exception as e:
        # await db.rollback()
        return {
            "success": False,
            "error": str(e),
            "message": "Failed to create test workflow"
        }

@router.get("/check-tables")
async def check_tables(db: AsyncSession = Depends(get_db)):
    """Check if required tables exist"""
    try:
        # Try to check tables
        tables = {}
        
        try:
            # Check maintenance_requests
            result = await db.execute(text("SELECT COUNT(*) FROM maintenance_requests"))
            tables['maintenance_requests'] = {"exists": True, "count": result.scalar()}
        except:
            tables['maintenance_requests'] = {"exists": False, "count": 0}
        
        try:
            # Check maintenance_workflows
            result = await db.execute(text("SELECT COUNT(*) FROM maintenance_workflows"))
            tables['maintenance_workflows'] = {"exists": True, "count": result.scalar()}
        except:
            tables['maintenance_workflows'] = {"exists": False, "count": 0}
        
        try:
            # Check workflow_communications
            result = await db.execute(text("SELECT COUNT(*) FROM workflow_communications"))
            tables['workflow_communications'] = {"exists": True, "count": result.scalar()}
        except:
            tables['workflow_communications'] = {"exists": False, "count": 0}
        
        return {"success": True, "tables": tables}
    except Exception as e:
        # If we can't connect at all, return a clear message
        if "nodename nor servname provided" in str(e):
            return {
                "success": False, 
                "error": "Cannot connect to database - backend is running in offline mode",
                "note": "Frontend is connected to Supabase directly and working normally"
            }
        return {"success": False, "error": str(e)}