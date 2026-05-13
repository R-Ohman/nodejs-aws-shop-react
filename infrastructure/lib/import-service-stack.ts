import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3n from 'aws-cdk-lib/aws-s3-notifications';
import * as path from 'path';

export class ImportServiceStack extends cdk.Stack {
  public readonly restApi: apigateway.RestApi;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const backendPath = path.resolve(process.cwd(), '../../nodejs-aws-shop-backend/dist');
    const bucketName = 'rss-import-275956877398';

    const bucket = s3.Bucket.fromBucketName(this, 'ImportBucket', bucketName);

    const importProductsFileFn = new lambda.Function(this, 'ImportProductsFileFunction', {
      runtime: lambda.Runtime.NODEJS_24_X,
      handler: 'handlers/importProductsFile.handler',
      code: lambda.Code.fromAsset(backendPath),
      memorySize: 128,
      timeout: cdk.Duration.seconds(10),
      environment: {
        ALLOWED_ORIGIN: process.env.ALLOWED_ORIGIN || '*',
        BUCKET_NAME: bucketName,
      },
    });

    const importFileParserFn = new lambda.Function(this, 'ImportFileParserFunction', {
      runtime: lambda.Runtime.NODEJS_24_X,
      handler: 'handlers/importFileParser.handler',
      code: lambda.Code.fromAsset(backendPath),
      memorySize: 128,
      timeout: cdk.Duration.seconds(10),
      environment: {
        BUCKET_NAME: bucketName,
      },
    });

    bucket.grantPut(importProductsFileFn);
    bucket.grantReadWrite(importFileParserFn);

    this.restApi = new apigateway.RestApi(this, 'ImportApi', {
      restApiName: 'Import Service API',
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: apigateway.Cors.DEFAULT_HEADERS,
      },
    });

    this.restApi.addGatewayResponse('Default4xxCors', {
      type: apigateway.ResponseType.DEFAULT_4XX,
      responseHeaders: {
        'Access-Control-Allow-Origin': "'*'",
        'Access-Control-Allow-Headers': "'*'",
      },
    });

    this.restApi.addGatewayResponse('Default5xxCors', {
      type: apigateway.ResponseType.DEFAULT_5XX,
      responseHeaders: {
        'Access-Control-Allow-Origin': "'*'",
        'Access-Control-Allow-Headers': "'*'",
      },
    });

    const importResource = this.restApi.root.addResource('import');
    importResource.addMethod('GET', new apigateway.LambdaIntegration(importProductsFileFn), {
      requestParameters: {
        'method.request.querystring.name': true,
      },
    });

    bucket.addEventNotification(
      s3.EventType.OBJECT_CREATED,
      new s3n.LambdaDestination(importFileParserFn),
      {
        prefix: 'uploaded/',
      }
    );

    new cdk.CfnOutput(this, 'ImportApiUrl', {
      value: this.restApi.url,
      description: 'Base URL for Import API',
    });
  }
}