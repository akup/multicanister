export class DefaultSuffix {
  static getSuffix({
    branchName,
    region,
    clusterName
  }: {
    branchName?: string,
    region?: string,
    clusterName?: string
  }) {
    let suffix = `${clusterName ? clusterName + "-" : ""}${branchName ? branchName + "-" : ""}${region ? region + "-" : ""}`
    return suffix.length > 0 ? suffix.substring(0, suffix.length - 1) : suffix
  }
  static withSuffix(name: string, {
    branchName,
    region,
    clusterName
  }: {
    branchName?: string,
    region?: string,
    clusterName?: string
  }) {
    return `${this.getSuffix({ branchName, region, clusterName })}-${name}`
  }
}