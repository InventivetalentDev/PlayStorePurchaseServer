const vars = require("./vars");

const fs = require("fs");

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

fs.readFile("googleTokens.json","utf8",(err,data)=>{
    if (err) {
        console.warn(err);
        return;
    }
    googleAccessTokens = JSON.parse(data);

    oauth2Client.setCredentials({
        refresh_token: googleAccessTokens.refresh_token
    });

    console.log("Previous google tokens loaded");
});

oauth2Client.on('tokens', (tokens) => {
    if (tokens.refresh_token) {
        // store the refresh_token in my database!
        console.log(tokens.refresh_token);
        fs.writeFile("googleTokens.json",JSON.stringify(tokens),"utf8",()=>{
        })
    }
    console.log("New Access Token:");
    console.log(tokens.access_token);
    googleAccessTokens = token;
});

// let swStats = require('swagger-stats');
// app.use(swStats.getMiddleware(vars.swagger));

const port = 8789;


app.get('/', (req, res) => {
    res.send("Hello World");
});


app.post("/verifyInAppPurchase/:type/:sub", (req, res) => {
    let type = req.params.type;
    if (type !== "subscription"&&type!=="product") {
        res.status(400).json({
            success: false,
            msg:"invalid request"
        });
        return;
    }
    let id = req.params.sub;
    let token = req.body.token;

    console.log("[VERIFY] " + type + "/" + id + " (" + token + ")");
    type += "s";

    if (!googleAccessTokens || !googleAccessTokens.access_token) {
        console.warn("Google tokens not ready");
        res.status(500).json({
            success:false,
            msg:"Google API not ready"
        });
        return;
    }

    request("https://www.googleapis.com/androidpublisher/v3/applications/org.inventivetalent.trashapp/purchases/"+type+"/" + id + "/tokens/" + token+"?access_token="+googleAccessTokens.access_token, (err, response, body) => {
        if (err) {
            console.warn(err);
            res.status(500).json({
                success:false,
                msg: "Google API error"
           });
            return;
        }
        console.log(JSON.stringify(body, null, 2));

        if (response.statusCode !== 200) {
            console.warn("non-ok status code from google api: "+response.statusCode);
            res.json({
                success:true,
                msg: "Failed to verify purchase"
            });
        }else{
            res.json({
                success:true
            })
        }
    });

});


app.listen(port, () => console.log(`TrashAppPurchases listening on port ${ port }!`));

process.on('uncaughtException', function (err) {
    console.log('Caught exception: ');
    console.log(err)
});
