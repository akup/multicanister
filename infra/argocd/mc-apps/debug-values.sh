#!/bin/bash

echo "Debugging Helm template rendering..."

cd apps/test-app

echo "1. Checking current values:"
helm get values test-app 2>/dev/null || echo "No existing release found"

echo ""
echo "2. Testing template rendering with debug:"
helm template test-app . --debug --values values.yaml

echo ""
echo "3. Testing with dependency update:"
helm dependency update
helm template test-app . --debug --values values.yaml

echo ""
echo "4. Checking if serviceAccount values are present:"
helm template test-app . --values values.yaml | grep -A 10 -B 5 "serviceAccount" 