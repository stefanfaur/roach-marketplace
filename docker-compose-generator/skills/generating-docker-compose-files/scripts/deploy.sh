#!/bin/bash

###############################################################################
# deploy.sh
#
# Deploy Docker/Podman Compose file to local, Swarm, or Kubernetes
#
# Usage:
#   ./deploy.sh --compose docker-compose.yml --target docker
#   ./deploy.sh --compose docker-compose.yml --target podman
#   ./deploy.sh --compose docker-compose.yml --target swarm --stack-name myapp
#   ./deploy.sh --compose docker-compose.yml --target kubernetes --namespace prod
#
# Exit Codes:
#   0 - Deployment successful
#   1 - Deployment failed
#   2 - Invalid arguments
###############################################################################

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

COMPOSE_FILE=""
TARGET_PLATFORM=""
NAMESPACE="default"
STACK_NAME=""
DRY_RUN=false
VERBOSE=false
WAIT_FOR_READY=false

show_help() {
    cat << EOF
Deploy Docker/Podman Compose files

Usage: $(basename "$0") [OPTIONS]

Options:
    -c, --compose FILE       Path to compose file (required)
    -t, --target PLATFORM    Target: docker, podman, swarm, kubernetes (required)
    -n, --namespace NS       Kubernetes namespace (default: default)
    -s, --stack-name NAME    Stack name for Swarm deployment
    --dry-run               Show what would be deployed without executing
    --wait                  Wait for deployment to be ready
    -v, --verbose           Enable verbose output
    -h, --help              Show this help message

EOF
    exit 0
}

log_error() { echo -e "${RED}ERROR:${NC} $*" >&2; }
log_success() { echo -e "${GREEN}SUCCESS:${NC} $*"; }
log_warning() { echo -e "${YELLOW}WARNING:${NC} $*"; }
log_info() { echo -e "${BLUE}INFO:${NC} $*"; }
log_step() { echo -e "${BLUE}>>>${NC} $*"; }

run_command() {
    local cmd="$*"
    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "[DRY RUN] $cmd"
        return 0
    fi
    if [[ "$VERBOSE" == "true" ]]; then
        log_info "Executing: $cmd"
    fi
    eval "$cmd"
}

check_dependencies() {
    local platform="$1"
    local missing_deps=0

    log_step "Checking dependencies..."

    case "$platform" in
        docker)
            command -v docker &>/dev/null || { log_error "docker not installed"; missing_deps=$((missing_deps + 1)); }
            ;;
        podman)
            command -v podman &>/dev/null || { log_error "podman not installed"; missing_deps=$((missing_deps + 1)); }
            ;;
        swarm)
            command -v docker &>/dev/null || { log_error "docker not installed"; missing_deps=$((missing_deps + 1)); }
            ;;
        kubernetes)
            command -v kubectl &>/dev/null || { log_error "kubectl not installed"; missing_deps=$((missing_deps + 1)); }
            command -v kompose &>/dev/null || log_warning "kompose not installed (needed for compose conversion)"
            ;;
    esac

    if [[ $missing_deps -gt 0 ]]; then
        log_error "Missing $missing_deps required dependencies"
        return 1
    fi

    log_success "All dependencies available"
}

validate_compose_file() {
    log_step "Validating compose file..."

    if [[ ! -f "$COMPOSE_FILE" ]]; then
        log_error "Compose file not found: $COMPOSE_FILE"
        return 1
    fi

    case "$TARGET_PLATFORM" in
        docker|swarm)
            docker compose -f "$COMPOSE_FILE" config > /dev/null 2>&1 || {
                log_error "Compose file validation failed"
                docker compose -f "$COMPOSE_FILE" config 2>&1 | head -20
                return 1
            }
            ;;
        podman)
            podman compose -f "$COMPOSE_FILE" config > /dev/null 2>&1 || {
                log_warning "Compose validation via podman failed, trying syntax check only"
            }
            ;;
    esac

    log_success "Compose file is valid"
}

deploy_docker() {
    log_step "Deploying with Docker Compose..."
    run_command "docker compose -f '$COMPOSE_FILE' up -d" || { log_error "Failed to start services"; return 1; }
    log_success "Services started"
    if [[ "$WAIT_FOR_READY" == "true" ]]; then
        sleep 5
        docker compose -f "$COMPOSE_FILE" ps
    fi
}

deploy_podman() {
    log_step "Deploying with Podman Compose..."
    run_command "podman compose -f '$COMPOSE_FILE' up -d" || { log_error "Failed to start services"; return 1; }
    log_success "Services started"
    if [[ "$WAIT_FOR_READY" == "true" ]]; then
        sleep 5
        podman compose -f "$COMPOSE_FILE" ps
    fi
}

deploy_swarm() {
    log_step "Deploying to Docker Swarm..."
    if ! docker info --format='{{.Swarm.LocalNodeState}}' | grep -q "active"; then
        log_error "Docker Swarm is not initialized. Run: docker swarm init"
        return 1
    fi
    local stack_name="${STACK_NAME:-compose_app}"
    run_command "docker stack deploy -c '$COMPOSE_FILE' '$stack_name'" || { log_error "Failed to deploy stack"; return 1; }
    log_success "Stack deployed: $stack_name"
}

deploy_kubernetes() {
    log_step "Deploying to Kubernetes..."
    kubectl cluster-info &>/dev/null || { log_error "Cannot connect to Kubernetes cluster"; return 1; }
    command -v kompose &>/dev/null || { log_error "kompose required for compose conversion"; return 1; }

    kubectl get namespace "$NAMESPACE" &>/dev/null || run_command "kubectl create namespace '$NAMESPACE'"

    local temp_dir
    temp_dir=$(mktemp -d)
    trap "rm -rf $temp_dir" EXIT

    kompose -f "$COMPOSE_FILE" convert -o "$temp_dir" 2>&1 || { log_error "Conversion failed"; return 1; }
    run_command "kubectl apply -f '$temp_dir' -n '$NAMESPACE'" || { log_error "Apply failed"; return 1; }

    log_success "Kubernetes deployment complete"
    if [[ "$WAIT_FOR_READY" == "true" ]]; then
        run_command "kubectl wait --for=condition=available --timeout=300s deployment --all -n '$NAMESPACE'"
    fi
    kubectl get all -n "$NAMESPACE"
}

main() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            -c|--compose) COMPOSE_FILE="$2"; shift 2 ;;
            -t|--target) TARGET_PLATFORM="$2"; shift 2 ;;
            -n|--namespace) NAMESPACE="$2"; shift 2 ;;
            -s|--stack-name) STACK_NAME="$2"; shift 2 ;;
            --dry-run) DRY_RUN=true; shift ;;
            --wait) WAIT_FOR_READY=true; shift ;;
            -v|--verbose) VERBOSE=true; shift ;;
            -h|--help) show_help ;;
            *) log_error "Unknown option: $1"; exit 2 ;;
        esac
    done

    [[ -z "$COMPOSE_FILE" ]] && { log_error "Compose file required"; exit 2; }
    [[ -z "$TARGET_PLATFORM" ]] && { log_error "Target platform required (docker, podman, swarm, kubernetes)"; exit 2; }
    [[ "$TARGET_PLATFORM" =~ ^(docker|podman|swarm|kubernetes)$ ]] || { log_error "Invalid platform: $TARGET_PLATFORM"; exit 2; }

    check_dependencies "$TARGET_PLATFORM" || exit 1
    validate_compose_file || exit 1

    case "$TARGET_PLATFORM" in
        docker) deploy_docker ;;
        podman) deploy_podman ;;
        swarm) deploy_swarm ;;
        kubernetes) deploy_kubernetes ;;
    esac

    log_success "Deployment completed"
}

main "$@"
