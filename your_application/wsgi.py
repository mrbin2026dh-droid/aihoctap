"""
WSGI / ASGI compatibility layer for Render default fallback:
Supports 'gunicorn your_application.wsgi' directly while running FastAPI!
"""
from a2wsgi import ASGIMiddleware
from backend.server import app as asgi_app

# WSGI application callable for gunicorn
application = ASGIMiddleware(asgi_app)
app = application
