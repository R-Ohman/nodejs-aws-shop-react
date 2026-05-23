import * as cdk from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { ImportServiceStack } from '../lib/import-service-stack';
import { ProductServiceStack } from '../lib/product-service-stack';

describe('Product and import service stacks', () => {
  beforeEach(() => {
    process.env.PRODUCTS_TABLE_NAME = 'RSS_Products';
    process.env.STOCKS_TABLE_NAME = 'RSS_Stocks';
    process.env.CREATE_PRODUCT_TOPIC_EMAIL = 'ruslanrabadanov2101@gmail.com';
    process.env.CREATE_PRODUCT_TOPIC_FILTER_EMAIL = 'filtered-products@example.com';
    process.env.CREATE_PRODUCT_TOPIC_FILTER_PRICE = '100';
  });

  it('configures the product batch processor, queue, and SNS subscriptions', () => {
    const app = new cdk.App();
    const productStack = new ProductServiceStack(app, 'ProductServiceStack', {
      env: {
        account: '123456789012',
        region: 'eu-north-1',
      },
    });

    const template = Template.fromStack(productStack);

    template.hasResourceProperties('AWS::SQS::Queue', {
      QueueName: 'catalogItemsQueue',
    });

    template.hasResourceProperties('AWS::SNS::Topic', {
      TopicName: 'createProductTopic',
    });

    template.resourceCountIs('AWS::SNS::Subscription', 2);

    template.hasResourceProperties('AWS::SNS::Subscription', {
      Protocol: 'email',
      Endpoint: 'ruslanrabadanov2101@gmail.com',
    });

    template.hasResourceProperties('AWS::SNS::Subscription', {
      Protocol: 'email',
      Endpoint: 'filtered-products@example.com',
      FilterPolicy: Match.anyValue(),
    });

    template.hasResourceProperties('AWS::Lambda::Function', {
      FunctionName: 'catalogBatchProcess',
      Handler: 'handlers/catalogBatchProcess.handler',
      Runtime: 'nodejs24.x',
      Environment: {
        Variables: Match.objectLike({
          PRODUCTS_TABLE: 'RSS_Products',
          STOCKS_TABLE: 'RSS_Stocks',
        }),
      },
    });

    template.hasResourceProperties('AWS::Lambda::EventSourceMapping', {
      BatchSize: 5,
    });
  });

  it('grants the import parser access to enqueue catalog items', () => {
    const app = new cdk.App();
    const productStack = new ProductServiceStack(app, 'ProductServiceStack', {
      env: {
        account: '123456789012',
        region: 'eu-north-1',
      },
    });

    const importStack = new ImportServiceStack(app, 'ImportServiceStack', {
      catalogItemsQueue: productStack.catalogItemsQueue,
      env: {
        account: '123456789012',
        region: 'eu-north-1',
      },
    });

    const template = Template.fromStack(importStack);

    template.hasResourceProperties('AWS::Lambda::Function', {
      Handler: 'dist/handlers/importFileParser.handler',
      Environment: {
        Variables: Match.objectLike({
          CATALOG_ITEMS_QUEUE_URL: Match.anyValue(),
        }),
      },
    });

    template.hasResourceProperties('AWS::IAM::Policy', {
      PolicyDocument: {
        Statement: Match.arrayWith([
          Match.objectLike({
            Action: Match.arrayWith(['sqs:SendMessage']),
          }),
        ]),
      },
    });
  });
});