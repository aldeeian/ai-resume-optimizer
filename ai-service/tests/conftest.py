"""Shared fixtures. Settings env vars are set before the app is imported."""

import os

import pytest
from fastapi.testclient import TestClient

os.environ.setdefault("ANTHROPIC_API_KEY", "test-anthropic-key")
os.environ.setdefault("AI_SERVICE_API_KEY", "test-service-key")

from app.main import app  # noqa: E402
from app.schemas import ParsedResume  # noqa: E402

API_KEY_HEADER = {"x-api-key": "test-service-key"}


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


@pytest.fixture
def source_resume() -> ParsedResume:
    """A small but realistic master resume used across tests."""
    return ParsedResume.model_validate(
        {
            "contact": {
                "name": "Sam Carter",
                "email": "sam@example.com",
                "phone": "555-123-4567",
                "location": "Calgary, AB",
                "links": ["github.com/samcarter"],
            },
            "summary": "CS student focused on backend systems.",
            "education": [
                {
                    "institution": "University of Calgary",
                    "degree": "BSc",
                    "field": "Computer Science",
                    "startDate": "2022",
                    "endDate": "2026",
                    "gpa": "3.7",
                    "highlights": ["Dean's list 2024"],
                }
            ],
            "skills": ["Python", "TypeScript", "PostgreSQL"],
            "experiences": [
                {
                    "company": "Acme Corp",
                    "title": "Software Developer Intern",
                    "location": "Calgary, AB",
                    "startDate": "May 2024",
                    "endDate": "Aug 2024",
                    "current": False,
                    "bullets": [
                        "Built REST endpoints in FastAPI serving 200 requests per second",
                        "Reduced report generation time by 40% with query optimization",
                    ],
                }
            ],
            "projects": [
                {
                    "name": "Fraud Detector",
                    "description": "ML pipeline for transaction fraud",
                    "technologies": ["Python", "XGBoost"],
                    "url": "",
                    "bullets": ["Trained XGBoost model on 100k transactions"],
                }
            ],
        }
    )
