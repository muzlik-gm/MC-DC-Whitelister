#!/bin/bash

set -euo pipefail

# Deploy script for MC-DC-Whitelister
# This script is path-independent and production-ready

# Configuration
LOG_FILE="deploy.log"
BACKUP_DIR="backup"
ROLLBACK_FILE="${BACKUP_DIR}/rollback-info"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
REPO_DIR="$HOME"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $*" | tee -a "${LOG_FILE}"
}

error() {
    echo -e "${RED}[$(date '+%Y-%m-%d %H:%M:%S')] ERROR:${NC} $*" | tee -a "${LOG_FILE}" >&2
}

warn() {
    echo -e "${YELLOW}[$(date '+%Y-%m-%d %H:%M:%S')] WARN:${NC} $*" | tee -a "${LOG_FILE}" >&2
}

# Function to check if bot is healthy
check_bot_health() {
    log "Checking if Discord bot is healthy..."
    
    # Check if the bot process is running
    if ! pgrep -f "node src/index.js" > /dev/null; then
        warn "Bot process is not running. Starting it..."
        cd "${REPO_DIR}"
        npm --prefix discord-bot start >> "${LOG_FILE}" 2>&1 &
        sleep 5
        
        # Verify the bot is now running
        if ! pgrep -f "node src/index.js" > /dev/null; then
            error "Failed to start the bot. Check logs."
            return 1
        fi
        log "Bot started successfully."
    else
        log "Bot is already running."
    fi
    
    # Check if the systemd service is running
    if systemctl is-active --quiet whitelist-bot; then
        log "Systemd service 'whitelist-bot' is running."
    else
        warn "Systemd service 'whitelist-bot' is not running."
    fi
    
    log "Bot health check completed."
    return 0
}

# Function to check if plugin is healthy after deployment
check_plugin_health() {
    log "Checking if plugin is healthy after deployment..."
    
    # Navigate to the project directory
    cd "${REPO_DIR}"
    
    # Wait a bit for the plugin to start
    sleep 10
    
    # Try to access the plugin status endpoint
    local max_attempts=5
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        log "Health check attempt $attempt/$max_attempts..."
        
        # Check if the web server is responding
        # The plugin typically runs on port 25252 for WhitelistBot
        if curl -s --max-time 5 http://localhost:25252/api/status > /dev/null; then
            log "Plugin health check passed - API is responding."
            return 0
        fi
        
        warn "API health check failed (attempt $attempt/$max_attempts)"
        sleep 5
        attempt=$((attempt + 1))
    done
    
    error "Plugin health check failed - API not responding after $max_attempts attempts."
    return 1
}

# Function to save state for rollback
backup_state() {
    log "Saving state for rollback..."
    
    # Create backup directory if it doesn't exist
    mkdir -p "${BACKUP_DIR}"
    
    # Save current git state
    cd "${REPO_DIR}"
    git status > "${BACKUP_DIR}/git_status_${TIMESTAMP}.txt" 2>&1
    git diff > "${BACKUP_DIR}/git_diff_${TIMESTAMP}.txt" 2>&1
    git rev-parse HEAD > "${BACKUP_DIR}/git_commit_${TIMESTAMP}.txt" 2>&1
    
    # Save plugin state (if it exists)
    if [ -d "minecraft-plugin" ]; then
        cp -r "minecraft-plugin/target" "${BACKUP_DIR}/target_${TIMESTAMP}/" 2>/dev/null || true
        cp "minecraft-plugin/src/main/resources/config.yml" "${BACKUP_DIR}/config_${TIMESTAMP}.yml" 2>/dev/null || true
    fi
    
    # Save discord-bot state
    if [ -d "discord-bot" ]; then
        cp -r "discord-bot/node_modules" "${BACKUP_DIR}/node_modules_${TIMESTAMP}/" 2>/dev/null || true
        cp "discord-bot/package.json" "${BACKUP_DIR}/package_${TIMESTAMP}.json" 2>/dev/null || true
    fi
    
    # Save systemd service state
    if [ -f "/etc/systemd/system/whitelist-bot.service" ]; then
        cp "/etc/systemd/system/whitelist-bot.service" "${BACKUP_DIR}/whitelist-bot.service_${TIMESTAMP}" 2>/dev/null || true
    fi
    
    # Save rollback info
    echo "${REPO_DIR}" > "${ROLLBACK_FILE}"
    echo "${TIMESTAMP}" >> "${ROLLBACK_FILE}"
    
    log "State saved for rollback (timestamp: ${TIMESTAMP})."
}

# Function to rollback deployment
perform_rollback() {
    log "Performing rollback..."
    
    if [ ! -f "${ROLLBACK_FILE}" ]; then
        error "No rollback information found. Cannot rollback."
        return 1
    fi
    
    local rollback_dir=$(head -n 1 "${ROLLBACK_FILE}")
    local rollback_timestamp=$(tail -n 1 "${ROLLBACK_FILE}")
    
    log "Rolling back to state at ${rollback_timestamp} in ${rollback_dir}..."
    
    # Stop the bot
    log "Stopping whitelist-bot service..."
    systemctl stop whitelist-bot 2>/dev/null || pkill -f "node src/index.js" || true
    
    # Navigate to the backup directory
    cd "${rollback_dir}"
    
    # Restore git state
    log "Restoring git state..."
    git reset --hard 2>/dev/null || warn "Failed to reset git - continuing..."
    git clean -fd 2>/dev/null || warn "Failed to clean git - continuing..."
    
    # Find and apply the correct backup
    local found_backup=false
    for backup_dir in "${BACKUP_DIR}"/*; do
        if [ -d "${backup_dir}" ]; then
            local backup_timestamp="${backup_dir##*/}"
            if [ "${backup_timestamp}" = "rollback-info" ]; then
                continue
            fi
            
            # Check if this is our target backup
            local target_file="${backup_dir}/git_commit_${rollback_timestamp}.txt"
            if [ -f "${target_file}" ]; then
                log "Found backup: ${target_file}"
                
                # Restore the git commit
                local saved_commit=$(cat "${target_file}")
                git checkout "${saved_commit}" 2>/dev/null || warn "Failed to checkout git commit - continuing..."
                
                # Restore other files if they exist
                if [ -d "${backup_dir}/target_${rollback_timestamp}" ]; then
                    cp -r "${backup_dir}/target_${rollback_timestamp}/" "minecraft-plugin/target/" 2>/dev/null || warn "Failed to restore target directory - continuing..."
                fi
                
                if [ -f "${backup_dir}/config_${rollback_timestamp}.yml" ]; then
                    cp "${backup_dir}/config_${rollback_timestamp}.yml" "minecraft-plugin/src/main/resources/config.yml" 2>/dev/null || warn "Failed to restore config - continuing..."
                fi
                
                if [ -d "${backup_dir}/node_modules_${rollback_timestamp}" ]; then
                    rm -rf "discord-bot/node_modules" 2>/dev/null || warn "Failed to clean node_modules - continuing..."
                    cp -r "${backup_dir}/node_modules_${rollback_timestamp}/" "discord-bot/node_modules/" 2>/dev/null || warn "Failed to restore node_modules - continuing..."
                fi
                
                if [ -f "${backup_dir}/package_${rollback_timestamp}.json" ]; then
                    cp "${backup_dir}/package_${rollback_timestamp}.json" "discord-bot/package.json" 2>/dev/null || warn "Failed to restore package.json - continuing..."
                fi
                
                found_backup=true
                log "Rollback completed successfully."
                break
            fi
        fi
    done
    
    if [ "$found_backup" = false ]; then
        error "No matching backup found for rollback. Manual intervention required."
        return 1
    fi
    
    # Install dependencies
    log "Installing dependencies..."
    if [ -f "discord-bot/package.json" ]; then
        npm --prefix discord-bot install 2>&1 | tee -a "${LOG_FILE}" || warn "Failed to install dependencies - continuing..."
    fi
    
    # Rebuild and restart the plugin
    log "Rebuilding and restarting plugin..."
    if [ -d "minecraft-plugin" ]; then
        cd "minecraft-plugin"
        mvn clean package -DskipTests 2>&1 | tee -a "${LOG_FILE}" || warn "Failed to build plugin - continuing..."
        cd ".."
    fi
    
    # Restart the bot
    log "Starting whitelist-bot service..."
    systemctl start whitelist-bot 2>/dev/null || (
        cd "${rollback_dir}"
        npm --prefix discord-bot start >> "${LOG_FILE}" 2>&1 &
    )
    
    # Clear rollback info
    rm -f "${ROLLBACK_FILE}"
    
    log "Rollback completed."
}

# Main deployment function
deploy() {
    log "Starting deployment..."
    
    # Navigate to the project directory
    cd "${REPO_DIR}"
    
    # Save state for potential rollback
    backup_state
    
    # Pull the latest changes
    log "Pulling latest changes from git..."
    git reset --hard 2>&1 | tee -a "${LOG_FILE}" || error "Failed to reset git. Aborting."; exit 1
    git clean -fd 2>&1 | tee -a "${LOG_FILE}" || warn "Failed to clean git - continuing..."
    git pull origin main 2>&1 | tee -a "${LOG_FILE}" || {
        error "Failed to pull from git. Aborting."; perform_rollback; exit 1
    }
    
    # Install dependencies
    log "Installing dependencies..."
    npm --prefix discord-bot install 2>&1 | tee -a "${LOG_FILE}" || {
        error "Failed to install dependencies. Aborting."; perform_rollback; exit 1
    }
    
    # Build the plugin (if it's a Java project)
    if [ -d "minecraft-plugin" ]; then
        log "Building Minecraft plugin..."
        cd minecraft-plugin
        mvn clean package -DskipTests 2>&1 | tee -a "${LOG_FILE}" || {
            error "Failed to build plugin. Aborting."; cd ..; perform_rollback; exit 1
        }
        cd ..
    fi
    
    # Stop the bot before deployment
    log "Stopping whitelist-bot service..."
    systemctl stop whitelist-bot 2>/dev/null || pkill -f "node src/index.js" || warn "Failed to stop bot - continuing..."
    
    # Deploy the changes (copy files)
    log "Deploying changes..."
    
    # Ensure backup exists and is up-to-date
    if [ ! -d "${BACKUP_DIR}" ]; then
        mkdir -p "${BACKUP_DIR}"
    fi
    
    # Copy the plugin target directory
    if [ -d "minecraft-plugin/target" ]; then
        cp -r "minecraft-plugin/target" "${BACKUP_DIR}/target_${TIMESTAMP}/"
    fi
    
    # Copy discord-bot files
    if [ -d "discord-bot/node_modules" ]; then
        cp -r "discord-bot/node_modules" "${BACKUP_DIR}/node_modules_${TIMESTAMP}/"
    fi
    
    # Copy other important files
    cp "discord-bot/package.json" "${BACKUP_DIR}/package_${TIMESTAMP}.json" 2>/dev/null || true
    cp "minecraft-plugin/src/main/resources/config.yml" "${BACKUP_DIR}/config_${TIMESTAMP}.yml" 2>/dev/null || true
    
    # Start the bot
    log "Starting whitelist-bot service..."
    systemctl start whitelist-bot 2>/dev/null || (
        cd "${REPO_DIR}"
        npm --prefix discord-bot start >> "${LOG_FILE}" 2>&1 &
    )
    
    # Wait a bit for the bot to start
    sleep 5
    
    # Verify bot is running
    if ! pgrep -f "node src/index.js" > /dev/null; then
        error "Bot failed to start after deployment. Aborting."; perform_rollback; exit 1
    fi
    
    # Health checks
    if ! check_bot_health; then
        error "Bot health check failed. Aborting."; perform_rollback; exit 1
    fi
    
    if ! check_plugin_health; then
        error "Plugin health check failed. Aborting."; perform_rollback; exit 1
    fi
    
    log "Deployment completed successfully."
}

# Trap signals to handle rollback
trap '{
    error "Deployment interrupted by user. Initiating rollback..."
    perform_rollback
    exit 1
}' INT TERM

# Run the deployment
main() {
    log "=== MC-DC-Whitelister Deployment Started ==="
    deploy
    log "=== MC-DC-Whitelister Deployment Completed ==="
}

main "$@"