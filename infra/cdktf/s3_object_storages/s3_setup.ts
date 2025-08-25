import { Construct } from "constructs";
import { MinioProvider, S3Bucket as MinioS3Bucket, IamUser, IamPolicy, IamUserPolicyAttachment } from "@sovarto/cdktf-provider-minio";
import { DefaultSuffix } from "../lib/default-suffix";
import { TerraformLocal } from "cdktf";
import { ApplyObjectStorages } from "./apply_object_storages";

export class S3SetupModule extends Construct {
  constructor(scope: Construct, id: string, {
    s3Hostname,
    s3AccessKey,
    s3SecretKey,
    branchName,
    clusterName,
    region,
    controlGatewayIp
  }: {
    s3Hostname: string,
    s3AccessKey: string,
    s3SecretKey: string,
    branchName?: string,
    clusterName?: string,
    region: string,
    controlGatewayIp: string
  }) {
    super(scope, id);

    // Create MinIO provider using remote state values
    //TODO: use minio_user instead of credentials
    const minioProvider = new MinioProvider(this, "minio_provider", {
      minioServer: s3Hostname,
      minioAccessKey: s3AccessKey,
      minioSecretKey: s3SecretKey,
      minioSsl: true,
      minioInsecure: false,
      minioRegion: "us-east-1" //This is hardcoded for vultr
    });

    let clusterBucketsSuffix = DefaultSuffix.getSuffix({branchName, clusterName, region})

    // Create buckets for loki with minio provider
    new MinioS3Bucket(this, "loki_chunks_bucket", {
      bucket: `${clusterBucketsSuffix}-loki-chunks`,
      provider: minioProvider,
    });
    new MinioS3Bucket(this, "loki_ruler_bucket", {
      bucket: `${clusterBucketsSuffix}-loki-ruler`,
      provider: minioProvider,
    });
    new MinioS3Bucket(this, "loki_admin_bucket", {
      bucket: `${clusterBucketsSuffix}-loki-admin`,
      provider: minioProvider,
    });

    let lokiS3CredentialsObject: TerraformLocal;

    //If provider supports users and policies create them for loki
    const providerSupportsS3IAM = false
    if (providerSupportsS3IAM) {
      // Create IAM user for Loki
      const lokiUser = new IamUser(this, "loki_user", {
        name: `${clusterBucketsSuffix}-loki-user`,
        provider: minioProvider,
      });

      // Create IAM policy for Loki buckets access
      const lokiPolicy = new IamPolicy(this, "loki_policy", {
        name: `${clusterBucketsSuffix}-loki-policy`,
        policy: JSON.stringify({
          Version: "2012-10-17",
          Statement: [
            {
              Effect: "Allow",
              Action: [
                "s3:GetObject",
                "s3:PutObject",
                "s3:DeleteObject",
                "s3:ListBucket",
                "s3:GetBucketLocation"
              ],
              Resource: [
                `arn:aws:s3:::${clusterBucketsSuffix}-loki-chunks`,
                `arn:aws:s3:::${clusterBucketsSuffix}-loki-chunks/*`,
                `arn:aws:s3:::${clusterBucketsSuffix}-loki-ruler`,
                `arn:aws:s3:::${clusterBucketsSuffix}-loki-ruler/*`,
                `arn:aws:s3:::${clusterBucketsSuffix}-loki-admin`,
                `arn:aws:s3:::${clusterBucketsSuffix}-loki-admin/*`,
                `arn:aws:s3:::${clusterBucketsSuffix}-delete-requests`,
                `arn:aws:s3:::${clusterBucketsSuffix}-delete-requests/*`
              ]
            }
          ]
        }),
        provider: minioProvider,
      });

      // Attach policy to user
      new IamUserPolicyAttachment(this, "loki_user_policy", {
        userName: lokiUser.name,
        policyName: lokiPolicy.name,
        provider: minioProvider,
      });

      //Use loki credentials
      lokiS3CredentialsObject = new TerraformLocal(this, "loki_user_s3_credentials", {
        hostname: s3Hostname,
        accessKey: lokiUser.name,
        secretKey: lokiUser.secret
      })
    } else {
      //Use admin credentials
      lokiS3CredentialsObject = new TerraformLocal(this, "loki_user_s3_credentials", {
        hostname: s3Hostname,
        accessKey: s3AccessKey,
        secretKey: s3SecretKey
      })
    }

    //Save credentials to gateway and apply to kubernetes cluster
    new ApplyObjectStorages(this, "apply_object_storages", {
      controlGatewayIp,
      lokiS3CredentialsObject,
      branchName,
      region,
      clusterName
    })
  }
}