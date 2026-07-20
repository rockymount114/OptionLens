import os

class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY', 'optionlens-session-secret-key-12345')
    JWT_SECRET_KEY = os.environ.get('JWT_SECRET_KEY', 'optionlens-jwt-secret-key-67890')
    SQLALCHEMY_DATABASE_URI = os.environ.get('DATABASE_URL', 'sqlite:///optionlens.db')
    
    # Adjust DATABASE_URL prefix if using PostgreSQL via Docker or direct connection
    if SQLALCHEMY_DATABASE_URI.startswith("postgres://"):
        SQLALCHEMY_DATABASE_URI = SQLALCHEMY_DATABASE_URI.replace("postgres://", "postgresql://", 1)
        
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    
    # Stripe Billing Configuration
    STRIPE_SECRET_KEY = os.environ.get('STRIPE_SECRET_KEY', 'sk_test_mock_secret')
    STRIPE_WEBHOOK_SECRET = os.environ.get('STRIPE_WEBHOOK_SECRET', 'whsec_mock_secret')
    
    # Plan parameters (Quotas)
    PLAN_QUOTAS = {
        'free': 10,
        'pro': 200,
        'power': -1 # Unlimited (represented as -1)
    }
