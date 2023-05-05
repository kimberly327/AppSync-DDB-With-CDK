import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as appsync from 'aws-cdk-lib/aws-appsync';
import * as path from 'path';

export class CdkProjStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const dynamodb_table = new dynamodb.Table(this, 'DDBTable', {
      tableName: 'DDB-Table',
      partitionKey: { name: "PK", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "SK", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST
    });

    const api = new appsync.GraphqlApi(this, 'Api', {
      name: 'demo',
      schema: appsync.SchemaFile.fromAsset(path.join(__dirname, '../schema/Schema.graphql')),
      authorizationConfig: {
        defaultAuthorization: {
          authorizationType: appsync.AuthorizationType.IAM,
        },
      },
      xrayEnabled: false,
    });
    
    const appSyncDDB = api.addDynamoDbDataSource('demoDataSource', dynamodb_table);
    dynamodb_table.grantReadWriteData(appSyncDDB);

    appSyncDDB.createResolver('CreateParentMutationResolver', {
      typeName: 'Mutation',
      fieldName: 'createParentItem',
      requestMappingTemplate: appsync.MappingTemplate.fromString(`
      {
        "version": "2018-05-29",
        "operation": "PutItem",
        "key": {
            "PK": $util.dynamodb.toDynamoDBJson($ctx.args.PK),
            "SK": $util.dynamodb.toDynamoDBJson($ctx.args.SK)
        },
        "attributeValues": {
            "data": $util.dynamodb.toDynamoDBJson($ctx.args.data),
            "type": $util.dynamodb.toDynamoDBJson($ctx.args.type)
        }
      }
      `),
      responseMappingTemplate: appsync.MappingTemplate.fromString(`$util.toJson($ctx.result)`),
    });

    appSyncDDB.createResolver('CreateChildMutationResolver', {
      typeName: 'Mutation',
      fieldName: 'createChildItem',
      requestMappingTemplate: appsync.MappingTemplate.fromString(`
      {
        "version": "2018-05-29",
        "operation": "PutItem",
        "key": {
            "PK": $util.dynamodb.toDynamoDBJson($ctx.args.PK),
            "SK": $util.dynamodb.toDynamoDBJson($ctx.args.SK)
        },
        "attributeValues": {
            "data": $util.dynamodb.toDynamoDBJson($ctx.args.data),
            "type": $util.dynamodb.toDynamoDBJson($ctx.args.type)
        }
      }
      `),
      responseMappingTemplate: appsync.MappingTemplate.fromString(`$util.toJson($ctx.result)`),
    });
    
    appSyncDDB.createResolver('GetParentAndChildResolver', {
      typeName: 'Query',
      fieldName: 'getParentWithChildren',
      requestMappingTemplate: appsync.MappingTemplate.fromString(`
      {
        "version" : "2017-02-28",
        "operation" : "Query",
        "query" : {
          "expression": "PK = :pk",
          "expressionValues" : {
            ":pk" : $util.dynamodb.toDynamoDBJson($ctx.args.PK)
          }
        }
      }
      `),
      responseMappingTemplate: appsync.MappingTemplate.fromFile('response.vtl'),
    });
    
  }
}
