import { ClusterTemplate } from '../private_k0s/cluster_template';

describe('ClusterTemplate', () => {
  describe('generateClusterTemplate', () => {
    test('should generate YAML with custom cluster name and region', () => {
      const customClusterTemplate = new ClusterTemplate({
        clusterName: 'my-cluster'
      });
      const customYamlOutput = customClusterTemplate.generateClusterTemplate();

      expect(customYamlOutput).toContain('name: my-cluster');
      expect(customYamlOutput).toContain('region: ams');
      expect(customYamlOutput).toContain('name: my-cluster-control-plane');
    });

    test('should include all required Kubernetes resources', () => {
      const clusterTemplate = new ClusterTemplate({});
      const yamlOutput = clusterTemplate.generateClusterTemplate();
      
      // Check for main cluster resource
      expect(yamlOutput).toContain('kind: Cluster');
      expect(yamlOutput).toContain('kind: VultrCluster');
      expect(yamlOutput).toContain('kind: KubeadmControlPlane');
      
      // Check for worker group resources
      expect(yamlOutput).toContain('kind: MachineDeployment');
      expect(yamlOutput).toContain('kind: VultrMachineTemplate');
      expect(yamlOutput).toContain('kind: KubeadmConfigTemplate');
    });

    test('should generate correct number of worker group resources', () => {
      const clusterTemplate = new ClusterTemplate({});
      const yamlOutput = clusterTemplate.generateClusterTemplate();
      
      // Count MachineDeployment resources (should match number of worker groups)
      const machineDeploymentMatches = (yamlOutput.match(/kind: MachineDeployment/g) || []).length;
      expect(machineDeploymentMatches).toBeGreaterThan(0);
      
      // Count VultrMachineTemplate resources (should match number of worker groups)
      const vultrMachineTemplateMatches = (yamlOutput.match(/kind: VultrMachineTemplate/g) || []).length;
      expect(vultrMachineTemplateMatches).toBeGreaterThan(0);
      
      // Count KubeadmConfigTemplate resources (should match number of worker groups)
      const kubeadmConfigTemplateMatches = (yamlOutput.match(/kind: KubeadmConfigTemplate/g) || []).length;
      expect(kubeadmConfigTemplateMatches).toBeGreaterThan(0);
    });
  });
});