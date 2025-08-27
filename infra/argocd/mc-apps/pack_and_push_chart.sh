#!/bin/bash

if [[ -z "$2" ]]; then
  echo "Error: OCI registry must be provided as second argument"
  exit 1
fi

OCI_REGISTRY=$2

HELM_CHARTS_FOLDERS=( "./app-helm-chart" )

helm_dependency_update () {
  for i in "${@}"; do
    if [[ "$i" == *"defectdojo"* ]]; then
      echo "Updating dependencies for chart: $i"
      (cd "$i" && helm dependency update)
    else
      echo "Skipping dependency update for chart: $i"
    fi
  done
}

helm_lint () {
  for i in "${@}"; do
    echo "Linting chart: $i"
    helm lint "$i" -f "$i/values.yaml"
  done
}

helm_pack () {
  for i in "${@}"; do
    echo "Packaging chart: $i"
    helm package "$i"
  done
}

helm_push () {
  local HELM_CHARTS_TGZ=( $(find . -mindepth 1 -maxdepth 1 -type f -name "*.tgz") )
  for j in "${HELM_CHARTS_TGZ[@]}"; do
    echo "Pushing chart: $j"
    # Push to the path that ArgoCD expects when using --repo syntax
    helm push "$j" $OCI_REGISTRY/app-helm-chart
  done
}

if [[ $1 = "lint" ]]; then
  helm_lint "${HELM_CHARTS_FOLDERS[@]}"
else
  helm_dependency_update "${HELM_CHARTS_FOLDERS[@]}"
  helm_pack "${HELM_CHARTS_FOLDERS[@]}"
  helm_push
fi