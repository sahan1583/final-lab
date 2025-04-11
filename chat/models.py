from django.db import models

class ChatMessage(models.Model):
    title = models.CharField(max_length=255)
    description = models.TextField()
    location = models.URLField()
    image = models.ImageField(upload_to="chat_images/", blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.title
