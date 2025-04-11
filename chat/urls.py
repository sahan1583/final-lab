from django.urls import path
from .views import ChatMessageListCreateView
from . import views  # Import your views file
urlpatterns = [
    path('chat/', ChatMessageListCreateView.as_view(), name='chat-api'),
     path('publicchat/', views.chat_widget, name='chat_widget'),
]
