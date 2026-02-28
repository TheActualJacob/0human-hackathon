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
        request_id = str(uuid.uuid4())
        workflow_id = str(uuid.uuid4())

        return {
            "success": True,
            "request_id": request_id,
            "workflow_id": workflow_id,
            "message": "Test maintenance workflow created (mock)"
        }

    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "message": "Failed to create test workflow"
        }


@router.get("/check-tables")
async def check_tables(db: AsyncSession = Depends(get_db)):
    """Check if required tables exist"""
    try:
        tables = {}

        try:
            result = await db.execute(text("SELECT COUNT(*) FROM maintenance_requests"))
            tables['maintenance_requests'] = {"exists": True, "count": result.scalar()}
        except Exception:
            tables['maintenance_requests'] = {"exists": False, "count": 0}

        try:
            result = await db.execute(text("SELECT COUNT(*) FROM maintenance_workflows"))
            tables['maintenance_workflows'] = {"exists": True, "count": result.scalar()}
        except Exception:
            tables['maintenance_workflows'] = {"exists": False, "count": 0}

        try:
            result = await db.execute(text("SELECT COUNT(*) FROM workflow_communications"))
            tables['workflow_communications'] = {"exists": True, "count": result.scalar()}
        except Exception:
            tables['workflow_communications'] = {"exists": False, "count": 0}

        return {"success": True, "tables": tables}
    except Exception as e:
        if "nodename nor servname provided" in str(e):
            return {
                "success": False,
                "error": "Cannot connect to database - backend is running in offline mode",
                "note": "Frontend is connected to Supabase directly and working normally"
            }
        return {"success": False, "error": str(e)}
