import { pokerTable } from "./dynamodb";

export const appsyncApi = new sst.aws.AppSync("PokerApi", {
  schema: "graphql/schema.graphql",
});

appsyncApi.addDataSource({
  name: "dynamoDS",
  dynamodb: pokerTable.arn,
});

appsyncApi.addResolver("Query getRoom", {
  dataSource: "dynamoDS",
  requestTemplate: `{
    "version": "2017-02-28",
    "operation": "GetItem",
    "key": {
      "pk": { "S": "ROOM#$ctx.args.roomId" },
      "sk": { "S": "META" }
    }
  }`,
  responseTemplate: `$util.toJson($ctx.result)`
});

appsyncApi.addResolver("Mutation vote", {
  dataSource: "dynamoDS",
  requestTemplate: `{
    "version": "2017-02-28",
    "operation": "UpdateItem",
    "key": {
      "pk": { "S": "ROOM#$ctx.args.roomId" },
      "sk": { "S": "USER#$ctx.args.userId" }
    },
    "update": {
      "expression": "SET vote = :v",
      "expressionValues": {
        ":v": { "S": "$ctx.args.vote" }
      }
    }
  }`,
  responseTemplate: `$util.toJson($ctx.result)`
});

appsyncApi.addResolver("Mutation reveal", {
  dataSource: "dynamoDS",
  requestTemplate: `{
    "version": "2017-02-28",
    "operation": "UpdateItem",
    "key": {
      "pk": { "S": "ROOM#$ctx.args.roomId" },
      "sk": { "S": "META" }
    },
    "update": {
      "expression": "SET revealed = :r",
      "expressionValues": {
        ":r": { "BOOL": true }
      }
    }
  }`,
  responseTemplate: `$util.toJson($ctx.result)`
});
