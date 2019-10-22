const vars = require("./vars");

const fs = require("fs");
const crypto = require("crypto");

const request = require("request");

const express = require('express');
const bodyParser = require('body-parser');
const app = express();
app.use(bodyParser.json());

const PACKAGE = "org.inventivetalent.trashapp";

const PRODUCT_PURCHASE = "androidpublisher#productPurchase";
const SUBSCRIPTION_PURCHASE = "androidpublisher#subscriptionPurchase";

const YET_TO_BE_ACKNOWLEDGED_OR_CONSUMED = 0;
const ACKNOWLEDGED_OR_CONSUMED = 1;

const PURCHASED = 0;
const CANCELED = 1;
const PENDING = 2;

// https://developers.google.com/android-publisher/api-ref/purchases/subscriptions#paymentState
const PAYMENT_PENDING = 0;
const PAYMENT_RECEIVED = 1;
const FREE_TRIAL = 2;
const PENDING_DEFERRED = 3;

const TEST = 0;
const PROMO = 1;
const REWARDED = 2;


const googleapis = require("googleapis");
const google = googleapis.google;

const oauth2Client = new google.auth.OAuth2(
    vars.oauth.id,
    vars.oauth.secret,
    vars.oauth.url
);

let googleAccessTokens;

fs.readFile("googleTokens.json", "utf8", (err, data) => {
    if (err) {
        console.warn(err);
        return;
    }
    googleAccessTokens = JSON.parse(data);
    console.log(googleAccessTokens)

    oauth2Client.setCredentials({
        refresh_token: googleAccessTokens.refresh_token
    });

    console.log("Previous google tokens loaded");
});

oauth2Client.on('tokens', (tokens) => {
    if (tokens.refresh_token) {
        // store the refresh_token in my database!
        console.log(tokens.refresh_token);
        fs.writeFile("googleTokens.json", JSON.stringify(tokens), "utf8", () => {
        })
    }
    console.log("New Access Token:");
    console.log(tokens.access_token);
    googleAccessTokens = tokens;
});

let playPublicKey;
fs.readFile("licenseKeyWithHeader", "utf8", (err, data) => {
    if (err) {
        console.warn(err);
        return;
    }
    playPublicKey = data;
    console.log("Read Play Public Key");
});

const androidPublisher = google.androidpublisher({
    version: "v3",
    auth: oauth2Client
});

// let swStats = require('swagger-stats');
// app.use(swStats.getMiddleware(vars.swagger));

const port = 8789;


app.get('/', (req, res) => {
    res.send("Hello World");
});


app.post("/verifyInAppPurchase/:type/:sub", (req, res) => {
    let type = req.params.type;
    if (type !== "subscription" && type !== "product") {
        res.status(400).json({
            success: false,
            msg: "invalid request"
        });
        return;
    }
    let id = req.params.sub;

    console.log("");
    console.log("[VERIFY] " + type + "/" + id);
    // type += "s";

    console.log(req.body);
    console.log("");


    let purchase = req.body.purchase;
    if (!purchase || typeof purchase !== "string") {
        res.status(400).json({
            success: false,
            msg: "Invalid purchase"
        });
        console.warn("Invalid Purchase");
        return;
    }
    purchase = JSON.parse(purchase);// parse string

    let signature = req.body.signature;
    if (!signature || typeof signature !== "string") {
        res.status(400).json({
            success: false,
            msg: "Invalid signature"
        });
        console.warn("Invalid Signature");
        return;
    }

    if (PACKAGE !== purchase.packageName) {
        console.warn("Not TrashApp!");
        res.status(400).json({
            success: false,
            msg: "Invalid package"
        });
        return;
    }

    if (purchase.productId !== id) {
        console.log(purchase.productId + " != " + id);
        res.status(400).json({
            success: false,
            msg: "product mismatch"
        });
        return;
    }


    //// Signature validation

    let verifier = crypto.createVerify("RSA-SHA1");
    verifier.update(req.body.purchase);
    let verifyResult = verifier.verify(playPublicKey, signature, "base64");
    console.log("Crypto Verify: " + verifyResult);

    if (!verifyResult) {
        res.status(400).json({
            success: false,
            msg: "Could not verify signature"
        });
        console.warn("Could not verify signature");
        return;
    }

    //// API calls

    if (!googleAccessTokens || !googleAccessTokens.access_token) {
        console.warn("Google tokens not ready");
        res.status(500).json({
            success: false,
            msg: "Google API not ready"
        });
        return;
    }


    let token = purchase.purchaseToken;
    let wasAcknowledged = purchase.acknowledged;

    let getCallback = (getResponse) => {
        // console.log(JSON.stringify(getResponse));
        let getBody = getResponse.data;
        console.log(getBody);
        /*
         {
          "kind": "androidpublisher#productPurchase",
          "purchaseTimeMillis": long,
          "purchaseState": integer,
          "consumptionState": integer,
          "developerPayload": string,
          "orderId": string,
          "purchaseType": integer,
          "acknowledgementState": integer
        }


        {
          "kind": "androidpublisher#subscriptionPurchase",
          "startTimeMillis": long,
          "expiryTimeMillis": long,
          "autoResumeTimeMillis": long,
          "autoRenewing": boolean,
          "priceCurrencyCode": string,
          "priceAmountMicros": long,
          "introductoryPriceInfo": {
            "introductoryPriceCurrencyCode": string,
            "introductoryPriceAmountMicros": long,
            "introductoryPricePeriod": string,
            "introductoryPriceCycles": integer
          },
          "countryCode": string,
          "developerPayload": string,
          "paymentState": integer,
          "cancelReason": integer,
          "userCancellationTimeMillis": long,
          "cancelSurveyResult": {
            "cancelSurveyReason": integer,
            "userInputCancelReason": string
          },
          "orderId": string,
          "linkedPurchaseToken": string,
          "purchaseType": integer,
          "priceChange": {
            "newPrice": {
              "priceMicros": string,
              "currency": string
            },
            "state": integer
          },
          "profileName": string,
          "emailAddress": string,
          "givenName": string,
          "familyName": string,
          "profileId": string,
          "acknowledgementState": integer
        }
         */

        if (getBody.orderId !== purchase.orderId) {
            res.json({
                success: false,
                msg: "Order ID mismatch",
                isValidPurchase: false
            });
            console.warn("Order ID mismatch");
            return;
        }
        console.log("Order ID:  " + getBody.orderId);

        if (getBody.kind === PRODUCT_PURCHASE && type === "product") {
            if (getBody.purchaseState !== PURCHASED) {
                res.status(400).json({
                    success: true,
                    msg: "State is not PURCHASED",
                    purchased: false,
                    isValidPurchase: false
                });
                console.warn("Not PURCHASED");
                return;
            }
            console.log("Purchase Time: " + new Date(parseInt(getBody.purchaseTimeMillis)))
        } else if (getBody.kind === SUBSCRIPTION_PURCHASE && type === "subscription") {
            if (getBody.paymentState !== PAYMENT_RECEIVED) {
                res.status(400).json({
                    success: true,
                    msg: "State is not PAYMENT_RECEIVED",
                    purchased: false,
                    isValidPurchase: false
                });
                console.warn("Not PAYMENT_RECEIVED");
                return;
            }
            console.log("Start Time: " + new Date(parseInt(getBody.startTimeMillis)))
            console.log("Expiry Time: " + new Date(parseInt(getBody.expiryTimeMillis)))
        } else {
            res.status(400).json({
                success: false,
                msg: "Invalid type",
                purchased: false,
                isValidPurchase: false
            });
            return;
        }

        let purchaseType = "REGULAR";
        if (getBody.hasOwnProperty("purchaseType")) {
            if (getBody.purchaseType === TEST) {
                purchaseType = "TEST";
            }
            if (getBody.purchaseType === PROMO) {
                purchaseType = "PROMO";
            }
            if (getBody.purchaseType === REWARDED) {
                purchaseType = "REWARDED";
            }
        }
        console.log("Purchase Type: " + purchaseType);

        if (getBody.acknowledgementState !== ACKNOWLEDGED_OR_CONSUMED && getBody.consumptionState !== ACKNOWLEDGED_OR_CONSUMED) {
            console.log("Acknowledging/Consuming purchase...");

            let acknowledgeCallback = (acknowledgeResponse) => {
                console.log(JSON.stringify(acknowledgeResponse));
                let acknowledgeBody = acknowledgeResponse.data;// should be empty if successful
                if (!acknowledgeBody || acknowledgeBody.length === 0) {
                    console.log("Purchase Acknowledged");

                    res.json({
                        success: true,
                        purchased: getBody.purchaseState === PURCHASED||getBody.paymentState===PAYMENT_RECEIVED,
                        wasAcknowledged: wasAcknowledged,
                        acknowledgedOrConsumed: true,
                        isValidPurchase: getBody.purchaseState === PURCHASED||getBody.paymentState===PAYMENT_RECEIVED,
                        expired: false,
                        sku: id
                    });
                    ///DONE
                    console.log("[VERIFY] DONE!");
                    console.log("");
                    return;
                } else {
                    console.warn("AcknowledgeBody was not empty");
                    console.warn(acknowledgeBody);
                    res.status(400).json({
                        success: false,
                        msg: "Could not acknowledge purchase"
                    });
                    return;
                }
            };

            if ("product" === type) {
                androidPublisher.purchases.products.acknowledge({
                    packageName: PACKAGE,
                    productId: id,
                    token: token
                }).then(acknowledgeCallback).catch(err => {
                    console.warn(err);
                    res.status(500).json({
                        success: false,
                        msg: "Google API error"
                    });
                });
            } else if ("subscription" === type) {
                androidPublisher.purchases.subscriptions.acknowledge({
                    packageName: PACKAGE,
                    subscriptionId: id,
                    token: token
                }).then(acknowledgeCallback).catch(err => {
                    console.warn(err);
                    res.status(500).json({
                        success: false,
                        msg: "Google API error"
                    });
                });
            } else {
                res.status(400).json({
                    success: false,
                    msg: "invalid type"
                });
                return;
            }

        } else {// Already acknowledged/consumed
            console.log("Already acknowledged");
            res.json({
                success: true,
                purchased: getBody.purchaseState === PURCHASED||getBody.paymentState===PAYMENT_RECEIVED,
                wasAcknowledged: wasAcknowledged,
                acknowledgedOrConsumed: true,
                isValidPurchase: (getBody.purchaseState === PURCHASED||getBody.paymentState===PAYMENT_RECEIVED) && (getBody.acknowledgementState === ACKNOWLEDGED_OR_CONSUMED || getBody.consumptionState === ACKNOWLEDGED_OR_CONSUMED),
                expired: false,
                sku: id
            });
            ///DONE
            console.log("[VERIFY] DONE!");
            console.log("");
            return;
        }

    };

    /*
    {
        purchase: string,
        signature: string
    }

   {
       "orderId":"GPA.3307-7413-6870-76472",
       "packageName":"org.inventivetalent.trashapp",
       "productId":"premium",
       "purchaseTime":1559207727270,
       "purchaseState":0,
       "purchaseToken":"inoooflaglepchekkmgcggmo.AO-.....ypTkaIv9-8orCpfC",
       "acknowledged":false
   }

     */

    if ("product" === type) {
        androidPublisher.purchases.products.get({
            packageName: PACKAGE,
            productId: id,
            token: token
        }).then(getCallback).catch(err => {
            console.warn(err);
            res.status(500).json({
                success: false,
                msg: "Google API error"
            });
        });
    } else if ("subscription" === type) {
        androidPublisher.purchases.subscriptions.get({
            packageName: PACKAGE,
            subscriptionId: id,
            token: token
        }).then(getCallback).catch(err => {
            console.warn(err);
            res.status(500).json({
                success: false,
                msg: "Google API error"
            });
        });
    } else {
        res.status(400).json({
            success: false,
            msg: "invalid type"
        });
        return;
    }

});


app.listen(port, () => console.log(`TrashAppPurchases listening on port ${ port }!`));

process.on('uncaughtException', function (err) {
    console.log('Caught exception: ');
    console.log(err)
});
