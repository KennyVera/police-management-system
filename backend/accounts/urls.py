from django.urls import path

from .views import (
    avatar_proxy,
    change_password_view,
    login_view,
    logout_view,
    me_view,
    roles_catalog,
    upload_avatar_view,
)

urlpatterns = [
    path("login/", login_view, name="auth-login"),
    path("logout/", logout_view, name="auth-logout"),
    path("me/", me_view, name="auth-me"),
    path("me/password/", change_password_view, name="auth-change-password"),
    path("me/avatar/", upload_avatar_view, name="auth-upload-avatar"),
    path("avatars/<path:object_key>", avatar_proxy, name="auth-avatar-proxy"),
    path("roles/", roles_catalog, name="auth-roles"),
]
