from django.db import models
import os
from django.contrib.auth.models import User
from django.db.models.signals import post_save
from django.dispatch import receiver

# Create your models here.
class Case(models.Model):
    id = models.AutoField(primary_key=True)
    title = models.CharField(max_length=100)
    description = models.TextField()
    location = models.URLField()
    phone_number = models.CharField(max_length=10)
    image = models.ImageField(upload_to='static/case_images/')
    status = models.CharField(max_length=100,default="open")
    created = models.DateTimeField(auto_now_add=True)
    updated = models.DateTimeField(auto_now=True)
    approved = models.BooleanField(default=False)
    created_by = models.CharField(max_length=100)
    closed_by = models.CharField(max_length=100, blank=True, null=True)

    def __str__(self):
        return self.title

    def delete(self, *args, **kwargs):
        """Delete the image file when the case is deleted"""
        if self.image:  # Ensure there is an image
            if os.path.isfile(self.image.path):  # Check if file exists
                os.remove(self.image.path)  # Delete the file
        super().delete(*args, **kwargs)  # Delete the object


class CaseUpdate(models.Model):
    case = models.ForeignKey(Case, on_delete=models.CASCADE, related_name="updates")
    timestamp = models.DateTimeField(auto_now_add=True)  # Auto stores update time
    title = models.CharField(max_length=100)
    location = models.URLField(blank=True, null=True)  # Optional URL
    description = models.TextField()
    image = models.ImageField(upload_to='static/case_images/', blank=True, null=True)  # Optional image
    updated_by = models.CharField(max_length=100, default="Admin")
    phone_number = models.CharField(max_length=10)

    def __str__(self):
        return f"Update for {self.case.title} on {self.timestamp}"
    
    def delete(self, *args, **kwargs):
        """Delete the image file when the update is deleted"""
        if self.image:
            if os.path.isfile(self.image.path):
                os.remove(self.image.path)
        super().delete(*args, **kwargs)



class UserProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE)
    phone_number = models.CharField(max_length=10, blank=True, null=True)

    def __str__(self):
        return self.user.username


# Automatically create/update UserProfile when User is created/updated
@receiver(post_save, sender=User)
def create_or_update_user_profile(sender, instance, created, **kwargs):
    if created:
        UserProfile.objects.create(user=instance)
    else:
        instance.userprofile.save()