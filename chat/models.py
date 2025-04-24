from django.db import models

class ChatMessage(models.Model):
    # username = models.CharField(max_length=100)
    title = models.CharField(max_length=255)
    description = models.TextField()
    location = models.URLField(blank=True, null=True)
    image = models.ImageField(upload_to="chat_images/", blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.title
