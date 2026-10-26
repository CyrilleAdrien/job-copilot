"""Briques partagées par les services job-copilot."""

from jobcopilot_common.app import create_service_app
from jobcopilot_common.config import Settings, get_settings

__all__ = ["Settings", "create_service_app", "get_settings"]
