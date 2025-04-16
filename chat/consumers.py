import json
from channels.generic.websocket import AsyncWebsocketConsumer
from .models import ChatMessage
from asgiref.sync import sync_to_async
from django.core.exceptions import ObjectDoesNotExist 

class ChatConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        """Handle new WebSocket connections"""
        self.room_name = "chat_room"
        self.room_group_name = f"chat_{self.room_name}"

        await self.channel_layer.group_add(self.room_group_name, self.channel_name)
        await self.accept()

        # Fetch last 10 messages and send them as a batch
        last_messages = await self.get_last_messages()
        await self.send(text_data=json.dumps({"type": "chat_history", "messages": last_messages}))

    async def disconnect(self, close_code):
        """Handle disconnection"""
        await self.channel_layer.group_discard(self.room_group_name, self.channel_name)

    async def receive(self, text_data):
        """Handle messages sent by users or requests for older messages"""
        data = json.loads(text_data)
        message_type = data.get("type")

        if message_type == "load_older_messages":
            oldest_message_id = data.get("oldest_id")
            older_messages = await self.get_older_messages(oldest_message_id, count=10)
            # Send older messages back *only* to the requesting client
            await self.send(text_data=json.dumps({"type": "older_chat_history", "messages": older_messages}))

        elif message_type == "chat_message": 
            title = data.get("title")
            description = data.get("description")
            location = data.get("location")
            image_url = data.get("image", None) 

            if not all([title, description, location]): # Basic validation
                    # Optionally send an error back to the user
                    # await self.send(text_data=json.dumps({"type": "error", "message": "Missing required fields."}))
                    return 

            message = await self.save_message(title, description, location, image_url)

            # Broadcast the new message to all users in the group
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    "type": "chat_message_broadcast", 
                    **message 
                }
            )

    async def chat_message_broadcast(self, event):
        """Send broadcast messages (new chat messages) to WebSocket clients"""
        
        await self.send(text_data=json.dumps({
            "type": "chat_message", 
            "title": event["title"],
            "description": event["description"],
            "location": event["location"],
            "created_at": event["created_at"],
            "image": event["image"],
            "id": event["id"] 
        }))

    @sync_to_async
    def save_message(self, title, description, location, image_url):
        """ Save the message to the database """
        message = ChatMessage.objects.create(
            title=title,
            description=description,
            location=location,
            image=image_url
        )
        image_url = None
        if message.image:
            image_url = message.image.url
            if image_url.startswith("/media/media/"):
                image_url = image_url.replace("/media/media/", "/media/")  

        return {
            "title": message.title,
            "description": message.description,
            "location": message.location,
            "created_at": message.created_at.strftime("%Y-%m-%d %H:%M:%S"),
            "image": image_url,
            "id": message.id,
        }

    @staticmethod
    def _serialize_messages(messages):
        """Helper to serialize a list of message objects."""
        serialized = []
        for msg in messages:
             # Prepare image URL for sending
            image_url = None
            if msg.image:
                 try:
                    if hasattr(msg.image, 'url'):
                         image_url = msg.image.url
                         if image_url.startswith("/media/media/"):
                             image_url = image_url.replace("/media/media/", "/media/", 1)
                 except ValueError:
                     image_url = None

            serialized.append({
                "id": msg.id, 
                "title": msg.title,
                "description": msg.description,
                "location": msg.location,
                "created_at": msg.created_at.strftime("%Y-%m-%d %H:%M:%S"),
                "image": image_url,
            })
        return serialized

    @sync_to_async
    def get_last_messages(self, count=10):
        """ Fetch the most recent 'count' messages from the database """
        messages = ChatMessage.objects.order_by("-created_at")[:count]
        return self._serialize_messages(reversed(messages))


    @sync_to_async
    def get_older_messages(self, oldest_id=None, count=10):
        """Fetch 'count' messages older than the message with oldest_id."""
        if oldest_id is None:
            return []

        try:
            
            oldest_message = ChatMessage.objects.get(pk=oldest_id)
           
            messages = ChatMessage.objects.filter(
                created_at__lt=oldest_message.created_at
            ).order_by("-created_at")[:count] 
            
            return self._serialize_messages(reversed(messages))
        except ObjectDoesNotExist:
             
            return []
