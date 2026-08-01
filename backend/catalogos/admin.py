from django.contrib import admin

from .models import CatalogoItem, TipoDelito, VariableGlobal

admin.site.register(TipoDelito)
admin.site.register(CatalogoItem)
admin.site.register(VariableGlobal)
