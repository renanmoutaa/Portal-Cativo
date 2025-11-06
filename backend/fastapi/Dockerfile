FROM python:3.11-slim
WORKDIR /app

# Improve Python runtime behavior
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# Install dependencies
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy application source
COPY . .

# Default envs (can be overridden by compose)
ENV FASTAPI_PORT=4001 \
    NEST_PORT=4002 \
    NEST_HOST=nest

EXPOSE 4001

# Start FastAPI
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${FASTAPI_PORT}"]