from datetime import datetime
from flask import Blueprint, request, jsonify, g
from app.extensions import db
from app.models import User, Subscription
from app.utils.auth import generate_token, token_required

auth_bp = Blueprint('auth', __name__, url_prefix='/auth')

@auth_bp.route('/register', methods=['POST'])
def register():
    data = request.get_json() or {}
    email = data.get('email')
    password = data.get('password')

    if not email or not password:
        return jsonify({'error': 'Email and password are required.'}), 400

    existing_user = User.query.filter_by(email=email).first()
    if existing_user:
        return jsonify({'error': 'Email already registered.'}), 400

    try:
        user = User(email=email)
        user.set_password(password)
        db.session.add(user)
        db.session.commit()

        # Seed initial "free" plan subscription record for the user
        free_sub = Subscription(
            user_id=user.id,
            plan_name='free',
            status='active',
            current_period_end=None  # Indefinite
        )
        db.session.add(free_sub)
        db.session.commit()

        token = generate_token(user.id)
        return jsonify({
            'message': 'User registered successfully.',
            'token': token,
            'user': user.to_json()
        }), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Failed to create user. Please try again.'}), 500


@auth_bp.route('/login', methods=['POST'])
def login():
    data = request.get_json() or {}
    email = data.get('email')
    password = data.get('password')

    if not email or not password:
        return jsonify({'error': 'Email and password are required.'}), 400

    user = User.query.filter_by(email=email).first()
    if not user or not user.check_password(password):
        return jsonify({'error': 'Invalid email or password.'}), 401

    if not user.is_active:
        return jsonify({'error': 'User account is deactivated.'}), 403

    user.last_login_at = datetime.utcnow()
    db.session.commit()

    token = generate_token(user.id)
    return jsonify({
        'token': token,
        'user': user.to_json()
    }), 200


@auth_bp.route('/logout', methods=['POST'])
def logout():
    # Client will discard the JWT, stateless logout
    return jsonify({'message': 'Logged out successfully.'}), 200


@auth_bp.route('/me', methods=['GET'])
@token_required
def me():
    return jsonify({
        'user': g.current_user.to_json()
    }), 200
