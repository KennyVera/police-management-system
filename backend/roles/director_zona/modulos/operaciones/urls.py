from django.urls import path

from .views import home

urlpatterns = [
    path("", home, name="director_zona-operaciones-home"),
]
