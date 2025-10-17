#!/bin/bash

##############################################################################
# Fly.io Deployment Script
#
# This script automates the deployment of the Wedding Guest Management
# backend to Fly.io, including database setup and configuration.
#
# Usage:
#   ./scripts/deploy-flyio.sh [command]
#
# Commands:
#   setup       - Initial setup (database + app)
#   deploy      - Deploy application only
#   migrate     - Run database migrations
#   status      - Check application status
#   logs        - View application logs
#   rollback    - Rollback to previous version
#   help        - Show this help message
#
##############################################################################

set -e  # Exit on error

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
APP_NAME="la-wed-backend"
DB_NAME="la-wed-database"
REGION="sin"  # Singapore
DB_SIZE="shared-cpu-1x"
DB_VOLUME_SIZE="1"

# Helper functions
print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_header() {
    echo ""
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}========================================${NC}"
    echo ""
}

# Check if flyctl is installed
check_flyctl() {
    if ! command -v flyctl &> /dev/null; then
        print_error "flyctl is not installed"
        echo "Please install flyctl: https://fly.io/docs/hands-on/install-flyctl/"
        exit 1
    fi
    print_success "flyctl is installed"
}

# Check if user is logged in
check_auth() {
    if ! flyctl auth whoami &> /dev/null; then
        print_error "Not logged in to Fly.io"
        echo "Please run: flyctl auth login"
        exit 1
    fi
    print_success "Authenticated with Fly.io"
}

# Setup database
setup_database() {
    print_header "Setting up Fly.io PostgreSQL Database"
    
    # Check if database already exists
    if flyctl status --app "$DB_NAME" &> /dev/null; then
        print_warning "Database '$DB_NAME' already exists"
        read -p "Do you want to continue with existing database? (y/n) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            print_info "Skipping database setup"
            return 0
        fi
    else
        print_info "Creating PostgreSQL database..."
        flyctl postgres create \
            --name "$DB_NAME" \
            --region "$REGION" \
            --initial-cluster-size 1 \
            --vm-size "$DB_SIZE" \
            --volume-size "$DB_VOLUME_SIZE"
        
        print_success "Database created successfully"
        print_warning "IMPORTANT: Save the database credentials shown above!"
    fi
}

# Setup application
setup_app() {
    print_header "Setting up Fly.io Application"
    
    # Check if app already exists
    if flyctl status --app "$APP_NAME" &> /dev/null; then
        print_warning "Application '$APP_NAME' already exists"
    else
        print_info "Creating application..."
        
        # Check if fly.toml exists
        if [ ! -f "fly.toml" ]; then
            print_error "fly.toml not found"
            exit 1
        fi
        
        flyctl apps create "$APP_NAME" --org personal
        print_success "Application created"
    fi
    
    # Attach database
    print_info "Attaching database to application..."
    flyctl postgres attach "$DB_NAME" --app "$APP_NAME" || true
    print_success "Database attached"
}

# Set secrets
setup_secrets() {
    print_header "Setting up Secrets"
    
    print_warning "You need to set the following secrets manually:"
    echo ""
    echo "Required secrets:"
    echo "  - DIRECT_URL"
    echo "  - CORS_ORIGIN"
    echo "  - FRONTEND_URL"
    echo ""
    echo "Optional secrets (for Cloudflare R2):"
    echo "  - R2_ENDPOINT"
    echo "  - R2_ACCESS_KEY_ID"
    echo "  - R2_SECRET_ACCESS_KEY"
    echo "  - R2_BUCKET_NAME"
    echo "  - R2_PUBLIC_URL"
    echo ""
    
    read -p "Do you want to set secrets now? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        print_info "Opening secrets configuration..."
        echo ""
        echo "Run these commands to set secrets:"
        echo ""
        echo "flyctl secrets set \\"
        echo "  DIRECT_URL=\"postgres://postgres:[PASSWORD]@$DB_NAME.internal:5432/[DB_NAME]?sslmode=disable\" \\"
        echo "  CORS_ORIGIN=\"https://ngocquanwd.com\" \\"
        echo "  FRONTEND_URL=\"https://ngocquanwd.com\" \\"
        echo "  --app $APP_NAME"
        echo ""
    fi
}

# Deploy application
deploy() {
    print_header "Deploying Application to Fly.io"
    
    check_flyctl
    check_auth
    
    # Check if app exists
    if ! flyctl status --app "$APP_NAME" &> /dev/null; then
        print_error "Application '$APP_NAME' does not exist"
        echo "Run: ./scripts/deploy-flyio.sh setup"
        exit 1
    fi
    
    print_info "Building and deploying..."
    flyctl deploy --app "$APP_NAME"
    
    print_success "Deployment completed"
    
    # Show app URL
    APP_URL=$(flyctl info --app "$APP_NAME" --json | grep -o '"Hostname":"[^"]*"' | cut -d'"' -f4)
    print_success "Application URL: https://$APP_URL"
}

# Run database migrations
run_migrations() {
    print_header "Running Database Migrations"
    
    check_flyctl
    check_auth
    
    print_info "Opening SSH console..."
    print_warning "Once connected, run: npm run prisma:migrate:deploy"
    
    flyctl ssh console --app "$APP_NAME"
}

# Check application status
check_status() {
    print_header "Application Status"
    
    check_flyctl
    check_auth
    
    print_info "App status:"
    flyctl status --app "$APP_NAME"
    
    echo ""
    print_info "Database status:"
    flyctl status --app "$DB_NAME"
    
    echo ""
    print_info "Recent logs:"
    flyctl logs --app "$APP_NAME" | tail -20
}

# View logs
view_logs() {
    print_header "Application Logs"
    
    check_flyctl
    check_auth
    
    print_info "Streaming logs (Ctrl+C to exit)..."
    flyctl logs --app "$APP_NAME"
}

# Rollback deployment
rollback() {
    print_header "Rollback Deployment"
    
    check_flyctl
    check_auth
    
    print_warning "This will rollback to the previous version"
    read -p "Are you sure? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_info "Rollback cancelled"
        exit 0
    fi
    
    print_info "Rolling back..."
    # Get previous version
    CURRENT_VERSION=$(flyctl releases --app "$APP_NAME" --json | grep -o '"Version":[0-9]*' | head -1 | cut -d':' -f2)
    PREVIOUS_VERSION=$((CURRENT_VERSION - 1))
    
    if [ $PREVIOUS_VERSION -lt 1 ]; then
        print_error "No previous version to rollback to"
        exit 1
    fi
    
    flyctl releases rollback "v$PREVIOUS_VERSION" --app "$APP_NAME"
    print_success "Rolled back to v$PREVIOUS_VERSION"
}

# Complete setup (database + app + deploy)
complete_setup() {
    print_header "Complete Fly.io Setup"
    
    check_flyctl
    check_auth
    
    setup_database
    setup_app
    setup_secrets
    
    print_success "Setup completed!"
    print_info "Next steps:"
    echo "  1. Set secrets (if not done already)"
    echo "  2. Run: ./scripts/deploy-flyio.sh deploy"
    echo "  3. Run migrations: ./scripts/deploy-flyio.sh migrate"
    echo "  4. Verify: ./scripts/deploy-flyio.sh status"
}

# Show help
show_help() {
    cat << EOF
Fly.io Deployment Script

Usage:
  ./scripts/deploy-flyio.sh [command]

Commands:
  setup       - Initial setup (database + app)
  deploy      - Deploy application only
  migrate     - Run database migrations
  status      - Check application status
  logs        - View application logs
  rollback    - Rollback to previous version
  help        - Show this help message

Examples:
  # Initial setup
  ./scripts/deploy-flyio.sh setup

  # Deploy application
  ./scripts/deploy-flyio.sh deploy

  # Run migrations
  ./scripts/deploy-flyio.sh migrate

  # Check status
  ./scripts/deploy-flyio.sh status

  # View logs
  ./scripts/deploy-flyio.sh logs

For more information, see MIGRATION-GUIDE-FLYIO.md
EOF
}

# Main script
main() {
    case "${1:-help}" in
        setup)
            complete_setup
            ;;
        deploy)
            deploy
            ;;
        migrate)
            run_migrations
            ;;
        status)
            check_status
            ;;
        logs)
            view_logs
            ;;
        rollback)
            rollback
            ;;
        help|--help|-h)
            show_help
            ;;
        *)
            print_error "Unknown command: $1"
            echo ""
            show_help
            exit 1
            ;;
    esac
}

# Run main function
main "$@"
