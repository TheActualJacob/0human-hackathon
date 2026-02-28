from supabase import create_client, Client

from app.config import settings

supabase: Client = create_client(
    settings.SUPABASE_URL.rstrip("/"), settings.SUPABASE_SERVICE_ROLE_KEY
)
