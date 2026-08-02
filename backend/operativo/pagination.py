"""Paginación ligera para listados de APIs (sin DEFAULT_PAGINATION_CLASS)."""

from __future__ import annotations

from math import ceil

from rest_framework.response import Response


def paginate_qs(
    request,
    queryset,
    serializer_class,
    *,
    default_size: int = 10,
    max_size: int = 50,
    context: dict | None = None,
) -> Response:
    """
    Query params:
      - page (1-based, default 1)
      - page_size (default 10, max 50)
    """
    try:
        page = max(1, int(request.query_params.get("page") or 1))
    except (TypeError, ValueError):
        page = 1
    try:
        page_size = int(request.query_params.get("page_size") or default_size)
    except (TypeError, ValueError):
        page_size = default_size
    page_size = max(1, min(page_size, max_size))

    total = queryset.count()
    total_pages = max(1, ceil(total / page_size)) if total else 1
    if page > total_pages:
        page = total_pages

    start = (page - 1) * page_size
    end = start + page_size
    page_qs = queryset[start:end]
    ctx = context or {"request": request}
    data = serializer_class(page_qs, many=True, context=ctx).data

    return Response(
        {
            "count": total,
            "page": page,
            "page_size": page_size,
            "total_pages": total_pages,
            "results": data,
        }
    )
