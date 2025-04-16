#!/bin/bash

# Setup Procedure
# chmod +x start_project.sh
# ./start_project.sh

# Create and activate virtual environment
python -m venv myenv
source myenv/bin/activate

# Install requirements
pip install -r requirements.txt

# Apply database migrations
python manage.py migrate

# Start Redis server (ensure Redis is installed and available)
redis-server --daemonize yes

# Start Celery worker and beat processes
celery -A animalwellness worker --loglevel=info &
celery -A animalwellness beat --loglevel=info &

# Start Daphne server (for WebSockets and ASGI support)
daphne -b 0.0.0.0 -p 8001 animalwellness.asgi:application &

# Optionally, you can start the Django dev server if needed:
python manage.py runserver

