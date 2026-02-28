from typing import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from supabase import create_client, Client

from app.config import settings

# Supabase client
supabase: Client = create_client(
    settings.SUPABASE_URL.rstrip("/"), settings.SUPABASE_SERVICE_ROLE_KEY
)

# SQLAlchemy async engine
engine = create_async_engine(settings.DATABASE_URL, echo=False)
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with async_session() as session:
        yield session
