import { pokerTable } from "./dynamodb";

export const appsyncApi = new sst.aws.AppSync("PokerApi", {
  schema: "graphql/schema.graphql",
  transform: {
    api: {
        authenticationType: "API_KEY",
    },
  },
});

export const appsyncApiKey = new aws.appsync.ApiKey("PokerApiKey", {
    apiId: appsyncApi.id,
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
  responseTemplate: `{
  "id": "$ctx.args.roomId",
  "revealed": #if($ctx.result && $ctx.result.revealed)true#else false#end
}`
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
  responseTemplate: `{
  "id": "$ctx.args.userId",
  "roomId": "$ctx.args.roomId",
  "username": #if($ctx.result.username)"$ctx.result.username"#else "User"#end,
  "vote": "$ctx.args.vote"
}`
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
  responseTemplate: `{
  "id": "$ctx.args.roomId",
  "revealed": true
}`
});

appsyncApi.addResolver("Mutation joinRoom", {
  dataSource: "dynamoDS",
  requestTemplate: `#set($userId = $util.autoId())
#set($ctx.stash.userId = $userId)
{
  "version": "2017-02-28",
  "operation": "PutItem",
  "key": {
    "pk": { "S": "ROOM#$ctx.args.roomId" },
    "sk": { "S": "USER#$userId" }
  },
  "attributeValues": {
    "roomId": { "S": "$ctx.args.roomId" },
    "username": { "S": "$ctx.args.username" },
    "userId": { "S": "$userId" },
    "type": { "S": "USER" }
  }
}`,
  responseTemplate: `{
  "id": "$ctx.stash.userId",
  "roomId": "$ctx.args.roomId",
  "username": "$ctx.args.username",
  "vote": null
}`
});

appsyncApi.addResolver("Query listParticipants", {
  dataSource: "dynamoDS",
  requestTemplate: `{
    "version": "2017-02-28",
    "operation": "Query",
    "query": {
      "expression": "pk = :pk AND begins_with(sk, :sk)",
      "expressionValues": {
        ":pk": { "S": "ROOM#$ctx.args.roomId" },
        ":sk": { "S": "USER#" }
      }
    }
  }`,
  responseTemplate: `[
    #foreach($item in $ctx.result.items)
    #if($item.type == "USER")
    {
      "id": "$item.userId",
      "roomId": "$item.roomId",
      "username": "$item.username",
      "vote": #if($item.vote)"$item.vote"#else null#end
    }
    #if($foreach.hasNext),#end
    #end
    #end
  ]`
});

appsyncApi.addResolver("Mutation ensureRoom", {
  dataSource: "dynamoDS",
  requestTemplate: `{
    "version": "2017-02-28",
    "operation": "PutItem",
    "key": {
      "pk": { "S": "ROOM#$ctx.args.roomId" },
      "sk": { "S": "META" }
    },
    "attributeValues": {
      "roomId": { "S": "$ctx.args.roomId" },
      "revealed": { "BOOL": false },
      "type": { "S": "ROOM" }
    }
  }`,
  responseTemplate: `{
    "id": "$ctx.args.roomId",
    "revealed": false
  }`
});
