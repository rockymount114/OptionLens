import unittest
import json
from app import create_app, db
from app.config import Config
from app.models import User, Subscription, UsageEvent

class TestConfig(Config):
    TESTING = True
    SQLALCHEMY_DATABASE_URI = 'sqlite:///:memory:'
    JWT_SECRET_KEY = 'test-secret-key'
    PLAN_QUOTAS = {
        'free': 2,  # Set low for easy limit testing
        'pro': 5
    }

class OptionLensTestCase(unittest.TestCase):
    def setUp(self):
        self.app = create_app(TestConfig)
        self.client = self.app.test_client()
        self.app_context = self.app.app_context()
        self.app_context.push()
        db.create_all()

    def tearDown(self):
        db.session.remove()
        db.drop_all()
        self.app_context.pop()

    def test_auth_workflow(self):
        # 1. Register User
        res = self.client.post('/api/auth/register', json={
            'email': 'trader@example.com',
            'password': 'securepassword'
        })
        self.assertEqual(res.status_code, 201)
        data = json.loads(res.data)
        self.assertIn('token', data)
        token = data['token']

        # 2. Query Profile
        res = self.client.get('/api/auth/me', headers={
            'Authorization': f'Bearer {token}'
        })
        self.assertEqual(res.status_code, 200)
        data = json.loads(res.data)
        self.assertEqual(data['user']['email'], 'trader@example.com')

        # 3. Login User
        res = self.client.post('/api/auth/login', json={
            'email': 'trader@example.com',
            'password': 'securepassword'
        })
        self.assertEqual(res.status_code, 200)
        data = json.loads(res.data)
        self.assertIn('token', data)

    def test_calculations_and_paywall(self):
        # Register and get token
        res = self.client.post('/api/auth/register', json={
            'email': 'quota@example.com',
            'password': 'password123'
        })
        token = json.loads(res.data)['token']

        # Call explain API (Analysis 1)
        payload = {
            'broker': 'fidelity',
            'symbol': 'TSLA',
            'strategy': 'covered_call',
            'underlying_price': 350.00,
            'strike': 380.00,
            'premium': 5.00,
            'contracts': 1,
            'expiration': '2027-01-15',
            'shares_covered': 100
        }

        res = self.client.post('/api/analysis/explain', json=payload, headers={
            'Authorization': f'Bearer {token}'
        })
        self.assertEqual(res.status_code, 200)
        data = json.loads(res.data)
        self.assertEqual(data['strategy_label'], 'Sell Covered Call')
        self.assertEqual(data['breakeven'], 345.00)
        self.assertEqual(data['usage']['remaining_this_month'], 1)

        # Call explain API (Analysis 2)
        res = self.client.post('/api/analysis/explain', json=payload, headers={
            'Authorization': f'Bearer {token}'
        })
        self.assertEqual(res.status_code, 200)
        data = json.loads(res.data)
        self.assertEqual(data['usage']['remaining_this_month'], 0)

        # Call explain API (Analysis 3 -> Hits Limit!)
        res = self.client.post('/api/analysis/explain', json=payload, headers={
            'Authorization': f'Bearer {token}'
        })
        self.assertEqual(res.status_code, 403)
        data = json.loads(res.data)
        self.assertIn('limit reached', data['error'].lower())

    def test_billing_mock_upgrade(self):
        # Register user
        res = self.client.post('/api/auth/register', json={
            'email': 'stripe@example.com',
            'password': 'password123'
        })
        res_data = json.loads(res.data)
        user_id = res_data['user']['id']
        token = res_data['token']

        # Get check out session link
        res = self.client.post('/api/billing/create-checkout-session', headers={
            'Authorization': f'Bearer {token}'
        })
        self.assertEqual(res.status_code, 200)
        data = json.loads(res.data)
        self.assertIn('url', data)
        self.assertIn('mock-success', data['url'])

        # Hit mock success redirect endpoint
        res = self.client.get(f'/api/billing/mock-success?user_id={user_id}&plan=pro')
        self.assertEqual(res.status_code, 200)
        self.assertIn('Upgrade Successful', res.data.decode())

        # Verify plan is now upgraded to Pro
        res = self.client.get('/api/usage/me', headers={
            'Authorization': f'Bearer {token}'
        })
        self.assertEqual(res.status_code, 200)
        data = json.loads(res.data)
        self.assertEqual(data['plan'], 'pro')
        self.assertEqual(data['limit_this_month'], 5) # Pro limit in test config

if __name__ == '__main__':
    unittest.main()
