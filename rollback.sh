#!/bin/bash

set -euo pipefail

# Rollback script for MC-DC-Whitelister
# Restores previous version on deployment failure

# Configuration
LOG_FILE="deploy.log"
BACKUP_DIR="backup"
ROLLBACK_FILE="${BACKUP_DIR}/rollback-info"

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

# Function to perform rollback
perform_rollback() {
    log "Starting manual rollback..."
    
    if [ ! -f "${ROLLBACK_FILE}" ]; then
        error "No rollback information found. Cannot rollback."
        log "Available backups:"
        ls -la "${BACKUP_DIR}" 2>/dev/null | grep -v "rollback-info" || error "No backup directory found."
        return 1
    fi
    
    local rollback_dir=$(head -n 1 "${ROLLBACK_FILE}")
    local rollback_timestamp=$(tail -n 1 "${ROLLBACK_FILE}")
    
    log "Rolling back to state at ${rollback_timestamp} in ${rollback_dir}..."
    
    # Stop the bot
    log "Stopping whitelist-bot service..."
    systemctl stop whitelist-bot 2>/dev/null || pkill -f "node src/index.js" || warn "Failed to stop bot - continuing..."
    
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
    
    log "Rollback completed successfully."
}

# Main rollback function
main() {
    log "=== MC-DC-Whitelister Manual Rollback Started ==="
    perform_rollback
    log "=== MC-DC-Whitelister Manual Rollback Completed ==="
}

main "$@"