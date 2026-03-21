#!/usr/bin/env bash
# Process every PDF/image in invoices/ with invoice-link (heuristic by default).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
INV="${ROOT}/invoices"
if [[ ! -d "$INV" ]]; then
  echo "Missing folder: $INV" >&2
  exit 1
fi
shopt -s nullglob
files=("$INV"/*.{pdf,png,jpg,jpeg,webp,tiff,tif})
if [[ ${#files[@]} -eq 0 ]]; then
  echo "No PDF or images in $INV"
  exit 0
fi
for f in "${files[@]}"; do
  echo "======== $(basename "$f") ========"
  invoice-link "$f" "$@"
  echo
done
