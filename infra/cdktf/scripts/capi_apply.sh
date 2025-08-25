# Input variables
CLUSTER_NAME=${1}
CAPI_CONFIG_YAML=${2}
MANAGEMENT_KUBECONFIG=${3}
CILIUM_VERSION=${4:-null}
CLOUD_PROVIDER_MANIFESTS=${5:-null}

INITIALIZATION_WAIT=5

# Validate required inputs
if [ -z "$CLUSTER_NAME" ]; then
    echo "Error: CLUSTER_NAME is required"
    echo "Usage: $0 CLUSTER_NAME [CAPI_CONFIG_YAML]"
    exit 1
fi

if [ ! -f "$CAPI_CONFIG_YAML" ]; then
    echo "Error: Config file $CAPI_CONFIG_YAML not found"
    exit 1
fi

if [ ! -f "$MANAGEMENT_KUBECONFIG" ]; then
    echo "Error: kubeconfig file $MANAGEMENT_KUBECONFIG not found"
    exit 1
fi

if [ -z "$CLUSTER_NAME" ]; then
    echo "Error: CLUSTER_NAME is required"
    echo "Usage: $0 CLUSTER_NAME [CAPI_CONFIG_YAML]"
    exit 1
fi


export KUBECONFIG=$MANAGEMENT_KUBECONFIG

# Script to manage cluster

# Check if cluster already exists
if ! kubectl get cluster | grep -q "$CLUSTER_NAME"; then
    # Check if cloud provider manifests folder exists only if cluster is not found
    if [ ! -d "$CLOUD_PROVIDER_MANIFESTS" ]; then
        echo "Error: $CLOUD_PROVIDER_MANIFESTS folder not found"
        exit 1
    fi
    if [ "$CILIUM_VERSION" = "null" ]; then
        echo "Error: CILIUM_VERSION is required"
        exit 1
    fi

    echo "Cluster $CLUSTER_NAME not found - performing first boot"

    # Apply updated configuration
    kubectl apply -f $CAPI_CONFIG_YAML

    # Wait for control plane to initialize
    echo "Waiting for control plane to initialize..."
    I=1;
    while true; do
#kubectl get kubeadmcontrolplane -o wide returns
#NAME                          CLUSTER         INITIALIZED   API SERVER AVAILABLE   DESIRED   REPLICAS   READY   UPDATED   UNAVAILABLE   AGE     VERSION
#test-main-ams-control-plane   test-main-ams                                        3         1                  1         1             3m48s   v1.32.4
#to find initialized control plane we look for $CLUSTER_NAME\s\s\strue,
#because there are 3 spaces between cluster name and initialized column
        status=$(kubectl get kubeadmcontrolplane -o wide | grep "$CLUSTER_NAME\s\s\strue" || true)
        if [ -n "$status" ] && [[ $status == *"true"* ]]; then
            echo "Control plane initialized successfully"
            break
        fi
        echo -ne "\rControl plane not yet initialized, waiting $INITIALIZATION_WAIT seconds... ($I)"; I=$((I+1))
        sleep $INITIALIZATION_WAIT
    done

    echo "Control plane was initialized."
    # Install cilium, and vultr ccm, csi
    echo ""
    echo "Installing cilium, and vultr ccm, csi..."

    #First we switch to created cluster
    clusterctl get kubeconfig $CLUSTER_NAME > $CLUSTER_NAME.kubeconfig
    export KUBECONFIG=$CLUSTER_NAME.kubeconfig

    #Then install cilium to deployed cluster
    cilium install --version $CILIUM_VERSION
    #Install vultr ccm and csi
    kubectl apply -f $CLOUD_PROVIDER_MANIFESTS

    #Install ArgoCD after cluster is created
else
    echo "Cluster $CLUSTER_NAME exists - updating configuration"
    
    # Extract MachineDeployment names from the config YAML
    # Use grep and awk to find MachineDeployment objects and extract their metadata.name
    CONFIG_MACHINE_DEPLOYMENTS=$(awk '/^kind: MachineDeployment$/{in_md=1; next} /^kind:/{in_md=0} in_md && /^  name:/{gsub(/^  name: /, ""); print}' $CAPI_CONFIG_YAML 2>/dev/null || echo "")
    
    # Delete worker groups scheduled for removal
    # This assumes worker groups are managed as MachineDeployments
    for group in $(kubectl get machinedeployment -l cluster.x-k8s.io/cluster-name=$CLUSTER_NAME -o name); do
        group_name=$(basename $group)
        if [ -n "$CONFIG_MACHINE_DEPLOYMENTS" ] && ! echo "$CONFIG_MACHINE_DEPLOYMENTS" | grep -q "^${group_name}$"; then
            echo "Deleting worker group: $group"
            kubectl delete $group
        fi
    done

    # Apply updated configuration
    kubectl apply -f $CAPI_CONFIG_YAML
fi