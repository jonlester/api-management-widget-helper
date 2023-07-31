import { useIdentityPlugin, DefaultAzureCredential } from "@azure/identity";
import { vsCodePlugin } from "@azure/identity-vscode";
import { createRestError, getClient } from "@azure-rest/core-client";
const { authorizeRequestOnTenantChallenge } = require("@azure/core-client");
import { bearerTokenAuthenticationPolicy } from "@azure/core-rest-pipeline";
const deployConfig = require("../../deployConfig.json");

import moment from "moment";

useIdentityPlugin(vsCodePlugin);

export declare type ConfigSecrets = {
  managementApiUrl: string;
  apiVersion: string;
  blobStorageUrl: string;
  userId?: string;
  token?: string;
  oauthBearerToken?: string;
};

function getRestClient(url: string, apiVersion: string, scope: string = "") {
  let policies: any = [
    {
      //we rely on a policy to help us acquire a token for the right tenant
      //if the initial call fails because of an issuer/audience tenant mismatch
      //this will use the www-authenticate header in the first response to
      //acquire a token for the corrent tenant.  This is useful when a developer
      //is currently logged into multiple AAD accounts, or is logged into one that
      //isn't the correct one
      policy: bearerTokenAuthenticationPolicy({
        credential: new DefaultAzureCredential(),
        scopes: scope,
        challengeCallbacks: {
          authorizeRequestOnChallenge: authorizeRequestOnTenantChallenge,
        },
      }),
      position: "perCall",
    },
  ];

  return getClient(url, {
    apiVersion: apiVersion,
    additionalPolicies: scope != "" ? policies : undefined,
  });
}

export async function getSecrets(userId: string = "1", developerPortalUrl: string): Promise<ConfigSecrets> {
  const headers = {
    "If-Match": "*",
    "Content-Type": "application/json",
  };

  const devPortalClient = getRestClient(developerPortalUrl, "");

  const portalConfigResponse = await devPortalClient.pathUnchecked("/config.json").get({ headers: headers });

  if (portalConfigResponse.status != "200") {
    createRestError("Error getting config from developer portal.", portalConfigResponse);
  }
  let managementApiUrl: string = portalConfigResponse.body.managementApiUrl;
  let apiVersion: string = portalConfigResponse.body.managementApiVersion;

  //Maximum supported token expiry time is 30 days from the time access token is generated.
  const expiryString = moment.utc(moment()).add(15, "days").format(`YYYY-MM-DD[T]HH:mm:ss.SS`);

  const body = {
    keyType: "primary",
    expiry: expiryString,
  };

  const serviceClient = getRestClient(
    `${deployConfig.serviceInformation.managementApiEndpoint}/${deployConfig.serviceInformation.resourceId}`,
    apiVersion,
    `${deployConfig.serviceInformation.managementApiEndpoint}/.default`,
  );

  const path = `users/${encodeURIComponent(userId)}/token`;
  const userTokenResponse = await serviceClient
    .pathUnchecked(`users/${encodeURIComponent(userId)}/token`)
    .post({ headers: headers, body: JSON.stringify(body) });

  if (userTokenResponse.status != "200") {
    createRestError("Error getting SAS token.", userTokenResponse);
  }

  return Promise.resolve<ConfigSecrets>({
    managementApiUrl: managementApiUrl,
    apiVersion: apiVersion,
    blobStorageUrl: portalConfigResponse.body.blobStorageUrl,
    userId: userId,
    token: userTokenResponse.body.value,
    oauthBearerToken: "", //TODO: resolve this once I have a use for it
  });
}
