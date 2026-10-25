"""Production entry point: existing CrimeIsDown data and authentication."""

from app.crimeisdown.application import create_app

app = create_app()
