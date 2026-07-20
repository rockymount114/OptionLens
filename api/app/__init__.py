import os
from flask import Flask
from app.config import Config
from app.extensions import db, migrate, cors

def create_app(config_class=Config):
    app = Flask(__name__)
    app.config.from_object(config_class)

    # Initialize extensions
    db.init_app(app)
    migrate.init_app(app, db)
    cors.init_app(app, resources={r"/api/*": {"origins": "*"}})

    # Register Blueprints
    from app.routes.auth import auth_bp
    from app.routes.analysis import analysis_bp
    from app.routes.usage import usage_bp
    from app.routes.billing import billing_bp
    from app.routes.webhooks import webhooks_bp
    from app.routes.health import health_bp

    app.register_blueprint(auth_bp, url_prefix='/api/auth')
    app.register_blueprint(analysis_bp, url_prefix='/api/analysis')
    app.register_blueprint(usage_bp, url_prefix='/api/usage')
    app.register_blueprint(billing_bp, url_prefix='/api/billing')
    app.register_blueprint(webhooks_bp, url_prefix='/api/webhooks')
    app.register_blueprint(health_bp, url_prefix='/api')

    # Automatically create tables if they do not exist
    with app.app_context():
        db.create_all()
        print("[OptionLens] Database tables initialized.")

    return app
