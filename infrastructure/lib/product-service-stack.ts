import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as lambdaEventSources from 'aws-cdk-lib/aws-lambda-event-sources';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as snsSubscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as path from 'path';

export class ProductServiceStack extends cdk.Stack {
  public readonly restApi: apigateway.RestApi;
  public readonly catalogItemsQueue: sqs.Queue;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const backendPath = path.resolve(process.cwd(), '../../nodejs-aws-shop-backend/dist');

    const productsTableName = process.env.PRODUCTS_TABLE_NAME || 'RSS_Products';
    const stocksTableName = process.env.STOCKS_TABLE_NAME || 'RSS_Stocks';
    const createProductTopicEmail = process.env.CREATE_PRODUCT_TOPIC_EMAIL || 'ruslanrabadanov2101@gmail.com';
    const createProductTopicFilterEmail = process.env.CREATE_PRODUCT_TOPIC_FILTER_EMAIL || 'filtered-products@example.com';
    const createProductTopicFilterPrice = Number(process.env.CREATE_PRODUCT_TOPIC_FILTER_PRICE || 100);

    this.catalogItemsQueue = new sqs.Queue(this, 'CatalogItemsQueue', {
      queueName: 'catalogItemsQueue',
      visibilityTimeout: cdk.Duration.seconds(30),
    });

    const createProductTopic = new sns.Topic(this, 'CreateProductTopic', {
      topicName: 'createProductTopic',
    });

    createProductTopic.addSubscription(new snsSubscriptions.EmailSubscription(createProductTopicEmail));
    createProductTopic.addSubscription(
      new snsSubscriptions.EmailSubscription(createProductTopicFilterEmail, {
        filterPolicy: {
          price: sns.SubscriptionFilter.numericFilter({ greaterThanOrEqualTo: createProductTopicFilterPrice }),
        },
      })
    );

    const getProductsListFn = new lambda.Function(this, 'GetProductsListFunction', {
      runtime: lambda.Runtime.NODEJS_24_X,
      handler: 'handlers/getProductsList.handler',
      code: lambda.Code.fromAsset(backendPath),
      memorySize: 128,
      timeout: cdk.Duration.seconds(10),
      environment: {
        ALLOWED_ORIGIN: process.env.ALLOWED_ORIGIN || '*',
        PRODUCTS_TABLE: productsTableName,
        STOCKS_TABLE: stocksTableName,
      },
    });

    const getProductByIdFn = new lambda.Function(this, 'GetProductByIdFunction', {
      runtime: lambda.Runtime.NODEJS_24_X,
      handler: 'handlers/getProductById.handler',
      code: lambda.Code.fromAsset(backendPath),
      memorySize: 128,
      timeout: cdk.Duration.seconds(10),
      environment: {
        ALLOWED_ORIGIN: process.env.ALLOWED_ORIGIN || '*',
        PRODUCTS_TABLE: productsTableName,
        STOCKS_TABLE: stocksTableName,
      },
    });

    const productsTable = dynamodb.Table.fromTableName(this, 'ProductsTable', productsTableName);
    const stocksTable = dynamodb.Table.fromTableName(this, 'StocksTable', stocksTableName);

    productsTable.grantReadData(getProductsListFn);
    stocksTable.grantReadData(getProductsListFn);
    productsTable.grantReadData(getProductByIdFn);
    stocksTable.grantReadData(getProductByIdFn);

    const createProductFn = new lambda.Function(this, 'CreateProductFunction', {
      runtime: lambda.Runtime.NODEJS_24_X,
      handler: 'handlers/createProduct.handler',
      code: lambda.Code.fromAsset(backendPath),
      memorySize: 128,
      timeout: cdk.Duration.seconds(10),
      environment: {
        ALLOWED_ORIGIN: process.env.ALLOWED_ORIGIN || '*',
        PRODUCTS_TABLE: productsTableName,
        STOCKS_TABLE: stocksTableName,
      },
    });

    productsTable.grantWriteData(createProductFn);
    stocksTable.grantWriteData(createProductFn);

    const catalogBatchProcessFn = new lambda.Function(this, 'CatalogBatchProcessFunction', {
      functionName: 'catalogBatchProcess',
      runtime: lambda.Runtime.NODEJS_24_X,
      handler: 'handlers/catalogBatchProcess.handler',
      code: lambda.Code.fromAsset(backendPath),
      memorySize: 128,
      timeout: cdk.Duration.seconds(30),
      environment: {
        PRODUCTS_TABLE: productsTableName,
        STOCKS_TABLE: stocksTableName,
        CREATE_PRODUCT_TOPIC_ARN: createProductTopic.topicArn,
      },
    });

    productsTable.grantWriteData(catalogBatchProcessFn);
    stocksTable.grantWriteData(catalogBatchProcessFn);
    createProductTopic.grantPublish(catalogBatchProcessFn);
    catalogBatchProcessFn.addEventSource(
      new lambdaEventSources.SqsEventSource(this.catalogItemsQueue, {
        batchSize: 5,
      })
    );

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
    const createIntegration = new apigateway.LambdaIntegration(createProductFn);
    products.addMethod('POST', createIntegration);

    const single = products.addResource('{productId}');
    const singleIntegration = new apigateway.LambdaIntegration(getProductByIdFn);
    single.addMethod('GET', singleIntegration);

    new cdk.CfnOutput(this, 'ProductApiUrl', {
      value: this.restApi.url,
      description: 'Base URL for Product API',
    });
  }
}
