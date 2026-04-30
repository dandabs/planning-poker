import { appsyncApi, appsyncApiKey } from "./appsync";

export const frontend = new sst.aws.Nextjs("Frontend", {
  path: "packages/frontend",
  environment: {
    NEXT_PUBLIC_APPSYNC_API_URL: appsyncApi.url,
    NEXT_PUBLIC_APPSYNC_API_KEY: appsyncApiKey.key,
  }
});
