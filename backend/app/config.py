from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str
    SUPABASE_URL: str
    SUPABASE_SERVICE_ROLE_KEY: str
    STRIPE_SECRET_KEY: str
    STRIPE_PUBLISHABLE_KEY: str
    ANTHROPIC_API_KEY: str = ""
    TWILIO_ACCOUNT_SID: str = ""
    TWILIO_AUTH_TOKEN: str = ""
    TWILIO_WHATSAPP_NUMBER: str = ""
    APP_URL: str = ""  # public URL for Twilio signature validation (backend)
    FRONTEND_URL: str = "http://localhost:3000"  # public URL for the Next.js frontend
    GEMINI_API_KEY: str = ""  # Google Gemini API key (Imagen 3 image generation)
    INSTAGRAM_ACCESS_TOKEN: str = ""  # Instagram Graph API access token

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()
