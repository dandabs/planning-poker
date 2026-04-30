export const pokerTable = new sst.aws.Dynamo("PokerTable", {
  fields: {
    pk: "string",
    sk: "string",
  },
  primaryIndex: { hashKey: "pk", rangeKey: "sk" },
  stream: "new-and-old-images",
});
