#!/usr/bin/env bash
set -euxo posix

api_key=${1:-""} # Default to empty if no argument provided

useradd -m k0s

cd /home/k0s

#Download & prepare k0s
curl -sSLf https://get.k0s.sh | sudo sh

#Install k0s
k0s install controller --single
systemctl start k0scontroller
systemctl enable k0scontroller

#Download kubectl
curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
install -o root -g root -m 0755 kubectl /usr/local/bin/kubectl

#Download & install clusterctl
curl -L https://github.com/kubernetes-sigs/cluster-api/releases/download/v1.10.3/clusterctl-linux-amd64 -o clusterctl
sudo install -o root -g root -m 0755 clusterctl /usr/local/bin/clusterctl

#Install git and golang
sudo apt-get update -y
sudo apt-get install -y ca-certificates curl git golang

# Add Docker's official GPG key:
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/debian/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc

# Add the repository to Apt sources:
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/debian \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update -y

#Add github to known hosts
ssh-keyscan github.com >> ~/.ssh/known_hosts

#Create kubeconfig
cat /var/lib/k0s/pki/admin.conf | tee /home/k0s/kubeconfig
export KUBECONFIG="/home/k0s/kubeconfig"

#Prepare Vultr cluster api install file with api key
curl -L https://github.com/JJOInvest/vultr-cluster-api-build/releases/download/0.1.0/install.yaml -o /home/k0s/capi-install.yaml
sed -i "s/apiKey: yourapikey/apiKey: ${api_key}/g" /home/k0s/capi-install.yaml

#this will install cert manager and capi
clusterctl init

#Install Vultr cluster api plugin and clear install file
kubectl apply -f /home/k0s/capi-install.yaml
rm /home/k0s/capi-install.yaml

#Download cilium cli
CILIUM_CLI_VERSION=$(curl -s https://raw.githubusercontent.com/cilium/cilium-cli/main/stable.txt)
CLI_ARCH=amd64
if [ "$(uname -m)" = "aarch64" ]; then CLI_ARCH=arm64; fi
curl -L --fail --remote-name-all https://github.com/cilium/cilium-cli/releases/download/${CILIUM_CLI_VERSION}/cilium-linux-${CLI_ARCH}.tar.gz{,.sha256sum}
sha256sum --check cilium-linux-${CLI_ARCH}.tar.gz.sha256sum
sudo tar xzvfC cilium-linux-${CLI_ARCH}.tar.gz /usr/local/bin
rm cilium-linux-${CLI_ARCH}.tar.gz{,.sha256sum}






