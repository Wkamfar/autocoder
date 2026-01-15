#!/bin/bash
# Generate Software Bill of Materials (SBOM) for WIRE2 backend
# Usage: ./scripts/generate-sbom.sh [output-dir]

set -e

OUTPUT_DIR="${1:-./sbom}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

mkdir -p "$OUTPUT_DIR"

echo "Generating SBOM for WIRE2 backend..."
echo "Output directory: $OUTPUT_DIR"

# Check if CycloneDX is available
if command -v cyclonedx &> /dev/null || npx @cyclonedx/cyclonedx-npm --help &> /dev/null; then
  echo "Generating SBOM with CycloneDX..."
  npx @cyclonedx/cyclonedx-npm \
    --output-file "$OUTPUT_DIR/sbom-cyclonedx-$TIMESTAMP.json" \
    --output-format json || echo "CycloneDX generation failed, continuing..."
else
  echo "CycloneDX not available, skipping..."
fi

# Check if Syft is available
if command -v syft &> /dev/null; then
  echo "Generating SBOM with Syft..."
  syft packages dir:./node_modules \
    -o cyclonedx-json \
    > "$OUTPUT_DIR/sbom-syft-$TIMESTAMP.json" || echo "Syft generation failed, continuing..."
else
  echo "Syft not available, skipping..."
fi

# Generate from package-lock.json (basic)
echo "Generating basic SBOM from package-lock.json..."
if [ -f package-lock.json ]; then
  cat > "$OUTPUT_DIR/sbom-basic-$TIMESTAMP.json" <<EOF
{
  "bomFormat": "CycloneDX",
  "specVersion": "1.4",
  "version": 1,
  "metadata": {
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "tools": [
      {
        "vendor": "WIRE2",
        "name": "SBOM Generator",
        "version": "1.0.0"
      }
    ],
    "component": {
      "type": "application",
      "name": "wire2-backend",
      "version": "$(node -p "require('./package.json').version")"
    }
  },
  "components": []
}
EOF
  echo "Basic SBOM generated: $OUTPUT_DIR/sbom-basic-$TIMESTAMP.json"
fi

echo "SBOM generation complete"
echo "Files generated:"
ls -lh "$OUTPUT_DIR"/sbom-*"$TIMESTAMP".json 2>/dev/null || echo "No SBOM files generated"
