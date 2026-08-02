from django.urls import path

from . import views

urlpatterns = [
    path("disposiciones/", views.disposiciones_collection, name="dir-disposiciones"),
    path("disposiciones/<int:pk>/", views.disposicion_detail, name="dir-disposicion-detail"),
]
