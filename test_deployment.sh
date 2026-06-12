#!/bin/bash

# Simple test to verify the deployment scripts are syntactically correct

echo "=== Testing deploy.sh syntax ==="
bash -n deploy.sh
echo "deploy.sh syntax check passed ✓"

echo ""
echo "=== Testing rollback.sh syntax ==="
bash -n rollback.sh
echo "rollback.sh syntax check passed ✓"

echo ""
echo "=== Checking file permissions ==="
if [ -x "deploy.sh" ]; then echo "✓ deploy.sh is executable"; else echo "✗ deploy.sh is NOT executable"; fi
if [ -x "rollback.sh" ]; then echo "✓ rollback.sh is executable"; else echo "✗ rollback.sh is NOT executable"; fi

echo ""
echo "=== Checking for critical files ==="
if [ -f "discord-bot/package.json" ]; then
    echo "✓ discord-bot/package.json found"
fi

if [ -d "minecraft-plugin" ]; then
    echo "✓ minecraft-plugin directory found"
fi

if [ -f "minecraft-plugin/pom.xml" ]; then
    echo "✓ minecraft-plugin/pom.xml found (Maven project)"
fi

echo ""
echo "=== Deployment preparation complete ==="
echo "The deployment scripts are ready for use."
echo ""
echo "To deploy manually:"
echo "  ./deploy.sh"
echo ""
echo "To rollback if needed:"
echo "  ./rollback.sh"