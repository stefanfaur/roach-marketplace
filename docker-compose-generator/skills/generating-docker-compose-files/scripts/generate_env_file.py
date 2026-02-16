#!/usr/bin/env python3
"""
Generate .env files from Docker/Podman Compose configurations.

Extracts environment variables and pre-fills with defaults.

Usage:
    ./generate_env_file.py --compose docker-compose.yml
    ./generate_env_file.py --compose docker-compose.yml --output .env.local
"""

import argparse
import json
import os
import re
import sys
import yaml
from pathlib import Path
from typing import Dict


class EnvGenerator:
    """Generate .env files from compose configurations."""

    COMMON_DEFAULTS = {
        "DEBUG": "false",
        "LOG_LEVEL": "info",
        "ENVIRONMENT": "development",
        "NODE_ENV": "development",
        "PYTHON_ENV": "development",
        "PORT": "8000",
        "DATABASE_PORT": "5432",
        "REDIS_PORT": "6379",
        "POSTGRES_PASSWORD": "change_me_in_production",
        "MYSQL_PASSWORD": "change_me_in_production",
        "MONGODB_PASSWORD": "change_me_in_production",
    }

    def __init__(self, compose_file: str, verbose: bool = False):
        self.compose_file = Path(compose_file)
        self.verbose = verbose
        self.compose_data = {}
        self.env_vars: Dict[str, str] = {}

    def log(self, message: str, level: str = "INFO") -> None:
        if self.verbose:
            print(f"[{level}] {message}", file=sys.stderr)

    def error(self, message: str) -> None:
        print(f"ERROR: {message}", file=sys.stderr)

    def load_compose_file(self) -> bool:
        if not self.compose_file.exists():
            self.error(f"Compose file not found: {self.compose_file}")
            return False
        try:
            with open(self.compose_file, "r") as f:
                self.compose_data = yaml.safe_load(f) or {}
            self.log(f"Loaded compose file: {self.compose_file}")
            return True
        except yaml.YAMLError as e:
            self.error(f"Failed to parse YAML: {e}")
            return False

    def extract_env_vars_from_compose(self) -> None:
        services = self.compose_data.get("services", {})
        for service_name, service_config in services.items():
            if not isinstance(service_config, dict):
                continue
            self.log(f"Processing service: {service_name}")
            env = service_config.get("environment", {})
            if isinstance(env, dict):
                for key, value in env.items():
                    self.env_vars[key] = str(value) if value is not None else ""
            elif isinstance(env, list):
                for item in env:
                    if "=" in item:
                        key, value = item.split("=", 1)
                        self.env_vars[key] = value
                    else:
                        self.env_vars[item] = ""
            env_files = service_config.get("env_file", [])
            if isinstance(env_files, str):
                env_files = [env_files]
            for env_file in env_files:
                self._extract_from_env_file(env_file)

    def _extract_from_env_file(self, env_file_path: str) -> None:
        file_path = self.compose_file.parent / env_file_path
        if not file_path.exists():
            self.log(f"Referenced env file not found: {file_path}", "WARNING")
            return
        try:
            with open(file_path, "r") as f:
                for line in f:
                    line = line.strip()
                    if not line or line.startswith("#"):
                        continue
                    if "=" in line:
                        key, value = line.split("=", 1)
                        if key not in self.env_vars:
                            self.env_vars[key] = value
        except Exception as e:
            self.log(f"Failed to read env file: {e}", "WARNING")

    def extract_variables_from_values(self) -> None:
        for service_config in self.compose_data.get("services", {}).values():
            if not isinstance(service_config, dict):
                continue
            config_str = json.dumps(service_config)
            matches = re.findall(r'\$\{([A-Z_][A-Z0-9_]*)\}', config_str)
            for var_name in matches:
                if var_name not in self.env_vars:
                    self.env_vars[var_name] = self._get_default_value(var_name)

    def _get_default_value(self, var_name: str) -> str:
        if var_name in self.COMMON_DEFAULTS:
            return self.COMMON_DEFAULTS[var_name]
        if "PASSWORD" in var_name:
            return "change_me_in_production"
        if "TOKEN" in var_name or "SECRET" in var_name or "KEY" in var_name:
            return "your_secret_here"
        if "URL" in var_name or "HOST" in var_name or "ENDPOINT" in var_name:
            return "http://localhost:8000"
        if "PORT" in var_name:
            return "8000"
        if "USERNAME" in var_name or "USER" in var_name:
            return "admin"
        if "EMAIL" in var_name:
            return "user@example.com"
        return ""

    def generate_env_content(self) -> str:
        lines = [
            "# Auto-generated environment variables from compose file",
            "# Update values as needed for your environment",
            "#",
        ]
        for key, value in sorted(self.env_vars.items()):
            if value:
                if any(c in value for c in [" ", "$", '"', "'"]):
                    value = f'"{value}"'
                lines.append(f"{key}={value}")
            else:
                lines.append(f"{key}=")
        lines.append("")
        return "\n".join(lines)

    def save_env_file(self, output_file: str, overwrite: bool = False) -> bool:
        output_path = Path(output_file)
        if output_path.exists() and not overwrite:
            self.error(f"File exists: {output_file} (use --force to overwrite)")
            return False
        try:
            with open(output_path, "w") as f:
                f.write(self.generate_env_content())
            os.chmod(output_path, 0o600)
            self.log(f"Saved env file: {output_file}")
            return True
        except Exception as e:
            self.error(f"Failed to save env file: {e}")
            return False

    def print_env_vars(self) -> None:
        if not self.env_vars:
            print("No environment variables found")
            return
        print(f"Found {len(self.env_vars)} environment variable(s):\n")
        for key, value in sorted(self.env_vars.items()):
            print(f"  {key}={value}" if value else f"  {key}=")

    def generate(self) -> bool:
        if not self.load_compose_file():
            return False
        self.extract_env_vars_from_compose()
        self.extract_variables_from_values()
        self.log(f"Extracted {len(self.env_vars)} environment variables")
        return True


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate .env files from compose files")
    parser.add_argument("--compose", "-c", required=True, help="Path to compose file")
    parser.add_argument("--output", "-o", default=".env", help="Output .env file path")
    parser.add_argument("--force", "-f", action="store_true", help="Overwrite existing file")
    parser.add_argument("--print", "-p", action="store_true", help="Print to stdout")
    parser.add_argument("--verbose", "-v", action="store_true", help="Verbose output")
    args = parser.parse_args()

    generator = EnvGenerator(args.compose, verbose=args.verbose)
    if not generator.generate():
        return 1

    if getattr(args, 'print'):
        generator.print_env_vars()
    else:
        if not generator.save_env_file(args.output, overwrite=args.force):
            return 1
        print(f"Generated .env file: {args.output}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
