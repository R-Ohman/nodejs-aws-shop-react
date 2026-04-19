#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const STACK_NAME = 'InfrastructureStack';
const REGION = 'eu-north-1';

try {
  console.log('Fetching CloudFront Distribution ID...');

  const output = execSync(
    `aws cloudformation describe-stacks --stack-name ${STACK_NAME} --region ${REGION} --query "Stacks[0].Outputs" --output json`,
    { encoding: 'utf-8' }
  );

  const outputs = JSON.parse(output);
  const distributionIdOutput = outputs.find(
    (o) => o.OutputKey === 'DistributionId'
  );

  if (!distributionIdOutput) {
    throw new Error(
      'Distribution ID not found in stack outputs. Make sure the infrastructure is deployed.'
    );
  }

  const distributionId = distributionIdOutput.OutputValue;
  console.log(`Found Distribution ID: ${distributionId}`);

  console.log('Invalidating CloudFront cache...');

  const invalidationResult = execSync(
    `aws cloudfront create-invalidation --distribution-id ${distributionId} --paths "/*" --region ${REGION} --query 'Invalidation.Id' --output text`,
    { encoding: 'utf-8' }
  ).trim();

  console.log(`Invalidation ID: ${invalidationResult}`);
  console.log('CloudFront cache invalidated successfully!');
  console.log(
    `   (It may take a few minutes for the cache to be fully cleared)`
  );

  process.exit(0);
} catch (error) {
  console.error('Error invalidating CloudFront cache:');
  console.error(error.message);
  process.exit(1);
}
