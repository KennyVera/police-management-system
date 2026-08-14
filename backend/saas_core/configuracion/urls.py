from django.urls import path

from .views import secciones as v
from .views import uploads as u

urlpatterns = [
    path("resumen/", v.resumen),
    path("identidad/", v.identidad),
    path("apariencia/", v.apariencia),
    path("regional/", v.regional),
    path("comunicaciones/", v.comunicaciones),
    path("plataforma/", v.plataforma),
    path("auditoria/", v.auditoria),
    path("upload/", u.upload_branding),
]
