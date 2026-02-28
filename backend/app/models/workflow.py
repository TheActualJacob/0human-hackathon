"""
Workflow models for database operations
"""
from sqlalchemy import Column, String, DateTime, JSON, ForeignKey, Text, Boolean, Numeric, Integer, Enum as SQLEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.ext.declarative import declarative_base
from datetime import datetime
import enum

Base = declarative_base()

class WorkflowStateEnum(str, enum.Enum):
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

class MaintenanceWorkflow(Base):
    __tablename__ = "maintenance_workflows"
    
    id = Column(UUID, primary_key=True)
    maintenance_request_id = Column(UUID, ForeignKey("maintenance_requests.id"), unique=True, nullable=False)
    current_state = Column(SQLEnum(WorkflowStateEnum), nullable=False, default=WorkflowStateEnum.SUBMITTED)
    ai_analysis = Column(JSON, nullable=False, default={})
    owner_response = Column(String)
    owner_response_message = Column(Text)
    vendor_message = Column(Text)
    vendor_eta = Column(DateTime(timezone=True))
    vendor_notes = Column(Text)
    state_history = Column(JSON, default=[])
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow)

class WorkflowCommunication(Base):
    __tablename__ = "workflow_communications"
    
    id = Column(UUID, primary_key=True)
    workflow_id = Column(UUID, ForeignKey("maintenance_workflows.id"), nullable=False)
    sender_type = Column(String, nullable=False)
    sender_id = Column(UUID)
    sender_name = Column(Text)
    message = Column(Text, nullable=False)
    metadata = Column(JSON, default={})
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)

class VendorBid(Base):
    __tablename__ = "vendor_bids"
    
    id = Column(UUID, primary_key=True)
    workflow_id = Column(UUID, ForeignKey("maintenance_workflows.id"), nullable=False)
    contractor_id = Column(UUID, ForeignKey("contractors.id"), nullable=False)
    bid_amount = Column(Numeric, nullable=False)
    estimated_completion_time = Column(Integer)
    message = Column(Text)
    is_selected = Column(Boolean, default=False)
    ai_score = Column(Numeric)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)