const vars = require("./vars");

const request = require("request");

const express = require('express');
const bodyParser = require('body-parser');
const app = express();
app.use(bodyParser.json());

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
    console.log("[VERIFY] " + type + "/" + id + " (" + token + ")");
    type += "s";

    let id = req.params.sub;
    let token = req.body.token;

    request("https://www.googleapis.com/androidpublisher/v3/applications/org.inventivetalent.trashapp/purchases/"+type+"/" + id + "/tokens/" + token, (err, response, body) => {
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
    })

});


app.listen(port, () => console.log(`TrashAppPurchases listening on port ${ port }!`));

process.on('uncaughtException', function (err) {
    console.log('Caught exception: ');
    console.log(err)
});
