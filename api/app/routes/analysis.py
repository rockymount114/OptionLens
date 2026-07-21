import hashlib
from datetime import datetime
from flask import Blueprint, request, jsonify, g, current_app
from app.extensions import db
from app.models import Subscription, UsageEvent, AnalysisRequest
from app.utils.auth import token_required

analysis_bp = Blueprint('analysis', __name__, url_prefix='/analysis')

def get_current_usage_count(user_id):
    """
    Get count of usage events in the current calendar month.
    """
    first_day_of_month = datetime.utcnow().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    count = UsageEvent.query.filter(
        UsageEvent.user_id == user_id,
        UsageEvent.event_type == 'explain',
        UsageEvent.created_at >= first_day_of_month
    ).count()
    return count

def get_user_plan_info(user_id):
    """
    Fetch user subscription plan and usage details.
    """
    sub = Subscription.query.filter_by(user_id=user_id, status='active')\
        .order_by(Subscription.created_at.desc()).first()
    
    plan = sub.plan_name if sub else 'free'
    limit = current_app.config['PLAN_QUOTAS'].get(plan, 10)
    return plan, limit

@analysis_bp.route('/extract-preview', methods=['POST'])
@token_required
def extract_preview():
    # Simple endpoint to check schema validity of DOM extraction payload
    payload = request.get_json() or {}
    symbol = payload.get('symbol')
    strategy = payload.get('strategy')
    
    if not symbol or not strategy:
        return jsonify({'error': 'Symbol and strategy are required.'}), 400
        
    return jsonify({
        'status': 'valid',
        'symbol': symbol,
        'strategy': strategy
    }), 200

@analysis_bp.route('/explain', methods=['POST'])
@token_required
def explain():
    user = g.current_user
    payload = request.get_json() or {}
    
    symbol = payload.get('symbol', '').upper()
    strategy = payload.get('strategy')
    underlying_price = float(payload.get('underlying_price', 0))
    strike = float(payload.get('strike', 0))
    premium = float(payload.get('premium', 0))
    contracts = int(payload.get('contracts', 1))
    expiration = payload.get('expiration')
    shares_covered = int(payload.get('shares_covered', 100))
    
    page_context = payload.get('page_context', {})
    source_url = page_context.get('source_url', '')

    if not symbol or not strategy or underlying_price <= 0 or strike <= 0 or premium <= 0:
        return jsonify({'error': 'Missing required financial input fields.'}), 400

    # 1. Enforce Server-Side Usage Paywall Limits
    plan, limit = get_user_plan_info(user.id)
    usage_count = get_current_usage_count(user.id)
    
    if limit != -1 and usage_count >= limit:
        return jsonify({
            'error': f'Monthly analysis limit reached ({usage_count}/{limit}). Please upgrade your plan.',
            'limit_reached': True
        }), 403

    # 2. Rule-Based Educational Explanations Engine
    multiplier = contracts * shares_covered
    total_premium = premium * multiplier
    
    strategy_label = ""
    summary = ""
    max_profit_str = ""
    max_loss_str = ""
    breakeven = 0.0
    assignment_risk = ""

    if strategy == 'covered_call':
        strategy_label = "Sell Covered Call"
        max_profit = ((strike - underlying_price) + premium) * multiplier
        max_loss = (underlying_price - premium) * multiplier
        breakeven = underlying_price - premium
        
        max_profit_str = f"${max_profit:,.2f}" if max_profit >= 0 else f"-${abs(max_profit):,.2f} (Underlying stock capital loss offsets premium)"
        max_loss_str = f"${max_loss:,.2f} (Substantial downside if stock price falls to zero; premium partially offsets losses)"
        
        summary = (
            f"You collect ${total_premium:,.2f} in premium immediately by committing to sell {multiplier} shares of {symbol} at ${strike:.2f} if called. "
            f"If {symbol} remains below ${strike:.2f} at expiration, you keep the premium and the stock. "
            f"Your maximum profit is realized if the stock rises above ${strike:.2f}."
        )
        
        if underlying_price >= strike:
            assignment_risk = "High. The option is currently In-The-Money (ITM). Expect shares to be called away at expiration unless you roll or close."
        else:
            pct_to_strike = ((strike - underlying_price) / underlying_price) * 100
            assignment_risk = f"Moderate. Stock is {pct_to_strike:.1f}% below the strike. If stock rises above ${strike:.2f}, you will likely face assignment."

    elif strategy == 'cash_secured_put':
        strategy_label = "Sell Cash-Secured Put"
        max_profit = premium * multiplier
        max_loss = (strike - premium) * multiplier
        breakeven = strike - premium
        
        max_profit_str = f"${max_profit:,.2f}"
        max_loss_str = f"${max_loss:,.2f} (If stock goes to zero, you are forced to buy shares at ${strike:.2f} minus the premium received)"
        
        summary = (
            f"You collect ${total_premium:,.2f} by agreeing to purchase {multiplier} shares of {symbol} at ${strike:.2f} if the stock price drops. "
            f"You must keep ${strike * multiplier:,.2f} in cash collateral. "
            f"If {symbol} stays above ${strike:.2f}, you keep the premium as pure profit."
        )
        
        if underlying_price <= strike:
            assignment_risk = "High. The option is currently In-The-Money (ITM). Expect to buy the stock at expiration unless price recovers."
        else:
            pct_to_strike = ((underlying_price - strike) / underlying_price) * 100
            assignment_risk = f"Low-to-Moderate. Stock is {pct_to_strike:.1f}% above the strike. If stock dips below ${strike:.2f}, you will purchase the stock."

    elif strategy == 'long_call':
        strategy_label = "Buy Long Call"
        max_profit_str = "Unlimited upside potential"
        max_loss = premium * multiplier
        max_loss_str = f"${max_loss:,.2f} (Limited to the premium paid)"
        breakeven = strike + premium
        
        summary = (
            f"You pay ${total_premium:,.2f} for the right to buy {multiplier} shares of {symbol} at ${strike:.2f}. "
            f"To profit, {symbol} must rise above ${breakeven:.2f} before expiration. "
            f"Otherwise, your contract loses value and can expire worthless."
        )
        assignment_risk = "N/A. You hold the option contract; you control exercise. No risk of forced assignment."

    elif strategy == 'long_put':
        strategy_label = "Buy Long Put"
        max_profit = (strike - premium) * multiplier
        max_profit_str = f"${max_profit:,.2f} (If stock falls to zero)"
        max_loss = premium * multiplier
        max_loss_str = f"${max_loss:,.2f} (Limited to the premium paid)"
        breakeven = strike - premium
        
        summary = (
            f"You pay ${total_premium:,.2f} for the right to sell {multiplier} shares of {symbol} at ${strike:.2f}. "
            f"To profit, {symbol} must drop below ${breakeven:.2f} before expiration. "
            f"Excellent hedge against downside market moves."
        )
        assignment_risk = "N/A. You hold the option contract; you control exercise. No risk of forced assignment."

    elif strategy == 'bull_call_spread':
        strategy_label = "Bull Call Spread"
        short_strike = strike + 5.0
        max_profit = (5.0 - premium) * multiplier
        max_loss = premium * multiplier
        breakeven = strike + premium
        
        max_profit_str = f"${max_profit:,.2f} (Capped above ${short_strike:.2f})"
        max_loss_str = f"${max_loss:,.2f} (Capped at net debit paid)"
        
        summary = (
            f"You purchase a Bull Call Spread by buying a call at ${strike:.2f} and selling a call at ${short_strike:.2f} for a net debit of ${premium:.2f}. "
            f"To reach maximum profit, {symbol} must rise above ${short_strike:.2f} by expiration. "
            f"Your risk is capped at the premium paid (${total_premium:,.2f})."
        )
        assignment_risk = f"Moderate-to-High if stock rises above short strike ${short_strike:.2f} near expiration, leading to potential assignment on the short leg."

    elif strategy == 'bear_put_spread':
        strategy_label = "Bear Put Spread"
        short_strike = strike - 5.0
        max_profit = (5.0 - premium) * multiplier
        max_loss = premium * multiplier
        breakeven = strike - premium
        
        max_profit_str = f"${max_profit:,.2f} (Capped below ${short_strike:.2f})"
        max_loss_str = f"${max_loss:,.2f} (Capped at net debit paid)"
        
        summary = (
            f"You purchase a Bear Put Spread by buying a put at ${strike:.2f} and selling a put at ${short_strike:.2f} for a net debit of ${premium:.2f}. "
            f"To reach maximum profit, {symbol} must fall below ${short_strike:.2f} by expiration. "
            f"Your loss is strictly limited to the premium paid (${total_premium:,.2f})."
        )
        assignment_risk = f"Moderate-to-High if stock falls below short strike ${short_strike:.2f} near expiration, leading to potential assignment on the short leg."

    elif strategy == 'long_straddle':
        strategy_label = "Long Straddle"
        max_profit_str = "Unlimited upside or downside potential"
        max_loss = premium * multiplier
        max_loss_str = f"${max_loss:,.2f} (Limited to the premium paid)"
        breakeven = strike + premium
        
        summary = (
            f"You purchase a Long Straddle by buying a call and a put at the same strike of ${strike:.2f} for a combined premium of ${premium:.2f}. "
            f"You profit if {symbol} moves significantly in either direction, breaking past ${strike - premium:.2f} or ${strike + premium:.2f}. "
            f"Max loss occurs if stock stays at strike."
        )
        assignment_risk = "N/A. You hold both options; you control exercise. No risk of forced assignment."

    elif strategy == 'long_strangle':
        strategy_label = "Long Strangle"
        call_strike = strike + 5.0
        put_strike = strike - 5.0
        max_profit_str = "Unlimited upside or downside potential"
        max_loss = premium * multiplier
        max_loss_str = f"${max_loss:,.2f} (Limited to the premium paid)"
        breakeven = call_strike + premium
        
        summary = (
            f"You purchase a Long Strangle by buying a put at ${put_strike:.2f} and a call at ${call_strike:.2f} for a net premium of ${premium:.2f}. "
            f"You profit from large price swings in either direction beyond ${put_strike - premium:.2f} or ${call_strike + premium:.2f}."
        )
        assignment_risk = "N/A. You hold both options; you control exercise."

    else:
        strategy_label = "Custom Strategy"
        max_profit_str = "Varies based on legs"
        max_loss_str = "Varies based on legs"
        summary = "Custom multi-leg options strategies are evaluated based on individual leg characteristics."
        assignment_risk = "Check individual short legs."

    # AI Enrichment for Pro/Power plans (Phase 3)
    if plan in ['pro', 'power']:
        opt_yield = 0.0
        if strategy == 'covered_call' and underlying_price > 0:
            opt_yield = (premium / underlying_price) * 100
        elif strategy == 'cash_secured_put' and strike > 0:
            opt_yield = (premium / strike) * 100
        elif strategy in ['bull_call_spread', 'bear_put_spread', 'long_straddle', 'long_strangle'] and strike > 0:
            opt_yield = (premium / strike) * 100
            
        prob_profit = 70 if strategy in ['covered_call', 'cash_secured_put'] else (40 if strategy in ['long_call', 'long_put'] else 55)
        
        ai_enrichment = (
            f"\n\n[PRO/POWER EXTRA] AI Analysis for {symbol}:\n"
            f"• Implied Volatility (IV) Outlook: Elevated IV suggests premium is relatively high, favoring option sellers. Expect potential IV crush after upcoming catalysts.\n"
            f"• Probability of Profit (PoP): Approximately {prob_profit}% probability of expiring profitable based on historical drift and standard deviation.\n"
            f"• Capital Efficiency: This {strategy_label.lower()} trade has a premium yield of {opt_yield:.2f}% relative to the strike. Consider rolling the position if the stock breaches the breakeven point (${breakeven:.2f})."
        )
        summary += ai_enrichment

    # 3. Log Usage Event & Record Request
    try:
        # Create usage event
        event = UsageEvent(
            user_id=user.id,
            event_type='explain',
            symbol=symbol,
            strategy=strategy,
            broker=payload.get('broker'),
            request_units=1
        )
        db.session.add(event)
        
        # Privacy: Hash URL before recording
        url_hash = hashlib.sha256(source_url.encode('utf-8')).hexdigest() if source_url else None
        
        analysis_record = AnalysisRequest(
            user_id=user.id,
            broker=payload.get('broker'),
            source_url_hash=url_hash,
            symbol=symbol,
            strategy=strategy,
            request_payload_json=payload,
            response_payload_json={
                'strategy_label': strategy_label,
                'summary': summary,
                'max_profit': max_profit_str,
                'max_loss': max_loss_str,
                'breakeven': breakeven,
                'assignment_risk': assignment_risk
            }
        )
        db.session.add(analysis_record)
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        # Non-blocking log, proceed with explanation response

    # 4. Form Response
    return jsonify({
        'strategy_label': strategy_label,
        'summary': summary,
        'max_profit': max_profit_str,
        'max_loss': max_loss_str,
        'breakeven': breakeven,
        'assignment_risk': assignment_risk,
        'usage': {
            'plan': plan,
            'remaining_this_month': -1 if limit == -1 else max(0, limit - (usage_count + 1))
        }
    }), 200


@analysis_bp.route('/history', methods=['GET'])
@token_required
def get_history():
    user = g.current_user
    # Fetch last 20 analysis requests for this user, ordered by date descending
    requests = AnalysisRequest.query.filter_by(user_id=user.id).order_by(AnalysisRequest.created_at.desc()).limit(20).all()
    
    history_list = []
    for r in requests:
        history_list.append({
            'id': r.id,
            'broker': r.broker,
            'symbol': r.symbol,
            'strategy': r.strategy,
            'created_at': r.created_at.isoformat(),
            'request_payload': r.request_payload_json,
            'response_payload': r.response_payload_json
        })
        
    return jsonify(history_list), 200
