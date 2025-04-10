from django.contrib import admin
from .models import Case
from .models import CaseUpdate
from .models import UserProfile

# Register your models here.
admin.site.register(Case)
admin.site.register(CaseUpdate)
admin.site.register(UserProfile)

