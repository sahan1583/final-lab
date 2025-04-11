from celery import shared_task
from .models import ChatMessage
from datetime import timedelta
from django.utils.timezone import now

@shared_task
def delete_old_messages():
    """ Deletes messages older than 30 days """
    threshold_date = now() - timedelta(days=30)
    deleted_count, _ = ChatMessage.objects.filter(created_at__lt=threshold_date).delete()
    return f"Deleted {deleted_count} old messages."
