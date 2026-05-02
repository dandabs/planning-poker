import { DynamoDBStreamEvent, Context } from 'aws-lambda';
import * as AWS from 'aws-sdk';
import https from 'node:https';
import { Resource } from 'sst';

// Lambda runtime should read AppSync endpoint/key from environment variables.
const APP_SYNC_URL = Resource.PokerApi.url;
const APP_SYNC_KEY = process.env.APPSYNC_API_KEY || "";

async function postGraphQL(query: string, variables: any) {
  if (!APP_SYNC_URL) throw new Error('APPSYNC_URL not set');
  const body = JSON.stringify({ query, variables });

  const url = new URL(APP_SYNC_URL);
  const options: any = {
    hostname: url.hostname,
    path: url.pathname + url.search,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body),
      ...(APP_SYNC_KEY ? { 'x-api-key': APP_SYNC_KEY } : {}),
    },
  };

  return new Promise<void>((resolve, reject) => {
    const req = https.request(options, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (d) => chunks.push(d));
      res.on('end', () => {
        const data = Buffer.concat(chunks).toString();
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          resolve();
        } else {
          reject(new Error(`GraphQL call failed (${res.statusCode}): ${data}`));
        }
      });
    });
    req.on('error', (e) => reject(e));
    req.write(body);
    req.end();
  });
}

export const handler = async (event: DynamoDBStreamEvent, _ctx: Context) => {
  const converter = AWS.DynamoDB.Converter;

  for (const record of event.Records || []) {
    try {
      if (record.eventName === 'REMOVE' && record.dynamodb?.OldImage) {
        // Use loose typing to avoid compiler errors related to aws-sdk typings
        const old = converter.unmarshall(record.dynamodb.OldImage as any) as any;
        const roomId = old?.roomId;
        const userId = old?.userId;
        const username = old?.username;

        const mutation = `mutation ParticipantLeft($roomId: ID!, $userId: ID!, $username: String) { participantLeft(roomId: $roomId, userId: $userId, username: $username) { id roomId username } }`;

        await postGraphQL(mutation, { roomId, userId, username });
      }
    } catch (err) {
      console.error('Failed to handle stream record', err);
    }
  }
};
