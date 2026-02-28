import stripe

from app.config import settings

stripe.api_key = settings.STRIPE_SECRET_KEY


def create_checkout_session(
    payment_id: str,
    amount_pence: int,
    tenant_name: str,
    unit_identifier: str,
    success_url: str,
    cancel_url: str,
) -> stripe.checkout.Session:
    return stripe.checkout.Session.create(
        payment_method_types=["card"],
        line_items=[
            {
                "price_data": {
                    "currency": "gbp",
                    "unit_amount": amount_pence,
                    "product_data": {
                        "name": f"Rent Payment - {unit_identifier}",
                        "description": f"Tenant: {tenant_name}",
                    },
                },
                "quantity": 1,
            }
        ],
        mode="payment",
        success_url=success_url,
        cancel_url=cancel_url,
        metadata={"payment_id": payment_id},
    )


def retrieve_checkout_session(session_id: str) -> stripe.checkout.Session:
    return stripe.checkout.Session.retrieve(session_id)
