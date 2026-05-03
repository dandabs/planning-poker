import { pokerTable } from "./dynamodb";

export const appsyncApi = new sst.aws.AppSync("PokerApi", {
  schema: "graphql/schema.graphql",
  transform: {
    api: {
        authenticationType: "API_KEY",
    },
  },
});

// appsyncApi.addDataSource({
//   name: "dynamoDS",
//   dynamodb: pokerTable.arn,
// });

export const appsyncApiKey = new aws.appsync.ApiKey("PokerApiKey", {
    apiId: appsyncApi.id,
});

pokerTable.subscribe("PokerStream", {
  handler: 'packages/functions/src/dynamoStreamHandler.handler',
  runtime: 'nodejs18.x',
  environment: {
    APPSYNC_API_KEY: appsyncApiKey.key,
  },
  link: [appsyncApi]
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
  "roomId": "$ctx.args.roomId",
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
  "roomId": "$ctx.args.roomId",
  "revealed": true
}`
});

appsyncApi.addResolver("Mutation hide", {
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
        ":r": { "BOOL": false }
      }
    }
  }`,
  responseTemplate: `{
  "id": "$ctx.args.roomId",
  "roomId": "$ctx.args.roomId",
  "revealed": false
}`
});

appsyncApi.addResolver("Mutation joinRoom", {
  dataSource: "dynamoDS",
  requestTemplate: `#set($userId = $util.autoId())
#set($ctx.stash.userId = $userId)
#set($ttl = $util.time.nowEpochMilliSeconds())
#set($ttl = $ttl + 40000)
#set($attrMap = $util.dynamodb.toMapValues({
  "roomId": $ctx.args.roomId,
  "username": $ctx.args.username,
  "userId": $userId,
  "type": "USER",
  "expiresAt": $ttl
}))
#set($ctx.stash.attrMap = $attrMap)
{
  "version": "2017-02-28",
  "operation": "PutItem",
  "key": {
    "pk": { "S": "ROOM#$ctx.args.roomId" },
    "sk": { "S": "USER#$userId" }
  },
  "attributeValues": $util.toJson($ctx.stash.attrMap)
}`,
  responseTemplate: `{
  "id": "$ctx.stash.userId",
  "roomId": "$ctx.args.roomId",
  "username": "$ctx.args.username",
  "vote": null
}`
});

// Add a NONE data source to allow publishing subscription events from external callers
appsyncApi.addDataSource({
  name: "noneDS",
});

// Heartbeat mutation - updates ttl for a user
appsyncApi.addResolver("Mutation heartbeat", {
  dataSource: "dynamoDS",
  requestTemplate: `{
    #set($ttl = $util.time.nowEpochMilliSeconds())
    #set($ttl = $ttl + 40000)
    "version": "2017-02-28",
    "operation": "UpdateItem",
    "key": {
      "pk": { "S": "ROOM#$ctx.args.roomId" },
      "sk": { "S": "USER#$ctx.args.userId" }
    },
    "update": {
      "expression": "SET #exp = :t",
      "expressionNames": {
        "#exp": "expiresAt"
      },
      "expressionValues": $util.toJson($util.dynamodb.toMapValues({":t": $ttl}))
    }
  }`,
  responseTemplate: `{
    "id": "$ctx.args.userId",
    "roomId": "$ctx.args.roomId"
  }`
});

// participantLeft mutation - used by stream lambda to publish a subscription event
appsyncApi.addResolver("Mutation participantLeft", {
  dataSource: "noneDS",
  requestTemplate: `{
    "version": "2017-02-28",
    "payload": $util.toJson($ctx.args)
  }`,
  responseTemplate: `{
    "id": "$ctx.args.userId",
    "roomId": "$ctx.args.roomId",
    "username": #if($ctx.args.username)"$ctx.args.username"#else "User"#end
  }`
});

// debug resolver removed

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
    "operation": "UpdateItem",
    "key": {
      "pk": { "S": "ROOM#$ctx.args.roomId" },
      "sk": { "S": "META" }
    },
    "update": {
      "expression": "SET roomId = if_not_exists(roomId, :rid), revealed = if_not_exists(revealed, :false), #t = if_not_exists(#t, :room)",
      "expressionNames": {"#t": "type"},
      "expressionValues": $util.toJson($util.dynamodb.toMapValues({":rid": "$ctx.args.roomId", ":false": false, ":room": "ROOM"}))
    },
    
  }`,
  responseTemplate: `{
    "id": "$ctx.args.roomId",
    "roomId": "$ctx.args.roomId",
    "revealed": #if($ctx.result && $ctx.result.revealed)true#else false#end
  }`
});

// Clear a participant's vote
appsyncApi.addResolver("Mutation clearVote", {
  dataSource: "dynamoDS",
  requestTemplate: `{
    "version": "2017-02-28",
    "operation": "UpdateItem",
    "key": {
      "pk": { "S": "ROOM#$ctx.args.roomId" },
      "sk": { "S": "USER#$ctx.args.userId" }
    },
    "update": {
      "expression": "REMOVE vote"
    }
  }`,
  responseTemplate: `{
    "id": "$ctx.args.userId",
    "roomId": "$ctx.args.roomId",
    "username": #if($ctx.result.username)"$ctx.result.username"#else "User"#end,
    "vote": null
  }`
});

// Kick a participant (delete user entry)
appsyncApi.addResolver("Mutation kick", {
  dataSource: "dynamoDS",
  requestTemplate: `{
    "version": "2017-02-28",
    "operation": "DeleteItem",
    "key": {
      "pk": { "S": "ROOM#$ctx.args.roomId" },
      "sk": { "S": "USER#$ctx.args.userId" }
    }
  }`,
  responseTemplate: `{
    "id": "$ctx.args.userId",
    "roomId": "$ctx.args.roomId",
    "username": #if($ctx.args.username)"$ctx.args.username"#else "User"#end
  }`
});

// publish participant change (noneDS) - used to broadcast arbitrary participant updates
appsyncApi.addResolver("Mutation publishParticipantChange", {
  dataSource: "noneDS",
  requestTemplate: `{
    "version": "2017-02-28",
    "payload": $util.toJson($ctx.args)
  }`,
  responseTemplate: `{
    "id": "$ctx.args.userId",
    "roomId": "$ctx.args.roomId",
    "username": #if($ctx.args.username)"$ctx.args.username"#else "User"#end,
    "vote": #if($ctx.args.vote)"$ctx.args.vote"#else null#end
  }`
});
