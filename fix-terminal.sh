#!/bin/bash
# Terminal Fix Script for Cursor IDE

echo "🔧 Fixing terminal rendering..."

# Reset terminal settings
export TERM=xterm-256color

# Clear any stuck escape sequences
printf '\033c'

# Reset stty settings
stty sane 2>/dev/null

# Clear screen
clear

echo "✅ Terminal should be fixed!"
echo "If you can see this message, your terminal is working."
echo ""
echo "Try typing: echo 'Hello World'"
