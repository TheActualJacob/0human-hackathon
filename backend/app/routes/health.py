from fastapi import APIRouter

from app.database import supabase

router = APIRouter(tags=["health"])


@router.get("/health")
async def health_check():
    try:
        supabase.table("landlords").select("id", count="exact").limit(0).execute()
        db_status = "connected"
    except Exception as e:
        db_status = f"error: {e}"

    return {"status": "ok", "database": db_status}
