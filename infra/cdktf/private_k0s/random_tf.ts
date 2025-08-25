import { Construct } from "constructs";
import { RandomProvider } from "@cdktf/provider-random/lib/provider";
import { Uuid as RandomUuid } from "@cdktf/provider-random/lib/uuid";

export class RandomTf extends Construct {
  public randomUuid?: string;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    new RandomProvider(this, "random");

    const randomUuidTf = new RandomUuid(this, "random_uuid", {});

    this.randomUuid = randomUuidTf.id;
  }
}