from datetime import datetime
from werkzeug.security import generate_password_hash, check_password_hash
from app.extensions import db

class User(db.Model):
    __tablename__ = 'users'

    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(120), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(256), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    last_login_at = db.Column(db.DateTime)
    is_active = db.Column(db.Boolean, default=True)
    stripe_customer_id = db.Column(db.String(120), unique=True, nullable=True)

    # Relationships
    subscriptions = db.relationship('Subscription', backref='user', lazy=True, cascade="all, delete-orphan")
    usage_events = db.relationship('UsageEvent', backref='user', lazy=True, cascade="all, delete-orphan")
    analysis_requests = db.relationship('AnalysisRequest', backref='user', lazy=True, cascade="all, delete-orphan")

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

    def to_json(self):
        return {
            'id': self.id,
            'email': self.email,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'is_active': self.is_active,
            'stripe_customer_id': self.stripe_customer_id
        }


class Subscription(db.Model):
    __tablename__ = 'subscriptions'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    stripe_subscription_id = db.Column(db.String(120), unique=True, nullable=True)
    stripe_price_id = db.Column(db.String(120), nullable=True)
    plan_name = db.Column(db.String(50), default='free', nullable=False) # free, pro, power
    status = db.Column(db.String(50), default='active', nullable=False) # active, trialing, past_due, canceled
    current_period_end = db.Column(db.DateTime, nullable=True)
    cancel_at_period_end = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class UsageEvent(db.Model):
    __tablename__ = 'usage_events'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    event_type = db.Column(db.String(50), nullable=False) # explain, preview
    symbol = db.Column(db.String(20), nullable=True)
    strategy = db.Column(db.String(50), nullable=True)
    broker = db.Column(db.String(50), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    request_units = db.Column(db.Integer, default=1)


class AnalysisRequest(db.Model):
    __tablename__ = 'analysis_requests'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    broker = db.Column(db.String(50), nullable=True)
    source_url_hash = db.Column(db.String(64), nullable=True) # Hashed URL for privacy
    symbol = db.Column(db.String(20), nullable=True)
    strategy = db.Column(db.String(50), nullable=True)
    request_payload_json = db.Column(db.JSON, nullable=True)
    response_payload_json = db.Column(db.JSON, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)


class SupportedBroker(db.Model):
    __tablename__ = 'supported_brokers'

    id = db.Column(db.Integer, primary_key=True)
    broker_key = db.Column(db.String(50), unique=True, nullable=False)
    display_name = db.Column(db.String(100), nullable=False)
    is_enabled = db.Column(db.Boolean, default=True)
    parser_version = db.Column(db.String(20), default='1.0.0')
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
