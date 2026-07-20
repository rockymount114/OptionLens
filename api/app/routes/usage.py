from flask import Blueprint, jsonify, g
from app.utils.auth import token_required
from app.routes.analysis import get_current_usage_count, get_user_plan_info

usage_bp = Blueprint('usage', __name__, url_prefix='/usage')

@usage_bp.route('/me', methods=['GET'])
@token_required
def get_usage():
    user = g.current_user
    plan, limit = get_user_plan_info(user.id)
    usage_count = get_current_usage_count(user.id)

    return jsonify({
        'plan': plan,
        'usage_this_month': usage_count,
        'limit_this_month': limit,
        'remaining_this_month': -1 if limit == -1 else max(0, limit - usage_count)
    }), 200
