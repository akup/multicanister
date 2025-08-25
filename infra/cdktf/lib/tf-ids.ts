import { TerraformResource } from "cdktf";

export const getResourceId = (resource: TerraformResource) => {
  return `${resource.terraformResourceType}.${resource.friendlyUniqueId}`;
};
