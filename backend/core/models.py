from django.db import models


class HealthCheck(models.Model):
    """Modelo mínimo para validar conectividad con PostgreSQL."""

    service = models.CharField(max_length=64)
    checked_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-checked_at"]

    def __str__(self) -> str:
        return f"{self.service} @ {self.checked_at}"
