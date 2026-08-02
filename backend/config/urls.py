from django.contrib import admin
from django.urls import include, path

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/", include("core.urls")),
    path("api/auth/", include("accounts.urls")),
    path("api/roles/", include("roles.urls")),
    path("api/tactico/", include("tactico.urls")),
]
