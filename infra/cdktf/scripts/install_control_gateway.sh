#!/usr/bin/env bash
set -euxo posix

HAS_KEYS=${1:-"false"}

echo "Checking ssh keys"
if [[ "${HAS_KEYS}" == "true" ]]; then
  echo "Keys are present, skipping ssh key generation"
else
  echo "Keys are not present, generating ssh keys"
  ssh-keygen -t rsa -b 4096 -f ~/.ssh/id_rsa -q -N ""
fi

chmod 600 ~/.ssh/id_rsa
chmod 644 ~/.ssh/id_rsa.pub


#Disable ssh by password
sed -i 's/#PasswordAuthentication yes/PasswordAuthentication no/' /etc/ssh/sshd_config
sed -i 's/PasswordAuthentication yes/PasswordAuthentication no/' /etc/ssh/sshd_config
# Also disable password authentication in included sshd config files
for cfg in /etc/ssh/sshd_config.d/*.conf; do
  [ -f "$cfg" ] && sed -i 's/PasswordAuthentication yes/PasswordAuthentication no/' "$cfg"
done

#Copy ssh key to k0sctl user
mkdir /home/k0s/.ssh
cp /root/.ssh/id_rsa* /home/k0s/.ssh/
chown -R k0s:k0s /home/k0s/.ssh

#Restart ssh
systemctl restart sshd

#Set firewall rules to open only 22 and 443 ports
# ufw allow 22/tcp
# ufw allow 443/tcp
# ufw --force enable

#TODO: install surricata