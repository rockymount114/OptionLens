import stripe
from flask import Blueprint, request, jsonify, g, redirect, current_app
from app.extensions import db
from app.models import User, Subscription
from app.utils.auth import token_required

billing_bp = Blueprint('billing', __name__, url_prefix='/billing')

PLANS = [
    {
        'id': 'price_free',
        'name': 'free',
        'display_name': 'Free Plan',
        'price': 0.00,
        'features': ['10 analyses/month', 'Covered Call + Cash-Secured Put only']
    },
    {
        'id': 'price_pro',
        'name': 'pro',
        'display_name': 'Pro Plan',
        'price': 9.99,
        'features': ['200 analyses/month', 'Scenario engine', 'History tracker']
    },
    {
        'id': 'price_power',
        'name': 'power',
        'display_name': 'Power Plan',
        'price': 19.99,
        'features': ['Unlimited analyses', 'Advanced explanations', 'Multi-broker support']
    }
]

@billing_bp.route('/plans', methods=['GET'])
def get_plans():
    return jsonify(PLANS), 200

@billing_bp.route('/create-checkout-session', methods=['POST'])
@token_required
def create_checkout_session():
    user = g.current_user
    stripe_key = current_app.config['STRIPE_SECRET_KEY']
    
    # Check if Stripe secret key is mock
    if stripe_key == 'sk_test_mock_secret' or stripe_key.startswith('sk_test_mock'):
        # Return mock checkout redirect URL
        # In a real local setup, this simulated URL redirects to our backend mock success endpoint
        mock_success_url = f"http://localhost:5000/api/billing/mock-success?user_id={user.id}&plan=pro"
        return jsonify({
            'session_id': 'mock_session_abc123',
            'url': mock_success_url,
            'message': 'Simulated Stripe session.'
        }), 200

    stripe.api_key = stripe_key
    try:
        # Create Stripe Customer if not exists
        if not user.stripe_customer_id:
            customer = stripe.Customer.create(email=user.email)
            user.stripe_customer_id = customer.id
            db.session.commit()
            
        checkout_session = stripe.checkout.Session.create(
            customer=user.stripe_customer_id,
            payment_method_types=['card'],
            line_items=[
                {
                    'price': 'price_12345_placeholder',  # In prod, read from query/env
                    'quantity': 1,
                },
            ],
            mode='subscription',
            success_url='https://example.com/success?session_id={CHECKOUT_SESSION_ID}',
            cancel_url='https://example.com/cancel',
        )
        return jsonify({
            'session_id': checkout_session.id,
            'url': checkout_session.url
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@billing_bp.route('/create-portal-session', methods=['POST'])
@token_required
def create_portal_session():
    user = g.current_user
    stripe_key = current_app.config['STRIPE_SECRET_KEY']

    if stripe_key == 'sk_test_mock_secret' or not user.stripe_customer_id:
        return jsonify({'message': 'Billing portal not available in local mock mode.'}), 200

    stripe.api_key = stripe_key
    try:
        session = stripe.billing_portal.Session.create(
            customer=user.stripe_customer_id,
            return_url='https://example.com/dashboard',
        )
        return jsonify({'url': session.url}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# Endpoint to process simulated local checkout success
@billing_bp.route('/mock-success', methods=['GET'])
def mock_success():
    user_id = request.args.get('user_id')
    plan = request.args.get('plan', 'pro')
    
    if not user_id:
        return "Missing user_id", 400
        
    user = User.query.get(user_id)
    if not user:
        return "User not found", 404
        
    # Upgrade user to selected plan
    try:
        # Deactivate old subscription
        Subscription.query.filter_by(user_id=user.id).delete()
        
        # Insert upgraded subscription
        sub = Subscription(
            user_id=user.id,
            plan_name=plan,
            status='active',
            stripe_subscription_id='sub_mock_stripe123'
        )
        db.session.add(sub)
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        return f"Database error: {str(e)}", 500

    # HTML page simulating a successful payment
    return f"""
    <html>
        <head>
            <title>Payment Successful</title>
            <style>
                body {{
                    background-color: #0f172a;
                    color: #ffffff;
                    font-family: system-ui, sans-serif;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    height: 100vh;
                    margin: 0;
                }}
                .card {{
                    background-color: #1e293b;
                    padding: 40px;
                    border-radius: 12px;
                    text-align: center;
                    box-shadow: 0 10px 25px rgba(0,0,0,0.3);
                    border: 1px solid rgba(255,255,255,0.08);
                }}
                h1 {{ color: #10b981; margin-bottom: 10px; }}
                p {{ color: #94a3b8; font-size: 15px; margin-bottom: 24px; }}
                .badge {{
                    background: linear-gradient(135deg, #6366f1 0%, #a855f7 100%);
                    color: #fff;
                    padding: 6px 12px;
                    border-radius: 20px;
                    font-size: 13px;
                    font-weight: bold;
                }}
            </style>
        </head>
        <body>
            <div class="card">
                <h1>✓ Upgrade Successful!</h1>
                <p>You have been upgraded to the <span class="badge">{plan.upper()}</span> plan.</p>
                <p>You can close this tab and return to the OptionLens extension.</p>
            </div>
        </body>
    </html>
    """
