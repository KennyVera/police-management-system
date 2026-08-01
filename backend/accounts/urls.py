from django.urls import path

from .views import login_view, logout_view, me_view, roles_catalog

urlpatterns = [
    path("login/", login_view, name="auth-login"),
    path("logout/", logout_view, name="auth-logout"),
    path("me/", me_view, name="auth-me"),
    path("roles/", roles_catalog, name="auth-roles"),
]
