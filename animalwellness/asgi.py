"""
ASGI config for animalwellness project.

It exposes the ASGI callable as a module-level variable named ``application``.

For more information on this file, see
https://docs.djangoproject.com/en/5.1/howto/deployment/asgi/
"""

import os
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "animalwellness.settings")
django.setup()  # Ensures Django apps are loaded before importing anything else

from django.core.asgi import get_asgi_application
from channels.routing import ProtocolTypeRouter, URLRouter
from chat.routing import websocket_urlpatterns
from channels.auth import AuthMiddlewareStack
from chat import routing


application = ProtocolTypeRouter({

    "http": get_asgi_application(),

    "websocket": AuthMiddlewareStack(

        URLRouter(

            routing.websocket_urlpatterns

        )

    ),

})
