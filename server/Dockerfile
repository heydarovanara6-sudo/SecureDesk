FROM python:3.11-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy app
COPY . .

# Expose Flask port
EXPOSE 5000

# Run with eventlet for Socket.IO
CMD ["python", "app.py"]
