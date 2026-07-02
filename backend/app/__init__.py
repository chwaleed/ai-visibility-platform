import logging

from flask import Flask
from flask_cors import CORS
from pydantic import ValidationError

from app.config import Config
from app.extensions import db, limiter, migrate
from app.utils.responses import ApiResponse


def create_app(config_overrides: dict | None = None) -> Flask:
    app = Flask(__name__)
    app.config.from_object(Config)
    if config_overrides:
        app.config.update(config_overrides)

    db.init_app(app)
    migrate.init_app(app, db)
    limiter.init_app(app)
    CORS(app, origins=[o.strip() for o in app.config["CORS_ORIGINS"].split(",")])

    if not app.testing:
        logging.basicConfig(
            level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s"
        )

    from app import models  # noqa: F401  (register models for migrations)
    from app.api.profiles import profiles_bp
    from app.api.queries import queries_bp

    app.register_blueprint(profiles_bp, url_prefix="/api/v1")
    app.register_blueprint(queries_bp, url_prefix="/api/v1")

    _register_error_handlers(app)
    return app


def _register_error_handlers(app: Flask) -> None:
    @app.errorhandler(404)
    def not_found(_e):
        return ApiResponse.error("not_found", "Resource not found", 404)

    @app.errorhandler(405)
    def method_not_allowed(_e):
        return ApiResponse.error("method_not_allowed", "Method not allowed", 405)

    @app.errorhandler(429)
    def rate_limited(e):
        return ApiResponse.error("rate_limited", f"Rate limit exceeded: {e.description}", 429)

    @app.errorhandler(ValidationError)
    def validation_error(e: ValidationError):
        details = [
            {"field": ".".join(str(p) for p in err["loc"]), "message": err["msg"]}
            for err in e.errors()
        ]
        return ApiResponse.error("validation_error", "Invalid request body", 400, details)

    @app.errorhandler(500)
    def server_error(_e):
        return ApiResponse.error("internal_error", "An unexpected error occurred", 500)
