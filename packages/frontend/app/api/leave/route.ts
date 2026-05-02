import { NextResponse } from 'next/server';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, DeleteCommand } from '@aws-sdk/lib-dynamodb';

const POKER_TABLE_NAME = process.env.POKER_TABLE_NAME || '';

const ddbClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(ddbClient);

export async function POST(req: Request) {
  try {
    const text = await req.text();
    let payload: any;
    try {
      payload = JSON.parse(text);
    } catch {
      payload = text ? JSON.parse(decodeURIComponent(text)) : {};
    }

    console.debug('[leave route] received payload:', JSON.stringify(payload));

    const { roomId, userId } = payload;
    if (!roomId || !userId) {
      return new NextResponse('missing roomId or userId', { status: 400 });
    }

    try {
      await docClient.send(new DeleteCommand({
        TableName: POKER_TABLE_NAME,
        Key: {
          pk: `ROOM#${roomId}`,
          sk: `USER#${userId}`,
        },
      }));
      console.debug('[leave route] deleted item from DynamoDB', roomId, userId);
    } catch (err) {
      console.warn('[leave route] failed to delete item', err);
    }

    return NextResponse.json({ status: 'ok' });
  } catch (err) {
    console.error('[leave route] unexpected error', err);
    return new NextResponse('Error', { status: 500 });
  }
}
