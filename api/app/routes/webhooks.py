import stripe
from datetime import datetime
from flask import Blueprint, request, jsonify, current_app
from app.extensions import db
from app.models import User, Subscription

webhooks_bp = Blueprint('webhooks', __name__, url_prefix='/webhooks')

# Map your Stripe Price IDs to internal Plan names
PRICE_MAP = {
    'price_pro_id_here': 'pro',
    'price_power_id_here': 'power'
}

@webhooks_bp.route('/stripe', methods=['POST'])
def stripe_webhook():
    payload = request.data
    sig_header = request.headers.get('STRIPE_SIGNATURE')
    webhook_secret = current_app.config['STRIPE_WEBHOOK_SECRET']
    stripe_key = current_app.config['STRIPE_SECRET_KEY']

    stripe.api_key = stripe_key
    event = None

    # Verify signature
    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, webhook_secret
        )
    except ValueError as e:
        # Invalid payload
        return jsonify({'error': 'Invalid payload'}), 400
    except stripe.error.SignatureVerificationError as e:
        # Invalid signature
        return jsonify({'error': 'Invalid signature'}), 400

    event_type = event['type']
    data_object = event['data']['object']

    if event_type in ['customer.subscription.created', 'customer.subscription.updated']:
        handle_subscription_write(data_object)
    elif event_type == 'customer.subscription.deleted':
        handle_subscription_deleted(data_object)

    return jsonify({'status': 'success'}), 200


def handle_subscription_write(subscription_obj):
    customer_id = subscription_obj['customer']
    subscription_id = subscription_obj['id']
    price_id = subscription_obj['items']['data'][0]['price']['id']
    status = subscription_obj['status']
    current_period_end_ts = subscription_obj['current_period_end']
    cancel_at_period_end = subscription_obj['cancel_at_period_end']

    user = User.query.filter_by(stripe_customer_id=customer_id).first()
    if not user:
        return

    plan_name = PRICE_MAP.get(price_id, 'pro') # default fallback

    sub = Subscription.query.filter_by(stripe_subscription_id=subscription_id).first()
    
    if not sub:
        # Check if user has an active fallback/free sub, deactivate it
        Subscription.query.filter_by(user_id=user.id).delete()
        sub = Subscription(user_id=user.id, stripe_subscription_id=subscription_id)
        db.session.add(sub)

    sub.stripe_price_id = price_id
    sub.plan_name = plan_name
    sub.status = status
    sub.current_period_end = datetime.utcfromtimestamp(current_period_end_ts)
    sub.cancel_at_period_end = cancel_at_period_end

    db.session.commit()


def handle_subscription_deleted(subscription_obj):
    subscription_id = subscription_obj['id']
    sub = Subscription.query.filter_by(stripe_subscription_id=subscription_id).first()
    
    if sub:
        user_id = sub.user_id
        # Delete stripe subscription and return user to free plan
        db.session.delete(sub)
        
        # Add back free plan subscription
        free_sub = Subscription(
            user_id=user_id,
            plan_name='free',
            status='active',
            current_period_end=None
        )
        db.session.add(free_sub)
        db.session.commit()
