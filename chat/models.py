from django.db import models

class ChatMessage(models.Model):
    username = models.CharField(max_length=100, default='anonymous')
    description = models.TextField()
    location = models.CharField(max_length=500, blank=True, null=True) 
    image = models.ImageField(upload_to="chat_images/", blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Message by {self.username} at {self.created_at.strftime('%Y-%m-%d %H:%M')}"
