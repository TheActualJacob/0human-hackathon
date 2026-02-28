from contextlib import asynccontextmanager

import stripe
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routes.frontend_proxy import router as frontend_proxy_router
from app.routes.health import router as health_router
from app.routes.instagram import router as instagram_router
from app.routes.lease_applications import router as lease_applications_router
from app.routes.signing import router as signing_router
from app.routes.whatsapp import router as whatsapp_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    stripe.api_key = settings.STRIPE_SECRET_KEY
    yield


app = FastAPI(title="PropAI Backend", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", settings.APP_URL, settings.FRONTEND_URL],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_router)
app.include_router(whatsapp_router)
app.include_router(instagram_router)
app.include_router(lease_applications_router)
app.include_router(signing_router)
app.include_router(frontend_proxy_router)
