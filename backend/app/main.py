from contextlib import asynccontextmanager

import stripe
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routes.frontend_proxy import router as frontend_proxy_router
from app.routes.health import router as health_router
from app.routes.instagram import router as instagram_router
from app.routes.lease_applications import router as lease_applications_router
from app.routes.listings import router as listings_router
from app.routes.maintenance_workflow import router as maintenance_workflow_router
from app.routes.signing import router as signing_router
from app.routes.test_workflow import router as test_workflow_router
from app.routes.whatsapp import router as whatsapp_router
from app.services.lease_expiry_service import check_expiring_leases, check_unanswered_inquiries

scheduler = AsyncIOScheduler()


@asynccontextmanager
async def lifespan(app: FastAPI):
    stripe.api_key = settings.STRIPE_SECRET_KEY

    scheduler.add_job(
        check_expiring_leases,
        "cron",
        hour=9,
        minute=0,
        id="check_expiring_leases",
        replace_existing=True,
    )
    scheduler.add_job(
        check_unanswered_inquiries,
        "cron",
        hour=9,
        minute=5,
        id="check_unanswered_inquiries",
        replace_existing=True,
    )
    scheduler.start()
    print("[Scheduler] Lease expiry cron jobs started (daily at 09:00 and 09:05)")

    yield

    scheduler.shutdown()


app = FastAPI(title="PropAI Backend", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001", "http://localhost:3002", settings.APP_URL, settings.FRONTEND_URL, "*"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=["*"],
    expose_headers=["*"],
    max_age=3600,
)

app.include_router(health_router)
app.include_router(whatsapp_router)
app.include_router(instagram_router)
app.include_router(lease_applications_router)
app.include_router(signing_router)
app.include_router(listings_router)
app.include_router(maintenance_workflow_router)
app.include_router(test_workflow_router)
app.include_router(frontend_proxy_router)
