#!/bin/bash
# Skill validation helper
set -e

echo "Validating skill..."

if [ ! -f "../SKILL.md" ]; then
    echo "Error: SKILL.md not found"
    exit 1
fi

if ! grep -q "^---$" "../SKILL.md"; then
    echo "Error: No frontmatter found"
    exit 1
fi

if ! grep -q "^name:" "../SKILL.md"; then
    echo "Error: Missing 'name' field"
    exit 1
fi

if ! grep -q "^description:" "../SKILL.md"; then
    echo "Error: Missing 'description' field"
    exit 1
fi

echo "Skill validation passed"
