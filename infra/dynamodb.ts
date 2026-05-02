export const pokerTable = new sst.aws.Dynamo("PokerTable", {
  fields: {
    pk: "string",
    sk: "string",
  },
  primaryIndex: { hashKey: "pk", rangeKey: "sk" },
  // keep streams for detecting deletes (old images)
  stream: "new-and-old-images",
  // enable DynamoDB TTL attribute
  ttl: "expiresAt",
});
