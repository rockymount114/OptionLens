import jwt
from datetime import datetime, timedelta
from functools import wraps
from flask import request, jsonify, current_app, g
from app.models import User

def generate_token(user_id):
    """
    Generate JWT Token for User ID.
    """
    try:
        payload = {
            'exp': datetime.utcnow() + timedelta(days=30),
            'iat': datetime.utcnow(),
            'sub': user_id
        }
        return jwt.encode(
            payload,
            current_app.config.get('JWT_SECRET_KEY'),
            algorithm='HS256'
        )
    except Exception as e:
        return None

def token_required(f):
    """
    Decorator to protect API routes with JWT.
    """
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        # Check Authorization Header
        if 'Authorization' in request.headers:
            auth_header = request.headers['Authorization']
            try:
                token = auth_header.split(" ")[1]
            except IndexError:
                return jsonify({'error': 'Bearer token format invalid.'}), 401
        
        if not token:
            return jsonify({'error': 'Token is missing.'}), 401

        try:
            payload = jwt.decode(
                token,
                current_app.config.get('JWT_SECRET_KEY'),
                algorithms=['HS256']
            )
            user_id = payload['sub']
            user = User.query.get(user_id)
            if not user:
                return jsonify({'error': 'User not found.'}), 401
            
            g.current_user = user
        except jwt.ExpiredSignatureError:
            return jsonify({'error': 'Signature expired. Please log in again.'}), 401
        except jwt.InvalidTokenError:
            return jsonify({'error': 'Invalid token. Please log in again.'}), 401

        return f(*args, **kwargs)

    return decorated
