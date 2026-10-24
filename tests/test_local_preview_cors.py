"""Static localhost previews can reach the API without trusting arbitrary origins."""
import pytest
from fastapi.testclient import TestClient
from backend.server import app


@pytest.mark.parametrize('origin', ['http://127.0.0.1:8120', 'http://localhost:41235',
                                    'https://mrbin2026dh-droid.github.io'])
def test_allowed_preview_origin(origin):
    with TestClient(app) as client:
        response = client.get('/api/health', headers={'Origin': origin})
        assert response.status_code == 200
        assert response.headers.get('access-control-allow-origin') == origin
        preflight = client.options('/api/student/login', headers={
            'Origin': origin, 'Access-Control-Request-Method': 'POST',
            'Access-Control-Request-Headers': 'content-type'})
        assert preflight.status_code == 200
        assert preflight.headers.get('access-control-allow-origin') == origin


@pytest.mark.parametrize('origin', ['http://localhost.evil.invalid:8120',
                                    'http://127.0.0.1.evil.invalid', 'https://evil.invalid'])
def test_untrusted_origin_is_not_granted_cors(origin):
    with TestClient(app) as client:
        response = client.get('/api/health', headers={'Origin': origin})
        assert 'access-control-allow-origin' not in response.headers
