#!/bin/bash

###############################################################################
# validate_compose.sh
#
# Validates Docker/Podman Compose files
#
# Usage:
#   ./validate_compose.sh --file docker-compose.yml
#   ./validate_compose.sh --file docker-compose.yml --runtime podman --strict
#
# Exit Codes:
#   0 - Validation successful
#   1 - Validation failed
#   2 - Invalid arguments
###############################################################################

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

COMPOSE_FILE=""
STRICT_MODE=false
VERBOSE=false
RUNTIME="docker"  # docker or podman

show_help() {
    cat << EOF
Validate Docker/Podman Compose files

Usage: $(basename "$0") [OPTIONS]

Options:
    -f, --file FILE      Path to compose file (required)
    -r, --runtime RT     Runtime: docker or podman (default: docker)
    -s, --strict         Enable strict validation
    -v, --verbose        Verbose output
    -h, --help           Show this help

EOF
    exit 0
}

log_error() { echo -e "${RED}ERROR:${NC} $*" >&2; }
log_success() { echo -e "${GREEN}SUCCESS:${NC} $*"; }
log_warning() { echo -e "${YELLOW}WARNING:${NC} $*"; }
log_info() { [[ "$VERBOSE" == "true" ]] && echo -e "${YELLOW}INFO:${NC} $*"; }

check_dependencies() {
    case "$RUNTIME" in
        docker)
            command -v docker &>/dev/null || { log_error "docker not installed"; return 1; }
            ;;
        podman)
            command -v podman &>/dev/null || { log_error "podman not installed"; return 1; }
            ;;
    esac
    log_info "Dependencies OK"
}

validate_yaml_syntax() {
    log_info "Validating YAML syntax..."
    case "$RUNTIME" in
        docker)
            docker compose -f "$COMPOSE_FILE" config > /dev/null 2>&1 || {
                log_error "YAML validation failed"
                docker compose -f "$COMPOSE_FILE" config 2>&1 | head -20
                return 1
            }
            ;;
        podman)
            podman compose -f "$COMPOSE_FILE" config > /dev/null 2>&1 || {
                log_warning "Podman compose config failed — checking YAML syntax only"
                python3 -c "import yaml; yaml.safe_load(open('$COMPOSE_FILE'))" 2>/dev/null || {
                    log_error "YAML syntax error"
                    return 1
                }
            }
            ;;
    esac
    log_success "YAML syntax is valid"
}

validate_podman_compatibility() {
    if [[ "$RUNTIME" != "podman" ]]; then
        return 0
    fi

    log_info "Checking Podman compatibility..."
    local warnings=0

    # Check for privileged ports
    if grep -qE '^\s*-\s*"?(80|443|[0-9]{1,3}):(80|443)' "$COMPOSE_FILE"; then
        log_warning "Privileged ports (< 1024) detected — may fail in rootless Podman"
        warnings=$((warnings + 1))
    fi

    # Check for deploy.replicas (not supported)
    if grep -q 'replicas:' "$COMPOSE_FILE"; then
        log_warning "'replicas' not supported in Podman (Swarm feature)"
        warnings=$((warnings + 1))
    fi

    # Check for missing SELinux labels on bind mounts
    if grep -qE '^\s*-\s*\./' "$COMPOSE_FILE"; then
        if ! grep -qE ':z\b|:Z\b' "$COMPOSE_FILE"; then
            log_warning "Bind mounts without SELinux labels (:z/:Z) — may fail on RHEL/Fedora"
            warnings=$((warnings + 1))
        fi
    fi

    # Check for default network reliance
    if ! grep -q 'networks:' "$COMPOSE_FILE"; then
        log_warning "No custom networks defined — DNS resolution may not work in Podman"
        warnings=$((warnings + 1))
    fi

    if [[ $warnings -gt 0 ]]; then
        log_warning "$warnings Podman compatibility warning(s) found"
    else
        log_success "No Podman compatibility issues detected"
    fi
}

validate_strict_mode() {
    [[ "$STRICT_MODE" != "true" ]] && return 0
    log_info "Running strict checks..."
    local warnings=0

    if ! grep -q 'healthcheck:' "$COMPOSE_FILE"; then
        log_warning "No health checks defined"
        warnings=$((warnings + 1))
    fi

    if ! grep -q 'restart:' "$COMPOSE_FILE"; then
        log_warning "No restart policies defined"
        warnings=$((warnings + 1))
    fi

    [[ $warnings -gt 0 ]] && log_warning "Strict mode: $warnings warning(s)"
}

main() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            -f|--file) COMPOSE_FILE="$2"; shift 2 ;;
            -r|--runtime) RUNTIME="$2"; shift 2 ;;
            -s|--strict) STRICT_MODE=true; shift ;;
            -v|--verbose) VERBOSE=true; shift ;;
            -h|--help) show_help ;;
            *) log_error "Unknown option: $1"; exit 2 ;;
        esac
    done

    [[ -z "$COMPOSE_FILE" ]] && { log_error "Compose file required"; exit 2; }
    [[ ! -f "$COMPOSE_FILE" ]] && { log_error "File not found: $COMPOSE_FILE"; exit 1; }

    check_dependencies || exit 1
    validate_yaml_syntax || exit 1
    validate_podman_compatibility
    validate_strict_mode

    log_success "Compose file validation complete"
}

main "$@"
