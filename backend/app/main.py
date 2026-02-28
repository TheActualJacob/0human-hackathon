import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routes.health import router as health_router
from app.routes.payments import router as payments_router
from app.routes.stripe import router as stripe_router
from app.routes.maintenance_workflow import router as maintenance_workflow_router
from app.routes.test_workflow import router as test_workflow_router

logging.basicConfig(level=logging.INFO)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logging.getLogger(__name__).info("PropAI Backend starting up")
    yield


app = FastAPI(title="PropAI Backend", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001", "http://localhost:3002", "*"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=["*"],
    expose_headers=["*"],
    max_age=3600,
)

app.include_router(health_router)
app.include_router(payments_router)
app.include_router(stripe_router)
app.include_router(maintenance_workflow_router)
app.include_router(test_workflow_router)
