"""Configuration loader for Finance Minister."""

import os
from pathlib import Path

import yaml


def get_project_root() -> Path:
    """Get the project root directory."""
    return Path(__file__).parent.parent


def load_config() -> dict:
    """Load configuration from config.yaml."""
    config_path = get_project_root() / "config.yaml"
    with open(config_path, "r") as f:
        return yaml.safe_load(f)


def get_db_path() -> str:
    """Get the absolute path to the database file."""
    config = load_config()
    db_relative = config["database"]["path"]
    db_path = get_project_root() / db_relative
    db_path.parent.mkdir(parents=True, exist_ok=True)
    return str(db_path)


def get_categories() -> dict:
    """Get all category definitions."""
    config = load_config()
    return config["categories"]


def get_llm_config() -> dict:
    """Get LLM configuration."""
    config = load_config()
    return config["llm"]
