import uuid
from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, Numeric, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


class Landlord(Base):
    __tablename__ = "landlords"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    full_name: Mapped[str] = mapped_column(Text, nullable=False)
    email: Mapped[str] = mapped_column(Text, unique=True, nullable=False)
    phone: Mapped[str | None] = mapped_column(Text)
    whatsapp_number: Mapped[str | None] = mapped_column(Text)
    notification_preferences: Mapped[dict | None] = mapped_column(JSONB)
    created_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    units: Mapped[list["Unit"]] = relationship(back_populates="landlord")


class Unit(Base):
    __tablename__ = "units"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    landlord_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("landlords.id"), nullable=False)
    unit_identifier: Mapped[str] = mapped_column(Text, nullable=False)
    address: Mapped[str] = mapped_column(Text, nullable=False)
    city: Mapped[str] = mapped_column(Text, nullable=False)
    country: Mapped[str] = mapped_column(Text, default="GB")
    jurisdiction: Mapped[str] = mapped_column(Text, default="england_wales")
    created_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    landlord: Mapped["Landlord"] = relationship(back_populates="units")
    leases: Mapped[list["Lease"]] = relationship(back_populates="unit")


class Lease(Base):
    __tablename__ = "leases"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    unit_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("units.id"), nullable=False)
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date | None] = mapped_column(Date)
    monthly_rent: Mapped[float] = mapped_column(Numeric, nullable=False)
    deposit_amount: Mapped[float | None] = mapped_column(Numeric)
    deposit_held: Mapped[float | None] = mapped_column(Numeric)
    deposit_scheme: Mapped[str | None] = mapped_column(Text)
    notice_period_days: Mapped[int | None] = mapped_column(Integer, default=30)
    status: Mapped[str] = mapped_column(Text, default="active")
    lease_document_url: Mapped[str | None] = mapped_column(Text)
    special_terms: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    unit: Mapped["Unit"] = relationship(back_populates="leases")
    tenants: Mapped[list["Tenant"]] = relationship(back_populates="lease")
    payments: Mapped[list["Payment"]] = relationship(back_populates="lease")
    payment_plans: Mapped[list["PaymentPlan"]] = relationship(back_populates="lease")


class Tenant(Base):
    __tablename__ = "tenants"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    lease_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("leases.id"), nullable=False)
    full_name: Mapped[str] = mapped_column(Text, nullable=False)
    email: Mapped[str | None] = mapped_column(Text)
    whatsapp_number: Mapped[str] = mapped_column(Text, unique=True, nullable=False)
    id_document_url: Mapped[str | None] = mapped_column(Text)
    is_primary_tenant: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    lease: Mapped["Lease"] = relationship(back_populates="tenants")


class Payment(Base):
    __tablename__ = "payments"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    lease_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("leases.id"), nullable=False)
    amount_due: Mapped[float] = mapped_column(Numeric, nullable=False)
    amount_paid: Mapped[float | None] = mapped_column(Numeric, default=0)
    due_date: Mapped[date] = mapped_column(Date, nullable=False)
    paid_date: Mapped[date | None] = mapped_column(Date)
    status: Mapped[str] = mapped_column(Text, default="pending")
    payment_method: Mapped[str | None] = mapped_column(Text)
    notes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    lease: Mapped["Lease"] = relationship(back_populates="payments")


class PaymentPlan(Base):
    __tablename__ = "payment_plans"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    lease_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("leases.id"), nullable=False)
    total_arrears: Mapped[float] = mapped_column(Numeric, nullable=False)
    installment_amount: Mapped[float] = mapped_column(Numeric, nullable=False)
    installment_frequency: Mapped[str] = mapped_column(Text, default="monthly")
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date | None] = mapped_column(Date)
    status: Mapped[str] = mapped_column(Text, default="active")
    agreed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    document_url: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    lease: Mapped["Lease"] = relationship(back_populates="payment_plans")


class Conversation(Base):
    __tablename__ = "conversations"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    lease_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("leases.id"), nullable=False)
    direction: Mapped[str] = mapped_column(Text, nullable=False)
    message_body: Mapped[str] = mapped_column(Text, nullable=False)
    whatsapp_message_id: Mapped[str | None] = mapped_column(Text)
    intent_classification: Mapped[str | None] = mapped_column(Text)
    timestamp: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class LandlordNotification(Base):
    __tablename__ = "landlord_notifications"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    landlord_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("landlords.id"), nullable=False)
    lease_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("leases.id"))
    notification_type: Mapped[str] = mapped_column(Text, nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    related_record_type: Mapped[str | None] = mapped_column(Text)
    related_record_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    requires_signature: Mapped[bool] = mapped_column(Boolean, default=False)
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class AgentAction(Base):
    __tablename__ = "agent_actions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    lease_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("leases.id"))
    action_category: Mapped[str] = mapped_column(Text, nullable=False)
    action_description: Mapped[str] = mapped_column(Text, nullable=False)
    tools_called: Mapped[dict | None] = mapped_column(JSONB)
    input_summary: Mapped[str | None] = mapped_column(Text)
    output_summary: Mapped[str | None] = mapped_column(Text)
    confidence_score: Mapped[float | None] = mapped_column(Numeric)
    timestamp: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
