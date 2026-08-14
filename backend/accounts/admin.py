from django.contrib import admin

from .models import AccesoEvento, UserProfile, UserSession

admin.site.register(UserProfile)
admin.site.register(UserSession)
admin.site.register(AccesoEvento)
