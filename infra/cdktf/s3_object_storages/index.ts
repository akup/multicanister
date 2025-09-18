import { Construct } from "constructs";


import { defaultConfig } from "../config";
import { ObjectStorage as VultrObjectStorage } from "../.gen/providers/vultr/object-storage";

export class S3ObjectStoragesModule extends Construct {
  objectStorage: VultrObjectStorage;
  constructor(scope: Construct, id: string) {
    super(scope, id);

    this.objectStorage = new VultrObjectStorage(this, "loki_object_storage", {
      clusterId: defaultConfig.objectStorageClusterId,
      label: "loki_object_storage",
      tierId: 3 //Premium Object Storage
    })
  }
}