FROM ghcr.io/astral-sh/uv:python3.12-bookworm-slim

WORKDIR /app
ENV UV_COMPILE_BYTECODE=1 FLASK_APP=app

COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev

COPY . .

EXPOSE 5000
CMD ["sh", "-c", "uv run flask db upgrade && uv run flask run --host=0.0.0.0 --port=5000"]
