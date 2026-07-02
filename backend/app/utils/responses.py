"""Single construction point for every HTTP response in the app."""
from typing import Any

from flask import Response, jsonify


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
