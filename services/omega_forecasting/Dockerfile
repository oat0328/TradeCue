FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
# Model libraries should be preinstalled in a separately reviewed image; base image fails
# closed with 503 for uninstalled or disabled engines. Do NOT expose this container publicly.
COPY app.py ./
EXPOSE 8000
CMD ["uvicorn","app:app","--host","0.0.0.0","--port","8000","--workers","1"]
