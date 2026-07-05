"""Single construction point for every HTTP response in the app."""
from typing import Any

from flask import Response, jsonify
from werkzeug.datastructures import MultiDict

MAX_PER_PAGE = 100


def page_args(args: MultiDict, default_per_page: int = 20) -> tuple[int, int]:
    """Clamped (page, per_page) from request args — shared by every paginated endpoint."""
    page = max(args.get("page", 1, type=int), 1)
    per_page = min(max(args.get("per_page", default_per_page, type=int), 1), MAX_PER_PAGE)
    return page, per_page


class ApiResponse:
    @staticmethod
    def ok(data: Any, status: int = 200) -> tuple[Response, int]:
        return jsonify(data), status

    @staticmethod
    def created(data: Any) -> tuple[Response, int]:
        return ApiResponse.ok(data, 201)

    @staticmethod
    def paginated(
        items: list[Any], page: int, per_page: int, total: int
    ) -> tuple[Response, int]:
        return (
            jsonify(
                {
                    "items": items,
                    "pagination": {
                        "page": page,
                        "per_page": per_page,
                        "total": total,
                        "total_pages": max(1, -(-total // per_page)),
                    },
                }
            ),
            200,
        )

    @staticmethod
    def error(
        code: str, message: str, status: int, details: Any = None
    ) -> tuple[Response, int]:
        body: dict[str, Any] = {"error": {"code": code, "message": message}}
        if details is not None:
            body["error"]["details"] = details
        return jsonify(body), status
