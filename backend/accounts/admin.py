from django.contrib import admin

from .models import UserProfile, UserSession

admin.site.register(UserProfile)
admin.site.register(UserSession)
