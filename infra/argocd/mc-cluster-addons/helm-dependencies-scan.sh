#!/bin/bash

# Scan for Helm charts in addons subdirectories
# Usage: ./helm-dependencies-scan.sh [scan|scan-json|scan-yaml|scan-github-matrix]
# This will scan for Chart.yaml files in ./addons/* and output dependencies in different formats

# Common function to get chart folders
get_chart_folders() {
    local chart_folders=()
    
    # Iterate through addons subdirectories
    for dir in ./addons/*/; do
        if [ -f "${dir}Chart.yaml" ]; then
            # Remove leading ./ and trailing / from path
            folder_name=$(echo "$dir" | sed 's|^./addons/||' | sed 's|/$||')
            chart_folders+=("$folder_name")
        fi
    done
    
    echo "${chart_folders[@]}"
}

# Common function to get dependencies for a chart
get_chart_dependencies() {
    local folder_name="$1"
    local chart_file="./addons/$folder_name/Chart.yaml"
    local deps_count=$(yq e '.dependencies | length' "$chart_file")
    
    if [ "$deps_count" -gt 0 ]; then
        for i in $(seq 0 $(($deps_count - 1))); do
            local name=$(yq e ".dependencies[$i].name" "$chart_file")
            local version=$(yq e ".dependencies[$i].version" "$chart_file")
            local repo=$(yq e ".dependencies[$i].repository" "$chart_file")
            echo "$name|$version|$repo"
        done
    fi
}

helm_scan() {
    local chart_folders=($(get_chart_folders))
    
    if [ ${#chart_folders[@]} -eq 0 ]; then
        echo "No folders containing Chart.yaml found in ./addons/*"
        exit 0
    fi

    echo "Found Helm charts and their dependencies:"
    for folder in "${chart_folders[@]}"; do
        echo "Chart at addons/$folder:"
        
        local deps=$(get_chart_dependencies "$folder")
        if [ -n "$deps" ]; then
            while IFS='|' read -r name version repo; do
                echo "  - Name: $name"
                echo "    Version: $version"
                echo "    Repository: $repo"
            done <<< "$deps"
        else
            echo "  No dependencies found"
        fi
        echo ""
    done
}

helm_scan_json() {
    local chart_folders=($(get_chart_folders))
    
    # Build JSON structure
    local json_output="{"
    json_output+="\"charts\":["
    
    # Iterate through chart folders
    local first_chart=true
    for folder in "${chart_folders[@]}"; do
        # Add comma if not first chart
        if [ "$first_chart" = true ]; then
            first_chart=false
        else
            json_output+=","
        fi
        
        json_output+="{\"path\":\"$folder\",\"dependencies\":["
        
        local deps=$(get_chart_dependencies "$folder")
        local first_dep=true
        
        if [ -n "$deps" ]; then
            while IFS='|' read -r name version repo; do
                # Add comma if not first dependency
                if [ "$first_dep" = true ]; then
                    first_dep=false
                else
                    json_output+=","
                fi
                
                json_output+="{\"name\":\"$name\",\"version\":\"$version\",\"repository\":\"$repo\"}"
            done <<< "$deps"
        fi
        json_output+="]}"
    done
    
    json_output+="]}"
    echo "$json_output"
}

helm_scan_github_matrix() {
    local chart_folders=($(get_chart_folders))
    
    # Build JSON array for GitHub matrix
    local output="["
    
    # Iterate through chart folders
    local first_chart=true
    for folder in "${chart_folders[@]}"; do
        local deps=$(get_chart_dependencies "$folder")
        if [ -n "$deps" ]; then
            # Find all values.yaml files in the chart folder
            local values_files=($(find "./addons/$folder" -name "values.yaml"))
            
            # For each values.yaml file found
            for values_path in "${values_files[@]}"; do
                local values_path=$(echo "$values_path" | sed "s|^./addons/$folder/||")
                while IFS='|' read -r name version repo; do
                    # Add comma if not first item
                    if [ "$first_chart" = true ]; then
                        first_chart=false
                    else
                        output+=","
                    fi
                    
                    # Escape quotes and create proper JSON array
                    local escaped_folder=$(echo "$folder" | sed 's/"/\\"/g')
                    local escaped_name=$(echo "$name" | sed 's/"/\\"/g')
                    local escaped_version=$(echo "$version" | sed 's/"/\\"/g')
                    local escaped_repo=$(echo "$repo" | sed 's/"/\\\\\\"/g')
                    
                    output+="\"[\\\"$escaped_folder\\\",\\\"$escaped_name\\\",\\\"$escaped_version\\\",\\\"$escaped_repo\\\",\\\"$values_path\\\"]\""
                done <<< "$deps"
            done
        fi
    done
    
    output+="]"
    echo "$output"
}

helm_scan_yaml() {
    local chart_folders=($(get_chart_folders))
    
    # Start YAML output
    echo "charts:"
    
    # Iterate through chart folders
    for folder in "${chart_folders[@]}"; do
        echo "- path: $folder"
        echo "  dependencies:"
        
        local deps=$(get_chart_dependencies "$folder")
        if [ -n "$deps" ]; then
            while IFS='|' read -r name version repo; do
                echo "    - name: $name"
                echo "      version: $version" 
                echo "      repository: $repo"
            done <<< "$deps"
        fi
    done
}

if [ "$1" = "scan" ]; then
    helm_scan
elif [ "$1" = "scan-json" ]; then
    helm_scan_json
elif [ "$1" = "scan-github-matrix" ]; then
    helm_scan_github_matrix
elif [ "$1" = "scan-yaml" ]; then
    helm_scan_yaml
else
    echo "Usage:"
    echo "  ./helm-dependencies-scan.sh scan       - Scan for Helm charts and display dependencies"
    echo "  ./helm-dependencies-scan.sh scan-json  - Scan for Helm charts and output dependencies in JSON format"
    echo "  ./helm-dependencies-scan.sh scan-yaml  - Scan for Helm charts and output dependencies in YAML format"
    echo "  ./helm-dependencies-scan.sh scan-github-matrix  - Scan for Helm charts and output dependencies in GitHub matrix format"
    exit 1
fi
