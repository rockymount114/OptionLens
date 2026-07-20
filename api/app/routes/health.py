from flask import Blueprint, jsonify
from app.routes.billing import PLANS

health_bp = Blueprint('health', __name__)

@health_bp.route('/health', methods=['GET'])
def health():
    return jsonify({
        'status': 'healthy',
        'api_version': '1.0.0'
    }), 200

@health_bp.route('/plans', methods=['GET'])
def get_plans():
    return jsonify(PLANS), 200
