import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as path from 'path';

export class ProductServiceStack extends cdk.Stack {
  public readonly restApi: apigateway.RestApi;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const backendPath = path.resolve(process.cwd(), '../../nodejs-aws-shop-backend/dist');

    const getProductsListFn = new lambda.Function(this, 'GetProductsListFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'handlers/getProductsList.handler',
      code: lambda.Code.fromAsset(backendPath),
      memorySize: 128,
      timeout: cdk.Duration.seconds(10),
    });

    const getProductByIdFn = new lambda.Function(this, 'GetProductByIdFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'handlers/getProductById.handler',
      code: lambda.Code.fromAsset(backendPath),
      memorySize: 128,
      timeout: cdk.Duration.seconds(10),
    });

    this.restApi = new apigateway.RestApi(this, 'ProductApi', {
      restApiName: 'Product Service API',
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

    const products = this.restApi.root.addResource('products');
    const productsIntegration = new apigateway.LambdaIntegration(getProductsListFn);
    products.addMethod('GET', productsIntegration);

    const single = products.addResource('{productId}');
    const singleIntegration = new apigateway.LambdaIntegration(getProductByIdFn);
    single.addMethod('GET', singleIntegration);

    new cdk.CfnOutput(this, 'ProductApiUrl', {
      value: this.restApi.url,
      description: 'Base URL for Product API',
    });
  }
}
