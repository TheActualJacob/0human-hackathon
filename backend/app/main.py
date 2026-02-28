from contextlib import asynccontextmanager

import stripe
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routes.health import router as health_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    stripe.api_key = settings.STRIPE_SECRET_KEY
    yield


app = FastAPI(title="PropAI Backend", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_router)
