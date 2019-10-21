const vars = require("./vars");

const fs = require("fs");
const crypto = require("crypto");

const request = require("request");

const express = require('express');
const bodyParser = require('body-parser');
const app = express();
app.use(bodyParser.json());


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
    googleAccessTokens = token;
});

let playPublicKey;
fs.readFile("licenseKey","utf8",(err,data)=>{
    if (err) {
        console.warn(err);
        return;
    }
    playPublicKey = data;
    console.log("Read Play Public Key");
})

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
    type += "s";

    console.log(req.body);
    console.log("");


    let purchase = req.body.purchase;
    if (!purchase || typeof purchase !== "string") {
        res.status(400).json({
            success: false,
            msg: "Invalid purchase"
        });
        return;
    }
    purchase = JSON.parse(purchase);// parse string

    let signature = req.body.signature;
    if (!signature || typeof signature !== "string") {
        res.status(400).json({
            success: false,
            msg: "Invalid signature"
        });
        return;
    }

    if ("org.inventivetalent.trashapp" !== purchase.packageName) {
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
    let verifyResult = verifier.verify(playPublicKey, signature,"base64");
    console.log("Crypto Verify: " + verifyResult);


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

    request("https://www.googleapis.com/androidpublisher/v3/applications/org.inventivetalent.trashapp/purchases/" + type + "/" + id + "/tokens/" + token + "?access_token=" + googleAccessTokens.access_token, (err, response, body) => {
        if (err) {
            console.warn(err);
            res.status(500).json({
                success: false,
                msg: "Google API error"
            });
            return;
        }
        console.log(body);

        if (response.statusCode !== 200) {
            console.warn("non-ok status code from google api: " + response.statusCode);
            res.json({
                success: true,
                msg: "Failed to verify purchase",
                isValidPurchase: false
            });
        } else {
            res.json({
                success: true
            })
        }
    });

});


app.listen(port, () => console.log(`TrashAppPurchases listening on port ${ port }!`));

process.on('uncaughtException', function (err) {
    console.log('Caught exception: ');
    console.log(err)
});
