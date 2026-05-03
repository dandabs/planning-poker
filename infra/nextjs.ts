import { appsyncApi, appsyncApiKey } from "./appsync";
import { pokerTable } from "./dynamodb";

export const frontend = new sst.aws.Nextjs("Frontend", {
  path: "packages/frontend",
  link: [pokerTable, appsyncApi],
  environment: {
    NEXT_PUBLIC_APPSYNC_API_URL: appsyncApi.url,
    NEXT_PUBLIC_APPSYNC_API_KEY: appsyncApiKey.key,
    POKER_TABLE_NAME: pokerTable.name,
  },
  domain: $app.stage === "prod" ?  {
    name: "poker.dsk.is",
    dns: sst.cloudflare.dns()
  } : undefined
});
