// adapt this to the database schema and helpers if necessary
import { db } from "../../helpers/db";
import { schema } from "./register_with_password_POST.schema";
import { randomBytes, createHash } from "crypto";
import {
  setServerSession,
  SessionExpirationSeconds,
} from "../../helpers/getSetServerSession";
import { generatePasswordHash } from "../../helpers/generatePasswordHash";
import superjson from "superjson";
import { addDuration } from "../../helpers/couponRules";

export async function handle(request: Request) {
  try {
    const json = superjson.parse(await request.text());
    const { email, password, displayName, ownerSetupCode, couponCode } = schema.parse(json);

    // Check if email already exists
    const existingUser = await db
      .selectFrom("users")
      .select("id")
      .where("email", "=", email)
      .limit(1)
      .execute();

    if (existingUser.length > 0) {
      return new Response(
        superjson.stringify({ message: "email already in use" }),
        {
          status: 409,
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
    }

    const passwordHash = await generatePasswordHash(password);


    // Create new user
    const newUser = await db.transaction().execute(async (trx) => {
      const reserved = await trx.selectFrom("ownerSetup").selectAll().where("email","=",email).forUpdate().executeTakeFirst();
      let newRole: "admin" | "user" = "user";
      if (reserved) {
        if (reserved.claimedAt || reserved.expiresAt < new Date() || !ownerSetupCode ||
          createHash("sha256").update(ownerSetupCode).digest("hex") !== reserved.tokenHash) throw new Error("Use your private owner setup link to register this reserved email.");
        newRole = "admin";
        await trx.updateTable("ownerSetup").set({claimedAt:new Date()}).where("email","=",email).execute();
      } else if (ownerSetupCode) throw new Error("The owner setup code does not match this email.");
      // Insert the user
      const [user] = await trx
        .insertInto("users")
        .values({
          email,
          displayName,
          role: newRole,
        })
        .returning(["id", "email", "displayName", "createdAt", "avatarUrl", "role"])
        .execute();

      // Store the password hash in another table
      await trx
        .insertInto("userPasswords")
        .values({
          userId: user.id,
          passwordHash,
        })
        .execute();

      // Every new member starts with a 30-day Copilot trial so they can
      // experience the full intelligence layer before choosing a paid trim.
      await trx
        .insertInto("userMemberships")
        .values({
          userId: user.id,
          tier: "copilot",
          status: "trial",
        })
        .execute();

      await trx
        .insertInto("riskProfiles")
        .values({
          userId: user.id,
          maxRiskPerTrade: 10,
          maxDailyLoss: 30,
          maxTradesPerDay: 3,
          longOnly: true,
          requireGreenConfirmation: true,
          noChaseEnabled: true,
          safeModeEnabled: true,
          dayTradeFlatTimePt: "12:30",
        })
        .execute();

      await trx
        .insertInto("userWorkspaces")
        .values([
          {
            userId: user.id,
            name: "Morning Hunt",
            kind: "morning_hunt",
            defaultAssetClass: "mixed",
            layoutMode: "copilot",
            quietMode: false,
            isDefault: true,
            config: {},
          },
          {
            userId: user.id,
            name: "Day Trader",
            kind: "day_trader",
            defaultAssetClass: "stocks",
            layoutMode: "copilot",
            quietMode: false,
            isDefault: false,
            config: {},
          },
          {
            userId: user.id,
            name: "CueCrypto 24/7",
            kind: "crypto_24_7",
            defaultAssetClass: "crypto",
            layoutMode: "copilot",
            quietMode: true,
            isDefault: false,
            config: {},
          },
        ])
        .execute();

      if (couponCode) {
        const coupon = await trx
          .selectFrom("membershipCoupons")
          .selectAll()
          .where("code", "=", couponCode)
          .forUpdate()
          .executeTakeFirst();

        if (!coupon || !coupon.active || coupon.redeemBy <= new Date()) {
          throw new Error("That coupon code is invalid, disabled, or expired.");
        }
        if (coupon.kind !== "free_access") {
          throw new Error("Percentage-discount coupons are applied from Membership after account creation.");
        }

        const used = await trx
          .selectFrom("couponRedemptions")
          .select((eb) => eb.fn.countAll<string>().as("count"))
          .where("couponId", "=", coupon.id)
          .where("status", "in", ["redeemed", "reserved"])
          .executeTakeFirstOrThrow();

        if (Number(used.count) >= coupon.maxRedemptions) {
          throw new Error("That coupon code has reached its redemption limit.");
        }

        const accessExpiresAt = addDuration(new Date(), coupon.durationValue, coupon.durationUnit);
        await trx
          .insertInto("couponRedemptions")
          .values({
            couponId: coupon.id,
            userId: user.id,
            status: "redeemed",
            accessExpiresAt,
            redeemedAt: new Date(),
          })
          .execute();

        await trx
          .insertInto("cueAuditLog")
          .values({
            userId: user.id,
            action: "coupon_redeemed_at_signup",
            entityType: "coupon",
            entityId: coupon.id,
            details: {
              code: coupon.code,
              tier: coupon.tier,
              accessExpiresAt: accessExpiresAt.toISOString(),
            },
          })
          .execute();
      }

      return user;
    });

    // Create a new session
    const sessionId = randomBytes(32).toString("hex");
    const now = new Date();
    const expiresAt = new Date(now.getTime() + SessionExpirationSeconds * 1000);

    await db
      .insertInto("sessions")
      .values({
        id: sessionId,
        userId: newUser.id,
        createdAt: now,
        lastAccessed: now,
        expiresAt,
      })
      .execute();

    // Create response with user data
    const response = new Response(
      superjson.stringify({
        user: newUser,
      }),
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    // Set session cookie
    await setServerSession(response, {
      id: sessionId,
      createdAt: now.getTime(),
      lastAccessed: now.getTime(),
    });

    return response;
  } catch (error: unknown) {
    console.error("Registration error:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Registration failed";
    return new Response(
      superjson.stringify({ message: errorMessage }),
      {
        status: 400,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  }
}
