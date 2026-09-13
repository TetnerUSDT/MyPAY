import { test } from "node:test";
import assert from "node:assert/strict";
import { requireSuperAdmin } from "../src/admin-middleware";

function basicAuth(username: string, password: string) {
  return `Basic ${Buffer.from(`${username}:${password}`, "utf8").toString("base64")}`;
}

function responseMock() {
  let statusCode = 200;
  let body: unknown;

  return {
    get statusCode() {
      return statusCode;
    },
    get body() {
      return body;
    },
    status(code: number) {
      statusCode = code;
      return this;
    },
    json(value: unknown) {
      body = value;
      return this;
    },
  };
}

test("super admin auth compares parsed credentials, including colon in password", async () => {
  const previousLogin = process.env.ADMIN_LOGIN;
  const previousPassword = process.env.ADMIN_PASSWORD;

  process.env.ADMIN_LOGIN = "test-admin";
  process.env.ADMIN_PASSWORD = "secret:with:colons";

  try {
    const response = responseMock();
    let nextCalled = false;

    await requireSuperAdmin(
      {
        headers: {
          authorization: basicAuth("test-admin", "secret:with:colons"),
        },
      } as never,
      response as never,
      () => {
        nextCalled = true;
      },
    );

    assert.equal(nextCalled, true);
    assert.equal(response.statusCode, 200);
  } finally {
    if (previousLogin === undefined) delete process.env.ADMIN_LOGIN;
    else process.env.ADMIN_LOGIN = previousLogin;

    if (previousPassword === undefined) delete process.env.ADMIN_PASSWORD;
    else process.env.ADMIN_PASSWORD = previousPassword;
  }
});